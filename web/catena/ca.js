// Catena Aurea kereső: statikus adatokból (data/) dolgozik, a szöveges kereséshez Pagefindet használ.
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const V = new URL(import.meta.url).searchParams.get("v") || "";
const json = async (u) => { const r = await fetch(V ? `${u}?v=${V}` : u); if (!r.ok) throw new Error(u); return r.json(); };
const DARAB = 20;
const EVNEV = { Mt: "Máté", Mk: "Márk", Lk: "Lukács", Jn: "János" };
const CT = "https://www.corpusthomisticum.org/";
const KONYVTAR = { k: "../", f: "../forrasok/" };  // a könyvtár két nyilvános keresője (Kommentár-, ill. Források keresője)

let E = [], SZ = [], BEALL = {}, pagefind = null;
const idIdx = new Map();
const cache = new Map();
async function idezetek(i) {
  const d = Math.floor(i / DARAB);
  if (!cache.has(d)) cache.set(d, json(`data/e/${d}.json`));
  return (await cache.get(d))[i % DARAB];
}
const vulCache = new Map();
const vulgata = (ev) => { if (!vulCache.has(ev)) vulCache.set(ev, json(`data/vulgata/${ev}.json`)); return vulCache.get(ev); };
const helyCim = (e) => `${e[1]} ${e[2]},${e[3]}${e[4] !== e[3] ? "–" + e[4] : ""}`;

// ---- Felugró ablak a szakaszokhoz (a lista a helyén marad); beágyazva a kattintás helyén nyílik ----
const RESZLET = new Set(["e"]);
const ABLAK = $("#ablak");
let lista = "";
const reszlet = (h) => RESZLET.has(decodeURIComponent(h.slice(1)).split("/")[0]);
let kattY = null;
document.addEventListener("click", (e) => {
  const a = e.target.closest("a, button");
  if (a && !a.closest("dialog")) kattY = a.getBoundingClientRect().top;
}, true);
document.addEventListener("submit", (e) => { kattY = e.target.getBoundingClientRect().top; }, true);
function helyez(dlg) {
  if (parent === window || kattY === null) { dlg.style.marginTop = dlg.style.maxHeight = ""; return; }
  const kepernyo = Math.round((screen.availHeight || 900) * 0.7);
  let t = Math.max(16, kattY - 60);
  if (innerHeight - t - 16 < Math.min(kepernyo, 400)) t = Math.max(16, innerHeight - Math.min(kepernyo, 400) - 16);
  dlg.style.marginTop = `${t}px`;
  dlg.style.maxHeight = `${Math.min(kepernyo, innerHeight - t - 16)}px`;
}
function ablakNyit() { if (!ABLAK.open) { ABLAK.showModal(); helyez(ABLAK); } ABLAK.scrollTop = 0; }
new ResizeObserver(() => ABLAK.open && helyez(ABLAK)).observe(ABLAK);
$("#ablak-bezar").onclick = () => ABLAK.close();
ABLAK.addEventListener("click", (e) => { if (e.target === ABLAK) ABLAK.close(); });
ABLAK.addEventListener("close", () => {
  if (reszlet(location.hash)) history.replaceState(null, "", lista ? `#${lista}` : location.pathname + location.search);
});

// ---- Beágyazás: magasság és görgetés kérése a WordPress-oldaltól ----
const jelezMagassag = () => parent !== window &&
  parent.postMessage({ type: "patcatena-magassag", h: document.documentElement.scrollHeight }, "*");
new ResizeObserver(jelezMagassag).observe(document.body);
function gorget(el) {
  if (!el) return;
  if (parent === window) { el.scrollIntoView({ block: "start", behavior: "smooth" }); return; }
  parent.postMessage({ type: "patcatena-gorget", y: Math.round(el.getBoundingClientRect().top + scrollY) }, "*");
}

// ---- Módváltás ----
const MODOK = ["hely", "tartalom", "atyak", "szoveg"];
function mod(nev) {
  for (const m of MODOK) { $(`#tab-${m}`).setAttribute("aria-selected", m === nev); $(`#panel-${m}`).hidden = m !== nev; }
}
for (const m of MODOK) $(`#tab-${m}`).onclick = () => mod(m);

