// Egyházatyák az Ószövetségről – webes kereső. Statikus adatokból dolgozik (data/), a szöveges kereséshez Pagefindet használ.
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const NYELVNEV = { lat: "latin", grc: "görög", eng: "angol", deu: "német", syc: "szír" };
const LAPMERET = 20;
const KONYVNEV = { Ter: "Teremtés", Kiv: "Kivonulás", Lev: "Leviták", Szám: "Számok", MTörv: "Második Törvénykönyv",
  Józs: "Józsue", Bír: "Bírák", Rut: "Rut", "1Sám": "1 Sámuel", "2Sám": "2 Sámuel", "1Kir": "1 Királyok", "2Kir": "2 Királyok",
  "1Krón": "1 Krónikák", "2Krón": "2 Krónikák", Ezd: "Ezdrás", Neh: "Nehemiás", "Ezd-Neh": "Ezdrás–Nehemiás (LXX)", "3Ezd": "3 Ezdrás (LXX)",
  Tób: "Tóbiás", Jud: "Judit", Eszt: "Eszter", "1Mak": "1 Makkabeus", "2Mak": "2 Makkabeus", "3Mak": "3 Makkabeus", "4Mak": "4 Makkabeus",
  Jób: "Jób", Zsolt: "Zsoltárok", Ódák: "Ódák (LXX)", Péld: "Példabeszédek", Préd: "Prédikátor", Én: "Énekek éneke", Bölcs: "Bölcsesség",
  Sir: "Sirák fia", SalZsolt: "Salamon zsoltárai", Iz: "Izajás", Jer: "Jeremiás", Siral: "Siralmak", Bár: "Báruk", Ez: "Ezekiel",
  Dán: "Dániel", "Dán-Theod": "Dániel (Theodotion)", "Dán-Zsuzs": "Zsuzsanna", "Dán-Zsuzs-Theod": "Zsuzsanna (Theodotion)",
  "Dán-Bel": "Bél és a sárkány", "Dán-Bel-Theod": "Bél és a sárkány (Theodotion)", Oz: "Ozeás", Jo: "Joel", Ám: "Ámosz", Abd: "Abdiás",
  Jón: "Jónás", Mik: "Mikeás", Náh: "Náhum", Hab: "Habakuk", Szof: "Szofoniás", Agg: "Aggeus", Zak: "Zakariás", Mal: "Malakiás",
  Mt: "Máté", Mk: "Márk", Lk: "Lukács", Jn: "János", ApCsel: "Apostolok cselekedetei", Róm: "Római levél", "1Kor": "1 Korintusi",
  "2Kor": "2 Korintusi", Gal: "Galata", Ef: "Efezusi", Fil: "Filippi", Kol: "Kolosszei", "1Tessz": "1 Tesszaloniki",
  "2Tessz": "2 Tesszaloniki", "1Tim": "1 Timóteus", "2Tim": "2 Timóteus", Tit: "Titusz", Filem: "Filemon", Zsid: "Zsidókhoz írt levél",
  Jak: "Jakab", "1Pt": "1 Péter", "2Pt": "2 Péter", "1Jn": "1 János", "2Jn": "2 János", "3Jn": "3 János", Júd: "Júdás", Jel: "Jelenések" };

let KAT = [], SZERZOK = [], KONYVEK = [], WEB = { reszindexek: 1 };
const darabCache = new Map(), bibliaCache = new Map();
let pagefind = null;

// Verziójelzés (az építés ideje): minden új közzététel után friss adatot tölt be, nem a gyorsítótárból
const V = new URL(import.meta.url).searchParams.get("v") || "";
const json = async (u) => { const r = await fetch(V ? `${u}?v=${V}` : u); if (!r.ok) throw new Error(u); return r.json(); };

async function darab(m, d) {
  const k = `${m}/${d}`;
  if (!darabCache.has(k)) darabCache.set(k, json(`data/sz/${m}/${d}.json`));
  return darabCache.get(k);
}
async function szakasz(m, d, ref) {
  const sorok = await darab(m, d);
  const i = sorok.findIndex((s) => s[0] === ref);
  return i < 0 ? null : { i, szoveg: sorok[i][1], sorok };
}
function link(mu, ref) {
  return mu.online.includes("{ref}") ? mu.online.replace("{ref}", encodeURIComponent(ref)) : mu.online;
}
function hivatkozas(mu, ref) {
  return `${mu.szerzo}: ${mu.mu} ${ref}. ${mu.kiadas}. ${link(mu, ref)}`;
}

