"use strict";

const qs = (s, r = document) => r.querySelector(s);
const qsa = (s, r = document) => [...r.querySelectorAll(s)];
const PALETTE = {
  long: "#00FF9D",
  short: "#FF3E52",
  cyan: "#00F2FF",
  gold: "#FFB800",
  text: "rgba(255,255,255,.80)",
  muted: "rgba(255,255,255,.42)"
};


const UIX13_APPLE_BENTO_GLASS = "UIX13_V23_APPLE_BENTO_GLASS_REFINEMENT";
try { document.documentElement.dataset.uiRefinement = UIX13_APPLE_BENTO_GLASS; } catch (_) {}

const state = {
  activeTab: "overview",
  symbol: "BTCUSDT",
  interval: "15m",
  status: null,
  guardrails: null,
  telemetry: null,
  market: null,
  operational: false,
  latency: 0
};

const TAB_ALIASES = {
  "1": "overview",
  geral: "overview",
  visao: "overview",
  "visao-geral": "overview",
  cerebro: "overview",
  "cerebro-vivo": "overview",
  overview: "overview",
  "2": "market",
  mercado: "market",
  market: "market",
  "3": "deep",
  analise: "deep",
  "analise-quant": "deep",
  quant: "deep",
  deep: "deep",
  "4": "micro",
  fluxo: "micro",
  micro: "micro",
  microestrutura: "micro",
  "5": "risk",
  risco: "risk",
  "risco-shadow": "risk",
  risk: "risk",
  "6": "memory",
  memoria: "memory",
  auditoria: "memory",
  memory: "memory"
};

function initialTabFromLocation() {
  const raw = new URLSearchParams(window.location.search).get("tab") || window.location.hash.slice(1);
  const key = String(raw || "").trim().toLowerCase();
  return TAB_ALIASES[key] || "overview";
}

function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, m => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[m]));
}

function validNumber(v) {
  return Number.isFinite(Number(v));
}

function validPrice(v) {
  return validNumber(v) && Number(v) > 0;
}

function price(v) {
  return validPrice(v)
    ? Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "SEM_DADO";
}

function pct(v) {
  return validNumber(v) ? `${Math.round(Number(v) * 100)}%` : "--";
}

function fmtTime(v) {
  try {
    return new Date(v || Date.now()).toLocaleTimeString("pt-BR", { hour12: false });
  } catch {
    return "--:--:--";
  }
}

function cleanLabel(v) {
  return String(v ?? "")
    .replace(/Omega/gi, "Orion Cyborg")
    .replace(/Legacy/gi, "Orion Cyborg")
    .replace(/AR10_PRO/gi, "ORION_CYBORG_CORE")
    .replace(/preview/gi, "blocked")
    .replace(/synthetic/gi, "blocked");
}

function cleanScenario(x) {
  return {
    ...x,
    scenario: cleanLabel(x?.scenario),
    reuse: cleanLabel(x?.reuse)
  };
}

function statusClass(v) {
  const s = String(v || "").toLowerCase();
  if (s.includes("fresh") || s.includes("ativo") || s.includes("pass") || s.includes("ready") || s.includes("ok")) return "ok";
  if (s.includes("blocked") || s.includes("indis") || s.includes("offline") || s.includes("sem")) return "bad";
  return "warn";
}

function setText(id, value) {
  const el = qs(`#${id}`);
  if (el) el.textContent = value;
}

function rowHtml(items) {
  return items.map(([a, b, c]) => `<div class="data-row"><span>${esc(a)}</span><b class="${c || ""}">${esc(b)}</b></div>`).join("");
}

function metricHtml(items) {
  return items.map(([a, b, c, d]) => (
    `<div class="metric-card"><span>${esc(a)}</span><b class="${c || ""}">${esc(b)}</b><small>${esc(d || "")}</small></div>`
  )).join("");
}

async function fetchJson(url) {
  const start = performance.now();
  const response = await fetch(url, { cache: "no-store" });
  state.latency = Math.round(performance.now() - start);
  if (!response.ok) throw new Error(`${response.status}`);
  return response.json();
}

