// Prümmer-kereső: Vademecum theologiae moralis – latin szöveg és magyar fordítás (statikus adatok + Pagefind).
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const V = new URL(import.meta.url).searchParams.get("v") || "";
const json = async (u) => { const r = await fetch(V ? `${u}?v=${V}` : u); if (!r.ok) throw new Error(u); return r.json(); };

let T = [], SZ = {}, TSZ = [], pagefind = null;
const szam = new Map();          // margószám → tétel
const csucsok = [];              // a szerkezet minden egysége, szülővel
const SZINTNEV = { 1: "traktátus", 2: "szakasz", 3: "kérdés", 4: "fejezet", 5: "cikkely", 6: "paragrafus" };

// ---- Beágyazás: magasság és görgetés ----
const jelezMagassag = () => parent !== window &&
  parent.postMessage({ type: "patcatena-magassag", h: document.documentElement.scrollHeight }, "*");
new ResizeObserver(jelezMagassag).observe(document.body);
function gorget(el) {
  if (!el) return;
  if (parent === window) { el.scrollIntoView({ block: "start", behavior: "smooth" }); return; }
  parent.postMessage({ type: "patcatena-gorget", y: Math.round(el.getBoundingClientRect().top + scrollY) }, "*");
}

// ---- Módváltás ----
const MODOK = ["temak", "szoveg", "szam"];
function mod(nev) {
  for (const m of MODOK) { $(`#tab-${m}`).setAttribute("aria-selected", m === nev); $(`#panel-${m}`).hidden = m !== nev; }
}
for (const m of MODOK) $(`#tab-${m}`).onclick = () => mod(m);

// ---- Szerkezet ----
function bejar(lista, szulo, pars) {
  for (const cs of lista) { cs.szulo = szulo; cs.pars = pars; csucsok.push(cs); bejar(cs.gy, cs, pars); }
}
const cimHu = (cs) => cs.hu || cs.la;
function traktatusCim(cs) {
  if (cs.sz !== 1) return cimHu(cs);
  const i = trSorszam(cs) + (cs.pars === "II" ? 1 : 0);
  return i === 0 ? cimHu(cs) : `${cs.pars === "II" ? "II. rész, " : ""}${romai(i)}. traktátus: ${cimHu(cs)}`;
}
function trSorszam(cs) { const l = SZ.reszek.find((r) => r.pars === cs.pars).tr; return l.indexOf(cs); }
function romai(n) {
  const t = [[10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]]; let s = "";
  for (const [v, r] of t) while (n >= v) { s += r; n -= v; }
  return s;
}
function utvonalaN(n) {
  const ut = [];
  let lista = SZ.reszek.flatMap((r) => r.tr);
  for (;;) {
    const cs = lista.find((c) => c.tol <= n && n <= c.ig);
    if (!cs) break;
    ut.push(cs); lista = cs.gy;
  }
  return ut;
}
const utHtml = (ut) => ut.map((cs) => `<a href="#e/${cs.sz}/${cs.tol}">${esc(traktatusCim(cs))}</a>`).join(" › ");

function fa() {
  const ag = (cs) => {
    const db = cs.ig - cs.tol + 1;
    const fej = `${esc(cs.sz === 1 ? traktatusCim(cs) : cimHu(cs))}<span class="tart">${cs.tol === cs.ig ? `${cs.tol}.` : `${cs.tol}–${cs.ig}.`} sz.</span>`;
    if (!cs.gy.length) return `<p class="level"><a href="#e/${cs.sz}/${cs.tol}">${fej}</a></p>`;
    return `<details><summary>${fej}<a class="nyit" href="#e/${cs.sz}/${cs.tol}">megnyitás</a></summary>${cs.gy.map(ag).join("")}</details>`;
  };
  $("#fa").innerHTML = SZ.reszek.map((r) =>
    `<p class="pars">${r.pars === "I" ? "I. rész" : "II. rész: A szentségekről"}</p>${r.tr.map(ag).join("")}`).join("");
  $("#allapot").textContent = `A magyar fordítás a ${SZ.kesz}. számig készült el; a többi helyen egyelőre a gépi latin szöveg olvasható.`;
}

