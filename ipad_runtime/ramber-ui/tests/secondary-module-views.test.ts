// secondary-module-views.test.ts — Multi-Source Order, deliverable 3: locks
// the dedicated secondary-module views (MARKETS/ANALYSIS/RISK/SCANNER/NEWS/
// ALERTS/EXECUTION) at source level — same technique as the other App-wiring
// suites (node env, no DOM; real rendering is verified via Playwright).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const app = () => readFileSync(resolve(here, '../src/App.tsx'), 'utf8');

describe('Secondary module views: real data routing, English labels, fail-closed honesty', () => {
  it('the old shared generic placeholder is gone — every non-cockpit tab routes to SecondaryModuleView', () => {
    const s = app();
    expect(s).not.toContain('AGUARDANDO FONTE DE DADOS REAL');
    expect(s).toContain('<SecondaryModuleView tab={activeTab} />');
  });

  it('nav ids/labels migrated to English trading terminology', () => {
    const s = app();
    for (const id of ['"MARKETS"', '"ANALYSIS"', '"RISK"', '"EXECUTION"', '"SCANNER"', '"NEWS"', '"ALERTS"']) {
      expect(s).toContain(`id: ${id}`);
    }
    expect(s).not.toContain('id: "MERCADOS"');
  });

  it('views read REAL state only: store selectors + WidgetContext — zero fetch() of their own', () => {
    const s = app();
    const view = s.slice(s.indexOf('function SecondaryModuleView'), s.indexOf('function ChartWidget'));
    expect(view).toContain('useConnectionsSnapshot()');
    expect(view).toContain('useCouncilSnapshot()');
    expect(view).toContain('useTrustScoreSnapshot()');
    expect(view).not.toMatch(/fetch\(/);
    expect(view).not.toMatch(/Math\.random/);
  });

  it('MARKETS lists all four real exchanges of the ingestion layer (MEXC included)', () => {
    expect(app()).toContain('["BINANCE", "BYBIT", "OKX", "MEXC"]');
  });

  it('scenario weights keep the honesty label (opinion mass, never market probability) in English', () => {
    expect(app()).toContain('council opinion mass, never market probability');
  });

  it('NEWS is fail-closed honest (no fabricated headlines) and EXECUTION states the permanent read-only design', () => {
    const s = app();
    expect(s).toContain('NO REAL NEWS FEED CONNECTED');
    expect(s).toContain('ORDER EXECUTION IS PERMANENTLY DISABLED');
  });

  it('empty states are honest text, never a fabricated number', () => {
    expect(app()).toContain('const MODULE_EMPTY = "AWAITING REAL DATA"');
  });

  // EPC MODO ELITE (Recuperação de Inteligência Oculta): opinionMass (a
  // distribuição real L/S/N do pool linear) já alimentava o Scenario
  // Engine mas nunca era mostrada como número — agreement é só o escalar
  // de coesão derivado. Recuperada no painel Council, fail-closed, com a
  // honestidade de sempre (massa de opinião, nunca probabilidade).
  it('Council: opinionMass (L/S/N) recuperada no painel ANALYSIS — não-duplicativa (agreement é derivado, não revela a forma), fail-closed em MODULE_EMPTY', () => {
    const s = app();
    expect(s).toContain('label="Opinion Mass (L/S/N)"');
    expect(s).toContain('council?.opinionMass ? `L ${Math.round(council.opinionMass.long * 100)} · S ${Math.round(council.opinionMass.short * 100)} · N ${Math.round(council.opinionMass.neutral * 100)}` : MODULE_EMPTY');
  });
});

describe('Command bar: Trade Plan strip (critical numbers in the header, fail-closed)', () => {
  it('renders signal + entry + stop + target from the real store slice', () => {
    const s = app();
    expect(s).toContain('function TradePlanTopStrip(');
    const strip = s.slice(s.indexOf('function TradePlanTopStrip('), s.indexOf('// --- TOP BAR ---'));
    expect(strip).toContain('useTradePlanSnapshot()');
    expect(strip).not.toMatch(/fetch\(/);
    expect(strip).not.toMatch(/Math\.random/);
  });

  // Achado real de sessão (relato do Operador: "Entry/Target não aparece"):
  // o plano é travado pela leitura do CONSELHO (trade-plan.ts), não pela
  // direção própria do Core Engine — as duas podem divergir de forma real
  // e honesta. Antes, `!plan` renderizava `null` silencioso: o Operador não
  // tinha como distinguir bug de estado esperado. Agora renderiza um motivo
  // real (Conselho travado/neutro/sem estrutura), nunca fabricado, e NUNCA
  // muda qual sinal trava o plano (LEI 24 seria violada por essa troca).
  it('sem plano real: nunca um return null silencioso — sempre um motivo honesto derivado do Conselho/Núcleo reais', () => {
    const s = app();
    const strip = s.slice(s.indexOf('function TradePlanTopStrip('), s.indexOf('// --- TOP BAR ---'));
    expect(strip).toContain('const council = useCouncilSnapshot();');
    expect(strip).not.toContain('if (!plan) return null;');
    expect(strip).toMatch(/if \(!plan\) \{/);
    // EPC §5/§6: a derivação do motivo agora vive em tradePlanAbsenceReason
    // (função pura, module-scope), reaproveitada também pelo overlay do
    // CANVAS do gráfico (Regra de Ouro 4 — nunca duplicar) — a barra só
    // chama a função e exibe o resultado.
    expect(strip).toContain('const coreDir = engine?.direction ?? null;');
    expect(strip).toContain('const { reason, tooltip } = tradePlanAbsenceReason(council, coreDir, recentResolution);');
    expect(strip).not.toMatch(/fetch\(/);
    expect(strip).not.toMatch(/Math\.random/);

    // as 4 causas reais e mutuamente exclusivas do null, nunca uma 5ª
    // inventada — fonte única de verdade dentro da própria função.
    const fnSrc = s.slice(s.indexOf('function tradePlanAbsenceReason('), s.indexOf('function TradePlanTopStrip('));
    expect(fnSrc).toContain('if (!council) {');
    expect(fnSrc).toContain('if (council.riskGated) {');
    expect(fnSrc).toContain('if (council.stance === "NEUTRAL" || council.stance === "ABSTAIN") {');
    // a divergência Núcleo vs. Conselho (achado real) fica explícita quando existe
    expect(fnSrc).toContain('reason: `Núcleo ${coreDir}, Conselho neutro`,');
    expect(fnSrc).not.toMatch(/fetch\(/);
    expect(fnSrc).not.toMatch(/Math\.random/);
  });

  // Achado 2.4 (Visual Cleanup & Rendering Audit — pedido do Operador:
  // "quando bater o alvo, automaticamente tentar analisar outro
  // parâmetro"): investigação real (agente de exploração) confirmou que o
  // Core Engine/Council/Trade Plan já reavaliam continuamente e sem
  // atraso assim que um plano resolve (signal-track-record.ts zera
  // `active` no MESMO tick que prova o último alvo) — o gap real era só
  // de apresentação, nunca de dado. recentResolutionReason() cobre essa
  // janela reusando DISSOLVE_CONFIG (aura-lifecycle.ts) — mesma
  // convenção real já usada pela Neural Market Aura, zero limiar novo.
  it('recentResolutionReason: só TARGET_HIT/PARTIAL_HIT geram a mensagem — STOP_HIT/REPLACED/OPEN caem nos 4 motivos genéricos de sempre', () => {
    const s = app();
    const idx = s.indexOf('function recentResolutionReason(');
    expect(idx, 'recentResolutionReason não encontrada').toBeGreaterThan(-1);
    const fnSrc = s.slice(idx, s.indexOf('function tradePlanAbsenceReason('));
    expect(fnSrc).toContain('if (!lastResolvedPlan) return null;');
    expect(fnSrc).toContain('if (lastResolvedPlan.status !== "TARGET_HIT" && lastResolvedPlan.status !== "PARTIAL_HIT") return null;');
  });

  it('recentResolutionReason: reusa a MESMA janela real de dissolução da Neural Market Aura (DISSOLVE_CONFIG.expireCandles) — zero limiar novo inventado', () => {
    const s = app();
    const idx = s.indexOf('function recentResolutionReason(');
    const fnSrc = s.slice(idx, s.indexOf('function tradePlanAbsenceReason('));
    expect(fnSrc).toContain('const ageBars = (nowMs - lastResolvedPlan.resolvedAt) / timeframeMs;');
    expect(fnSrc).toContain('if (ageBars >= DISSOLVE_CONFIG.expireCandles) return null;');
    expect(s).toContain('import { computeAuraReading, TIMEFRAME_MS, DISSOLVE_CONFIG } from "./nexus/aura-lifecycle";');
  });

  it('tradePlanAbsenceReason: a resolução recente (quando existe) tem prioridade sobre os 4 motivos genéricos do Conselho', () => {
    const s = app();
    const idx = s.indexOf('function tradePlanAbsenceReason(');
    const fnSrc = s.slice(idx, s.indexOf('function TradePlanTopStrip('));
    expect(fnSrc).toContain('recentResolution?: { reason: string; tooltip: string } | null,');
    expect(fnSrc).toContain('if (recentResolution) return recentResolution;');
  });

  it('os 2 call sites reais (barra de comando + canvas) computam recentResolution a partir do MESMO histórico real (trackRecord.history), nunca uma leitura fabricada', () => {
    const s = app();
    // Barra de comando: useTrackRecordSnapshot já é usado aqui (trackRecord),
    // zero hook novo — só uma leitura adicional do MESMO objeto.
    const stripIdx = s.indexOf('function TradePlanTopStrip(');
    const stripSrc = s.slice(stripIdx, s.indexOf('// --- TOP BAR ---'));
    expect(stripSrc).toContain('const lastResolved = trackRecord.history[trackRecord.history.length - 1] ?? null;');
    expect(stripSrc).toContain('const recentResolution = recentResolutionReason(lastResolved, Date.now(), timeframeMs);');
    // Canvas (ChartWidget): mesmo padrão, useTrackRecordSnapshot dedicado
    // (zero prop-drilling a partir de App(), mesma disciplina já usada por
    // councilForChart logo acima).
    const chartIdx = s.indexOf('function ChartWidget(');
    expect(chartIdx).toBeGreaterThan(-1);
    // O limite era `chartIdx + 5000` — um número mágico, não uma fronteira
    // real. Ele quebrou ao inserir um hook novo perto do topo do ChartWidget:
    // as duas linhas continuavam DENTRO do componente (o que este teste
    // afirma), só saíram da janela arbitrária. Agora o corte é o mesmo tipo
    // de marcador real já usado para TradePlanTopStrip logo acima — a
    // asserção passa a ser "está dentro do ChartWidget", que é o que ela
    // sempre quis dizer, em vez de "está nos primeiros 5000 caracteres dele".
    const chartSrc = s.slice(chartIdx, s.indexOf('// --- ORDER FLOW WIDGET ---'));
    expect(chartSrc).toContain('const trackRecordForChart = useTrackRecordSnapshot();');
    expect(chartSrc).toContain('const lastResolvedPlanForChart = trackRecordForChart.history[trackRecordForChart.history.length - 1] ?? null;');
  });

  it('LEI 24: o fallback honesto nunca escreve em engine/council/plan — só lê e exibe (mesma disciplina display-only)', () => {
    const s = app();
    const strip = s.slice(s.indexOf('function TradePlanTopStrip('), s.indexOf('// --- TOP BAR ---'));
    const fallbackIdx = strip.indexOf('if (!plan) {');
    const fallbackBlock = strip.slice(fallbackIdx, strip.indexOf('\n  }', fallbackIdx));
    expect(fallbackBlock).not.toMatch(/setTradePlan|setCouncil|setEngine/);
  });

  it('structure-break alert is pure display derivation from the live price vs real plan levels', () => {
    const s = app();
    expect(s).toContain('TARGET REACHED');
    expect(s).toContain('STOP BREACHED');
    expect(s).toContain('<TradePlanTopStrip livePrice={data?.price ?? null} />');
  });
});