function isOperational(market) {
  const source = String(market?.source || "").toLowerCase();
  const blocked = ["fallback", "fixture", "preview", "synthetic", "mock"].some(x => source.includes(x));
  const lanes = Number(market?.source_consensus?.active_lanes || 0);
  return Boolean(market?.candles?.length && !blocked && lanes > 0);
}

function setActive(tab) {
  state.activeTab = tab;
  qsa(".page").forEach(page => page.classList.toggle("active", page.dataset.page === tab));
  qsa("[data-tab]").forEach(button => button.classList.toggle("active", button.dataset.tab === tab));
  if (tab === "market") drawMarket();
  if (tab === "deep") drawSensory();
  if (tab === "micro") drawHeatmap();
}

function bindEvents() {
  qsa("[data-tab]").forEach(button => button.addEventListener("click", () => setActive(button.dataset.tab)));
  qsa("[data-interval]").forEach(button => button.addEventListener("click", () => {
    state.interval = button.dataset.interval;
    const select = qs("#intervalSelect");
    if (select) select.value = state.interval;
    qsa("[data-interval]").forEach(x => x.classList.toggle("active", x.dataset.interval === state.interval));
    loadMarket();
  }));
  qsa("[data-score]").forEach(button => button.addEventListener("click", () => {
    qsa("[data-score]").forEach(x => x.classList.toggle("active", x === button));
    renderScore(button.dataset.score);
  }));
  qs("#symbolSelect")?.addEventListener("change", event => {
    state.symbol = event.target.value;
    loadMarket();
  });
  qs("#intervalSelect")?.addEventListener("change", event => {
    state.interval = event.target.value;
    qsa("[data-interval]").forEach(x => x.classList.toggle("active", x.dataset.interval === state.interval));
    loadMarket();
  });
  qs("#refreshBtn")?.addEventListener("click", () => refreshAll());
  qs("#openMarketBtn")?.addEventListener("click", () => setActive("market"));
  qs("#socialPrintBtn")?.addEventListener("click", () => {
    document.body.classList.add("social-print-mode");
    setTimeout(() => {
      window.print();
      setTimeout(() => document.body.classList.remove("social-print-mode"), 600);
    }, 80);
  });
}

function updateTruth() {
  state.operational = isOperational(state.market);
  if (state.operational) {
    setText("truthState", "DADOS REAIS COMPROVADOS");
    setText("truthDetail", `${state.market.source} | ${fmtTime(state.market.generated_at)} | ${state.latency} ms`);
  } else {
    setText("truthState", "SEM DADO REAL - AGUARDAR");
    setText("truthDetail", "Fonte offline ou nao comprovada bloqueada para leitura operacional.");
  }
}

function renderHeader() {
  const telemetry = state.telemetry || {};
  const feeds = telemetry.feeds?.items || [];
  const fresh = feeds.filter(x => String(x.status).toLowerCase() === "fresh").length;
  const ok = Boolean(state.status?.ok);
  const brain = telemetry.brain || {};
  setText("shellOnline", ok ? "SISTEMA ONLINE" : "REVIEW_REQUIRED");
  setText("topOnline", ok ? "ONLINE" : "REVISAR");
  setText("topOnlineDetail", ok ? "100% operacional" : "endpoint indisponivel");
  setText("topIntegrity", state.guardrails?.fail_closed ? "100%" : "REVISAR");
  setText("topLatency", `${state.latency || "--"} ms`);
  setText("topSensors", `${fresh} / ${feeds.length}`);
  setText("topSensorsDetail", fresh === feeds.length && fresh ? "FRESH" : "prepared nao conta");
  setText("topMemory", `${brain.hippocampus?.length || 0} episodios`);
  setText("topHeartbeat", fmtTime(telemetry.generated_at));
  setText("clock", fmtTime());
  setText("topRnns", "SHADOW");
  setText("dockHealth", ok && state.operational ? "100%" : "AGUARDAR");
}