// ---- Fordítás és másolás ----
const tiszta = (t) => t.replace(/ ¶ /g, " ").replace(/\s+/g, " ").trim();
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
async function masol(gomb, t) {
  let ok = false;
  try { await navigator.clipboard.writeText(tiszta(t)); ok = true; } catch { ok = regiMasolas(tiszta(t)); }
  const regi = gomb.textContent;
  gomb.textContent = ok ? "Másolva" : "Másolás nem sikerült";
  setTimeout(() => (gomb.textContent = regi), 2000);
}
const bekezdesek = (t, lang) => t.split(" ¶ ").map((p) => `<p lang="${lang}">${esc(p)}</p>`).join("");

// ---- Egy szakasz ----
async function szakaszHtml(i, kiemelt = null) {
  const e = E[i];
  const [q, vul] = await Promise.all([idezetek(i), vulgata(e[1])]);
  const versek = [];
  for (let v = e[3]; v <= e[4]; v++) if (vul[`${e[2]}:${v}`]) versek.push(`<sup>${v}</sup>${esc(vul[`${e[2]}:${v}`])}`);
  const ct = e[8] ? `<a href="${CT}${e[8].replace("#", ".html#")}" target="_blank" rel="noopener">latin szöveg: Corpus Thomisticum, ${esc(e[1] === "Jn" ? "Io." : e[1] === "Mk" ? "Mc." : e[1] === "Lk" ? "Lc." : "Mt.")} cap. ${e[2]} lectio ${esc(e[5])}</a>` : "";
  const idez = q.map((x, k) => {
    const [kulcs, hu, ecim, en, lcim, la, kt] = x;
    const kv = kt ? `<a class="konyvtar" href="${KONYVTAR[kt[0]]}#u/${kt[1]}/${encodeURIComponent(kt[2])}" target="_blank" rel="noopener">Latin eredeti a könyvtárban: ${esc(kt[3])} ${esc(kt[2])}</a>` : "";
    const szovegek = la
      ? `<div class="ket-hasab"><div><h3>Latin${lcim ? ` (${esc(lcim)})` : ""}</h3>${bekezdesek(la, "la")}</div><div><h3>Angol</h3>${en ? bekezdesek(en, "en") : ""}</div></div>`
      : (en ? bekezdesek(en, "en") : `<p class="uzenet">Ehhez az idézethez az angol fordításban nincs megfelelő szöveg.</p>`);
    return `<div class="idezet${kiemelt && kiemelt === hu ? " kiem" : ""}" data-k="${k}">
      <h4>${esc(hu)} ${ecim ? `<span>(${esc(ecim)})</span>` : ""}</h4>${szovegek}
      <div class="eszk"><button data-masol="${k}">Szöveg másolása</button>
      <a href="${esc(aiModLink(la || en || ""))}" target="_blank" rel="noopener">Fordítás (Google AI mód)</a>${kv}</div></div>`;
  }).join("");
  return `<article class="egyseg" data-i="${i}">
    <p class="szamok">${esc(helyCim(e))} <span>· ${EVNEV[e[1]]} evangéliuma, ${e[2]}. fejezet · ${e[7]} idézet</span></p>
    <div class="ige">${versek.length ? `<p class="lat" lang="la">${versek.join(" ")}</p>` : ""}${e[6] ? `<p lang="en">${esc(e[6])}</p>` : ""}</div>
    ${idez}
    <p class="forrasjel">${ct}</p>
    <div class="lapozo">
      <button data-lep="${i - 1}" ${i === 0 ? "disabled" : ""}>Előző szakasz</button>
      <button data-lep="${i + 1}" ${i === E.length - 1 ? "disabled" : ""}>Következő szakasz</button>
    </div></article>`;
}
function bekot(gyoker, i, q) {
  gyoker.querySelectorAll("[data-masol]").forEach((b) => b.onclick = () => { const x = q[+b.dataset.masol]; masol(b, x[5] || x[3]); });
  gyoker.querySelectorAll("[data-lep]").forEach((b) => b.onclick = () => { location.hash = `#e/${E[+b.dataset.lep][0]}`; });
}
async function szakaszAblak(id) {
  const i = idIdx.get(id);
  if (i === undefined) { $("#ablak-tartalom").innerHTML = `<p class="uzenet">Nincs ilyen szakasz: ${esc(id)}.</p>`; ablakNyit(); return; }
  $("#ablak-tartalom").innerHTML = await szakaszHtml(i);
  bekot($("#ablak-tartalom"), i, await idezetek(i));
  ablakNyit();
}