// ---- Egy tétel ----
function bekezdesek(s, latin) {
  return s.split(/\s*¶\s*/).filter(Boolean).map((p) => {
    const csakCim = p.replace(/\[[^\]]+\]/g, "").trim() === "";
    if (csakCim) return p.match(/\[[^\]]+\]/g).map((c) => `<p class="bel">${esc(c.slice(1, -1))}</p>`).join("");
    const jegyz = /^[¹²³⁴⁵]/.test(p);
    return `<p${jegyz ? ' class="jegyzet"' : ""}${latin ? ' lang="la"' : ""}>${esc(p).replace(/\[([^\]]+)\]/g, '<span class="bel">$1</span>')}</p>`;
  }).join("");
}
function tetelHtml(t) {
  const fej = `<p class="szam"><a href="#n/${t.n}">${t.n}.</a>${t.lap ? `<span>${t.lap}. oldal</span>` : ""}</p>`;
  if (t.ocr) return `<div class="tetel" id="n${t.n}">${fej}<div class="ket-hasab ocr"><div class="la">
      <p class="ocrjel">Gépi szövegfelismerés, javítatlan latin szöveg – a magyar fordítás még nem készült el.</p>${bekezdesek(t.la, true)}</div></div></div>`;
  return `<div class="tetel" id="n${t.n}">${fej}<div class="ket-hasab">
    <div class="hu" lang="hu"><h3>Magyarul</h3>${bekezdesek(t.hu)}</div>
    <div class="la"><h3>Latinul</h3>${bekezdesek(t.la, true)}</div></div></div>`;
}

// ---- Egység megnyitása (#e/<szint>/<első szám>) ----
const MAX = 25;
function egyseg(sz, tol, cel) {
  const cs = csucsok.find((c) => c.sz === sz && c.tol === tol);
  if (!cs) { $("#eredmeny").innerHTML = `<p class="uzenet">Nincs ilyen egység.</p>`; return; }
  const ut = [];
  for (let c = cs.szulo; c; c = c.szulo) ut.unshift(c);
  let tolN = cs.tol, igN = cs.ig;
  if (igN - tolN + 1 > MAX) {  // nagy egység: a gyermekek listája és a bevezető számok
    const elso = cs.gy.length ? cs.gy[0].tol - 1 : tolN + MAX - 1;
    igN = Math.min(elso, tolN + MAX - 1);
  }
  const tt = T.filter((t) => t.n >= tolN && t.n <= igN);
  const gy = cs.gy.length ? `<ul>${cs.gy.map((g) => `<li><a href="#e/${g.sz}/${g.tol}">${esc(cimHu(g))}</a>
    <span class="tart">${g.tol}–${g.ig}. sz.</span></li>`).join("")}</ul>` : "";
  $("#eredmeny").innerHTML = `<section class="egyseg">${ut.length ? `<p class="ut">${utHtml(ut)}</p>` : ""}
    <h2 class="egysegcim">${esc(cs.sz === 1 ? traktatusCim(cs) : cimHu(cs))}</h2>${cs.hu ? `<p class="lat-cim" lang="la">${esc(cs.la)}</p>` : ""}
    ${tt.map(tetelHtml).join("")}${gy}<div class="lapozo">${lapozo(cs)}</div></section>`;
  gorget(cel ? $(`#n${cel}`) : $("#eredmeny"));
}
function lapozo(cs) {
  const testver = csucsok.filter((c) => c.sz === cs.sz).sort((a, b) => a.tol - b.tol);
  const i = testver.indexOf(cs);
  const g = (j, s) => j < 0 || j >= testver.length ? `<button disabled>${s}</button>`
    : `<a class="gomb" href="#e/${testver[j].sz}/${testver[j].tol}">${s}</a>`;
  return g(i - 1, `Előző ${SZINTNEV[cs.sz]}`) + g(i + 1, `Következő ${SZINTNEV[cs.sz]}`);
}
function szamLap(n) {
  if (!szam.has(n)) { $("#eredmeny").innerHTML = `<p class="uzenet">Nincs ${n}. szám.</p>`; return; }
  const ut = utvonalaN(n);
  const cs = [...ut].reverse().find((c) => c.ig - c.tol + 1 <= MAX) || ut[ut.length - 1];
  if (cs && cs.ig - cs.tol + 1 <= MAX) { egyseg(cs.sz, cs.tol, n); return; }
  const t = szam.get(n);
  const elozo = T[T.indexOf(t) - 1], kov = T[T.indexOf(t) + 1];
  $("#eredmeny").innerHTML = `<section class="egyseg"><p class="ut">${utHtml(ut)}</p>${tetelHtml(t)}
    <div class="lapozo">${elozo ? `<a class="gomb" href="#n/${elozo.n}">Előző szám</a>` : ""}${kov ? `<a class="gomb" href="#n/${kov.n}">Következő szám</a>` : ""}</div></section>`;
  gorget($("#eredmeny"));
}
function szamLista() {
  $("#szamlista").innerHTML = csucsok.filter((c) => c.sz === 1).map((c) =>
    `<p><a href="#e/1/${c.tol}">${c.tol}–${c.ig}.</a> <span>${esc(traktatusCim(c))}</span></p>`).join("");
}

