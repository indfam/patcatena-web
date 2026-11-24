#!/usr/bin/env python3
"""A patcatena webes keresőjének (statikus oldal) felépítése.

Használat:  python3 eszkozok/web.py [kimeneti_mappa]        (alapértelmezés: _site)
            eszkozok/web_pagefind.sh _site   (szöveges keresőindex, részindexenként)

Kimenet:
  index.html, app.js, style.css           a kereső felülete (a web/ mappából)
  data/katalogus.json                     a művek adatai (szerző, cím, kiadás, licenc, link)
  data/konyvek.json                       a bibliai könyvek listája
  data/biblia/<könyv>.json                Vulgata- és LXX-szöveg + idéző szakaszok versenként
  data/sz/<mű>/<darab>.json               a szakaszok szövege, kb. 60 KB-os darabokban
  <kimenet>_pagefind/<n>/                 szakaszonként egy HTML-lap a Pagefind-indexeléshez, részindexenként
                                          (utána törölhető); a részindexek száma: data/web.json

Csak nyílt licencű (Creative Commons) szövegek kerülnek a kimenetbe; a felhasználó saját katalógusa
(oszovetsegi_kommentarok.xlsx) nem.
"""
import csv, html, json, os, shutil, sys
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


def jdump(obj, utvonal):
    os.makedirs(os.path.dirname(utvonal), exist_ok=True)
    with open(utvonal, 'w', encoding='utf-8') as o:
        json.dump(obj, o, ensure_ascii=False, separators=(',', ':'))


def main(ki):
    if os.path.exists(ki):
        shutil.rmtree(ki)
    os.makedirs(ki)
    for f in os.listdir(os.path.join(GYOKER, 'web')):
        if f.endswith(('.html', '.js', '.css', '.svg')) and True:
            shutil.copy(os.path.join(GYOKER, 'web', f), ki)

    kat = [k for k in csv.DictReader(open(os.path.join(GYOKER, 'katalogus', 'korpusz.csv'), encoding='utf-8')) if nyilt(k)]
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
    jdump(muvek, os.path.join(ki, 'data', 'katalogus.json'))
    # Szerzők a katalógus (nagyjából időrendi) sorrendjében, csak a ténylegesen meglévők
    meglevo = {m['szerzo'] for m in muvek}
    sorrend = [r['szerzo'] for r in csv.DictReader(open(os.path.join(GYOKER, 'katalogus', 'lefedettseg.csv'), encoding='utf-8'))]
    jdump([s for s in sorrend if s in meglevo] + sorted(meglevo - set(sorrend)), os.path.join(ki, 'data', 'szerzok.json'))

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
    jdump({'reszindexek': resz_db + 1}, os.path.join(ki, 'data', 'web.json'))
    print(f'{len(muvek)} mű, {len(hely)} szakasz, {len(konyvek)} bibliai könyv -> {ki}')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else os.path.join(GYOKER, '_site'))
