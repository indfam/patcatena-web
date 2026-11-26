// Denzinger-kereső: statikus adatokból (data/) dolgozik, a szöveges kereséshez Pagefindet használ.
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const V = new URL(import.meta.url).searchParams.get("v") || "";
const json = async (u) => { const r = await fetch(V ? `${u}?v=${V}` : u); if (!r.ok) throw new Error(u); return r.json(); };
const DARAB = 100;

let MUT = [], DOK = [], pagefind = null;
const darabCache = new Map();
async function egyseg(i) {
  const d = Math.floor(i / DARAB);
  if (!darabCache.has(d)) darabCache.set(d, json(`data/e/${d}.json`));
  const [D, ds, megj, latin, lforras, angol, acim, dsforras] = (await darabCache.get(d))[i % DARAB];
  return { i, D, ds: ds ? ds.split(",") : [], megj, latin, lforras, angol, acim, dsforras, dok: MUT[i][2] };
}

// ---- Magasság jelzése a beágyazó oldalnak (WordPress-iframe) ----
const jelezMagassag = () => parent !== window &&
  parent.postMessage({ type: "patcatena-magassag", h: document.documentElement.scrollHeight }, "*");
new ResizeObserver(jelezMagassag).observe(document.body);

// ---- Módváltás ----
function mod(nev) {
  for (const m of ["szam", "szoveg", "dok"]) {
    $(`#tab-${m}`).setAttribute("aria-selected", m === nev);
    $(`#panel-${m}`).hidden = m !== nev;
  }
}
for (const m of ["szam", "szoveg", "dok"]) $(`#tab-${m}`).onclick = () => { mod(m); if (m === "dok") dokLista(); };

// ---- Számkeresés ----
const szamErtek = (s) => { const m = String(s).match(/^(\d+)([a-z]?)$/); return m ? +m[1] + (m[2] ? (m[2].charCodeAt(0) - 96) / 100 : 0) : NaN; };
function keresSzam(tipus, szam) {
  szam = String(szam).trim().toLowerCase().replace(/^(ds|dh|d)\s*/, "");
  if (tipus === "ds") {
    let i = MUT.findIndex((m) => m[1].split(",").includes(szam));
    if (i >= 0) return { i, pontos: true };
    // nincs pontosan ilyen szám (pl. hiányzó görög tétel): a következő meglévő
    const c = szamErtek(szam);
    i = MUT.findIndex((m) => m[1] && m[1].split(",").some((x) => szamErtek(x) >= c));
    return i >= 0 ? { i, pontos: false } : null;
  }
  let i = MUT.findIndex((m) => m[0] === szam);
  if (i >= 0) return { i, pontos: true };
  const c = szamErtek(szam);
  i = MUT.findIndex((m) => m[0] && szamErtek(m[0]) >= c);
  return i >= 0 ? { i, pontos: false } : null;
}

function szamFelirat(e) {
  const ds = e.ds.length ? `DS ${e.ds.length > 1 ? `${e.ds[0]}–${e.ds[e.ds.length - 1]}` : e.ds[0]}` : "";
  const d = e.D ? `D ${e.D}` : "";
  return [ds, d].filter(Boolean).join(" · ");
}
function latinHtml(t) {
  return t.split(/(?=⟦\d+[a-z]?⟧)/).map((r) => {
    const m = r.match(/^⟦(\d+[a-z]?)⟧\s*(.*)$/s);
    return m ? `<p><span class="ds-jel">${esc(m[1])}</span>${esc(m[2])}</p>` : `<p>${esc(r)}</p>`;
  }).join("");
}
const forditasKeres = (t) => `fordítsd: "${t.replace(/⟦(\d+[a-z]?)⟧/g, "[DS $1]").replace(/\s+/g, " ").trim()}"`;
function aiModLink(t) {
  let s = t.replace(/⟦(\d+[a-z]?)⟧/g, "[DS $1]").replace(/\s+/g, " ").trim();
  if (encodeURIComponent(s).length > 6000) {
    while (encodeURIComponent(s).length > 6000) s = s.slice(0, Math.floor(s.length * 0.9));
    s += " […]";
  }
  return `https://www.google.com/search?udm=50&hl=hu&q=${encodeURIComponent(`fordítsd: "${s}"`)}`;
}