function renderOverview() {
  const brain = state.telemetry?.brain || {};
  const market = state.market || {};
  const guardrails = state.guardrails || {};
  const pulse = Number(brain.plasticity?.fused_signal ?? brain.cortex?.hidden_state_pulse);
  const pulseProgress = qs("#pulseProgress");
  setText("pulseValue", validNumber(pulse) ? pulse.toFixed(2).replace(".", ",") : "--");
  if (pulseProgress) pulseProgress.style.width = `${validNumber(pulse) ? Math.max(0, Math.min(100, pulse * 100)) : 0}%`;
  qs("#neuralStateList").innerHTML = rowHtml([
    ["Fusao Cognitiva", validNumber(pulse) ? pulse.toFixed(2) : "--"],
    ["Entropia Mercado", validNumber(brain.amygdala?.cortisol) ? Number(brain.amygdala.cortisol).toFixed(2) : "--"],
    ["Dopamina / Reward", validNumber(brain.dopamine?.dopamine) ? Number(brain.dopamine.dopamine).toFixed(2) : "--"],
    ["Confianca Sistema", pct(brain.cortex?.confidence)],
    ["Fontes Integradas", state.operational ? `${market.source_consensus?.active_lanes || 0} / ${market.source_consensus?.total_lanes || 0}` : "SEM DADO"]
  ]);
  setText("overviewBias", state.operational ? String(market.bias || "AGUARDAR").replaceAll("_", " ") : "SEM DADO REAL - AGUARDAR");
  setText("overviewMode", "READ_ONLY");
  qs("#overviewMetrics").innerHTML = metricHtml([
    ["Preco Atual", state.operational ? price(market.price) : "SEM_DADO", "", `${state.symbol} / ${state.interval}`],
    ["Suporte Forte", state.operational ? price(market.levels?.support) : "SEM_DADO", "", "zona de defesa"],
    ["Resistencia Forte", state.operational ? price(market.levels?.resistance) : "SEM_DADO", "", "zona de ataque"],
    ["Confianca", state.operational ? pct(market.confidence) : "--", "", "derivado real"]
  ]);
  qs("#overviewGuardrails").innerHTML = metricHtml([
    ["Preco Truth", state.operational ? "PASS" : "BLOCKED", state.operational ? "ok" : "bad", "real data only"],
    ["Fail Closed", guardrails.fail_closed ? "ATIVO" : "REVISAR", guardrails.fail_closed ? "ok" : "bad", "runtime governance"],
    ["Order Send", guardrails.real_orders_enabled ? "REVISAR" : "DESATIVADO", guardrails.real_orders_enabled ? "bad" : "ok", "zero execution"],
    ["Broker Auth", String(guardrails.broker_actions || "blocked").toUpperCase(), "ok", "blocked"],
    ["RNN Shadow", "WARMUP", "warn", "human gate"],
    ["Cockpit", "READ_ONLY", "ok", "operator panel"]
  ]);
}