// ---- Magasság jelzése a beágyazó oldalnak (WordPress-iframe) ----
const jelezMagassag = () => parent !== window &&
  parent.postMessage({ type: "patcatena-magassag", h: document.documentElement.scrollHeight }, "*");
new ResizeObserver(jelezMagassag).observe(document.body);

// ---- Módváltás ----
function mod(nev) {
  for (const m of ["vers", "szoveg"]) {
    $(`#tab-${m}`).setAttribute("aria-selected", m === nev);
    $(`#panel-${m}`).hidden = m !== nev;
  }
}
$("#tab-vers").onclick = () => { mod("vers"); $("#konyv").focus(); };
$("#tab-szoveg").onclick = () => { mod("szoveg"); $("#kerdes").focus(); };

// ---- Bibliai hely ----
function bontHely(s) {
  const m = s.trim().match(/^(\d+)\s*[,:.]\s*(\d+)(?:\s*[-–]\s*(\d+))?$/);
  if (!m) return null;
  const v1 = +m[2], v2 = +(m[3] || m[2]);
  if (v2 < v1 || v2 - v1 > 30) return null;
  return { fej: m[1], versek: Array.from({ length: v2 - v1 + 1 }, (_, i) => String(v1 + i)) };
}
const erosseg = (egy, ossz) => (egy >= 3 && egy >= ossz * 0.5 ? "erős" : egy >= 3 ? "közepes" : "gyenge");

async function versKereses(konyv, helyStr, szerzo) {
  const hely = bontHely(helyStr);
  const ki = $("#eredmeny");
  if (!hely) { ki.innerHTML = `<p class="uzenet">A helyet fejezet,vers alakban adja meg, például 3,15 vagy 3,15-16.</p>`; return; }
  ki.innerHTML = `<p class="toltes">Keresés…</p>`;
  if (!bibliaCache.has(konyv)) bibliaCache.set(konyv, json(`data/biblia/${encodeURIComponent(konyv)}.json`));
  let b;
  try { b = await bibliaCache.get(konyv); } catch { ki.innerHTML = `<p class="uzenet">Ehhez a könyvhöz nincs adat.</p>`; return; }
  const kulcsok = hely.versek.map((v) => `${hely.fej}:${v}`);
  const sorok = (t) => kulcsok.filter((k) => t[k]).map((k) => `<p><sup>${k.split(":")[1]}</sup>${esc(t[k])}</p>`).join("");
  const vul = sorok(b.v), lxx = sorok(b.l);

  // Találatok: ugyanaz a szakasz csak egyszer, a legerősebb egyezéssel
  const egyedi = new Map();
  for (const k of kulcsok) for (const [m, ref, d, egy, ossz, bib] of b.i[k] || []) {
    const mu = KAT[m];
    if (szerzo && mu.szerzo !== szerzo) continue;
    const kulcs = `${m}|${ref}`, regi = egyedi.get(kulcs);
    if (!regi || egy / ossz > regi.egy / regi.ossz) egyedi.set(kulcs, { m, ref, d, egy, ossz, bib, vers: k.split(":")[1] });
  }
  const talalat = [...egyedi.values()];
  const helyCim = `${konyv} ${hely.fej},${hely.versek.length > 1 ? hely.versek[0] + "–" + hely.versek.at(-1) : hely.versek[0]}`;
  const erosek = talalat.filter((t) => erosseg(t.egy, t.ossz) !== "gyenge");
  ki.innerHTML = `
    <article class="textus">
      <h2><b>${esc(helyCim.split(" ")[0])}</b> ${esc(helyCim.split(" ").slice(1).join(" "))}</h2>
      <div class="forditasok">
        <div lang="la"><h3>Vulgata</h3>${vul || '<p class="uzenet">Nincs a Vulgata-fájlban.</p>'}</div>
        <div lang="grc"><h3>Szeptuaginta</h3>${lxx || '<p class="uzenet">Nincs a Szeptuaginta-fájlban.</p>'}</div>
      </div>
      <p class="osszegzes">${talalat.length ? `${talalat.length} idéző szakasz ${new Set(talalat.map((t) => KAT[t.m].szerzo)).size} szerzőtől${talalat.length > erosek.length ? `, ebből ${talalat.length - erosek.length} gyenge egyezés` : ""}.` : "Az index nem talált szó szerinti idézetet. Próbálja a szöveges keresést kulcsszavakkal."}</p>
    </article>
    <div id="glosszak"></div>
    <div class="gyenge" id="gyenge-hely"></div>`;
  await glosszak(erosek.length ? erosek : talalat, $("#glosszak"));
  const gyengek = erosek.length ? talalat.filter((t) => erosseg(t.egy, t.ossz) === "gyenge") : [];
  if (gyengek.length) {
    const gomb = document.createElement("button");
    gomb.textContent = `${gyengek.length} gyenge egyezés megjelenítése`;
    gomb.onclick = async () => { gomb.remove(); const d = document.createElement("div"); $("#gyenge-hely").append(d); await glosszak(gyengek, d); };
    $("#gyenge-hely").append(gomb);
  }
}

