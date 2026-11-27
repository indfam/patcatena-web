// Ott-dogmatika kereső: tételek magyarul, minősítéssel és Denzinger-linkekkel (statikus adatok + Pagefind).
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const V = new URL(import.meta.url).searchParams.get("v") || "";
const json = async (u) => { const r = await fetch(V ? `${u}?v=${V}` : u); if (!r.ok) throw new Error(u); return r.json(); };
const DENZ = "../denzinger/";

let T = [], SZ = {}, pagefind = null;
const sorsz = new Map();

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
const MODOK = ["temak", "szoveg", "minos"];
function mod(nev) {
  for (const m of MODOK) { $(`#tab-${m}`).setAttribute("aria-selected", m === nev); $(`#panel-${m}`).hidden = m !== nev; }
}
for (const m of MODOK) $(`#tab-${m}`).onclick = () => mod(m);

const osztaly = (m) => m === "De fide" ? "de-fide" : m === "Sententia fidei proxima" ? "fidei-proxima" : "";
const reszCim = (r) => SZ.reszek.find((x) => x.resz === r);
const parCim = (r, p) => (reszCim(r)?.par.find((x) => x[0] === p) || [])[1] || "";

function tetelHtml(t, helyKell = true) {
  const r = reszCim(t.resz);
  const dl = t.d.length ? `<p class="dlink">Denzinger: ${t.d.map((d) => `<a href="${DENZ}#d/${d}" target="_blank" rel="noopener">D ${d}</a>`).join("")}</p>` : "";
  return `<div class="tetel" id="t${t.s}">
    <p class="fej"><span>${t.s}. tétel</span><span class="minos ${osztaly(t.m)}" title="${esc(t.m)}">${esc(SZ.minosites[t.m] || t.m)}</span>
      ${helyKell ? `<a href="#p/${t.resz}/${t.par}">${esc(r.cim)}, ${t.par}. § ${esc(parCim(t.resz, t.par))}</a>` : ""}</p>
    <p class="hu" lang="hu">${esc(t.hu)}</p>
    <p class="en" lang="en">${esc(t.en)}${t.m ? ` <i>(${esc(t.m)})</i>` : ""}</p>${dl}</div>`;
}

// ---- Témák (szerkezet) ----
function fa() {
  let konyv = "";
  $("#fa").innerHTML = SZ.reszek.map((r) => {
    const fej = r.konyv !== konyv ? `<p class="konyv">${esc(r.konyv)}</p>` : "";
    konyv = r.konyv;
    const db = r.par.reduce((n, p) => n + p[3].length, 0);
    return `${fej}<details><summary>${esc(r.cim)} <span class="angolcim">(${db} tétel)</span></summary><ul>${r.par.map((p) =>
      `<li><a href="#p/${r.resz}/${p[0]}">${p[0]}. § ${esc(p[1] || p[2])}</a> <span>${p[3].length ? `· ${p[3].length} tétel` : ""}</span></li>`).join("")}</ul></details>`;
  }).join("");
}
function parLap(r, p) {
  const resz = reszCim(r); if (!resz) return;
  const par = resz.par.find((x) => x[0] === p);
  const tt = T.filter((t) => t.resz === r && t.par === p);
  $("#eredmeny").innerHTML = `<section class="egyseg"><p class="szamok">${esc(resz.konyv)} · ${esc(resz.cim)}</p>
    <h2 class="doknev">${p}. § ${esc(par ? par[1] : "")}</h2>${par && par[2] ? `<p class="angolcim">${esc(par[2])}</p>` : ""}
    ${tt.length ? tt.map((t) => tetelHtml(t, false)).join("") : `<p class="uzenet">Ehhez a paragrafushoz nincs külön kiemelt tétel.</p>`}
    <div class="lapozo">${szomszed(r, p, -1)}${szomszed(r, p, 1)}</div></section>`;
}
function szomszed(r, p, irany) {
  const lista = SZ.reszek.flatMap((x) => x.par.map((y) => [x.resz, y[0]]));
  const i = lista.findIndex(([a, b]) => a === r && b === p) + irany;
  if (i < 0 || i >= lista.length) return `<button disabled>${irany < 0 ? "Előző" : "Következő"} §</button>`;
  return `<a class="gomb" href="#p/${lista[i][0]}/${lista[i][1]}">${irany < 0 ? "Előző" : "Következő"} §</a>`;
}