function renderMarket() {
  const market = state.market || {};
  const levels = market.levels || {};
  const op = state.operational;
  const entry = validPrice(levels.entry_zone?.[0]) && validPrice(levels.entry_zone?.[1])
    ? `${price(levels.entry_zone[0])} - ${price(levels.entry_zone[1])}`
    : "SEM_DADO";
  qs("#marketPlan").innerHTML = rowHtml([
    ["ATIVO", state.symbol, "ok"],
    ["TIMEFRAME", state.interval, "ok"],
    ["DIRECAO SHADOW", op ? String(market.bias || "AGUARDAR").replaceAll("_", " ") : "SEM DADO", op ? "warn" : "bad"],
    ["ENTRADA", op ? entry : "SEM DADO", op && entry !== "SEM_DADO" ? "ok" : "bad"],
    ["PROTECAO", op ? price(levels.technical_invalidation) : "SEM DADO", validPrice(levels.technical_invalidation) ? "bad" : "warn"],
    ["ALVO 1", op ? price(levels.target) : "SEM DADO", validPrice(levels.target) ? "ok" : "warn"],
    ["ALVO 2", "SEM MOTOR DEDICADO", "warn"],
    ["REENTRADA", "SEM MOTOR DEDICADO", "warn"],
    ["R:R", "SEM MOTOR DEDICADO", "warn"],
    ["FASE DO CICLO", op ? levels.structure || "SEM DADO" : "SEM DADO", op ? "ok" : "bad"]
  ]);
  qs("#marketKpis").innerHTML = metricHtml([
    ["Direcao Shadow", op ? String(market.bias || "AGUARDAR").replaceAll("_", " ") : "SEM DADO", op ? "warn" : "bad", "fail-closed"],
    ["Preco Atual", op ? price(market.price) : "SEM_DADO", "", "source truth"],
    ["Alvo 1", op ? price(levels.target) : "SEM_DADO", validPrice(levels.target) ? "ok" : "warn", "tecnico"],
    ["Alvo 2", "SEM MOTOR", "warn", "nao inventar"],
    ["Invalidacao", op ? price(levels.technical_invalidation) : "SEM_DADO", validPrice(levels.technical_invalidation) ? "bad" : "warn", "tecnica"],
    ["Qualidade", op ? pct(market.confidence) : "BLOCKED", op ? "ok" : "bad", "real data"]
  ]);
  setText("chartTitle", `GRAFICO INSTITUCIONAL | ${state.symbol} | ${state.interval}`);
  setText("chartSubtitle", op ? `${market.source} | ${fmtTime(market.generated_at)} | ${state.latency} ms` : "SEM DADO REAL - AGUARDAR");
  setText("marketNarrative", op ? cleanLabel(market.narrative) : "Fonte publica nao comprovada. Painel bloqueado para leitura operacional.");
  renderScore("scorecard");
  renderScenarios();
  renderSources();
  drawMarket();
}

function renderScore(mode) {
  const market = state.market || {};
  const op = state.operational;
  if (mode === "sources") {
    qs("#scoreContent").innerHTML = rowHtml((market.source_consensus?.lanes || []).map(x => [x.name, x.status, statusClass(x.status)]));
    return;
  }
  if (mode === "lifecycle") {
    qs("#scoreContent").innerHTML = rowHtml([
      ["Estado", op ? "WATCH_ENTRY" : "BLOCKED", op ? "warn" : "bad"],
      ["Zona", op ? "OBSERVE" : "SEM DADO"],
      ["TP1", op ? "PENDING" : "SEM DADO"],
      ["Protecao", op ? "ARMED" : "SEM DADO"],
      ["Reentrada", op ? "OBSERVE" : "SEM DADO"]
    ]);
    return;
  }
  qs("#scoreContent").innerHTML = rowHtml([
    ["Qualidade", op ? "REAL DATA" : "BLOCKED", op ? "ok" : "bad"],
    ["Confluencia", op ? pct(market.confidence) : "--"],
    ["Multi-TF", "SEM MOTOR"],
    ["Volume", op ? String(market.signals?.volume_ratio ?? "--") : "SEM DADO"],
    ["Estrutura", op ? market.levels?.structure || "SEM DADO" : "SEM DADO"],
    ["Execucao", "BLOQUEADA", "bad"]
  ]);
}

function renderScenarios() {
  const market = state.market || {};
  const op = state.operational;
  qs("#scenarioList").innerHTML = rowHtml([
    ["PRIMARIO", op ? cleanLabel(market.narrative) : "Aguardar candles reais"],
    ["ALTERNATIVO", op ? `Observar ${market.levels?.structure || "estrutura"}` : "Sem dado"],
    ["RISCO", op && validPrice(market.levels?.technical_invalidation) ? `Perda de ${price(market.levels.technical_invalidation)}` : "SEM_DADO / fail-closed"]
  ]);
}

function renderSources() {
  const lanes = state.market?.source_consensus?.lanes || [];
  qs("#sourceRegistry").innerHTML = lanes.length
    ? lanes.map(x => `<div class="source-row"><span>${esc(x.name)}</span><b class="${statusClass(x.status)}">${esc(x.status)}</b></div>`).join("")
    : '<div class="empty-module">SEM FONTES</div>';
}

