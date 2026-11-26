// Wuest liturgikus kereső: statikus adatokból (data/) dolgozik, a szöveges kereséshez Pagefindet használ.
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const V = new URL(import.meta.url).searchParams.get("v") || "";
const json = async (u) => { const r = await fetch(V ? `${u}?v=${V}` : u); if (!r.ok) throw new Error(u); return r.json(); };
const DARAB = 40;
const ANGOL_PDF = "https://isidore.co/misc/Res%20pro%20Deo/ITOPL_OCR-layer-only/11a.%20Liturgy/d-Matters%20Liturgical-%201959_OCR.pdf";
const LATIN_IA = "https://archive.org/details/collectiorerumli00wues/page/n";
const ekezetNelkul = (t) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

let A = [], L = [], PAR = {}, MUT = [], TSZ = [], pagefind = null;
const cache = new Map();
const aIdx = new Map(), lIdx = new Map();
async function szoveg(k, i) {
  const d = Math.floor(i / DARAB), kulcs = `${k}${d}`;
  if (!cache.has(kulcs)) cache.set(kulcs, json(`data/${k}/${d}.json`));
  return (await cache.get(kulcs))[i % DARAB];
}

const RESZLET = new Set(["a", "l", "lm"]);

// ---- Felugró ablak a tételekhez: a keret tetején nyílik, a lista (találatok, témafa) a helyén marad ----
const ABLAK = $("#ablak");
let lista = "";  // az utolsó listanézet címe (#q/…, #t/…); bezáráskor ide tér vissza
const reszlet = (h) => RESZLET.has(decodeURIComponent(h.slice(1)).split("/")[0]);
// Beágyazva (WordPress-iframe) a keret a teljes tartalom magasságú, ezért a felugró ablak ott nyílik, ahol a
// kattintott elem van – így a látható részen marad, és bezáráskor nem kell visszagörgetni. Önálló lapon a tetején.
let kattY = null;
document.addEventListener("click", (e) => {
  const a = e.target.closest("a, button");
  if (a && !a.closest("dialog")) kattY = a.getBoundingClientRect().top;
}, true);
document.addEventListener("submit", (e) => { kattY = e.target.getBoundingClientRect().top; }, true);
function helyez(dlg) {
  if (parent === window || kattY === null) { dlg.style.marginTop = ""; return; }
  const t = Math.min(Math.max(16, kattY - 60), Math.max(16, innerHeight - dlg.offsetHeight - 16));
  dlg.style.marginTop = `${t}px`;
}
function ablakNyit() { if (!ABLAK.open) { ABLAK.showModal(); helyez(ABLAK); } ABLAK.scrollTop = 0; }
const ablakba = (html) => { $("#ablak-tartalom").innerHTML = html; ablakNyit(); };
new ResizeObserver(() => ABLAK.open && helyez(ABLAK)).observe(ABLAK);  // betöltés után is a keretben maradjon
$("#ablak-bezar").onclick = () => ABLAK.close();
ABLAK.addEventListener("click", (e) => { if (e.target === ABLAK) ABLAK.close(); });
ABLAK.addEventListener("close", () => {
  if (reszlet(location.hash)) history.replaceState(null, "", lista ? `#${lista}` : location.pathname + location.search);
});

// ---- Magasság jelzése a beágyazó oldalnak (WordPress-iframe) ----
const jelezMagassag = () => parent !== window &&
  parent.postMessage({ type: "patcatena-magassag", h: document.documentElement.scrollHeight }, "*");
new ResizeObserver(jelezMagassag).observe(document.body);

// ---- Módváltás ----
function mod(nev) {
  for (const m of ["tema", "szoveg", "szam"]) {
    $(`#tab-${m}`).setAttribute("aria-selected", m === nev);
    $(`#panel-${m}`).hidden = m !== nev;
  }
}
for (const m of ["tema", "szoveg", "szam"]) $(`#tab-${m}`).onclick = () => mod(m);

