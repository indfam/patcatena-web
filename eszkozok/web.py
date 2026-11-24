#!/usr/bin/env python3
"""A patcatena webes keresőjének (statikus oldal) felépítése.

Két kereső készül ugyanabból a kódból (a művek besorolása: eszkozok/kategoria.py):
  Kommentár-kereső            a kifejezetten szentírás-magyarázó művek; bibliai hely, szöveg, szerző és mű szerint
  Patrisztikus források       az összes többi patrisztikus mű; szerző és mű szerint, illetve szöveg szerint

Használat:  python3 eszkozok/web.py _site                      (Kommentár-kereső)
            python3 eszkozok/web.py _site/forrasok --kor forras (Patrisztikus források keresője)
            eszkozok/web_pagefind.sh _site ; eszkozok/web_pagefind.sh _site/forrasok   (szöveges keresőindexek)

Kimenet:
  index.html, app.js, style.css           a kereső felülete (a web/ mappából)
  data/katalogus.json                     a művek adatai (szerző, cím, kiadás, licenc, link)
  data/konyvek.json                       a bibliai könyvek listája
  data/biblia/<könyv>.json                Vulgata- és LXX-szöveg + idéző szakaszok versenként
  data/sz/<mű>/<darab>.json               a szakaszok szövege, kb. 60 KB-os darabokban
  data/refs/<mű>.json                     a mű helyei sorrendben, darabszámmal (böngészéshez, helyre ugráshoz)
  <kimenet>_pagefind/<n>/                 szakaszonként egy HTML-lap a Pagefind-indexeléshez, részindexenként
                                          (utána törölhető); a részindexek száma: data/web.json

Csak nyílt licencű (Creative Commons) szövegek kerülnek a kimenetbe; a felhasználó saját katalógusa
(oszovetsegi_kommentarok.xlsx) nem.
"""
import csv, html, json, os, shutil, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kategoria import kategoria
from collections import defaultdict

GYOKER = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
csv.field_size_limit(10**9)
DARAB = 60_000  # bájt / szövegdarab
RESZINDEX = 20_000_000  # bájt szöveg / Pagefind-részindex (a memóriaigény miatt)

KONYVEK = ('Ter Kiv Lev Szám MTörv Józs Bír Rut 1Sám 2Sám 1Kir 2Kir 1Krón 2Krón Ezd Neh Ezd-Neh 3Ezd Tób Jud Eszt '
           '1Mak 2Mak 3Mak 4Mak Jób Zsolt Ódák Péld Préd Én Bölcs Sir SalZsolt Iz Jer Siral Bár Ez Dán Dán-Theod '
           'Dán-Zsuzs Dán-Zsuzs-Theod Dán-Bel Dán-Bel-Theod Oz Jo Ám Abd Jón Mik Náh Hab Szof Agg Zak Mal '
           'Mt Mk Lk Jn ApCsel Róm 1Kor 2Kor Gal Ef Fil Kol 1Tessz 2Tessz 1Tim 2Tim Tit Filem Zsid Jak 1Pt 2Pt '
           '1Jn 2Jn 3Jn Júd Jel').split()
# Egy szakasz HTML-lapja a Pagefind-indexeléshez. Minden lap „la” nyelvű: így egyetlen, szótövezés nélküli index
# készül, amelyben latin, görög és modern nyelvű szöveg együtt kereshető (a görög ékezeteket a Pagefind elhagyja).
LAP = ('<!doctype html><html lang="la"><head><meta charset="utf-8"><title>{m}/{d}</title></head><body>'
       '<p data-pagefind-body>{t}</p><span data-pagefind-meta="m:{m}"></span><span data-pagefind-meta="d:{d}"></span>'
       '<span data-pagefind-meta="r:{r}"></span><span data-pagefind-filter="szerzo:{sz}"></span>'
       '<span data-pagefind-filter="nyelv:{ny}"></span></body></html>')
NYELV = {'lat': 'latin', 'grc': 'görög', 'eng': 'angol', 'deu': 'német', 'syc': 'szír'}


# A webes keresőből kihagyott szerzők (a könyvtárban megmaradnak). Philón zsidó szerző, nem egyházatya.
KIZART_SZERZOK = {'Alexandriai Philón'}


def nyilt(k):
    """A nyilvános keresőbe kerülhet-e: nyílt licencű, és nem kihagyott szerző."""
    return 'creativecommons.org' in k['licenc'] and k['szerzo'] not in KIZART_SZERZOK