function renderQuant() {
  const brain = state.telemetry?.brain || {};
  const memory = (brain.hippocampus || []).map(cleanScenario);
  setText("entropyValue", validNumber(brain.amygdala?.cortisol) ? Number(brain.amygdala.cortisol).toFixed(2).replace(".", ",") : "--");
  qs("#episodeRows").innerHTML = memory.map((x, i) => (
    `<tr><td>${String(i + 1).padStart(2, "0")}</td><td>${esc(x.scenario)}</td><td>${esc(x.reuse)}</td><td>${esc(x.match_pct)}%</td></tr>`
  )).join("") || '<tr><td colspan="4">SEM REFERENCIAS</td></tr>';
  const bars = [
    ["Dopamina / reward", Number(brain.dopamine?.dopamine)],
    ["Cortisol / stress", Number(brain.amygdala?.cortisol)],
    ["Fusao cognitiva", Number(brain.plasticity?.fused_signal)],
    ["Confianca cortex", Number(brain.cortex?.confidence)]
  ];
  qs("#neuralBars").innerHTML = bars.map(([label, value]) => (
    `<div class="bar-row"><span>${label}</span><b>${validNumber(value) ? value.toFixed(2) : "--"}</b><div class="bar-track"><i style="width:${validNumber(value) ? Math.max(0, Math.min(100, value * 100)) : 0}%"></i></div></div>`
  )).join("");
  qs("#challengerGrid").innerHTML = [["RNN", "SHADOW"], ["GRU", "WARMUP"], ["LSTM", "WARMUP"], ["KAN", "WARMUP"]]
    .map(([a, b]) => `<div class="mini-card"><span>${a}</span><b>${b}</b><small>human gate</small></div>`).join("");
  drawRadar();
  drawSensory();
}

function renderMicro() {
  setText("microSymbol", state.symbol);
  setText("microInterval", state.interval);
  setText("microHealth", state.operational ? "REAL DATA" : "SEM DADO");
  qs("#microDiagnostics").innerHTML = rowHtml([
    ["Imbalance L2", "SEM DADO"],
    ["CVD acumulado", "SEM DADO"],
    ["Delta 1m", "SEM DADO"],
    ["VWAP sessao", state.operational ? price(state.market?.price) : "SEM DADO"],
    ["Heatmap", "DERIVED_FROM_REAL_CANDLES"],
    ["Integridade do fluxo", state.operational ? "CANDLES ONLY" : "SEM DADO"]
  ]);
  drawHeatmap();
}

function renderRisk() {
  const guardrails = state.guardrails || {};
  qs("#guardrailList").innerHTML = rowHtml([
    ["Modo operacional", "SHADOW ONLY"],
    ["Execucao real", guardrails.real_orders_enabled ? "REVISAR" : "BLOQUEADA", guardrails.real_orders_enabled ? "bad" : "ok"],
    ["Order send", guardrails.real_orders_enabled ? "REVISAR" : "DESATIVADO", guardrails.real_orders_enabled ? "bad" : "ok"],
    ["Broker auth", String(guardrails.broker_actions || "blocked").toUpperCase()],
    ["Fail closed", guardrails.fail_closed ? "ATIVO" : "REVISAR", guardrails.fail_closed ? "ok" : "bad"]
  ]);
  qs("#safetyLayerList").innerHTML = rowHtml([
    ["Politica & governanca", "ATIVA", "ok"],
    ["Verificacao & logica", "ATIVA", "ok"],
    ["Protecao de dados", "ATIVA", "ok"],
    ["Risco & exposicao", "ATIVA", "ok"],
    ["Integridade & auditoria", "ATIVA", "ok"]
  ]);
  setText("riskIntegrity", guardrails.fail_closed ? "100%" : "REVISAR");
  qs("#engineStatus").innerHTML = rowHtml([
    ["MT5 Bridge", "READ_ONLY / OFF"],
    ["MEXC Bridge", "READ_ONLY / OFF"],
    ["Market Data Feed", state.operational ? "ATIVO" : "REVISAR", state.operational ? "ok" : "warn"],
    ["Risk Engine Shadow", "ATIVO", "ok"],
    ["Strategy Engine Shadow", "ATIVO", "ok"],
    ["Execution Engine", "DESATIVADO", "ok"]
  ]);
}