// ---- Bibliai hely ----
let gorgessen = false;
async function helyKereses(ev, hely) {
  const ki = $("#eredmeny");
  const m = hely.replace(/\s/g, "").match(/^(\d+)[,:.](\d+)/);
  if (!m) { ki.innerHTML = `<p class="uzenet">A helyet fejezet,vers alakban adja meg, például 5,14.</p>`; return; }
  const fej = +m[1], v = +m[2];
  const talalt = E.map((e, i) => [e, i]).filter(([e]) => e[1] === ev && e[2] === fej && e[3] <= v && v <= e[4]);
  if (!talalt.length) {
    const fejek = E.filter((e) => e[1] === ev && e[2] === fej);
    ki.innerHTML = `<p class="uzenet">${esc(`${ev} ${fej},${v}`)}: ${fejek.length ? "ehhez a vershez nincs külön szakasz." : "nincs ilyen fejezet."}</p>`;
    return;
  }
  const html = [];
  for (const [, i] of talalt) html.push(await szakaszHtml(i));
  ki.innerHTML = html.join("");
  for (const [, i] of talalt) bekot(ki.querySelector(`[data-i="${i}"]`), i, await idezetek(i));
  ki.querySelectorAll("[data-lep]").forEach((b) => b.onclick = () => {
    const e = E[+b.dataset.lep]; location.hash = `#v/${e[1]}/${e[2]},${e[3]}`;
  });
  if (gorgessen) { gorgessen = false; gorget(ki.querySelector(".egyseg")); }
}

// ---- Tartalom ----
function tartalom() {
  const ev = {};
  E.forEach((e, i) => { ((ev[e[1]] ??= {})[e[2]] ??= []).push(i); });
  $("#tartalom").innerHTML = Object.entries(ev).map(([k, fejek]) =>
    `<details class="tszdoboz"><summary>${EVNEV[k]} evangéliuma</summary><div class="fejlista">${Object.keys(fejek).map((f) =>
      `<a href="#f/${k}/${f}">${f}</a>`).join("")}</div></details>`).join("");
}
function fejezetLista(ev, fej) {
  const sor = E.map((e, i) => [e, i]).filter(([e]) => e[1] === ev && e[2] === +fej);
  $("#eredmeny").innerHTML = `<section class="egyseg"><h2 class="doknev">${EVNEV[ev]} evangéliuma, ${esc(fej)}. fejezet</h2>
    <ul class="doklista">${sor.map(([e]) => `<li><span class="tart">${esc(helyCim(e))} · ${e[7]} idézet</span><a href="#e/${e[0]}">${esc(e[6].slice(0, 140) || helyCim(e))}${e[6].length > 140 ? "…" : ""}</a></li>`).join("")}</ul></section>`;
}

// ---- Atyák ----
function szerzoLista() {
  $("#szerzolista").innerHTML = SZ.map(([n, c], i) => `<a href="#a/${i}">${esc(n)} <span>(${c})</span></a>`).join("");
  $("#sszerzo").innerHTML = `<option value="">mind</option>` + SZ.map(([n]) => `<option>${esc(n)}</option>`).join("");
}
function szerzoLap(i) {
  const [n, c, egys] = SZ[i];
  const evek = {};
  for (const j of egys) (evek[E[j][1]] ??= []).push(j);
  $("#eredmeny").innerHTML = `<section class="egyseg"><h2 class="doknev">${esc(n)}</h2><p class="angolcim">${c} idézet ${egys.length} szakaszban</p>
    ${Object.entries(evek).map(([ev, js]) => `<h3 class="tszfej"><b>${EVNEV[ev]} evangéliuma</b></h3><div class="fejlista">${js.map((j) =>
      `<a href="#e/${E[j][0]}">${esc(`${E[j][2]},${E[j][3]}${E[j][4] !== E[j][3] ? "–" + E[j][4] : ""}`)}</a>`).join("")}</div>`).join("")}</section>`;
}

