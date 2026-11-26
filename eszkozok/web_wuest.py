#!/usr/bin/env python3
"""A Wuest-kereső (Collectio Rerum Liturgicarum 1915 / Matters Liturgical 1959) statikus webes változata.

Bemenet: szovegek/wuest/ (angol.tsv, latin.tsv, latin_mutato.tsv, parok.tsv, cimek_hu.tsv, fejezetek_hu.tsv,
targyszotar.tsv) – az eszkozok/wuest_angol.py, wuest_latin.py, wuest_par.py kimenete.
Kimenet (pl. _site/wuest): index.html, wu.js, style.css, data/…, és <kimenet>_pagefind/0/ a Pagefind-indexhez.
Használat: python3 eszkozok/web_wuest.py _site/wuest ; bash eszkozok/web_pagefind.sh _site/wuest
"""
import csv, html, json, os, re, shutil, sys, time

GYOKER = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W = os.path.join(GYOKER, 'szovegek', 'wuest')
DARAB = 40
# Egy nyelv minden lapon: a Pagefind nyelvenként külön indexet építene, a böngésző csak egyet töltene be.
LAP = ('<!doctype html><html lang="{lang}"><head><meta charset="utf-8"><title>{k}</title></head><body>'
       '<div data-pagefind-body><h1 data-pagefind-meta="cim">{cim}</h1><p>{t}</p></div>'
       '<span data-pagefind-meta="k:{k}"></span><span data-pagefind-filter="kiadas:{kiadas}"></span></body></html>')
csv.field_size_limit(sys.maxsize)


def tsv(nev):
    return list(csv.DictReader(open(os.path.join(W, nev), encoding='utf-8'), delimiter='\t'))


def jdump(obj, ut):
    os.makedirs(os.path.dirname(ut), exist_ok=True)
    with open(ut, 'w', encoding='utf-8') as o:
        json.dump(obj, o, ensure_ascii=False, separators=(',', ':'))


def main(ki):
    if os.path.exists(ki):
        shutil.rmtree(ki)
    os.makedirs(ki)
    for f in os.listdir(os.path.join(GYOKER, 'web', 'wuest')):
        shutil.copy(os.path.join(GYOKER, 'web', 'wuest', f), ki)
    shutil.copy(os.path.join(GYOKER, 'web', 'style.css'), ki)
    ih = os.path.join(ki, 'index.html')
    tartalom = open(ih, encoding='utf-8').read().replace('__VERZIO__', time.strftime('%Y%m%d%H%M%S'))
    open(ih, 'w', encoding='utf-8').write(tartalom)

    fejhu = {r['angol']: r['magyar'] for r in tsv('fejezetek_hu.tsv')}
    cimhu = {r['n']: r['magyar'] for r in tsv('cimek_hu.tsv')}
    ang, lat = tsv('angol.tsv'), tsv('latin.tsv')
    pf = ki.rstrip('/') + '_pagefind'
    if os.path.exists(pf):
        shutil.rmtree(pf)
    os.makedirs(os.path.join(pf, '0'))

    # Angol (1959): tematikus szerkezet + szöveg darabokban
    meta, darab = [], []
    for i, r in enumerate(ang):
        cim_hu = cimhu.get(r['n'], '')
        meta.append([r['n'], r['pdf_lap'], fejhu.get(r['resz'], r['resz']), fejhu.get(r['fejezet'], r['fejezet'].title()),
                     cim_hu, r['cim'], r['resz'], r['fejezet'].title()])
        darab.append(r['szoveg'])
        if len(darab) == DARAB:
            jdump(darab, os.path.join(ki, 'data', 'a', f'{i // DARAB}.json')); darab = []
        cim = f"{r['n']}. {cim_hu or r['cim']}"
        with open(os.path.join(pf, '0', f'a{r["n"]}.html'), 'w', encoding='utf-8') as o:
            o.write(LAP.format(lang='en', k=f'a{r["n"]}', cim=html.escape(cim), kiadas='angol (1959)',
                               t=html.escape(' '.join([cim_hu, r['cim'], meta[-1][3], r['szoveg'].replace(' ¶ ', ' ')]))))
    if darab:
        jdump(darab, os.path.join(ki, 'data', 'a', f'{(len(ang) - 1) // DARAB}.json'))
    jdump(meta, os.path.join(ki, 'data', 'angol.json'))

    # Latin (1915)
    meta, darab = [], []
    for i, r in enumerate(lat):
        r['fejezet'] = r['fejezet'].replace('^', 'ae')  # OCR: æ → ^
        meta.append([r['n'], r['pdf_lap'], r['fejezet']])
        darab.append(r['szoveg'])
        if len(darab) == DARAB:
            jdump(darab, os.path.join(ki, 'data', 'l', f'{i // DARAB}.json')); darab = []
        with open(os.path.join(pf, '0', f'l{r["n"]}.html'), 'w', encoding='utf-8') as o:
            o.write(LAP.format(lang='en', k=f'l{r["n"]}', cim=html.escape(f"{r['n']}. {r['fejezet']}"), kiadas='latin (1915)',
                               t=html.escape(r['fejezet'] + ' ' + r['szoveg'])))
    if darab:
        jdump(darab, os.path.join(ki, 'data', 'l', f'{(len(lat) - 1) // DARAB}.json'))
    jdump(meta, os.path.join(ki, 'data', 'latin.json'))

    # Összekötés, mutató, tárgyszótár
    parok = {}
    for r in tsv('parok.tsv'):
        parok.setdefault('l' + r['latin_n'], []).append(r['angol_n'])
        parok.setdefault('a' + r['angol_n'], []).append(r['latin_n'])
    jdump(parok, os.path.join(ki, 'data', 'parok.json'))
    jdump([[r['cimszo'], r['szoveg'], [int(x) for x in r['bekezdesek'].split(',')]] for r in tsv('latin_mutato.tsv')],
          os.path.join(ki, 'data', 'mutato.json'))
    jdump([[r['kategoria'], r['targyszo'], [x for x in r['latin'].split('|') if x], [x for x in r['angol'].split('|') if x]]
           for r in tsv('targyszotar.tsv')], os.path.join(ki, 'data', 'targyszotar.json'))
    print(f'{len(ang)} angol tétel, {len(lat)} latin bekezdés -> {ki}', file=sys.stderr)


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '_site/wuest')
