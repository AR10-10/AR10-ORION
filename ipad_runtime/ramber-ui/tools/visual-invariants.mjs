#!/usr/bin/env node
// visual-invariants.mjs — verificação VISUAL real das invariantes do
// terminal, em vários viewports e timeframes.
//
// POR QUE ISTO EXISTE: a rodada de superfície (PR #39) foi defendida por
// matemática e estava ERRADA na tela — o gradiente do .cyber-panel pintava
// por cima do background-color e anulava a migração. Só apareceu quando
// alguém abriu o navegador e leu getComputedStyle. Argumento não substitui
// olhar; este script é o "olhar", repetível.
//
// NÃO roda no CI de propósito: .github/workflows/testes.yml verifica e não
// publica, sem browser, e uma suíte de navegador em todo push mudaria o
// custo de cada PR. Isto é uma ferramenta de sessão, executada quando uma
// mudança visual precisa de prova.
//
// USO:
//   1) npm run dev -- --host 127.0.0.1 --port 5199
//   2) node tools/visual-invariants.mjs [porta]
//
// Requer `playwright-core` e o Chromium do ambiente. Como isto NÃO é
// dependência do repo (é ferramenta de sessão), o pacote pode viver fora
// daqui — aponte com PLAYWRIGHT_CORE_DIR. ESM não respeita NODE_PATH, daí
// a resolução explícita abaixo em vez de um import simples.
// Sem rede de mercado o gráfico fica em "AGUARDANDO CANDLES" — as
// invariantes abaixo são justamente as que NÃO dependem de dado real.
import { pathToFileURL } from "node:url";
import { join } from "node:path";

const dirExterno = process.env.PLAYWRIGHT_CORE_DIR;
const mod = dirExterno
  ? await import(pathToFileURL(join(dirExterno, "playwright-core", "index.js")).href)
  : await import("playwright-core");
// playwright-core é CJS: importado por ESM, a API inteira cai em `default`.
// O `?? mod` cobre o caso de um bundler que já tenha feito interop.
const { chromium } = mod.default ?? mod;

const PORTA = process.argv[2] ?? "5199";
const URL = `http://127.0.0.1:${PORTA}/`;
const CHROME = process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

/** Superfície base declarada em nexus/terminal-design-tokens.ts. */
const SURFACE_BASE = "rgb(1, 3, 8)";
/** Piso de legibilidade: TYPE_SCALE_MIN_REM (0.4rem) * 16. */
const PISO_FONTE_PX = 6.4;

const PERFIS = [
  { nome: "iPadPro-1366x1024", w: 1366, h: 1024 },
  { nome: "Laptop-1440x900", w: 1440, h: 900 },
  { nome: "iPadMini-1024x768", w: 1024, h: 768 },
];
const TIMEFRAMES = ["1m", "5m", "15m", "1H", "4H", "1D", "1W"];

const medir = (page) =>
  page.evaluate(() => {
    let menor = Infinity;
    for (const el of document.querySelectorAll("span,div,button")) {
      if (!el.textContent?.trim()) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (Number.isFinite(fs) && fs > 0 && fs < menor) menor = fs;
    }
    const raiz = document.querySelector('[class*="h-[100dvh]"]');
    const painel = document.querySelector(".cyber-panel");
    return {
      fundo: raiz ? getComputedStyle(raiz).backgroundColor : null,
      // O gradiente É a superfície do painel — o background-color fica por
      // baixo dele e não decide nada (foi esse o defeito da PR #39).
      painelGradiente: painel ? getComputedStyle(painel).backgroundImage : null,
      scrollHorizontal: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      menorFontePx: Number.isFinite(menor) ? Number(menor.toFixed(2)) : null,
      paineis: document.querySelectorAll(".cyber-panel").length,
    };
  });

const falhas = [];
const checar = (ctx, m) => {
  if (m.scrollHorizontal) falhas.push(`${ctx}: scroll horizontal de página (Regra de Ouro 7)`);
  if (m.fundo !== SURFACE_BASE) falhas.push(`${ctx}: fundo ${m.fundo} != SURFACE.base ${SURFACE_BASE}`);
  if (m.menorFontePx !== null && m.menorFontePx < PISO_FONTE_PX)
    falhas.push(`${ctx}: fonte ${m.menorFontePx}px abaixo do piso ${PISO_FONTE_PX}px`);
};

const browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
try {
  for (const perfil of PERFIS) {
    const ctx = await browser.newContext({ viewport: { width: perfil.w, height: perfil.h } });
    const page = await ctx.newPage();
    await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(13_000);
    const m = await medir(page);
    checar(perfil.nome, m);
    console.log(`${perfil.nome.padEnd(22)} fundo=${m.fundo}  menorFonte=${m.menorFontePx}px  scrollH=${m.scrollHorizontal}  painéis=${m.paineis}`);

    // Timeframes só no primeiro perfil: o que muda entre eles é o layout,
    // não o prazo — repetir 7 cliques em 3 perfis seria custo sem achado.
    if (perfil === PERFIS[0]) {
      for (const tf of TIMEFRAMES) {
        const ok = await page
          .getByRole("button", { name: tf, exact: true })
          .first()
          .click({ timeout: 4000 })
          .then(() => true)
          .catch(() => false);
        if (!ok) {
          falhas.push(`timeframe ${tf}: botão não clicável`);
          continue;
        }
        await page.waitForTimeout(1200);
        checar(`timeframe ${tf}`, await medir(page));
      }
      console.log(`timeframes verificados:   ${TIMEFRAMES.join(" ")}`);
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}

if (falhas.length > 0) {
  console.error(`\n${falhas.length} INVARIANTE(S) VIOLADA(S):`);
  for (const f of falhas) console.error(`  - ${f}`);
  process.exit(1);
}
console.log("\nTodas as invariantes visuais passaram.");
