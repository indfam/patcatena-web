#!/usr/bin/env python3
"""A Catena aurea-kereső statikus webes változata.

Bemenet: szovegek/catena/catena_angol.tsv (nyilvános: angol szöveg, latin nélkül) vagy --latin kapcsolóval catena.tsv
(a Corpus Thomisticum latin szövegével együtt – csak privát használatra, a jogtulajdonos engedélye nélkül nem tehető
közzé), kapcsolat.tsv (az idézetek helye a könyvtár latin szövegeiben), szerzok.tsv, biblia/vulgata.tsv.
Kimenet: index.html, ca.js, style.css, data/…, és <kimenet>_pagefind/0/ a Pagefind-indexhez.
Használat: python3 eszkozok/web_catena.py _site/catena [--latin] ; bash eszkozok/web_pagefind.sh _site/catena
"""
import csv, html, json, os, shutil, sys, time
from collections import defaultdict, Counter

GY = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(GY, 'eszkozok'))
from web import nyilt  # noqa: E402
from kategoria import kategoria  # noqa: E402

C = os.path.join(GY, 'szovegek', 'catena')
DARAB = 20
EVNEV = {'Mt': 'Máté', 'Mk': 'Márk', 'Lk': 'Lukács', 'Jn': 'János'}
LAP = ('<!doctype html><html lang="en"><head><meta charset="utf-8"><title>{k}</title></head><body>'
       '<div data-pagefind-body><h1 data-pagefind-meta="cim">{cim}</h1><p>{t}</p></div>'
       '<span data-pagefind-meta="k:{k}"></span><span data-pagefind-filter="evangelium:{ev}"></span>{szf}</body></html>')
csv.field_size_limit(sys.maxsize)


def jdump(obj, ut):
    os.makedirs(os.path.dirname(ut), exist_ok=True)
    with open(ut, 'w', encoding='utf-8') as o:
        json.dump(obj, o, ensure_ascii=False, separators=(',', ':'))


def main(ki, latin):
    if os.path.exists(ki): shutil.rmtree(ki)
    os.makedirs(ki)
    for f in os.listdir(os.path.join(GY, 'web', 'catena')):
        shutil.copy(os.path.join(GY, 'web', 'catena', f), ki)
    shutil.copy(os.path.join(GY, 'web', 'style.css'), ki)
    ih = os.path.join(ki, 'index.html')
    tartalom = open(ih, encoding='utf-8').read().replace('__VERZIO__', time.strftime('%Y%m%d%H%M%S'))
    open(ih, 'w', encoding='utf-8').write(tartalom)

    forras = 'catena.tsv' if latin and os.path.exists(os.path.join(C, 'catena.tsv')) else 'catena_angol.tsv'
    sorok = list(csv.DictReader(open(os.path.join(C, forras), encoding='utf-8'), delimiter='\t'))
    # a könyvtár szakaszai: csak a nyilvános keresőkben elérhetők, a megfelelő keresőbe mutató címmel
    kat = {r['urn']: r for r in csv.DictReader(open(os.path.join(GY, 'katalogus', 'korpusz.csv'), encoding='utf-8'))}
    kapcs = defaultdict(dict)
    for r in csv.DictReader(open(os.path.join(C, 'kapcsolat.tsv'), encoding='utf-8'), delimiter='\t'):
        k = kat.get(r['urn'])
        if not k or (not latin and not nyilt(k)): continue
        kapcs[r['id']][int(r['sorszam'])] = ['k' if kategoria(k) == 'kommentar' else 'f', r['urn'], r['ref'], k['mu']]

    pf = ki.rstrip('/') + '_pagefind'
    if os.path.exists(pf): shutil.rmtree(pf)
    os.makedirs(os.path.join(pf, '0'))
    meta, darab, szerzok, szerzo_egys = [], [], Counter(), defaultdict(list)
    for i, r in enumerate(sorok):
        q = json.loads(r['idezetek'])
        idez = []
        for s, p in enumerate(q):
            # [kulcs, magyar név, angol címke, angol szöveg, latin címke, latin szöveg, könyvtári hely]
            idez.append([p[0], p[1], p[4], p[5], p[2] if latin else '', p[3] if latin else '', kapcs[r['id']].get(s)])
            for n in p[1].split(' / '):  # összevont idézetnél (pl. „Glossa / Pszeudo-Aranyszájú János”) mindkét szerző
                szerzok[n] += 1
                if not szerzo_egys[n] or szerzo_egys[n][-1] != i: szerzo_egys[n].append(i)
        meta.append([r['id'], r['evangelium'], int(r['fejezet']), int(r['vers_tol']), int(r['vers_ig']), r['lectio'],
                     r['ige_angol'], len(q), r['lat_hely']])
        darab.append(idez)
        if len(darab) == DARAB:
            jdump(darab, os.path.join(ki, 'data', 'e', f'{i // DARAB}.json')); darab = []
        hely = f"{r['evangelium']} {r['fejezet']},{r['vers_tol']}" + (f"–{r['vers_ig']}" if r['vers_ig'] != r['vers_tol'] else '')
        nevek = sorted({n for p in q for n in p[1].split(' / ')})
        szf = ''.join(f'<span data-pagefind-filter="szerzo:{html.escape(n)}"></span>' for n in nevek)
        szoveg = ' '.join([r['ige_angol']] + [f'{p[1]} ({p[4]}): {p[5]}' for p in q])
        with open(os.path.join(pf, '0', f'{r["id"]}.html'), 'w', encoding='utf-8') as o:
            o.write(LAP.format(k=r['id'], cim=html.escape(hely), ev=EVNEV[r['evangelium']], szf=szf, t=html.escape(szoveg)))
    if darab: jdump(darab, os.path.join(ki, 'data', 'e', f'{(len(sorok) - 1) // DARAB}.json'))
    jdump(meta, os.path.join(ki, 'data', 'egysegek.json'))
    jdump([[n, c, szerzo_egys[n]] for n, c in szerzok.most_common()], os.path.join(ki, 'data', 'szerzok.json'))
    vul = defaultdict(dict)
    for r in csv.DictReader(open(os.path.join(GY, 'biblia', 'vulgata.tsv'), encoding='utf-8'), delimiter='\t'):
        if r['konyv'] in EVNEV: vul[r['konyv']][f"{r['fejezet']}:{r['vers']}"] = r['szoveg']
    for k, v in vul.items(): jdump(v, os.path.join(ki, 'data', 'vulgata', f'{k}.json'))
    jdump({'latin': bool(latin)}, os.path.join(ki, 'data', 'beall.json'))
    print(f'{len(sorok)} egység, {sum(szerzok.values())} idézet, {len(szerzok)} szerző, '
          f'{sum(len(v) for v in kapcs.values())} könyvtári kapcsolat ({forras}) -> {ki}', file=sys.stderr)


if __name__ == '__main__':
    a = [x for x in sys.argv[1:] if not x.startswith('--')]
    main(a[0] if a else '_site/catena', '--latin' in sys.argv)
