// audit-header-maxcontent.mjs — Diretriz Modo Operacional §9/§14: a
// auditoria responsiva com header VAZIO não pega colisões que só existem
// com dados reais (lição da primeira foto ao vivo do Operador: a colisão
// orb×cartão VWAP só aparecia com chips populados). Este script preenche
// os chips EXISTENTES com o conteúdo máximo da matriz §14 e clona os
// condicionais ausentes num sandbox sem rede (mesmas classes => mesma
// geometria) — uma FIXTURE DE LAYOUT de teste, nunca dado exibido como
// real ao Operador — e mede sobreposição par-a-par entre os filhos
// visíveis das 3 zonas do header, além de clip/scroll.
//
// Uso: node scripts/audit-header-maxcontent.mjs [url]
//      (padrão http://localhost:4327/ — vite preview do build atual)
//
// playwright não é dependência do app (auditoria só) — resolvido do
// node_modules local se existir, senão da instalação global do ambiente,
// senão de PLAYWRIGHT_DIR. Falha com instrução clara, nunca silenciosa.
import { createRequire } from "node:module";

function resolvePlaywright() {
  const bases = [
    import.meta.url, // node_modules do próprio repo, se um dia for devDep
    process.env.PLAYWRIGHT_DIR ? `${process.env.PLAYWRIGHT_DIR}/x.js` : null,
    "/opt/node22/lib/x.js", // global do ambiente de CI/sandbox atual
  ].filter(Boolean);
  for (const base of bases) {
    try {
      return createRequire(base)("playwright");
    } catch {}
  }
  console.error("playwright não encontrado — instale-o ou aponte PLAYWRIGHT_DIR para o diretório que contém node_modules/playwright.");
  process.exit(2);
}
const { chromium } = resolvePlaywright();

const url = process.argv[2] ?? "http://localhost:4327/";
const executablePath = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";