MODOK = {
    'kommentar': {
        'CIM': 'Egyházatyák az Ószövetségről', 'H1': 'Kommentár-kereső',
        'ALCIM': 'Keresés patrisztikus bibliamagyarázatokban, eredeti latin és görög nyelven. Adjon meg egy bibliai '
                 'helyet, és a kereső megmutatja, ki idézi és magyarázza; vagy keressen szavakra, kifejezésekre a szövegekben.',
        'LEIRAS': 'Keresés az egyházatyák szentírás-magyarázó műveiben: ki és hol idéz egy bibliai helyet, '
                  'szöveges keresés latin és görög eredetiben.'},
    'forras': {
        'CIM': 'Patrisztikus források', 'H1': 'Patrisztikus források keresője',
        'ALCIM': 'Az egyházatyák és az ókeresztény írók további művei eredeti nyelven: levelek, értekezések, '
                 'prédikációk, történeti művek, zsinati iratok – szerző, mű és hely szerint vagy szavakra keresve.',
        'LEIRAS': 'Az egyházatyák és az ókeresztény írók műveinek keresője: szerző, mű, hely és szöveg szerint, '
                  'latin és görög eredetiben.'},
}


def jdump(obj, utvonal):
    os.makedirs(os.path.dirname(utvonal), exist_ok=True)
    with open(utvonal, 'w', encoding='utf-8') as o:
        json.dump(obj, o, ensure_ascii=False, separators=(',', ':'))


def jobb_szoveg(ki, kat, muvek):
    """A PL-szövegek összekötése ugyanazon szöveg gondosabb kiadásával (eszkozok/jobb_szoveg.py eredménye).
    A katalógusban: muvek[i]['jobb'] = a célművek listája; data/jobb/<i>.json = {PL-hely: [célmű sorszáma, célhely]}.
    A célmű lehet a másik keresőben is ('oldal'); csak nyílt licencű célmű kerül bele."""
    f = os.path.join(GYOKER, 'katalogus', 'jobb_szoveg.tsv')
    if not os.path.exists(f):
        return
    osszes = {k['urn']: k for k in csv.DictReader(open(os.path.join(GYOKER, 'katalogus', 'korpusz.csv'), encoding='utf-8'))}
    sorszam = {k['urn']: i for i, k in enumerate(kat)}
    parok = {}
    for r in csv.DictReader(open(f, encoding='utf-8'), delimiter='\t'):
        c = osszes.get(r['urn'])
        if r['pl_urn'] in sorszam and c and nyilt(c):
            parok.setdefault(r['pl_urn'], []).append((r['pl_ref'], c, r['ref'], int(r['kozos'])))
    for pl_urn, lista in parok.items():
        i = sorszam[pl_urn]
        celok, cel_i, helyek = [], {}, {}
        for pl_ref, c, ref, kozos in lista:
            if c['urn'] not in cel_i:
                cel_i[c['urn']] = len(celok)
                celok.append({'urn': c['urn'], 'szerzo': c['szerzo'], 'mu': c['mu'], 'kiadas': c['kiadas'],
                              'oldal': kategoria(c), 'db': 0})
            celok[cel_i[c['urn']]]['db'] += 1
            if pl_ref not in helyek or kozos > helyek[pl_ref][2]:
                helyek[pl_ref] = [cel_i[c['urn']], ref, kozos]
        muvek[i]['jobb'] = celok
        jdump({k: v[:2] for k, v in helyek.items()}, os.path.join(ki, 'data', 'jobb', f'{i}.json'))