// ---- Minősítés szerint ----
function minosLista() {
  const db = {}; for (const t of T) db[t.m] = (db[t.m] || 0) + 1;
  $("#minoslista").innerHTML = Object.keys(SZ.minosites).filter((m) => db[m] && m).map((m) =>
    `<a class="gomb" href="#m/${encodeURIComponent(m)}">${esc(SZ.minosites[m])} (${db[m]})</a>`).join("");
  $("#sminos").innerHTML = `<option value="">mind</option>` + Object.keys(SZ.minosites).filter((m) => db[m]).map((m) =>
    `<option value="${esc(SZ.minosites[m])}">${esc(SZ.minosites[m])}</option>`).join("");
}
function minosLap(m) {
  const tt = T.filter((t) => t.m === m);
  $("#eredmeny").innerHTML = `<section class="egyseg"><h2 class="doknev">${esc(SZ.minosites[m] || m)}</h2>
    <p class="osszegzes">${tt.length} tétel</p>${tt.map((t) => tetelHtml(t)).join("")}</section>`;
}

// ---- Szöveges keresés ----
async function szovegKereses(q) {
  const ki = $("#eredmeny");
  ki.innerHTML = `<p class="toltes">Keresés…</p>`;
  if (!pagefind) {
    pagefind = await import(`./pagefind/pagefind.js${V ? "?v=" + V : ""}`);
    await pagefind.options({ excerptLength: 30 });
  }
  const filters = $("#sminos").value ? { minosites: $("#sminos").value } : {};
  const r = await pagefind.search(q, { filters });
  if (!r.results.length) { ki.innerHTML = `<p class="uzenet">Nincs találat erre: „${esc(q)}”. Próbálja más szóalakkal vagy angolul.</p>`; return; }
  const adat = await Promise.all(r.results.slice(0, 120).map((x) => x.data()));
  ki.innerHTML = `<p class="osszegzes">${r.results.length} tétel</p>` +
    adat.map((a) => sorsz.get(+a.meta.k)).filter(Boolean).map((t) => tetelHtml(t)).join("");
}

// ---- Útvonalak: #p/<rész>/<§> · #t/<sorszám> · #m/<minősítés> · #q/szavak ----
$("#urlap-szoveg").onsubmit = (ev) => {
  ev.preventDefault();
  const h = `#q/${encodeURIComponent($("#kerdes").value.trim())}`;
  if (location.hash === h) utvonal(); else location.hash = h;
};
let elso = true;
async function utvonal() {
  const h = decodeURIComponent(location.hash.slice(1));
  const [tipus, ...resz] = h.split("/");
  const ertek = resz.join("/");
  if (tipus === "p" && resz.length >= 2) { mod("temak"); parLap(+resz[0], +resz[1]); if (!elso) gorget($("#eredmeny")); }
  else if (tipus === "t" && sorsz.get(+ertek)) { const t = sorsz.get(+ertek); mod("temak"); parLap(t.resz, t.par); gorget($(`#t${t.s}`)); }
  else if (tipus === "m" && ertek) { mod("minos"); minosLap(ertek); }
  else if (tipus === "q" && ertek) { mod("szoveg"); $("#kerdes").value = ertek; await szovegKereses(ertek); }
  else $("#eredmeny").innerHTML = "";
  elso = false;
}
window.addEventListener("hashchange", utvonal);

[T, SZ] = await Promise.all([json("data/tetelek.json"), json("data/szerkezet.json")]);
for (const t of T) sorsz.set(t.s, t);
fa();
minosLista();
utvonal();
