# Prümmer, Vademecum – fordítási munkarend

- Forrás: `../vademecum_latin.tsv` (gépi OCR, a librinostri-szkennelés 1941-es 5. kiadásából; `eszkozok/prummer.py`).
  Kiírás egy tartományra: `python3 /home/claude/patcatena/eszkozok/prummer_mutat.py A B` (vagy a TSV-ből szűrve). A hiányzó számok a megelőző
  tétel szövegében vannak – ott kell szétvágni (a 106 pl. a 105-ben volt). Kétes helyen az oldalképet nézd meg:
  `pdftoppm -r 70 -gray -f <pdf> -l <pdf> -png forras/prummer_vademecum_librinostri.pdf <ki>`.
- Kimenet: `NNN.tsv` adagonként (fejléc: `n<TAB>latin<TAB>magyar`), kb. 20 tétel/adag. A `latin` mező a JAVÍTOTT
  latin szöveg (OCR-hibák, dőlt szavak helyreállítva, élőfejek, oldalszámok, lábléc törölve), a `magyar` a saját fordítás.
- Jelölések: `¶` = bekezdés; `[Caput II. De …]` / `[II. fejezet. …]` = a tétel szövegébe ékelt szerkezeti címek
  (ott, ahol a nyomtatványban állnak); lábjegyzet: `¹` a szövegben, a jegyzet a tétel végén `¶ ¹ …`.
- Szóhasználat: actus humanus = emberi cselekedet; actus hominis = az ember cselekvése; advertentia = odafigyelés;
  voluntarium = akaratlagos (mint minőség: akaratlagosság; volitum = akart, intentum = szándékolt); ignorantia vincibilis/invincibilis/crassa/affectata = legyőzhető/legyőzhetetlen/durva/szándékolt
  tudatlanság; elicitus/imperatus = kibocsátott/parancsolt; Principium = elv; Scholion = kiegészítés; Propositio = tétel;
  Praenotamen = előzetes megjegyzés; Nota = megjegyzés; Quaeres/Resp. = Kérdés/Felelet; Corollarium = következmény;
  meritum de condigno/de congruo = méltányos/illendőségi érdem; dispensatio = felmentés; privilegium = kiváltság;
  consuetudo = szokás; epikeia = epikeia; lex poenalis/irritans = büntető/érvénytelenítő törvény; domicilium /
  quasi-domicilium = lakóhely / ideiglenes lakóhely; peregrinus = idegen; vagus = vándorló; iustitia commutativa /
  legalis = kölcsönös / törvényes igazságosság; conscientia laxa/perplexa/scrupulosa = tág/tanácstalan/aggályos lelkiismeret.
- Hivatkozások: „CIC 2202. kán. 2. §”, egymás után „2218. kán.”; Szentírás SZIT-rövidítéssel (Róm 3,8); pápák az
  egyházi helyesírási útmutató szerint (X. Szent Piusz, XIII. Leó, XI. Ince); Trentói Zsinat.
- Állapot: a kész adagok fájlnevei mutatják (001–007: 0–140).
- Bűnbánat: paenitentia = bűnbánat; contritio (általában) = bánat, contritio stricte dicta/perfecta = tökéletes bánat; attritio = bánkódás (tökéletlen bánat); propositum = (erős) elhatározás; confessio = gyónás (bűnvallomás); satisfactio = elégtétel; absolutio = feloldozás; materia remota/proxima = távoli/közeli anyag; ex opere operato/operantis latinul marad.