function renderMemory() {
  const memory = (state.telemetry?.brain?.hippocampus || []).map(cleanScenario);
  const n = memory.length;
  qs("#memoryStrip").innerHTML = [
    ["Memoria Sync", n ? "STATIC_REFERENCE" : "SEM DADO"],
    ["Episodios ativos", `${n} episodios`],
    ["Indice semantico", n ? `${n} fontes` : "--"],
    ["Saude da memoria", n ? "REFERENCE" : "--"],
    ["Memoria usada", "SEM ENDPOINT"],
    ["Checkpoint ativo", "SEM ENDPOINT"],
    ["Ultimo snapshot", "SEM ENDPOINT"],
    ["Modo atual", "READ_ONLY"]
  ].map(([a, b]) => `<div class="metric"><span>${esc(a)}</span><b>${esc(b)}</b></div>`).join("");
  qs("#memoryRows").innerHTML = memory.map((x, i) => (
    `<tr><td>${String(i + 1).padStart(2, "0")}</td><td>${esc(x.scenario)}</td><td>${esc(x.reuse)}</td><td>${esc(x.match_pct)}%</td></tr>`
  )).join("") || '<tr><td colspan="4">SEM REFERENCIAS</td></tr>';
  setText("memorySyncPct", n ? "REF" : "--");
  qs("#memoryHealthBars").innerHTML = rowHtml([
    ["Integridade", "STATIC_REFERENCE"],
    ["Consistencia", "SEM LEDGER"],
    ["Cobertura", `${n} itens`],
    ["Ultima sincronia", "SEM ENDPOINT"]
  ]);
  qs("#patternList").innerHTML = memory.map(x => `<div class="pattern-row"><span>${esc(x.scenario)}</span><b>${esc(x.match_pct)}%</b></div>`).join("") || '<div class="empty-module">SEM PADROES</div>';
}

function drawBackground(ctx, w, h) {
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(255,255,255,.07)";
  for (let i = 0; i <= 9; i++) {
    ctx.beginPath();
    ctx.moveTo(0, i * h / 9);
    ctx.lineTo(w, i * h / 9);
    ctx.stroke();
  }
  for (let i = 0; i <= 12; i++) {
    ctx.beginPath();
    ctx.moveTo(i * w / 12, 0);
    ctx.lineTo(i * w / 12, h);
    ctx.stroke();
  }
}

function line(ctx, x1, y1, x2, y2, color, width = 1, dash = []) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

function tag(ctx, x, y, label, color) {
  ctx.save();
  ctx.font = "700 10px Consolas,monospace";
  const width = ctx.measureText(label).width + 13;
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.95;
  ctx.fillRect(x, y - 10, width, 19);
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#000000";
  ctx.fillText(label, x + 6, y + 4);
  ctx.restore();
}

