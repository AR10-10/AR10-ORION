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
  // Achado real (captura do Operador em Retina 2x): janela macOS de
  // ~1000px LÓGICOS — a classe de largura que cortava o badge herói na
  // borda da região rolável e nunca estava na matriz.
  { name: "macbook-half", width: 1000, height: 656 },
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
    // Evolução de Produto (avaliação como operador): o pior subtítulo REAL
    // não é "ALTA" — matrix.confidence pode ser literalmente
    // "DADOS_INSUFICIENTES" (visível na captura real do Operador), e o
    // qualificador mais longo é "AGUARDANDO ENTRADA". Fixture = pior caso
    // combinado verificado ao vivo (o pill cresce dentro da região rolável,
    // nunca clipa/sobrepõe — esta linha trava isso para sempre).
    // Seletor ESTRUTURAL (children[1] do badge), não textual: a mutação de
    // "AWAITING"→"LONG" acima já trocou o texto do subtítulo neste ponto —
    // achado real: o seletor textual antigo ("OBSERVANDO") era um no-op
    // silencioso no estado ocioso, a fixture do subtítulo nunca aplicava.
    const badgeEl = all("[title]").find((e) => (e.getAttribute("title") ?? "").includes("NEXUS DECISION"));
    // Formato pós-captura (o prefixo "Confidence · " foi removido do
    // subtítulo — o rótulo vive no tooltip): pior caso real atual.
    set(badgeEl?.children?.[1] ?? null, "DADOS_INSUFICIENTES · AGUARDANDO ENTRADA");
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

  // Diretriz de Evolução Profissional, Fase 11 ("A condição mais
  // importante é testar com conteúdo real preenchido. Não validar somente
  // o estado vazio."): achado real de auditoria — o bloco acima só
  // preenche o HEADER; a gaveta Market Intelligence (MarketDirectionWidget
  // + MarketBiasDecisionCard, os 2 lugares mais recentes a ganhar o
  // qualificador BIAS≠ENTRY) nunca tinha sido testada com o texto mais
  // longo realista ("AGUARDANDO ENTRADA", o pior caso das 3 opções da
  // tabela real). Mesma técnica (mutação de texto real + medição síncrona,
  // zero dado fabricado exibido a um usuário real — sandbox de auditoria).
  // Clicar e medir precisam ser DUAS chamadas separadas: React só reconcilia
  // a nova classe "drawer-open" depois do click() retornar (o flush do
  // scheduler não é síncrono dentro do mesmo evaluate) — achado real ao
  // rodar este script pela primeira vez, não uma suposição.
  const opened = await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) => (b.getAttribute("title") ?? "") === "Market Intelligence");
    if (!btn) return false;
    btn.click();
    return true;
  });
  if (!opened) {
    results.push({ vp: vp.name, issues: [...issues.filter((i) => i !== "CLEAN"), "FALHA: botão 'Market Intelligence' não encontrado"] });
    await page.close();
    continue;
  }
  await page.waitForTimeout(300);

  const drawerIssues = await page.evaluate(() => {
    const out = [];
    const all = (sel) => [...document.querySelectorAll(sel)];
    const set = (el, text) => {
      if (el) el.textContent = text;
    };
    // MarketDirectionWidget: "Vetor" + qualificador (pior caso: mais longo)
    const vetorLabel = all("span").find((s) => s.textContent?.trim() === "Vetor");
    if (vetorLabel?.parentElement) {
      const kids = [...vetorLabel.parentElement.children];
      set(kids[1], "Short Dominance");
      const qualifierSpan = kids[3]; // 4ª linha condicional (só existe quando há qualificador — clona se ausente)
      if (qualifierSpan) {
        set(qualifierSpan, "AGUARDANDO ENTRADA");
      } else {
        const bookRow = kids[2];
        const clone = bookRow?.cloneNode(true);
        if (clone) {
          clone.textContent = "AGUARDANDO ENTRADA";
          bookRow.after(clone);
        }
      }
    }
    // MarketBiasDecisionCard: "Sinal Institucional" + qualificador (pior caso)
    const sinalLabel = all("span").find((s) => s.textContent?.trim() === "Sinal Institucional");
    if (sinalLabel?.parentElement) {
      const valueSpan = [...sinalLabel.parentElement.children].find((c) => c !== sinalLabel);
      if (valueSpan) {
        valueSpan.textContent = "";
        const direction = document.createTextNode("SHORT");
        const qualifier = document.createElement("span");
        qualifier.className = "ml-1.5 text-[0.4rem] font-bold tracking-[0.1em] text-[#8ab4f8]/60 uppercase align-middle";
        qualifier.textContent = "AGUARDANDO ENTRADA";
        valueSpan.appendChild(direction);
        valueSpan.appendChild(qualifier);
      }
    }

    // Medição: nenhum irmão visível dentro da gaveta pode se sobrepor.
    const drawer = all("div").find((d) => d.className.includes("terminal-left") && d.className.includes("drawer-open"));
    if (!drawer) return ["FALHA: gaveta Market Intelligence não abriu"];
    if (document.body.scrollWidth > window.innerWidth + 1) out.push(`BODY overflow-x ${document.body.scrollWidth} (gaveta aberta)`);
    const cards = [...drawer.children].filter((c) => c.getBoundingClientRect().width > 4 && c.getBoundingClientRect().height > 4);
    for (let i = 0; i < cards.length; i++) {
      for (let j = i + 1; j < cards.length; j++) {
        const a = cards[i].getBoundingClientRect();
        const b = cards[j].getBoundingClientRect();
        const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (ix > 3 && iy > 3) out.push(`GAVETA: cartões sobrepostos ${Math.round(ix)}x${Math.round(iy)}px (índices ${i}×${j})`);
      }
    }
    // dentro de cada cartão, os próprios filhos de texto tampouco podem colidir
    for (const card of cards) {
      const leaves = all("span,div")
        .filter((e) => card.contains(e) && e.childElementCount === 0 && (e.textContent ?? "").trim().length > 0)
        .filter((e) => e.getBoundingClientRect().width > 2 && e.getBoundingClientRect().height > 2);
      for (let i = 0; i < leaves.length; i++) {
        for (let j = i + 1; j < leaves.length; j++) {
          const a = leaves[i].getBoundingClientRect();
          const b = leaves[j].getBoundingClientRect();
          const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (ix > 3 && iy > 3) {
            out.push(
              `GAVETA: texto sobreposto ${Math.round(ix)}x${Math.round(iy)}px: [${(leaves[i].textContent ?? "").slice(0, 24)}] × [${(leaves[j].textContent ?? "").slice(0, 24)}]`,
            );
          }
        }
      }
    }
    return out.length ? out : ["CLEAN"];
  });

  // Diretriz de Evolução Visual e Operacional Final §9: terceira passada —
  // o painel Síntese Operacional (aba ANALYSIS) com a string mais longa
  // REAL da tabela de Risco (dois fatores acumulados). Verificado uma vez
  // ao vivo (wrap limpo em 2 linhas no iPad Mini); esta passada torna a
  // verificação PERMANENTE — mesma disciplina da gaveta acima.
  const synthOpened = await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) => (b.getAttribute("title") ?? "") === "ANALYSIS");
    if (!btn) return false;
    btn.click();
    return true;
  });
  let synthIssues = ["CLEAN"];
  if (!synthOpened) {
    synthIssues = ["FALHA: aba ANALYSIS não encontrada"];
  } else {
    await page.waitForTimeout(300);
    synthIssues = await page.evaluate(() => {
      const out = [];
      const rows = [...document.querySelectorAll("div")].filter((d) => d.className.includes("justify-between"));
      const riscoRow = rows.find((d) => d.firstElementChild?.textContent?.trim() === "Risco");
      const decisaoRow = rows.find((d) => d.firstElementChild?.textContent?.trim() === "Decisão");
      if (!decisaoRow) return ["FALHA: painel Síntese Operacional não renderizou na ANALYSIS"];
      // pior caso real: Risco pode estar omitido (null honesto) — clona a
      // linha de Decisão para medir a geometria com a string mais longa.
      const row = riscoRow ?? decisaoRow;
      const valueSpan = row.lastElementChild;
      if (valueSpan) valueSpan.textContent = "ELEVADO — Heat EXTREMO · R:R do TP1 abaixo do piso 1:2";
      const rowRect = row.getBoundingClientRect();
      const panel = row.closest("div.cyber-panel") ?? row.parentElement;
      const panelRect = panel.getBoundingClientRect();
      if (rowRect.right > panelRect.right + 1) out.push(`SÍNTESE: linha estoura o painel ${Math.round(rowRect.right - panelRect.right)}px`);
      if (valueSpan && valueSpan.scrollWidth > valueSpan.clientWidth + 1) out.push(`SÍNTESE: valor clipado ${valueSpan.scrollWidth - valueSpan.clientWidth}px`);
      if (document.body.scrollWidth > window.innerWidth + 1) out.push(`BODY overflow-x ${document.body.scrollWidth} (ANALYSIS aberta)`);
      return out.length ? out : ["CLEAN"];
    });
  }

  const combined = [...issues, ...drawerIssues, ...synthIssues].filter((i) => i !== "CLEAN");
  results.push({ vp: vp.name, issues: combined.length ? combined : ["CLEAN"] });
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