// ---- Témafa: rész → fejezet → tétel ----
function fa() {
  const reszek = [];
  for (const t of A) {
    let r = reszek[reszek.length - 1];
    if (!r || r.nev !== t[2]) reszek.push(r = { nev: t[2], en: t[6], fej: [] });
    let f = r.fej[r.fej.length - 1];
    if (!f || f.nev !== t[3]) r.fej.push(f = { nev: t[3], en: t[7], tetel: [] });
    f.tetel.push(t);
  }
  $("#fa").innerHTML = reszek.map((r) => `<li><details><summary>${esc(r.nev)}</summary>${r.fej.map((f) =>
    `<details class="fej"><summary>${esc(f.nev)} <span class="angolcim">(${esc(f.en)})</span></summary><ul class="tetelek">${f.tetel.map((t) =>
      `<li><span>${esc(t[0])}.</span><a href="#a/${esc(t[0])}">${esc(t[4] || t[5])}</a></li>`).join("")}</ul></details>`).join("")}</details></li>`).join("");
}

// ---- Fordítás és másolás ----
const tiszta = (t) => t.replace(/ ¶ /g, " ").replace(/\s+/g, " ").trim();
const masolando = (t) => tiszta(t);  // a Szöveg másolása csak magát a szöveget másolja
function aiModLink(t) {
  let s = tiszta(t);
  if (encodeURIComponent(s).length > 6000) {
    while (encodeURIComponent(s).length > 6000) s = s.slice(0, Math.floor(s.length * 0.9));
    s += " […]";
  }
  return `https://www.google.com/search?udm=50&hl=hu&q=${encodeURIComponent(`fordítsd: "${s}"`)}`;
}
function regiMasolas(t) {
  const ta = document.createElement("textarea");
  ta.value = t; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
  document.body.append(ta); ta.select();
  let ok = false;
  try { ok = document.execCommand("copy"); } catch { ok = false; }
  ta.remove();
  return ok;
}
function gombok(k, i, t, n) {
  return `<div class="lapozo">
      <button data-lap="${i - 1}" ${i === 0 ? "disabled" : ""}>Előző</button>
      <button id="masol">Szöveg másolása</button>
      <a class="gomb" href="${esc(aiModLink(t))}" target="_blank" rel="noopener">Fordítás (Google AI mód)</a>
      <button data-lap="${i + 1}" ${i === n - 1 ? "disabled" : ""}>Következő</button>
    </div>`;
}
function bekot(k, t) {
  document.querySelectorAll("[data-lap]").forEach((b) => b.onclick = () => {
    const i = +b.dataset.lap; location.hash = `#${k}/${(k === "a" ? A : L)[i][0]}`;
  });
  $("#masol").onclick = async () => {
    const s = masolando(t);
    let ok = false;
    try { await navigator.clipboard.writeText(s); ok = true; } catch { ok = regiMasolas(s); }
    $("#masol").textContent = ok ? "Szöveg másolva" : "Másolás nem sikerült";
    setTimeout(() => { const b = $("#masol"); if (b) b.textContent = "Szöveg másolása"; }, 2000);
  };
}
const bekezdesek = (t) => t.split(" ¶ ").map((p) => `<p>${esc(p)}</p>`).join("");