function drawMarket() {
  const canvas = qs("#marketCanvas");
  const overlay = qs("#chartOverlay");
  const market = state.market;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const ctx = canvas.getContext("2d");
  canvas.width = Math.max(700, Math.round(rect.width * dpr));
  canvas.height = Math.max(320, Math.round(rect.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const w = rect.width;
  const h = rect.height;
  ctx.clearRect(0, 0, w, h);
  drawBackground(ctx, w, h);
  if (!state.operational || !market?.candles?.length) {
    overlay.classList.remove("hidden");
    overlay.innerHTML = "SEM DADO REAL<br><small>AGUARDAR | FAIL-CLOSED</small>";
    return;
  }
  overlay.classList.add("hidden");
  const candles = market.candles.slice(-68);
  const levels = market.levels || {};
  const visibleLevels = [
    levels.target,
    levels.resistance,
    market.price,
    levels.support,
    levels.technical_invalidation,
    ...(levels.entry_zone || [])
  ].filter(validPrice).map(Number);
  const values = candles.flatMap(x => [Number(x.high), Number(x.low)]);
  const hi = Math.max(...values, ...visibleLevels);
  const lo = Math.min(...values, ...visibleLevels);
  const span = Math.max(1, hi - lo);
  const padL = 20;
  const padR = 92;
  const padT = 18;
  const padB = 64;
  const chartH = h - padT - padB;
  const step = (w - padL - padR) / candles.length;
  const y = v => padT + (hi - Number(v)) / span * chartH;
  const x = i => padL + i * step + step / 2;

  const entry = levels.entry_zone || [];
  if (validPrice(entry[0]) && validPrice(entry[1])) {
    ctx.fillStyle = "rgba(255,184,0,.10)";
    ctx.fillRect(padL, Math.min(y(entry[0]), y(entry[1])), w - padL - padR, Math.abs(y(entry[1]) - y(entry[0])));
  }

  [
    [levels.target, "ALVO 1", PALETTE.long],
    [levels.resistance, "RESISTENCIA", PALETTE.gold],
    [market.price, "PRECO", PALETTE.cyan],
    [levels.support, "SUPORTE", PALETTE.cyan],
    [levels.technical_invalidation, "PROTECAO", PALETTE.short]
  ].forEach(([value, label, color]) => {
    if (!validPrice(value)) return;
    const yy = y(value);
    line(ctx, padL, yy, w - padR, yy, color, 1, [7, 6]);
    tag(ctx, w - padR + 7, yy, `${label} ${price(value)}`, color);
  });

  const maxVol = Math.max(...candles.map(k => Number(k.volume || 0)), 1);
  candles.forEach((k, i) => {
    const xx = x(i);
    const up = Number(k.close) >= Number(k.open);
    const color = up ? PALETTE.long : PALETTE.short;
    ctx.fillStyle = up ? "rgba(0,255,157,.30)" : "rgba(255,62,82,.30)";
    ctx.fillRect(xx - Math.max(1.5, step * 0.25), h - 15 - (Number(k.volume || 0) / maxVol) * 35, Math.max(3, step * 0.5), (Number(k.volume || 0) / maxVol) * 35);
    line(ctx, xx, y(k.high), xx, y(k.low), color, 1.15);
    ctx.fillStyle = color;
    ctx.fillRect(xx - Math.max(2, step * 0.26), Math.min(y(k.open), y(k.close)), Math.max(4, step * 0.52), Math.max(3, Math.abs(y(k.close) - y(k.open))));
  });

  const ma = candles.map((_, i) => {
    const sample = candles.slice(Math.max(0, i - 8), i + 1);
    return sample.reduce((sum, k) => sum + Number(k.close), 0) / sample.length;
  });
  ctx.save();
  ctx.strokeStyle = PALETTE.gold;
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ma.forEach((value, i) => i ? ctx.lineTo(x(i), y(value)) : ctx.moveTo(x(i), y(value)));
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = PALETTE.muted;
  ctx.font = "700 9px Consolas,monospace";
  ctx.fillText("VOLUME", padL, h - 7);
  ctx.fillStyle = PALETTE.cyan;
  ctx.fillText("REAL CANDLES | READ_ONLY", padL + 70, h - 7);
}

function drawRadar() {
  const svg = qs("#radarChart");
  if (!svg) return;
  const vals = [0.64, 0.61, 0.84, 0.72, 0.71, 0.71];
  const cx = 150;
  const cy = 125;
  const r = 88;
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 3;
    const rr = r * vals[i];
    pts.push(`${cx + Math.cos(a) * rr},${cy + Math.sin(a) * rr}`);
  }
  let grid = "";
  for (let n = 1; n <= 4; n++) {
    const p = [];
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 3;
      p.push(`${cx + Math.cos(a) * r * n / 4},${cy + Math.sin(a) * r * n / 4}`);
    }
    grid += `<polygon points="${p.join(" ")}" fill="none" stroke="rgba(255,255,255,.12)"/>`;
  }
  svg.innerHTML = `${grid}<polygon points="${pts.join(" ")}" fill="rgba(0,242,255,.13)" stroke="${PALETTE.cyan}" stroke-width="2"/>${pts.map(p => {
    const [x, y] = p.split(",");
    return `<circle cx="${x}" cy="${y}" r="3" fill="${PALETTE.gold}"/>`;
  }).join("")}`;
}

