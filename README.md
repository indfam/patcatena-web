# patcatena-web – az egyházatyák bibliamagyarázatainak keresője

Ez a tároló a [patcatena](https://indfam.github.io/patcatena-web/) webes kereső forrása: egyházatyák ószövetségi
kommentárjai és rokon művei eredeti nyelven (latin, görög), bibliai idézet-indexszel.

- **A kereső:** https://indfam.github.io/patcatena-web/
- **Tartalom:** `szovegek/tsv/` (szakaszokra bontott szövegek), `katalogus/korpusz.csv` (kiadások, licencek),
  `biblia/` (Vulgata Clementina, Szeptuaginta), `index/biblia_idezetek.tsv` (mely szakasz melyik bibliai helyet idézi).
- **Építés:** `python3 eszkozok/web.py _site && bash eszkozok/web_pagefind.sh _site` – a GitHub Actions minden
  változás után elvégzi és közzéteszi.

A tároló tartalmát a karbantartó privát munkakönyvtárából egy szkript frissíti; ide közvetlenül ne commitolj.

## Források és licenc

A szövegek az Open Greek and Latin (First1KGreek, CSEL, Patrologia Latina), a Perseus Digital Library és a
Patristic Text Archive (BBAW) nyílt kiadásaiból származnak, CC BY-SA 4.0 licenc alatt (két fájl CC BY 4.0);
részletesen lásd `FORRASOK.md` és a `katalogus/korpusz.csv` `licenc` oszlopa. A belőlük készült fájlok és a kereső
ugyanezen licenc alatt, a forrás megjelölésével szabadon felhasználhatók.