// A magyar fordítás (Fila Béla – Jug László, az új számozás szerint) a denzingerhu.wordpress.com oldalain olvasható:
// az oldalak kezdő DS-száma és címe. A szöveget nem vesszük át, csak a megfelelő oldalra linkelünk.
const FJ_OLDALAK = [[101,"magyar-denzinger/dokumentum-101/"],[150,"dok-150/"],[211,"dok-211/"],[250,"dok/"],[300,"dok-300/"],[350,"dok-350/"],[401,"dok-401/"],[450,"fj-450/"],[500,"dok-500/"],[550,"fj-550/"],[600,"fj-600/"],[650,"fj-650/"],[700,"fj-700/"],[751,"fj-751/"],[800,"fj-800/"],[850,"fj-850/"],[891,"fj-891/"],[950,"fj-950/"],[1000,"magyar-denzinger/dok-1000/"],[1050,"fj-1050/"],[1100,"fj-1100/"],[1150,"fj-1150/"],[1201,"fj-1201/"],[1300,"fj-1300/"],[1355,"fj-1355/"],[1400,"fj-1400/"],[1451,"fj-1451/"],[1500,"fj-1500/"],[1600,"fj-1600/"],[1667,"fj-1667/"],[1701,"fj-1701/"],[1763,"fj-1763/"],[1820,"fj-1820/"],[1900,"fj-1900/"],[1981,"fj-1981/"],[1999,"magyar-denzinger/dok-1999/"],[2101,"fj-1999/"],[2201,"fj-2201/"],[2300,"fj2300/"],[2400,"fj-2400/"],[2509,"fj-2509/"],[2546,"fj-2546/"],[2600,"fj-2600/"],[2705,"fj-2705/"],[2800,"fj-2800/"],[2850,"fj-2850/"],[2901,"fj-2901/"],[3000,"magyar-denzinger/dok-3000/"],[3100,"fj-3050/"],[3150,"fj-3150/"],[3201,"fj-3201/"],[3255,"fj-3255/"],[3300,"fj-3300/"],[3350,"fj-3350/"],[3401,"fj-3398/"],[3503,"fj-3503/"],[3601,"fj-3601/"],[3650,"fj-3650/"],[3700,"fj-3700/"],[3750,"fj-3750/"],[3800,"fj-3800/"],[3840,"fj-3840/"],[3900,"fj-3900/"],[3998,"fj-3998/"],[4500,"fj-4500/"]];
function fjLink(ds) {
  const n = parseInt(ds, 10);
  if (!n) return "";
  if (n < 101) return "https://denzingerhu.wordpress.com/hitvallasok/";
  let o = FJ_OLDALAK[0];
  for (const x of FJ_OLDALAK) if (x[0] <= n) o = x;
  // A Fila–Jug-oldalakon a bekezdések „{1525}” jelöléssel kezdődnek: szövegtöredék-hivatkozással (#:~:text=) a böngésző
  // (Chrome, Edge, Safari, újabb Firefox) odagörget és kiemeli; ha a jel nincs az oldalon, egyszerűen az oldal eleje nyílik meg
  return `https://denzingerhu.wordpress.com/${o[1]}#:~:text=${encodeURIComponent(`{${ds}}`)}`;
}