async function angolLap(n) {
  const i = aIdx.get(String(n));
  if (i === undefined) { ablakba(`<p class="uzenet">Az angol kiadásban nincs ${esc(n)}. számú tétel (vagy a gépi tagolás nem találta meg).</p>`); return; }
  const t = A[i], sz = await szoveg("a", i);
  const kapcs = (PAR["a" + t[0]] || []).filter((x) => lIdx.has(x));
  ablakba(`<article class="egyseg">
    <p class="szamok">Matters Liturgical (1959), ${esc(t[0])}. tétel <span>· ${esc(t[2])} · ${esc(t[3])}</span></p>
    <h2 class="doknev">${esc(t[4] || t[5])}</h2>
    <p class="angolcim">${esc(t[5])}</p>
    <div lang="en">${bekezdesek(sz)}</div>
    ${kapcs.length ? `<p class="kapcs">Kapcsolódó bekezdések a latin kiadásban (közös döntések alapján): ${kapcs.map((x) => `<a href="#l/${x}">${x}.</a>`).join(" · ")}</p>` : ""}
    <p class="forrasjel">Gépi olvasású szöveg. <a href="${ANGOL_PDF}#page=${esc(t[1])}" target="_blank" rel="noopener">Az eredeti oldal (PDF, ${esc(t[1])}. oldal)</a></p>
    ${gombok("a", i, sz, A.length)}
  </article>`);
  bekot("a", sz);
}
async function latinLap(n) {
  const i = lIdx.get(String(n));
  if (i === undefined) { ablakba(`<p class="uzenet">A latin kiadásban a ${esc(n)}. bekezdést a gépi tagolás nem találta meg; valószínűleg az előző bekezdés végén olvasható.</p>`); return; }
  const t = L[i], sz = await szoveg("l", i);
  const kapcs = (PAR["l" + t[0]] || []).filter((x) => aIdx.has(x));
  ablakba(`<article class="egyseg">
    <p class="szamok">Collectio Rerum Liturgicarum (1915), ${esc(t[0])}. bekezdés <span>· ${esc(t[2])}</span></p>
    <div lang="la"><p>${esc(sz)}</p></div>
    ${kapcs.length ? `<p class="kapcs">Kapcsolódó tételek az angol kiadásban (közös döntések alapján): ${kapcs.map((x) => `<a href="#a/${x}">${x}. ${esc(A[aIdx.get(x)][4] || A[aIdx.get(x)][5])}</a>`).join(" · ")}</p>` : ""}
    <p class="forrasjel">Gépi olvasású szöveg, OCR-hibák lehetnek benne. <a href="${LATIN_IA}${+t[1] - 1}" target="_blank" rel="noopener">Az eredeti oldal (Internet Archive)</a></p>
    ${gombok("l", i, sz, L.length)}
  </article>`);
  bekot("l", sz);
}

// ---- Tárgyszótár és latin tárgymutató ----
const tszReszek = (t) => t.split(/[,()]/).map((x) => ekezetNelkul(x)).filter(Boolean);
function tszKeres(q) {
  const n = ekezetNelkul(q);
  const pontos = TSZ.findIndex((t) => ekezetNelkul(t[1]) === n || tszReszek(t[1]).includes(n));
  const hasonlo = TSZ.map((t, i) => [t, i]).filter(([t, i]) => i !== pontos && n.length >= 3 &&
    tszReszek(t[1]).some((r) => r.includes(n) || r.split(" ").some((w) => w.startsWith(n)))).map(([, i]) => i);
  return { pontos: pontos >= 0 ? pontos : null, hasonlo };
}
function listak() {
  const kat = [...new Set(TSZ.map((t) => t[0]))];
  $("#tszlista").innerHTML = kat.map((k) => `<div class="tszkat"><h4>${esc(k)}</h4><p>${TSZ.map((t, i) => [t, i]).filter(([t]) => t[0] === k)
    .map(([t, i]) => `<a href="#t/${i}">${esc(t[1])}</a>`).join(" · ")}</p></div>`).join("");
  $("#lmutato").innerHTML = MUT.map((m, i) => `<a href="#lm/${i}">${esc(m[0])}</a>`).join("");
}
function mutatoLap(i) {
  const [cimszo, sz, nums] = MUT[i];
  ablakba(`<section class="egyseg"><p class="szamok">Index alphabeticus (1915)</p><h2 class="doknev">${esc(cimszo)}</h2>
    <p lang="la">${esc(sz)}</p><p class="kapcs">Bekezdések: ${nums.map((n) => lIdx.has(String(n)) ? `<a href="#l/${n}">${n}.</a>` : `${n}.`).join(" · ")}</p></section>`);
}