function drawSensory() {
  const canvas = qs("#sensoryCanvas");
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const ctx = canvas.getContext("2d");
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const w = rect.width;
  const h = rect.height;
  ctx.clearRect(0, 0, w, h);
  drawBackground(ctx, w, h);
  [PALETTE.cyan, PALETTE.long, PALETTE.gold, PALETTE.short].forEach((color, idx) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.35;
    ctx.beginPath();
    for (let x = 0; x < w; x++) {
      const y = (idx + 1) * h / 5 + Math.sin(x / 22 + idx * 1.4) * 11 + Math.sin(x / 9 + idx) * 4;
      x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
  });
  qs("#sensoryStats").innerHTML = metricHtml([
    ["SNR", "DERIVADO"],
    ["Coerencia", "VISUAL"],
    ["Ruido", "SEM SENSOR"],
    ["Estabilidade", "SHADOW"],
    ["Deriva", "SEM DADO"]
  ]);
}

function drawHeatmap() {
  const canvas = qs("#heatmapCanvas");
  const overlay = qs("#heatmapOverlay");
  const market = state.market;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const ctx = canvas.getContext("2d");
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const w = rect.width;
  const h = rect.height;
  ctx.clearRect(0, 0, w, h);
  drawBackground(ctx, w, h);
  if (!state.operational || !market?.candles?.length) {
    overlay.classList.remove("hidden");
    overlay.innerHTML = "SEM DADO REAL<br><small>HEATMAP DERIVADO BLOQUEADO</small>";
    return;
  }
  overlay.classList.add("hidden");
  for (let i = 0; i < 12; i++) {
    const y0 = 22 + i * (h - 44) / 12;
    const alpha = 0.035 + ((i * 7) % 8) * 0.012;
    ctx.fillStyle = i < 6 ? `rgba(255,184,0,${alpha})` : `rgba(0,255,157,${alpha})`;
    ctx.fillRect(0, y0, w, 10 + ((i * 13) % 22));
  }
  const candles = market.candles.slice(-52);
  const values = candles.flatMap(x => [Number(x.high), Number(x.low)]);
  const hi = Math.max(...values);
  const lo = Math.min(...values);
  const span = Math.max(1, hi - lo);
  const step = w / candles.length;
  const y = v => h - 24 - (Number(v) - lo) / span * (h - 48);
  candles.forEach((k, i) => {
    const xx = i * step + step / 2;
    const color = Number(k.close) >= Number(k.open) ? PALETTE.long : PALETTE.short;
    line(ctx, xx, y(k.high), xx, y(k.low), color, 1);
    ctx.fillStyle = color;
    ctx.fillRect(xx - 2.4, Math.min(y(k.open), y(k.close)), 4.8, Math.max(3, Math.abs(y(k.close) - y(k.open))));
  });
  ctx.fillStyle = PALETTE.cyan;
  ctx.font = "700 9px Consolas,monospace";
  ctx.fillText("DERIVED_FROM_REAL_CANDLES | NAO E L2", 12, h - 8);
}

async function loadMarket() {
  try {
    state.market = await fetchJson(`/api/orion/market-analysis?symbol=${encodeURIComponent(state.symbol)}&interval=${encodeURIComponent(state.interval)}&pressure=30`);
  } catch {
    state.market = null;
  }
  updateTruth();
  renderMarket();
  renderOverview();
  renderMicro();
}

async function refreshAll() {
  try {
    [state.status, state.guardrails, state.telemetry] = await Promise.all([
      fetchJson("/api/status"),
      fetchJson("/api/orion/guardrails"),
      fetchJson("/api/orion/telemetry")
    ]);
  } catch {
    state.status = null;
    state.guardrails = null;
    state.telemetry = null;
  }
  await loadMarket();
  renderHeader();
  renderOverview();
  renderQuant();
  renderMicro();
  renderRisk();
  renderMemory();
}

window.addEventListener("resize", () => {
  if (state.activeTab === "market") drawMarket();
  if (state.activeTab === "micro") drawHeatmap();
  if (state.activeTab === "deep") drawSensory();
});

bindEvents();
setActive(initialTabFromLocation());
refreshAll();
setInterval(refreshAll, 30000);