async function egysegLap(i, megjegyzes = "") {
  const ki = $("#eredmeny");
  ki.innerHTML = `<p class="toltes">Betöltés…</p>`;
  const e = await egyseg(i);
  const dok = DOK[e.dok];
  const forras = e.lforras === "ocr1911"
    ? "Latin: a 11. kiadás (1911) gépi olvasású szövege – OCR-hibák lehetnek benne."
    : e.lforras === "catho" ? "Latin: catho.org. " : "";
  ki.innerHTML = `<article class="egyseg">
    ${megjegyzes ? `<p class="uzenet">${esc(megjegyzes)}</p>` : ""}
    <p class="szamok">${esc(szamFelirat(e))}${e.dsforras === "filajug" ? ` <span>(az új szám a Fila–Jug-féle összehasonlító táblázat szerint)</span>` : ""}</p>
    <p class="doknev"><a href="#dok/${e.dok}">${esc(dok[0] || "–")}</a></p>
    ${dok[3] && dok[3] !== dok[0] ? `<p class="angolcim">${esc(dok[3])}</p>` : ""}
    ${e.acim ? `<p class="angolcim">${esc(e.acim)}</p>` : ""}
    ${e.megj ? `<p class="angolcim">${esc(e.megj)}</p>` : ""}
    <div class="ket-hasab">
      <div lang="la"><h3>Latin</h3>${e.latin ? latinHtml(e.latin) : `<p class="uzenet">A latin szöveg nincs meg a forrásokban.</p>`}</div>
      <div lang="en"><h3>Angol (Deferrari, régi számozás)</h3>${e.angol ? `<p>${esc(e.angol)}</p>` : `<p class="uzenet">${e.D ? "Ehhez a számhoz nincs angol szöveg." : "Ez a tétel a régi kiadásban (és így az angol fordításban) nem szerepel."}</p>`}</div>
    </div>
    ${e.ds.length ? `<p class="magyar"><a href="${esc(fjLink(e.ds[0]))}" target="_blank" rel="noopener">Magyarul: Fila–Jug-fordítás (denzingerhu.wordpress.com)</a> – a megnyíló oldal a {${esc(e.ds[0])}} bekezdéshez görget.</p>` : ""}
    <p class="forrasjel">${esc(forras)}${e.angol ? "Angol: R. J. Deferrari, The Sources of Catholic Dogma (1955/57), patristica.net." : ""}</p>
    <div class="lapozo">
      <button id="elozo" ${i === 0 ? "disabled" : ""}>Előző tétel</button>
      <button id="masol" ${e.latin ? "" : "disabled"}>Szöveg másolása</button>
      ${e.latin ? `<a class="gomb" href="${esc(aiModLink(e.latin))}" target="_blank" rel="noopener">Fordítás (Google AI mód)</a>` : ""}
      <button id="kovetkezo" ${i === MUT.length - 1 ? "disabled" : ""}>Következő tétel</button>
    </div>
  </article>`;
  $("#elozo").onclick = () => nyit(i - 1);
  $("#kovetkezo").onclick = () => nyit(i + 1);
  $("#masol").onclick = async () => {
    const t = forditasKeres(e.latin);
    let ok = false;
    try { await navigator.clipboard.writeText(t); ok = true; } catch { ok = regiMasolas(t); }
    $("#masol").textContent = ok ? "Szöveg másolva" : "Másolás nem sikerült";
    setTimeout(() => { const b = $("#masol"); if (b) b.textContent = "Szöveg másolása"; }, 2000);
  };
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
// A hely címe a legpontosabb meglévő szám (DS, ha van)
function nyit(i) {
  const [d, ds] = MUT[i];
  const h = ds ? `#ds/${ds.split(",")[0]}` : `#d/${d}`;
  if (location.hash === h) egysegLap(i); else location.hash = h;
}

// ---- Dokumentumok ----
function dokTartomany(k) {
  const [, elso, n] = DOK[k];
  const ds = MUT.slice(elso, elso + n).flatMap((m) => (m[1] ? m[1].split(",") : []));
  const d = MUT.slice(elso, elso + n).map((m) => m[0]).filter(Boolean);
  return [ds.length ? `DS ${ds[0]}${ds.length > 1 ? "–" + ds[ds.length - 1] : ""}` : "", d.length ? `D ${d[0]}${d.length > 1 ? "–" + d[d.length - 1] : ""}` : ""]
    .filter(Boolean).join(" · ");
}
function dokLista() {
  const q = $("#dokszuro").value.trim().toLowerCase();
  const nq = ekezetNelkul(q);
  const sorok = DOK.map((d, k) => [d, k]).filter(([d]) => !q || ekezetNelkul(d[0]).includes(nq) || ekezetNelkul(d[3] || "").includes(nq));
  $("#doklista").innerHTML = sorok.slice(0, 400).map(([d, k]) =>
    `<li><span class="tart">${esc(dokTartomany(k))}</span><a href="#dok/${k}">${esc(d[0] || "–")}</a></li>`).join("") +
    (sorok.length > 400 ? `<li><span></span><span class="tart">… további ${sorok.length - 400} dokumentum – szűkítse a keresést.</span></li>` : "");
}
$("#dokszuro").oninput = dokLista;

async function dokLap(k) {
  const [cim, elso, n, eredeti] = DOK[k];
  const ki = $("#eredmeny");
  ki.innerHTML = `<p class="toltes">Betöltés…</p>`;
  const egysegek = await Promise.all(Array.from({ length: n }, (_, j) => egyseg(elso + j)));
  ki.innerHTML = `<section class="egyseg"><p class="szamok">${esc(dokTartomany(k))}</p><h2 class="doknev">${esc(cim)}</h2>${eredeti && eredeti !== cim ? `<p class="angolcim">${esc(eredeti)}</p>` : ""}
    ${egysegek.map((e) => `<div class="talalat"><h4><a href="#i/${e.i}">${esc(szamFelirat(e))}</a></h4>
      ${e.acim ? `<p class="angolcim">${esc(e.acim)}</p>` : ""}
      <p lang="la">${esc((e.latin || e.angol).replace(/⟦\d+[a-z]?⟧/g, "").slice(0, 260))}…</p></div>`).join("")}</section>`;
}

// ---- Szöveges keresés (Pagefind) ----
function valtozatok(q) {
  const u = q.toLowerCase().replace(/v/g, "u").replace(/j/g, "i");
  const v = u.replace(/(^|[^a-z])u(?=[aeiou])|(?<=[aeiou])u(?=[aeiou])/g, (m, p) => (p ?? "") + "v");
  return [...new Set([q, u, v])];
}
// ---- Magyar tárgyszótár: magyar tárgyszó → latin és angol keresőszavak ----
let TSZ = [];
const ekezetNelkul = (t) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
// A tárgyszó részei (vesszők és zárójelek mentén): „purgatórium (tisztítóhely, tisztítótűz)” → 3 kereshető alak
const tszReszek = (t) => t.split(/[,()]/).map((x) => ekezetNelkul(x)).filter(Boolean);
function tszKeres(q) {
  const n = ekezetNelkul(q);
  if (!n) return { pontos: null, hasonlo: [] };
  const pontos = TSZ.findIndex((t) => ekezetNelkul(t[1]) === n || tszReszek(t[1]).includes(n));
  const hasonlo = TSZ.map((t, i) => [t, i]).filter(([t, i]) => i !== pontos && n.length >= 3 &&
    tszReszek(t[1]).some((r) => r.includes(n) || r.split(" ").some((w) => w.startsWith(n)))).map(([, i]) => i);
  return { pontos: pontos >= 0 ? pontos : null, hasonlo };
}
function tszLista() {
  const kat = [...new Set(TSZ.map((t) => t[0]))];
  $("#tszlista").innerHTML = kat.map((k) => `<div class="tszkat"><h4>${esc(k)}</h4><p>${TSZ.map((t, i) => [t, i]).filter(([t]) => t[0] === k)
    .map(([t, i]) => `<a href="#t/${i}">${esc(t[1])}</a>`).join(" · ")}</p></div>`).join("");
}

async function pfInit() {
  if (!pagefind) {
    pagefind = await import(`./pagefind/pagefind.js${V ? "?v=" + V : ""}`);
    await pagefind.options({ excerptLength: 40 });
  }
}
async function szovegKereses(q, tsz = null) {
  const ki = $("#eredmeny");
  ki.innerHTML = `<p class="toltes">Keresés…</p>`;
  await pfInit();
  // Ha a keresett szó egy magyar tárgyszó, annak latin és angol megfelelőire keresünk
  const tk = tsz === null ? tszKeres(q) : { pontos: tsz, hasonlo: [] };
  const t = tk.pontos !== null ? TSZ[tk.pontos] : null;
  const kerdesek = t ? [...t[2], ...t[3]].flatMap(valtozatok) : valtozatok(q);
  const eredm = await Promise.all([...new Set(kerdesek)].map((v) => pagefind.search(v)));
  const lattuk = new Set(), talalatok = [];
  for (const r of eredm) for (const x of r.results) if (!lattuk.has(x.id)) { lattuk.add(x.id); talalatok.push(x); }
  const fej = (t ? `<p class="tszfej">Tárgyszó: <b>${esc(t[1])}</b> <span>(${esc(t[0])})</span> – keresve: ${esc([...t[2], ...t[3]].join(", "))}</p>` : "") +
    (tk.hasonlo.length ? `<p class="tszfej">Hasonló tárgyszavak: ${tk.hasonlo.slice(0, 12).map((i) => `<a href="#t/${i}">${esc(TSZ[i][1])}</a>`).join(" · ")}</p>` : "");
  if (!talalatok.length) { ki.innerHTML = fej + `<p class="uzenet">Nincs találat erre: „${esc(q)}”. Próbálja latinul vagy angolul, vagy válasszon a tárgyszavak közül.</p>`; return; }
  ki.innerHTML = fej + `<p class="osszegzes">${talalatok.length} tétel</p><div id="talalatok"></div><button class="tobb" id="tobb" hidden>További találatok</button>`;
  let n = 0;
  const lap = async () => {
    const adat = await Promise.all(talalatok.slice(n, n + 20).map((x) => x.data()));
    n += adat.length;
    $("#talalatok").insertAdjacentHTML("beforeend", adat.map((a) => {
      const i = +a.meta.i, [d, ds] = MUT[i];
      const sz = [ds ? `DS ${ds.split(",")[0]}${ds.includes(",") ? "–" + ds.split(",").pop() : ""}` : "", d ? `D ${d}` : ""].filter(Boolean).join(" · ");
      return `<div class="talalat"><h4><a href="#i/${i}">${esc(sz)}</a> <span class="angolcim">${esc(a.meta.cim || "")}</span></h4><p>${a.excerpt}</p></div>`;
    }).join(""));
    $("#tobb").hidden = n >= talalatok.length;
  };
  $("#tobb").onclick = lap;
  await lap();
}

// ---- Útvonalak ----
$("#urlap-szam").onsubmit = (ev) => { ev.preventDefault(); location.hash = `#${$("#szamozas").value}/${$("#szam").value.trim()}`; };
$("#urlap-szoveg").onsubmit = (ev) => { ev.preventDefault(); location.hash = `#q/${encodeURIComponent($("#kerdes").value.trim())}`; };
async function utvonal() {
  const h = decodeURIComponent(location.hash.slice(1));
  const [tipus, ...resz] = h.split("/");
  const ertek = resz.join("/");
  if ((tipus === "ds" || tipus === "d") && ertek) {
    mod("szam"); $("#szamozas").value = tipus; $("#szam").value = ertek;
    const r = keresSzam(tipus, ertek);
    if (!r) { $("#eredmeny").innerHTML = `<p class="uzenet">Nincs ilyen szám: ${esc(tipus.toUpperCase())} ${esc(ertek)}.</p>`; return; }
    await egysegLap(r.i, r.pontos ? "" : `${tipus.toUpperCase()} ${ertek} nincs meg külön tételként; a legközelebbi következő:`);
  } else if (tipus === "i" && ertek) {
    await egysegLap(Math.max(0, Math.min(MUT.length - 1, +ertek)));
  } else if (tipus === "t" && ertek && TSZ[+ertek]) {
    mod("szoveg"); $("#kerdes").value = TSZ[+ertek][1]; await szovegKereses(TSZ[+ertek][1], +ertek);
  } else if (tipus === "q" && ertek) {
    mod("szoveg"); $("#kerdes").value = ertek; await szovegKereses(ertek);
  } else if (tipus === "dok" && ertek) {
    await dokLap(+ertek);
  } else {
    $("#eredmeny").innerHTML = "";
  }
  if (h && tipus !== "q") $("#eredmeny").scrollIntoView({ block: "start" });
}
window.addEventListener("hashchange", utvonal);

[MUT, DOK, TSZ] = await Promise.all([json("data/mutato.json"), json("data/dokumentumok.json"),
  json("data/targyszotar.json").catch(() => [])]);
dokLista();
tszLista();
utvonal();