def main(ki, kor='kommentar'):
    if os.path.exists(ki):
        shutil.rmtree(ki)
    os.makedirs(ki)
    for f in os.listdir(os.path.join(GYOKER, 'web')):
        if f.endswith(('.html', '.js', '.css', '.svg')) and True:
            shutil.copy(os.path.join(GYOKER, 'web', f), ki)
    # Verziójelzés a fájlhivatkozásokban: a böngésző minden építés után az új változatot tölti be
    verzio = time.strftime('%Y%m%d%H%M%S', time.gmtime())
    index_html = os.path.join(ki, 'index.html')
    with open(index_html, encoding='utf-8') as f:
        tartalom = f.read().replace('__VERZIO__', verzio).replace('__MOD__', kor)
        for kulcs, ertek in MODOK[kor].items():
            tartalom = tartalom.replace(f'__{kulcs}__', html.escape(ertek))
    with open(index_html, 'w', encoding='utf-8') as f:
        f.write(tartalom)

    kat = [k for k in csv.DictReader(open(os.path.join(GYOKER, 'katalogus', 'korpusz.csv'), encoding='utf-8')) if nyilt(k) and kategoria(k) == kor]
    muvek, urn2id = [], {}
    hely = {}  # (urn, ref) -> darab
    os.makedirs(os.path.join(ki, 'data'), exist_ok=True)
    pf_forras = ki.rstrip('/') + '_pagefind'
    if os.path.exists(pf_forras):
        shutil.rmtree(pf_forras)
    resz_db, resz_meret = 0, 0
    for i, k in enumerate(kat):
        urn2id[k['urn']] = i
        if resz_meret > RESZINDEX:
            resz_db, resz_meret = resz_db + 1, 0
        darabok, akt, meret = [], [], 0
        with open(os.path.join(GYOKER, k['tsv']), encoding='utf-8') as f:
            for sor in f:
                ref, _, t = sor.rstrip('\n').partition('\t')
                if not t:
                    continue
                if akt and meret + len(t.encode()) > DARAB:
                    darabok.append(akt); akt, meret = [], 0
                akt.append([ref, t]); meret += len(t.encode())
        if akt:
            darabok.append(akt)
        jdump([[ref, d] for d, resz in enumerate(darabok) for ref, _ in resz], os.path.join(ki, 'data', 'refs', f'{i}.json'))
        for d, resz in enumerate(darabok):
            jdump(resz, os.path.join(ki, 'data', 'sz', str(i), f'{d}.json'))
            os.makedirs(os.path.join(pf_forras, str(resz_db), str(i), str(d)), exist_ok=True)
            for j, (ref, t) in enumerate(resz):
                hely.setdefault((k['urn'], ref), d)
                resz_meret += len(t.encode())
                with open(os.path.join(pf_forras, str(resz_db), str(i), str(d), f'{j}.html'), 'w', encoding='utf-8') as o:
                    o.write(LAP.format(t=html.escape(t), m=i, d=d, r=html.escape(ref, quote=True),
                                       sz=html.escape(k['szerzo'], quote=True),
                                       ny=NYELV.get(k['nyelv'], k['nyelv'])))
        muvek.append({'szerzo': k['szerzo'], 'mu': k['mu'], 'nyelv': k['nyelv'], 'tipus': k['tipus'],
                      'kiadas': k['kiadas'], 'licenc': k['licenc'], 'online': k['online'],
                      'forras': k['forraskorpusz'], 'urn': k['urn'], 'darabok': len(darabok)})
    jobb_szoveg(ki, kat, muvek)
    jdump(muvek, os.path.join(ki, 'data', 'katalogus.json'))
    # Szerzők a katalógus (nagyjából időrendi) sorrendjében, csak a ténylegesen meglévők
    meglevo = {m['szerzo'] for m in muvek}
    sorrend = [r['szerzo'] for r in csv.DictReader(open(os.path.join(GYOKER, 'katalogus', 'lefedettseg.csv'), encoding='utf-8'))]
    jdump([s for s in sorrend if s in meglevo] + sorted(meglevo - set(sorrend)), os.path.join(ki, 'data', 'szerzok.json'))

    if kor != 'kommentar':  # a forráskeresőben nincs bibliai helyes keresés
        jdump([], os.path.join(ki, 'data', 'konyvek.json'))
        jdump({'reszindexek': resz_db + 1, 'mod': kor}, os.path.join(ki, 'data', 'web.json'))
        print(f'{len(muvek)} mű, {len(hely)} szakasz -> {ki}')
        return
    # Biblia + idézet-index könyvenként
    biblia = defaultdict(lambda: {'v': {}, 'l': {}, 'i': defaultdict(list)})
    for b, kulcs in (('vulgata', 'v'), ('lxx', 'l')):
        with open(os.path.join(GYOKER, 'biblia', f'{b}.tsv'), encoding='utf-8') as f:
            next(f)
            for sor in f:
                p = sor.rstrip('\n').split('\t')
                if len(p) == 4:
                    biblia[p[0]][kulcs][f'{p[1]}:{p[2]}'] = p[3]
    with open(os.path.join(GYOKER, 'index', 'biblia_idezetek.tsv'), encoding='utf-8') as f:
        next(f)
        for sor in f:
            konyv, fej, vers, bib, _, urn, ref, egy, ossz = sor.rstrip('\n').split('\t')
            if urn not in urn2id or (urn, ref) not in hely:
                continue
            biblia[konyv]['i'][f'{fej}:{vers}'].append([urn2id[urn], ref, hely[(urn, ref)], int(egy), int(ossz), bib[0]])
    konyvek = []
    for konyv in sorted(biblia, key=lambda x: (KONYVEK.index(x) if x in KONYVEK else 999, x)):
        adat = biblia[konyv]
        fejezetek = sorted({int(x.split(':')[0]) for x in list(adat['v']) + list(adat['l']) if x.split(':')[0].isdigit()})
        konyvek.append({'k': konyv, 'fej': len(fejezetek) and max(fejezetek), 'idezet': sum(map(len, adat['i'].values()))})
        jdump({'v': adat['v'], 'l': adat['l'], 'i': adat['i']}, os.path.join(ki, 'data', 'biblia', f'{konyv}.json'))
    jdump(konyvek, os.path.join(ki, 'data', 'konyvek.json'))
    jdump({'reszindexek': resz_db + 1, 'mod': kor}, os.path.join(ki, 'data', 'web.json'))
    print(f'{len(muvek)} mű, {len(hely)} szakasz, {len(konyvek)} bibliai könyv -> {ki}')


if __name__ == '__main__':
    arg = [a for a in sys.argv[1:] if not a.startswith('--')]
    kor = sys.argv[sys.argv.index('--kor') + 1] if '--kor' in sys.argv else 'kommentar'
    arg = [a for a in arg if a != kor]
    main(arg[0] if arg else os.path.join(GYOKER, '_site'), kor)