async function glosszak(lista, hova) {
  const rend = (sz) => { const i = SZERZOK.indexOf(sz); return i < 0 ? 999 : i; };
  lista.sort((a, b) => rend(KAT[a.m].szerzo) - rend(KAT[b.m].szerzo) || a.m - b.m || b.egy - a.egy);
  const csop = new Map();
  for (const t of lista) { const sz = KAT[t.m].szerzo; if (!csop.has(sz)) csop.set(sz, []); csop.get(sz).push(t); }
  let mutatott = 0;
  const kirak = async (szerzok) => {
    for (const [sz, tetelek] of szerzok) {
      const sec = document.createElement("section");
      sec.className = "glossza";
      sec.innerHTML = `<h3>${esc(sz)}</h3><div></div>`;
      hova.append(sec);
      for (const t of tetelek) {
        const mu = KAT[t.m];
        const el = document.createElement("div");
        el.className = "tetel";
        el.innerHTML = `<h4>${esc(mu.mu)} <span class="hely">${esc(t.ref)}</span></h4>
          <p class="egyezes">${t.vers ? `${t.vers}. vers · ` : ""}egyezés: ${t.egy}/${t.ossz} ritka szóhármas (${erosseg(t.egy, t.ossz)}, ${t.bib === "v" ? "Vulgata" : "LXX"})</p>
          <blockquote lang="${mu.nyelv === "lat" ? "la" : mu.nyelv}">…</blockquote>
          <button class="tovabb">Teljes szakasz</button>`;
        el.querySelector(".tovabb").onclick = () => olvaso(t.m, t.d, t.ref);
        sec.lastElementChild.append(el);
        szakasz(t.m, t.d, t.ref).then((s) => {
          const tx = s ? s.szoveg : "";
          el.querySelector("blockquote").textContent = tx.length > 700 ? tx.slice(0, 700) + "…" : tx;
        });
      }
    }
  };
  const csoportok = [...csop.entries()];
  // Szerzőnként lapozva, hogy sok találatnál se töltsön be egyszerre mindent
  let i = 0;
  const kovetkezo = async () => {
    const resz = [];
    while (i < csoportok.length && (mutatott < LAPMERET || !resz.length)) { resz.push(csoportok[i]); mutatott += csoportok[i][1].length; i++; }
    await kirak(resz);
    hova.querySelector(".tobb")?.remove();
    if (i < csoportok.length) {
      const g = document.createElement("button");
      g.className = "tobb"; g.textContent = `További szerzők (${csoportok.length - i})`;
      g.onclick = () => { mutatott = 0; kovetkezo(); };
      hova.append(g);
    }
  };
  await kovetkezo();
}

