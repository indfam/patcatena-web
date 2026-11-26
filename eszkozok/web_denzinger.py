#!/usr/bin/env python3
"""A Denzinger-kereső (Enchiridion symbolorum) statikus webes változatának építése.

Bemenet: szovegek/denzinger/denzinger.tsv (az eszkozok/denzinger.py kimenete).
Kimenet (pl. _site/denzinger):
  index.html, dz.js, style.css            a felület (web/denzinger/ + a közös web/style.css)
  data/mutato.json                        egységenként [D, "DS,DS,…", dokumentum sorszáma, darab]
  data/dokumentumok.json                  [magyar cím, első egység, egységek száma, eredeti (francia) cím]
  data/e/<darab>.json                     az egységek szövege, 100-asával
  <kimenet>_pagefind/0/                   egységenként egy HTML-lap a Pagefind-indexhez (eszkozok/web_pagefind.sh)
Használat: python3 eszkozok/web_denzinger.py _site/denzinger ; bash eszkozok/web_pagefind.sh _site/denzinger
"""
import csv, html, json, os, shutil, sys, time

GYOKER = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DARAB = 100
LAP = ('<!doctype html><html lang="la"><head><meta charset="utf-8"><title>{i}</title></head><body>'
       '<div data-pagefind-body><h1 data-pagefind-meta="cim">{cim}</h1><p>{t}</p></div>'
       '<span data-pagefind-meta="i:{i}"></span></body></html>')
csv.field_size_limit(sys.maxsize)


def jdump(obj, ut):
    os.makedirs(os.path.dirname(ut), exist_ok=True)
    with open(ut, 'w', encoding='utf-8') as o:
        json.dump(obj, o, ensure_ascii=False, separators=(',', ':'))


def main(ki):
    if os.path.exists(ki):
        shutil.rmtree(ki)
    os.makedirs(ki)
    verzio = time.strftime('%Y%m%d%H%M%S', time.gmtime())
    for f in os.listdir(os.path.join(GYOKER, 'web', 'denzinger')):
        shutil.copy(os.path.join(GYOKER, 'web', 'denzinger', f), ki)
    shutil.copy(os.path.join(GYOKER, 'web', 'style.css'), ki)
    ih = os.path.join(ki, 'index.html')
    t = open(ih, encoding='utf-8').read().replace('__VERZIO__', verzio)
    open(ih, 'w', encoding='utf-8').write(t)

    sorok = list(csv.DictReader(open(os.path.join(GYOKER, 'szovegek', 'denzinger', 'denzinger.tsv'), encoding='utf-8'),
                                delimiter='\t'))
    # A dokumentumcímek magyar fordítása (szovegek/denzinger/cimek_hu.tsv: francia → magyar)
    hf = os.path.join(GYOKER, 'szovegek', 'denzinger', 'cimek_hu.tsv')
    magyar = {r['francia']: r['magyar'] for r in csv.DictReader(open(hf, encoding='utf-8'), delimiter='\t')} \
        if os.path.exists(hf) else {}
    mutato, dok, darab = [], [], []
    pf = ki.rstrip('/') + '_pagefind'
    if os.path.exists(pf):
        shutil.rmtree(pf)
    for i, s in enumerate(sorok):
        cim = s['cim'] or (dok[-1][0] if dok else '') or s['angol_cim'] or 'Hitvallások'
        if not dok or dok[-1][3] != cim:
            dok.append([magyar.get(cim, cim), i, 0, cim])
        dok[-1][2] += 1
        mutato.append([s['d'], s['ds'], len(dok) - 1])
        darab.append([s['d'], s['ds'], s['megj'], s['latin'], s['latin_forras'], s['angol'], s['angol_cim'], s.get('ds_forras', '')])
        if len(darab) == DARAB:
            jdump(darab, os.path.join(ki, 'data', 'e', f'{i // DARAB}.json')); darab = []
        szoveg = ' '.join(x for x in (s['angol_cim'], s['latin'].replace('⟦', '').replace('⟧', ''), s['angol']) if x)
        ut = os.path.join(pf, '0', f'{i}.html')
        os.makedirs(os.path.dirname(ut), exist_ok=True)
        with open(ut, 'w', encoding='utf-8') as o:
            o.write(LAP.format(i=i, cim=html.escape(dok[-1][0]), t=html.escape(cim + ' ' + szoveg)))
    if darab:
        jdump(darab, os.path.join(ki, 'data', 'e', f'{(len(sorok) - 1) // DARAB}.json'))
    jdump(mutato, os.path.join(ki, 'data', 'mutato.json'))
    # Magyar tárgyszótár (kategória, tárgyszó, latin és angol keresőszavak)
    tf = os.path.join(GYOKER, 'szovegek', 'denzinger', 'targyszotar.tsv')
    if os.path.exists(tf):
        tsz = [[r['kategoria'], r['targyszo'], [x.strip() for x in r['latin'].split('|') if x.strip()],
                [x.strip() for x in r['angol'].split('|') if x.strip()]]
               for r in csv.DictReader(open(tf, encoding='utf-8'), delimiter='\t')]
        jdump(tsz, os.path.join(ki, 'data', 'targyszotar.json'))
    jdump(dok, os.path.join(ki, 'data', 'dokumentumok.json'))
    print(f'{len(sorok)} egység, {len(dok)} dokumentum -> {ki}', file=sys.stderr)


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '_site/denzinger')