// ---- Szöveges keresés (Pagefind) ----
function valtozatok(q) {
  const u = q.toLowerCase().replace(/v/g, "u").replace(/j/g, "i");
  const v = u.replace(/(^|[^a-z])u(?=[aeiou])|(?<=[aeiou])u(?=[aeiou])/g, (m, p) => (p ?? "") + "v");
  return [...new Set([q, u, v])];
}
async function szovegKereses(q, tsz = null) {
  const ki = $("#eredmeny");
  ki.innerHTML = `<p class="toltes">Keresés…</p>`;
  if (!pagefind) {
    pagefind = await import(`./pagefind/pagefind.js${V ? "?v=" + V : ""}`);
    await pagefind.options({ excerptLength: 40 });
  }
  const tk = tsz === null ? tszKeres(q) : { pontos: tsz, hasonlo: [] };
  const t = tk.pontos !== null ? TSZ[tk.pontos] : null;
  const kerdesek = t ? [...t[2], ...t[3]].flatMap(valtozatok) : valtozatok(q);
  const filters = $("#kiadas").value ? { kiadas: $("#kiadas").value } : {};
  const eredm = await Promise.all([...new Set(kerdesek)].map((v) => pagefind.search(v, { filters })));
  const lattuk = new Set(), talalatok = [];
  for (const r of eredm) for (const x of r.results) if (!lattuk.has(x.id)) { lattuk.add(x.id); talalatok.push(x); }
  const fej = (t ? `<p class="tszfej">Tárgyszó: <b>${esc(t[1])}</b> <span>(${esc(t[0])})</span> – keresve: ${esc([...t[2], ...t[3]].join(", "))}</p>` : "") +
    (tk.hasonlo.length ? `<p class="tszfej">Hasonló tárgyszavak: ${tk.hasonlo.slice(0, 12).map((i) => `<a href="#t/${i}">${esc(TSZ[i][1])}</a>`).join(" · ")}</p>` : "");
  if (!talalatok.length) { ki.innerHTML = fej + `<p class="uzenet">Nincs találat erre: „${esc(q)}”. Próbálja angolul vagy latinul, vagy válasszon a tárgyszavak közül.</p>`; return; }
  ki.innerHTML = fej + `<p class="osszegzes">${talalatok.length} találat</p><div id="talalatok"></div><button class="tobb" id="tobb" hidden>További találatok</button>`;
  let n = 0;
  const lap = async () => {
    const adat = await Promise.all(talalatok.slice(n, n + 20).map((x) => x.data()));
    n += adat.length;
    $("#talalatok").insertAdjacentHTML("beforeend", adat.map((a) => {
      const k = a.meta.k, tip = k[0], szam = k.slice(1);
      const felirat = tip === "a" ? `Angol (1959), ${szam}. tétel` : `Latin (1915), ${szam}. bekezdés`;
      return `<div class="talalat"><h4><a href="#${tip}/${szam}">${esc(felirat)}</a> <span class="angolcim">${esc(a.meta.cim || "")}</span></h4><p>${a.excerpt}</p></div>`;
    }).join(""));
    $("#tobb").hidden = n >= talalatok.length;
  };
  $("#tobb").onclick = lap;
  await lap();
}

// ---- Útvonalak ----
$("#urlap-szam").onsubmit = (ev) => { ev.preventDefault(); location.hash = `#${$("#szamkiadas").value}/${$("#szam").value.trim()}`; };
$("#urlap-szoveg").onsubmit = (ev) => { ev.preventDefault(); location.hash = `#q/${encodeURIComponent($("#kerdes").value.trim())}`; };
async function utvonal() {
  const h = decodeURIComponent(location.hash.slice(1));
  const [tipus, ...resz] = h.split("/");
  const ertek = resz.join("/");
  if (tipus === "a" && ertek) { await angolLap(ertek); return; }
  if (tipus === "l" && ertek) { await latinLap(ertek); return; }
  if (tipus === "lm" && MUT[+ertek]) { mutatoLap(+ertek); return; }
  if (ABLAK.open) ABLAK.close();
  if (h === lista && $("#eredmeny").innerHTML.trim()) return;  // visszatérés a már kirakott listához
  lista = h;
  if (tipus === "t" && TSZ[+ertek]) { mod("szoveg"); $("#kerdes").value = TSZ[+ertek][1]; await szovegKereses(TSZ[+ertek][1], +ertek); }
  else if (tipus === "q" && ertek) { mod("szoveg"); $("#kerdes").value = ertek; await szovegKereses(ertek); }
  else { lista = ""; $("#eredmeny").innerHTML = ""; }
}
window.addEventListener("hashchange", utvonal);

[A, L, PAR, MUT, TSZ] = await Promise.all(["angol", "latin", "parok", "mutato", "targyszotar"].map((x) => json(`data/${x}.json`)));
A.forEach((t, i) => aIdx.set(t[0], i));
L.forEach((t, i) => lIdx.set(t[0], i));
fa();
listak();
utvonal();