// ---- Szöveges keresés ----
function valtozatok(q) {
  const u = q.toLowerCase().replace(/v/g, "u").replace(/j/g, "i");
  const v = u.replace(/(^|[^a-z])u(?=[aeiou])|(?<=[aeiou])u(?=[aeiou])/g, (m, p) => (p ?? "") + "v");
  return [...new Set([q, u, v])];
}
async function szovegKereses(q, szerzo, nyelv) {
  const ki = $("#eredmeny");
  ki.innerHTML = `<p class="toltes">Keresés…</p>`;
  if (!pagefind) {
    pagefind = await import(`./pagefind/pagefind.js${V ? "?v=" + V : ""}`);
    await pagefind.options({ excerptLength: 40 });
    // A keresőindex részekben készül (memóriaigény miatt); a böngészőben egyesítjük őket
    for (let n = 1; n < WEB.reszindexek; n++) await pagefind.mergeIndex(new URL(`pagefind${n}/`, location.href).href);
  }
  const filters = {};
  if (szerzo) filters.szerzo = szerzo;
  if (nyelv) filters.nyelv = nyelv;
  const eredm = await Promise.all(valtozatok(q).map((v) => pagefind.search(v, { filters })));
  const egyedi = new Map();
  for (const e of eredm) for (const r of e.results) if (!egyedi.has(r.id) || egyedi.get(r.id).score < r.score) egyedi.set(r.id, r);
  const lista = [...egyedi.values()].sort((a, b) => b.score - a.score);
  ki.innerHTML = `<p class="osszegzes">${lista.length ? `${lista.length} szakasz` : "Nincs találat. Próbáljon kevesebb vagy rövidebb szót, vagy szótőt (pl. „leon”)."}</p><div id="lista"></div>`;
  let n = 0;
  const lap = async () => {
    const adat = await Promise.all(lista.slice(n, n + LAPMERET).map((r) => r.data()));
    n += adat.length;
    for (const a of adat) {
      const m = +a.meta.m, mu = KAT[m];
      const el = document.createElement("div");
      el.className = "glossza";
      el.innerHTML = `<h3>${esc(mu.szerzo)}</h3><div class="tetel"><h4>${esc(mu.mu)} <span class="hely">${esc(a.meta.r)}</span></h4>
        <p class="egyezes">${NYELVNEV[mu.nyelv] || mu.nyelv}${mu.tipus === "translation" ? " fordítás" : ""}</p>
        <blockquote lang="${mu.nyelv === "lat" ? "la" : mu.nyelv}">…${a.excerpt}…</blockquote>
        <button class="tovabb">Teljes szakasz</button></div>`;
      el.querySelector(".tovabb").onclick = () => olvaso(m, +a.meta.d, a.meta.r, q);
      $("#lista").append(el);
    }
    $("#lista").querySelector(".tobb")?.remove();
    if (n < lista.length) {
      const g = document.createElement("button");
      g.className = "tobb"; g.textContent = `További találatok (${lista.length - n})`;
      g.onclick = lap;
      $("#lista").append(g);
    }
  };
  await lap();
}

