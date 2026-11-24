#!/usr/bin/env python3
"""A művek besorolása: kifejezetten szentírás-magyarázó mű („kommentar”) vagy egyéb patrisztikus forrás („forras”).

A besorolás a mű címén alapul (kommentár, magyarázat, homília, kérdések, katéna stb. egy bibliai könyvre vagy helyre),
néhány szerzőnél a műfaj ismeretében; a kézi javítások a katalogus/kategoria_felulbiralas.csv-ben vannak
(urn-előtag, kategoria, indok), és mindig elsőbbséget élveznek.

Használat:  python3 eszkozok/kategoria.py            összesítés és a besorolás kiírása (katalogus/kategoria.csv)
A webes keresők (web.py) és a keres.py ugyanezt a függvényt használják.
"""
import csv, os, re, sys, unicodedata

GYOKER = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

KONYVEK = (r'psalm|genes|exod|leuit|numer|deuteron|iosue|iesu naue|iudic|ruth|regn|reg(um|es|norum)|paralip|esdr|nehem|tob|'
           r'iudith|esther|iob|prou|ecclesiast|cantic|sapient|ecclesiastic|sirac|isai|esai|ierem|hierem|lament|threni|baruch|'
           r'ezech|hiezech|dan|ose|hose|ioel|amos|abdi|ion|mich|nahum|naum|habac|abac|sophon|agg|zachar|malach|machab|maccab|'
           r'matth|marc|luc|ioann|iohann|euangel|actus|actibus|rom|corinth|galat|ephes|philipp|coloss|thessal|timoth|titum|tit|'
           r'philem|hebr|iacob|petr|iudae|apocal|epist(u|o)l\w* (beati )?pauli|pauli|prophet|heptateuch|octateuch|pentateuch|'
           r'cantica|canticum|psalter|scriptur|vetus testament|ueteris testament|nouum testament|noui testament|'
           r'ψαλμ|γενεσ|εξοδ|ησαι|ιερεμ|ιεζεκ|δανιηλ|ιωβ|ασμα|εκκλησιαστ|ευαγγελ|ματθ|ιωανν|λουκ|παροιμ')
KOMMENTAR = re.compile(
    r'comment|enarrat|explanat|expositi|exposit\w* (in|super)|adnotation|annotation|scholi|catena|glaphyr|hexaemer|'
    r'hexameron|moralia|quaestion\w* (in|hebraic|euangel|ueter|uet|ex|de|super)|in heptateuch|locution|'
    r'de genesi|in genesi|selecta in|excerpta in|notae in|fragment\w* in|in illud|homil\w*( [xiulcdm]+)? in|homil\w* super|translatio homiliarum|ad simplicianum|ex epist\w* beati pauli|'
    r'tractat\w* (in|super|de)\s+(' + KONYVEK + r')|sermo\w* (in|de|super)\s+(' + KONYVEK + r')|'
    r'^(in|super|ad)\s+(' + KONYVEK + r')|\b(in|super)\s+(librum|libros|cantic|psalm|euangel|epist)|'
    r'de scripturis|de consensu euangelist|de sermone domini|speculum de scriptura|formulae spiritalis|instructionum|'
    r'allegoriae|de ortu et obitu patrum|instituta regularia|de septem regulis|de nominibus hebraic|nominum hebraic|'
    r'de situ et nominibus|hebraicarum quaestionum|de benedictionibus|tractatus mysteriorum|complexiones|'
    r'interpretatio homiliarum|in (xii|duodecim) prophet|kommentar|psalmen|hypomnema|prolog\w* (uarii|in)|weitere prologtexte|'
    r'eclogae propheticae|onomasticon|de adoratione et cultu|interpretatio\w* in|psalmorum|über (daniel|die psalmen)|^instructiones|'
    r'apologia\w* (altera )?prophetae|mansionibus|de concordia matthaei|quaestion.*testament|testament\w* quaestion|'
    r'de ueteri et nouo testamento|decem tentationes|de uerbis scripturae|de sabbatis et circumcisione|ausgehend vom|'
    r'de montibus sina|(sacr\w*|diuin\w*|sanct\w*) scriptur|ὑπόμνημα|ἑρμηνεί|εἰς τ(ὸν|ὴν|ὰ|οὺς)', re.I)
# Ambrus és mások egy bibliai alakról vagy helyről írt magyarázó művei
ALAK = re.compile(r'^de (paradiso|cain|noe|abraham|isaac|iacob|ioseph|patriarch|nabuth|tobia|helia|interpellatione|'
                  r'apologia (prophetae )?dauid|dauid|iob|salomon|sacrificiis caini|tribus pueris|melchisedech)', re.I)
# Nem kommentár: a Biblia szövege, bibliai eposz, illetve a cím más műfajt jelöl
NEM = re.compile(r'diuina bibliotheca|^biblia|^euangeliorum libri|carmen paschale|cento|alethia|heptateuchos|'
                 r'de actibus apostolorum|de spiritalis historiae|de laudibus dei|^contra |^aduersus |regula\b|^uita |'
                 r'porphyr|ciceron|aristotel|categori|topic|isagog|symbol|missa|liturg|admonitio|incarnation|'
                 r'iudaeos et graecos|laudem ecclesiae|haeresibus|harmoniae|enchiridion|lectiones|carmina\b', re.I)

KOMMENTAR_SZERZOK = {'Katénák', 'Katénák (Újszövetség)'}


def norm(t):
    t = unicodedata.normalize('NFC', t or '')
    return re.sub(r'\s+', ' ', t.replace('v', 'u').replace('V', 'U').replace('j', 'i').replace('J', 'I')).strip()


def felulbiralasok():
    f = os.path.join(GYOKER, 'katalogus', 'kategoria_felulbiralas.csv')
    if not os.path.exists(f):
        return []
    return [(r['urn_elotag'], r['kategoria']) for r in csv.DictReader(open(f, encoding='utf-8'))]


_FB = None


def kategoria(sor):
    """sor: a korpusz.csv egy sora (dict). Visszaad: 'kommentar' vagy 'forras'."""
    global _FB
    if _FB is None:
        _FB = felulbiralasok()
    urn = sor['urn'].split(':')[-1]
    for elotag, kat in _FB:
        if urn.startswith(elotag):
            return kat
    if sor['szerzo'] in KOMMENTAR_SZERZOK:
        return 'kommentar'
    cim = norm(sor['mu'])
    alap = unicodedata.normalize('NFKD', cim)
    alap = ''.join(c for c in alap if not unicodedata.combining(c))
    if NEM.search(cim) or NEM.search(alap):
        return 'forras'
    if KOMMENTAR.search(cim) or KOMMENTAR.search(alap) or ALAK.search(cim):
        return 'kommentar'
    return 'forras'


if __name__ == '__main__':
    from collections import Counter
    kat = list(csv.DictReader(open(os.path.join(GYOKER, 'katalogus', 'korpusz.csv'), encoding='utf-8')))
    ki = [(r['urn'], r['szerzo'], r['mu'], kategoria(r)) for r in kat]
    with open(os.path.join(GYOKER, 'katalogus', 'kategoria.csv'), 'w', encoding='utf-8', newline='') as o:
        w = csv.writer(o); w.writerow(['urn', 'szerzo', 'mu', 'kategoria']); w.writerows(ki)
    print(Counter(k for *_, k in ki))
    if '-v' in sys.argv:
        for u, sz, mu, k in ki:
            if k == sys.argv[-1]:
                print(f'{sz[:24]:24} | {mu[:90]}')