// §14: "Testar esse estado em todas as resoluções."
const VIEWPORTS = [
  { name: "ipad-mini-portrait", width: 744, height: 1133 },
  { name: "ipad-mini-landscape", width: 1133, height: 744 },
  { name: "ipad-portrait", width: 810, height: 1080 },
  { name: "ipad-air-portrait", width: 820, height: 1180 },
  { name: "ipad-pro-portrait", width: 1024, height: 1366 },
  { name: "ipad-pro-landscape", width: 1366, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
  { name: "monitor-large", width: 1920, height: 1080 },
  { name: "ultrawide-21x9", width: 2560, height: 1080 },
  { name: "ultrawide-34in", width: 3440, height: 1440 },
];

const browser = await chromium.launch({ executablePath });
const results = [];
for (const vp of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem("ar10cyborg_access_unlocked", "1");
    } catch {}
  });
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("text=GRÁFICO", { timeout: 20000 });
  await page.waitForTimeout(1500);

  // Mutação + medição na MESMA avaliação síncrona: o re-render de 1s do
  // TopBar nunca intercala (JS single-thread dentro do evaluate).
  const issues = await page.evaluate(() => {
    const out = [];
    const all = (sel) => [...document.querySelectorAll(sel)];
    const bySnippet = (snippet) => all("span,button,div").filter((e) => e.childElementCount === 0 && (e.textContent ?? "").includes(snippet));

    // ── FIXTURE §14 nos chips existentes (folhas de texto) ──
    const set = (el, text) => {
      if (el) el.textContent = text;
    };
    // preço + variação (spans font-mono do cluster de preço)
    const priceSpan = all("span").find((s) => s.className.includes("font-black font-mono tracking-tight"));
    set(priceSpan, "64,100.72");
    if (priceSpan?.nextElementSibling) set(priceSpan.nextElementSibling, "+1.73%");
    // badge fundido (direção + subtítulo)
    for (const s of bySnippet("AWAITING")) {
      if (s.className.includes("tracking") || s.textContent === "AWAITING") set(s, "LONG");
    }
    const subtitle = all("span").find((s) => (s.textContent ?? "").includes("OBSERVANDO"));
    set(subtitle, "CONFIDENCE · ALTA · GERENCIANDO");
    // Score / Heat / zona
    const scoreLabel = all("span").find((s) => s.textContent === "Score");
    if (scoreLabel?.parentElement) {
      const v = [...scoreLabel.parentElement.querySelectorAll("span")].find((x) => x !== scoreLabel);
      set(v, "87");
    }
    const heatLabel = all("span").find((s) => s.textContent === "Heat");
    if (heatLabel?.parentElement) {
      const spans = [...heatLabel.parentElement.querySelectorAll("span")];
      set(spans[1], "87");
      set(spans[2], "EXTREMO");
    }
    // Cartão VWAP cheio (§14: valor + relação + estado)
    const vwapLabel = all("span").find((s) => (s.textContent ?? "").startsWith("VWAP"));
    if (vwapLabel?.parentElement) {
      const spans = [...vwapLabel.parentElement.children];
      set(spans[1], "64,005.89");
      set(spans[2], "↑ +0.42% · COMPRADOR");
    }
    // LIVE + latência + sessão (§14: ONLINE / 42ms / LONDRES+NY)
    const live = all("span").find((s) => s.textContent === "OFF" || s.textContent === "LIVE");
    set(live, "LIVE");
    const lat = all("span").find((s) => s.className.includes("font-mono tabular-nums") && (s.textContent ?? "").length <= 6 && s !== priceSpan);
    set(lat, "42ms");
    const session = all("span").find((s) => /Londres|Ásia|Nova|Pacífico|LONDRES/i.test(s.textContent ?? "") && (s.textContent ?? "").length < 22);
    set(session, "LONDRES+NY");
    // TENDÊNCIA: condicional ausente sem motor — clona o chip de TF
    // (mesmas classes => mesma geometria) e rotula ALTA.
    const tfChip = all("span").find((s) => /^\d+m$|^\d+H$|^15m$/i.test((s.textContent ?? "").trim()) && s.className.includes("uppercase tracking-wider"));
    if (tfChip && !all("span").some((s) => s.textContent === "ALTA")) {
      const clone = tfChip.cloneNode(true);
      clone.textContent = "ALTA";
      tfChip.after(clone);
    }

    // ── MEDIÇÃO (mesma avaliação, zero re-render intercalado) ──
    const region = all("div").find((d) => d.className.includes("overflow-x-auto") && d.className.includes("[&>*]:shrink-0"));
    if (!region) return ["FALHA: região central rolável não encontrada"];
    const header = region.parentElement; // fileira: [âncora esq][região][âncora dir]
    const zones = [...header.children];
    // (a) filhos DIRETOS da fileira nunca se cruzam
    const boxes = zones.map((el) => ({ el, r: el.getBoundingClientRect() }));
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i].r;
        const b = boxes[j].r;
        const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        if (ix > 2) out.push(`ZONAS CRUZADAS ${Math.round(ix)}px: zona ${i} × zona ${j}`);
      }
    }
    // (b) dentro de cada zona: chips irmãos visíveis nunca se cruzam
    for (const zone of zones) {
      const kids = [...zone.children].filter((k) => k.getBoundingClientRect().width > 4);
      for (let i = 0; i < kids.length; i++) {
        for (let j = i + 1; j < kids.length; j++) {
          const a = kids[i].getBoundingClientRect();
          const b = kids[j].getBoundingClientRect();
          const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (ix > 3 && iy > 3)
            out.push(
              `CHIPS SOBREPOSTOS ${Math.round(ix)}x${Math.round(iy)}px: [${(kids[i].textContent ?? "").slice(0, 22)}] × [${(kids[j].textContent ?? "").slice(0, 22)}]`,
            );
        }
      }
    }
    // (c) zero scroll de página + zero clip no topo do header
    if (document.body.scrollWidth > window.innerWidth + 1) out.push(`BODY overflow-x ${document.body.scrollWidth}`);
    const hr = header.getBoundingClientRect();
    if (hr.top < -1) out.push(`HEADER top-clip ${Math.round(hr.top)}px`);
    // (d) âncora direita (power) nunca coberta pela região
    const power = all("button").find((b) => (b.title ?? "").includes("Force reconnection"));
    if (power) {
      const rr = region.getBoundingClientRect();
      const pr = power.getBoundingClientRect();
      if (rr.right > pr.left + 2) out.push(`REGIÃO invade âncora direita: ${Math.round(rr.right - pr.left)}px`);
    }
    return out.length ? out : ["CLEAN"];
  });

  results.push({ vp: vp.name, issues });
  await page.close();
}
await browser.close();

let fail = false;
for (const r of results) {
  console.log(`\n=== ${r.vp} ===`);
  console.log(r.issues.join("\n"));
  if (r.issues[0] !== "CLEAN") fail = true;
}
process.exit(fail ? 1 : 0);