// ---- Tárgyszótár és szöveges keresés ----
function tszLista() {
  const kat = [...new Set(TSZ.map((x) => x.kat))];
  $("#tszlista").innerHTML = `<div class="tszkat">${kat.map((k) => `<h4>${esc(k)}</h4><p>${TSZ.filter((x) => x.kat === k)
    .map((x) => `<a href="#t/${x.i}">${esc(x.t)}</a>`).join("")}</p>`).join("")}</div>`;
  const trs = csucsok.filter((c) => c.sz === 1);
  $("#straktatus").innerHTML = `<option value="">mind</option>` + trs.map((c) => `<option>${esc(c.hu)}</option>`).join("");
}
const kisbetu = (s) => s.toLocaleLowerCase("hu").trim();
function tszKeres(q) {
  const k = kisbetu(q);
  return TSZ.find((x) => kisbetu(x.t) === k || x.sz.some((s) => kisbetu(s) === k));
}
async function pf() {
  if (!pagefind) {
    pagefind = await import(`./pagefind/pagefind.js${V ? "?v=" + V : ""}`);
    await pagefind.options({ excerptLength: 32 });
  }
  return pagefind;
}
async function kereses(q, tsz) {
  const ki = $("#eredmeny");
  ki.innerHTML = `<p class="toltes">Keresés…</p>`;
  const p = await pf();
  const filters = $("#straktatus").value ? { traktatus: $("#straktatus").value } : {};
  const kerdesek = tsz ? [...new Set([tsz.t, ...tsz.sz, ...tsz.la])] : [q];
  const valaszok = await Promise.all(kerdesek.map((x) => p.search(x, { filters })));
  const egyedi = new Map();
  for (const r of valaszok) for (const x of r.results) if (!egyedi.has(x.id)) egyedi.set(x.id, x);
  const fej = tsz ? `<p class="tszfej">Tárgyszó: <b>${esc(tsz.t)}</b> (${esc(tsz.kat)}) · keresve: ${kerdesek.map(esc).join(", ")}</p>` : "";
  if (!egyedi.size) { ki.innerHTML = fej + `<p class="uzenet">Nincs találat erre: „${esc(q)}”. Próbálja más szóalakkal vagy latinul.</p>`; return; }
  const lista = [...egyedi.values()];
  const adat = await Promise.all(lista.slice(0, 200).map((x) => x.data()));
  adat.sort((a, b) => +a.meta.n - +b.meta.n);
  ki.innerHTML = fej + `<p class="osszegzes">${lista.length} szám${lista.length > 200 ? " (az első 200 látszik)" : ""}</p>` + adat.map((a) => {
    const n = +a.meta.n, t = szam.get(n), ut = utvonalaN(n);
    const hely = ut.slice(-2).map(cimHu).join(" › ");
    return `<div class="talalat"><h4><a href="#n/${n}">${n}.</a> <span>${esc(hely)}${t && t.ocr ? " · latin (gépi szöveg)" : ""}</span></h4>
      <p>${a.excerpt}</p></div>`;
  }).join("");
}

// ---- Útvonalak: #e/<szint>/<szám> · #n/<szám> · #q/szavak · #t/<tárgyszó> ----
$("#urlap-szoveg").onsubmit = (ev) => {
  ev.preventDefault();
  const h = `#q/${encodeURIComponent($("#kerdes").value.trim())}`;
  if (location.hash === h) utvonal(); else location.hash = h;
};
$("#urlap-szam").onsubmit = (ev) => {
  ev.preventDefault();
  const h = `#n/${parseInt($("#szam").value, 10)}`;
  if (location.hash === h) utvonal(); else location.hash = h;
};
async function utvonal() {
  const h = decodeURIComponent(location.hash.slice(1));
  const [tipus, ...resz] = h.split("/");
  const ertek = resz.join("/");
  if (tipus === "e" && resz.length >= 2) { mod("temak"); egyseg(+resz[0], +resz[1]); }
  else if (tipus === "n" && ertek) { mod("szam"); $("#szam").value = ertek; szamLap(+ertek); }
  else if (tipus === "t" && TSZ[+ertek]) { mod("szoveg"); $("#kerdes").value = TSZ[+ertek].t; await kereses(TSZ[+ertek].t, TSZ[+ertek]); }
  else if (tipus === "q" && ertek) { mod("szoveg"); $("#kerdes").value = ertek; await kereses(ertek, tszKeres(ertek)); }
  else $("#eredmeny").innerHTML = "";
}
window.addEventListener("hashchange", utvonal);
$("#straktatus").onchange = () => { if (location.hash.startsWith("#q/") || location.hash.startsWith("#t/")) utvonal(); };

[T, SZ, TSZ] = await Promise.all([json("data/tetelek.json"), json("data/szerkezet.json"), json("data/targyszotar.json")]);
for (const t of T) szam.set(t.n, t);
for (const r of SZ.reszek) bejar(r.tr, null, r.pars);
fa();
tszLista();
szamLista();
utvonal();
