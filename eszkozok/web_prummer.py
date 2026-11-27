#!/usr/bin/env python3
"""Prümmer-kereső: Dominicus M. Prümmer O.P., Vademecum theologiae moralis (5. kiadás, Freiburg 1941) –
a margószámok szerinti tételek javított latin szövege és saját magyar fordítása, a könyv szerkezetével.

Bemenet: szovegek/prummer/vademecum_latin.tsv (szerkezet + gépi OCR, eszkozok/prummer.py),
forditas/NNN.tsv (javított latin + magyar; ami még nincs lefordítva, az OCR-szöveggel, jelölve kerül be),
reszek_hu.tsv (traktátusok magyar címe), targyszotar.tsv (magyar tárgyszó → latin keresőszavak).
A jogvédett angol Handbook (Shelton 1956) NEM kerül bele.
Kimenet: index.html, pr.js, style.css, data/tetelek.json, data/szerkezet.json, data/targyszotar.json és
<kimenet>_pagefind/0/ (tételenként egy lap). Használat: python3 eszkozok/web_prummer.py _site/prummer ; web_pagefind.sh
"""
import csv, glob, html, json, os, re, shutil, sys, time

GY = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = os.path.join(GY, 'szovegek', 'prummer')
csv.field_size_limit(10 ** 9)
LABLEC = re.compile(r'¶?\s*Pr\S{1,6}er,\s*Vademecum theol\.?\s*moralis\.?\s*\S*\s*(?=¶|$)')
LAP = ('<!doctype html><html lang="hu"><head><meta charset="utf-8"><title>{n}</title></head><body>'
       '<div data-pagefind-body><h1 data-pagefind-meta="cim">{cim}</h1><p>{t}</p></div>'
       '<span data-pagefind-meta="n:{n}"></span><span data-pagefind-filter="traktatus:{tr}"></span>'
       '<span data-pagefind-filter="allapot:{al}"></span></body></html>')


def tsv(ut):
    return list(csv.DictReader(open(ut, encoding='utf-8'), delimiter='\t'))


def jdump(obj, ut):
    os.makedirs(os.path.dirname(ut), exist_ok=True)
    with open(ut, 'w', encoding='utf-8') as o:
        json.dump(obj, o, ensure_ascii=False, separators=(',', ':'))


def cimek(s):
    return re.findall(r'\[([^\]]+)\]', s)


SZINTEK = [(1, r'^TRACTATUS\b'), (2, r'^SECTIO\b'), (3, r'^QUAESTIO\b'), (4, r'^Caput\b'), (5, r'^Art\.'), (6, r'^§')]


def szint_ki(c):
    for k, rx in SZINTEK:
        if re.match(rx, c.strip()): return k
    return None


def norm(c):
    return re.sub(r'[^a-z]', '', c.lower())[:28]


def tisztit(c):
    return re.sub(r'\s+', ' ', c).strip().rstrip('.')


