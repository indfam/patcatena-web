#!/usr/bin/env python3
"""Ott-kereső: Ludwig Ott dogmatikájának tételei (nyilvános váz) – magyar fordítás, angol tételmondat, teológiai
minősítés, Denzinger-hivatkozások, szerkezet. A teljes szöveg (ott_angol.tsv) jogvédett, NEM kerül bele.

Bemenet: szovegek/ott/tetelek.tsv (az eszkozok/ott.py kimenete), tetelek_hu.tsv (javítások + magyar fordítás),
reszek.tsv, par_hu.tsv. Kimenet: index.html, ot.js, style.css, data/tetelek.json, data/szerkezet.json és
<kimenet>_pagefind/0/ (tételenként egy lap). Használat: python3 eszkozok/web_ott.py _site/ott ; web_pagefind.sh
"""
import csv, html, json, os, shutil, sys, time

GY = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
O = os.path.join(GY, 'szovegek', 'ott')  # forrás: az EPUB-ból (ott.py)
MINOS_HU = {
    'De fide': 'hittétel (de fide)', 'Sententia fidei proxima': 'hithez közeli tétel (sententia fidei proxima)',
    'Sententia certa': 'teológiailag biztos tétel (sententia certa)', 'Sententia communis': 'általános teológiai vélemény (sententia communis)',
    'Sententia communior': 'általánosabb vélemény (sententia communior)', 'Sententia probabilis': 'valószínű vélemény (sententia probabilis)',
    'Sententia probabilior': 'valószínűbb vélemény (sententia probabilior)', 'Sententia pia': 'jámbor vélemény (sententia pia)',
    '': 'minősítés nélkül',
}
LAP = ('<!doctype html><html lang="hu"><head><meta charset="utf-8"><title>{k}</title></head><body>'
       '<div data-pagefind-body><h1 data-pagefind-meta="cim">{cim}</h1><p>{t}</p></div>'
       '<span data-pagefind-meta="k:{k}"></span><span data-pagefind-filter="minosites:{m}"></span>'
       '<span data-pagefind-filter="resz:{r}"></span></body></html>')


def tsv(nev):
    return list(csv.DictReader(open(os.path.join(O, nev), encoding='utf-8'), delimiter='\t'))


def jdump(obj, ut):
    os.makedirs(os.path.dirname(ut), exist_ok=True)
    with open(ut, 'w', encoding='utf-8') as o:
        json.dump(obj, o, ensure_ascii=False, separators=(',', ':'))


def main(ki):
    if os.path.exists(ki): shutil.rmtree(ki)
    os.makedirs(ki)
    for f in os.listdir(os.path.join(GY, 'web', 'ott')):
        shutil.copy(os.path.join(GY, 'web', 'ott', f), ki)
    shutil.copy(os.path.join(GY, 'web', 'style.css'), ki)
    ih = os.path.join(ki, 'index.html')
    tartalom = open(ih, encoding='utf-8').read().replace('__VERZIO__', time.strftime('%Y%m%d%H%M%S'))
    open(ih, 'w', encoding='utf-8').write(tartalom)

    reszek = {r['resz']: r for r in tsv('reszek.tsv')}
    parhu = {r['hely']: r['magyar'] for r in tsv('par_hu.tsv')}
    hu = {r['n']: r for r in tsv('tetelek_hu.tsv')}
    paren = {}
    tetelek = []
    for r in tsv('tetelek.tsv'):
        h = hu.get(r['n'], {})
        if h.get('torol') == '1' or not h.get('magyar'): continue
        resz, par = (h['hely'].split('.') if h.get('hely') else (r['resz'], r['par']))
        paren.setdefault(f'{resz}.{par}', r['par_cim'] if not h.get('hely') else '')
        tetelek.append({'n': int(r['n']), 'resz': int(resz), 'par': int(par), 'm': r['minosites'],
                        'en': h.get('en_javitott') or r['tetel'], 'hu': h['magyar'],
                        'd': [int(x) for x in r['dszam'].split(',') if x]})
    tetelek.sort(key=lambda t: (t['resz'], t['par'], t['n']))
    for i, t in enumerate(tetelek, 1): t['s'] = i  # megjelenített sorszám
    # szerkezet: rész → §-ok (cím magyarul és angolul) → tételek sorszáma
    szerk = []
    for rk in sorted(reszek, key=int):
        r = reszek[rk]
        pars = sorted({t['par'] for t in tetelek if t['resz'] == int(rk)} |
                      {int(h.split('.')[1]) for h in parhu if h.split('.')[0] == rk})
        szerk.append({'resz': int(rk), 'konyv': r['konyv'], 'cim': r['magyar'], 'angol': r['angol'],
                      'par': [[p, parhu.get(f'{rk}.{p}', ''), paren.get(f'{rk}.{p}', ''),
                               [t['s'] for t in tetelek if t['resz'] == int(rk) and t['par'] == p]] for p in pars]})
    jdump(tetelek, os.path.join(ki, 'data', 'tetelek.json'))
    jdump({'reszek': szerk, 'minosites': MINOS_HU}, os.path.join(ki, 'data', 'szerkezet.json'))
    pf = ki.rstrip('/') + '_pagefind'
    if os.path.exists(pf): shutil.rmtree(pf)
    os.makedirs(os.path.join(pf, '0'))
    for t in tetelek:
        r = reszek[str(t['resz'])]
        hely = f"{t['resz']}.{t['par']}"
        cim = f"{t['s']}. tétel · {r['magyar']}, {t['par']}. § {parhu.get(hely, '')}"
        with open(os.path.join(pf, '0', f"t{t['s']}.html"), 'w', encoding='utf-8') as o:
            o.write(LAP.format(k=t['s'], cim=html.escape(cim), m=html.escape(MINOS_HU[t['m']]), r=html.escape(r['magyar']),
                               t=html.escape(' '.join([t['hu'], t['en'], t['m']] + [f'D {d}' for d in t['d']]))))
    print(f"{len(tetelek)} tétel, {len(szerk)} rész -> {ki}", file=sys.stderr)


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '_site/ott')