// ---- Olvasó: egy szakasz teljes szövege, lapozással ----
let OLV = null;
async function olvaso(m, d, ref, kiemel) {
  const s = await szakasz(m, d, ref);
  if (!s) return;
  const mu = KAT[m];
  OLV = { m, d, i: s.i, n: s.sorok.length, ref, kiemel };
  $("#olvaso-cim").innerHTML = `<b>${esc(mu.szerzo)}</b><br>${esc(mu.mu)} ${esc(ref)}`;
  $("#olvaso-adat").innerHTML = `<p>Kiadás: ${esc(mu.kiadas)}</p>
    <p><a href="${esc(link(mu, ref))}" target="_blank" rel="noopener">Megnyitás a forrásnál</a>${mu.online.includes("{ref}") ? "" : ` (hely: ${esc(ref)})`} · ${esc(mu.urn)}</p>
    ${mu.forras === "patrologia_latina-dev" ? "<p>Gépi javítású OCR (Migne, PL); a hasábszámot és a szöveget a nyomtatott kiadásban érdemes ellenőrizni.</p>" : ""}`;
  let html = esc(s.szoveg);
  if (kiemel) for (const w of valtozatok(kiemel).join(" ").replace(/["„”]/g, "").split(/\s+/).filter((w) => w.length > 2)) {
    html = html.replace(new RegExp(`(${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"), "<mark>$1</mark>");
  }
  const sz = $("#olvaso-szoveg");
  sz.innerHTML = html;
  sz.lang = mu.nyelv === "lat" ? "la" : mu.nyelv;
  $("#elozo").disabled = s.i === 0 && d === 0;
  $("#kovetkezo").disabled = s.i === s.sorok.length - 1 && d === mu.darabok - 1;
  const dlg = $("#olvaso");
  if (!dlg.open) dlg.showModal();
  sz.scrollTop = 0;
}
async function lapoz(irany) {
  if (!OLV) return;
  let { m, d, i } = OLV;
  let sorok = await darab(m, d);
  i += irany;
  if (i < 0) { if (d === 0) return; d--; sorok = await darab(m, d); i = sorok.length - 1; }
  if (i >= sorok.length) { if (d >= KAT[m].darabok - 1) return; d++; sorok = await darab(m, d); i = 0; }
  olvaso(m, d, sorok[i][0], OLV.kiemel);
}
$("#elozo").onclick = () => lapoz(-1);
$("#kovetkezo").onclick = () => lapoz(1);
$("[data-bezar]").onclick = () => $("#olvaso").close();
$("#olvaso").addEventListener("click", (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); });
$("#masol").onclick = async () => {
  const mu = KAT[OLV.m];
  try { await navigator.clipboard.writeText(hivatkozas(mu, OLV.ref)); $("#masol").textContent = "Hivatkozás másolva"; }
  catch { $("#masol").textContent = "A másolás nem sikerült"; }
  setTimeout(() => ($("#masol").textContent = "Hivatkozás másolása"), 2000);
};

// ---- Útvonal (#v/Ter/3,15 · #q/szavak) – a keresés linkelhető ----
function utvonal() {
  const h = decodeURIComponent(location.hash.slice(1));
  const p = new URLSearchParams(h.includes("?") ? h.split("?")[1] : "");
  const [tipus, ...resz] = h.split("?")[0].split("/");
  if (tipus === "v" && resz.length >= 2) {
    mod("vers"); $("#konyv").value = resz[0]; $("#hely").value = resz[1]; $("#vszerzo").value = p.get("szerzo") || "";
    versKereses(resz[0], resz[1], p.get("szerzo") || "");
  } else if (tipus === "q" && resz.length) {
    const q = resz.join("/");
    mod("szoveg"); $("#kerdes").value = q; $("#sszerzo").value = p.get("szerzo") || ""; $("#snyelv").value = p.get("nyelv") || "";
    szovegKereses(q, p.get("szerzo") || "", p.get("nyelv") || "");
  } else if (!h) {
    $("#eredmeny").innerHTML = "";
  }
}
const ugrik = (h) => { if (location.hash === "#" + h) utvonal(); else location.hash = h; };
$("#urlap-vers").onsubmit = (e) => {
  e.preventDefault();
  const sz = $("#vszerzo").value;
  ugrik(`v/${$("#konyv").value}/${$("#hely").value.replace(/\s/g, "")}${sz ? "?szerzo=" + encodeURIComponent(sz) : ""}`);
};
$("#urlap-szoveg").onsubmit = (e) => {
  e.preventDefault();
  const p = new URLSearchParams();
  if ($("#sszerzo").value) p.set("szerzo", $("#sszerzo").value);
  if ($("#snyelv").value) p.set("nyelv", $("#snyelv").value);
  ugrik(`q/${$("#kerdes").value.trim()}${p.toString() ? "?" + p : ""}`);
};
addEventListener("hashchange", utvonal);

// ---- Indulás ----
[KAT, SZERZOK, KONYVEK, WEB] = await Promise.all([json("data/katalogus.json"), json("data/szerzok.json"), json("data/konyvek.json"), json("data/web.json")]);
$("#konyv").innerHTML = KONYVEK.filter((k) => k.idezet).map((k) => `<option value="${esc(k.k)}">${esc(KONYVNEV[k.k] ? `${KONYVNEV[k.k]} (${k.k})` : k.k)}</option>`).join("");
const szerzoOpc = SZERZOK.map((s) => `<option>${esc(s)}</option>`).join("");
$("#vszerzo").insertAdjacentHTML("beforeend", szerzoOpc);
$("#sszerzo").insertAdjacentHTML("beforeend", szerzoOpc);
const nyelvek = [...new Set(KAT.map((m) => NYELVNEV[m.nyelv] || m.nyelv))];
$("#snyelv").insertAdjacentHTML("beforeend", nyelvek.map((n) => `<option>${esc(n)}</option>`).join(""));
utvonal();