def main(ki):
    if os.path.exists(ki): shutil.rmtree(ki)
    os.makedirs(ki)
    for f in os.listdir(os.path.join(GY, 'web', 'prummer')):
        shutil.copy(os.path.join(GY, 'web', 'prummer', f), ki)
    shutil.copy(os.path.join(GY, 'web', 'style.css'), ki)
    ih = os.path.join(ki, 'index.html')
    tartalom = open(ih, encoding='utf-8').read().replace('__VERZIO__', time.strftime('%Y%m%d%H%M%S'))
    open(ih, 'w', encoding='utf-8').write(tartalom)

    ocr = {int(r['n']): r for r in tsv(os.path.join(P, 'vademecum_latin.tsv'))}
    ford = {}
    for f in sorted(glob.glob(os.path.join(P, 'forditas', '[0-9]*.tsv'))):
        for r in tsv(f):
            ford[int(r['n'])] = r
    trhu = {(r['pars'], int(r['tract'])): r['magyar'] for r in tsv(os.path.join(P, 'reszek_hu.tsv'))}

    tetelek, elozo = [], None
    for n in sorted(set(ocr) | set(ford)):
        s = ocr.get(n) or elozo  # a szétválasztott számok a megelőző tétel helyén állnak
        f = ford.get(n)
        la = f['latin'] if f else LABLEC.sub(' ', s['latin'])
        lap = s['lap'] if s['lap'].isdigit() and s['pdf'].isdigit() and abs(int(s['pdf']) - int(s['lap']) - 21) <= 4 else ''
        tetelek.append({'n': n, 'k': [s['pars'], int(s['tract']), int(s['caput'] or 0), int(s['art'] or 0), int(s['par'] or 0)],
                        'lap': lap, 'pdf': s['pdf'], 'la': la, 'hu': f['magyar'] if f else '', 'ocr': 0 if f else 1})
        if n in ocr: elozo = ocr[n]

    # Szerkezet a címsorok sorrendjéből (a számozásuk az OCR-ben megbízhatatlan): a lefordított részben a fordítás
    # [címsorai] (latin + magyar, a QUAESTIO és SECTIO szinttel), azon túl a vademecum_latin.tsv címváltásai.
    kesz = max(ford)
    esemeny = []  # (kezdő tételszám, szint, latin, magyar)
    sk = ocr.get(kesz) or {}
    utolso_cim = {sz: norm(sk.get(m, '')) for sz, m in ((4, 'caput_cim'), (5, 'art_cim'), (6, 'par_cim'))}
    # (pars, tract) – az OCR traktátusszáma ingadozik, csak az első előfordulás számít
    latott = {(r['pars'], r['tract']) for k, r in ocr.items() if k <= kesz}
    for t in tetelek:
        n = t['n']
        if n <= kesz:
            f = ford.get(n)
            if not f: continue
            la_c, hu_c = cimek(f['latin']), cimek(f['magyar'])
            eleje = f['latin'].lstrip().startswith('[')
            for j, (lc, hc) in enumerate(zip(la_c, hu_c)):
                sz = szint_ki(lc)
                if sz is None: continue
                kezd = n if (eleje and j == 0) else n + 1
                esemeny.append((kezd, sz, tisztit(lc), tisztit(hc)))
        else:
            s = ocr.get(n)
            if not s: continue
            if (s['pars'], s['tract']) not in latott:
                latott.add((s['pars'], s['tract']))
                esemeny.append((n, 1, s['tract_cim'].rstrip('. '), trhu.get((s['pars'], int(s['tract'])), '')))
                utolso_cim.clear()
            for sz, mezo in ((4, 'caput_cim'), (5, 'art_cim'), (6, 'par_cim')):
                kul = norm(s[mezo])
                if kul and kul != utolso_cim.get(sz):
                    esemeny.append((n, sz, s[mezo].rstrip('. '), ''))
                    utolso_cim[sz] = kul
                    for m in (5, 6):
                        if m > sz: utolso_cim.pop(m, None)
    # az első [TRACTATUS] címsor előtti traktátusok (Bevezetés, I., II.) kezdete a vademecum_latin.tsv-ből
    elso_tr = min((x[0] for x in esemeny if x[1] == 1), default=kesz + 1)
    latott = set()
    for t in tetelek:
        s = ocr.get(t['n'])
        if t['n'] >= elso_tr or not s: continue
        if (s['pars'], s['tract']) not in latott:
            latott.add((s['pars'], s['tract']))
            esemeny.append((t['n'], 1, s['tract_cim'].rstrip('. '), trhu.get((s['pars'], int(s['tract'])), '')))
    egyedi = {}
    for x in esemeny: egyedi.setdefault((x[0], x[1]), x)  # a fordítás címsora elsőbbséget kap
    esemeny = sorted(egyedi.values(), key=lambda x: (x[0], x[1]))
    esemeny = [(k, sz, re.sub(r'[\^«»*•]+', '', la).strip(' .,'), hu) for k, sz, la, hu in esemeny]
    pars_of = {t['n']: t['k'][0] for t in tetelek}
    gyoker = {'pars': {}, 'lista': []}
    nyitott = {}  # szint → csúcs
    utolso = max(t['n'] for t in tetelek)
    for kezd, sz, la, hu in esemeny:
        if sz == 1:  # traktátus: magyar címe a reszek_hu.tsv-ből
            s = ocr.get(kezd)
            if s: hu = trhu.get((s['pars'], int(s['tract'])), hu)
            la = re.sub(r'^TRACTATUS\s+[IVXLC]+\.?\s*', '', la)
            hu = re.sub(r'^[IVXLC]+\.\s*TRAKTÁTUS\.?\s*', '', hu)
        cs = {'sz': sz, 'la': la, 'hu': hu, 'tol': kezd, 'ig': kezd, 'gy': []}
        for k in [k for k in nyitott if k >= sz]: del nyitott[k]
        szulo = max((k for k in nyitott if k < sz), default=None)
        if szulo is None:
            p = pars_of.get(kezd, 'I')
            gyoker['pars'].setdefault(p, []).append(cs)
        else:
            nyitott[szulo]['gy'].append(cs)
        nyitott[sz] = cs
    def lezar(lista, veg):
        for i, cs in enumerate(lista):
            cs['ig'] = (lista[i + 1]['tol'] - 1) if i + 1 < len(lista) else veg
            lezar(cs['gy'], cs['ig'])
    parsok = sorted(gyoker['pars'])
    for i, p in enumerate(parsok):
        veg = (gyoker['pars'][parsok[i + 1]][0]['tol'] - 1) if i + 1 < len(parsok) else utolso
        lezar(gyoker['pars'][p], veg)
    szerk = [{'pars': p, 'tr': gyoker['pars'][p]} for p in parsok]
    db_csucs = sum(1 for _ in esemeny)

    tsz = []
    for i, r in enumerate(tsv(os.path.join(P, 'targyszotar.tsv'))):
        tsz.append({'i': i, 'kat': r['kategoria'], 't': r['targyszo'], 'sz': [x for x in r['keresoszavak'].split('|') if x],
                    'la': [x for x in r['latin'].split('|') if x]})
    jdump(tetelek, os.path.join(ki, 'data', 'tetelek.json'))
    jdump({'reszek': szerk, 'kesz': kesz, 'osszes': len(tetelek)}, os.path.join(ki, 'data', 'szerkezet.json'))
    jdump(tsz, os.path.join(ki, 'data', 'targyszotar.json'))

    pf = ki.rstrip('/') + '_pagefind'
    if os.path.exists(pf): shutil.rmtree(pf)
    os.makedirs(os.path.join(pf, '0'))
    for t in tetelek:
        trn = trhu.get((t['k'][0], t['k'][1]), '')
        cim = f"{t['n']}. sz. · {trn}"
        szoveg = re.sub(r'[¶\[\]]', ' ', f"{t['hu']} {t['la']}")
        with open(os.path.join(pf, '0', f"n{t['n']}.html"), 'w', encoding='utf-8') as o:
            o.write(LAP.format(n=t['n'], cim=html.escape(cim), t=html.escape(szoveg), tr=html.escape(trn),
                               al='gépi latin szöveg' if t['ocr'] else 'lefordítva'))
    print(f"{len(tetelek)} tétel ({len(ford)} lefordítva), {db_csucs} szerkezeti egység -> {ki}", file=sys.stderr)


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '_site/prummer')