// ---- Szöveges keresés (Pagefind) ----
async function szovegKereses(q) {
  const ki = $("#eredmeny");
  ki.innerHTML = `<p class="toltes">Keresés…</p>`;
  if (!pagefind) {
    pagefind = await import(`./pagefind/pagefind.js${V ? "?v=" + V : ""}`);
    await pagefind.options({ excerptLength: 40 });
  }
  const filters = {};
  if ($("#sev").value) filters.evangelium = $("#sev").value;
  if ($("#sszerzo").value) filters.szerzo = $("#sszerzo").value;
  const r = await pagefind.search(q, { filters });
  if (!r.results.length) { ki.innerHTML = `<p class="uzenet">Nincs találat erre: „${esc(q)}”. Az angol fordításban keres – próbálja angol szóval.</p>`; return; }
  ki.innerHTML = `<p class="osszegzes">${r.results.length} szakasz</p><div id="talalatok"></div><button class="tobb" id="tobb" hidden>További találatok</button>`;
  let n = 0;
  const lap = async () => {
    const adat = await Promise.all(r.results.slice(n, n + 20).map((x) => x.data()));
    n += adat.length;
    $("#talalatok").insertAdjacentHTML("beforeend", adat.map((a) =>
      `<div class="talalat"><h4><a href="#e/${esc(a.meta.k)}">${esc(a.meta.cim)}</a></h4><p>${a.excerpt}</p></div>`).join(""));
    $("#tobb").hidden = n >= r.results.length;
  };
  $("#tobb").onclick = lap;
  await lap();
}

// ---- Útvonalak: #v/Mt/5,14 · #e/Mt.5.11 · #f/Mt/5 · #a/<n> · #q/szavak ----
$("#urlap-hely").onsubmit = (ev) => {
  ev.preventDefault(); gorgessen = true;
  const h = `#v/${$("#ev").value}/${$("#hely").value.replace(/\s/g, "")}`;
  if (location.hash === h) utvonal(); else location.hash = h;
};
$("#urlap-szoveg").onsubmit = (ev) => {
  ev.preventDefault();
  const h = `#q/${encodeURIComponent($("#kerdes").value.trim())}`;
  if (location.hash === h) { lista = ""; utvonal(); } else location.hash = h;
};
async function utvonal() {
  const h = decodeURIComponent(location.hash.slice(1));
  const [tipus, ...resz] = h.split("/");
  const ertek = resz.join("/");
  if (tipus === "e" && ertek) { await szakaszAblak(ertek); return; }
  if (ABLAK.open) ABLAK.close();
  if (h === lista && $("#eredmeny").innerHTML.trim()) return;
  lista = h;
  if (tipus === "v" && resz.length >= 2) { mod("hely"); $("#ev").value = resz[0]; $("#hely").value = resz[1]; await helyKereses(resz[0], resz[1]); }
  else if (tipus === "f" && resz.length >= 2) { mod("tartalom"); fejezetLista(resz[0], resz[1]); }
  else if (tipus === "a" && SZ[+ertek]) { mod("atyak"); szerzoLap(+ertek); }
  else if (tipus === "q" && ertek) { mod("szoveg"); $("#kerdes").value = ertek; await szovegKereses(ertek); }
  else { lista = ""; $("#eredmeny").innerHTML = ""; }
}
window.addEventListener("hashchange", utvonal);

[E, SZ, BEALL] = await Promise.all([json("data/egysegek.json"), json("data/szerzok.json"), json("data/beall.json")]);
E.forEach((e, i) => idIdx.set(e[0], i));
tartalom();
szerzoLista();
utvonal();
