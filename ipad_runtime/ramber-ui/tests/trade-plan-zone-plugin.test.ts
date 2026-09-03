// trade-plan-zone-plugin.test.ts — Ordem Final Autonomia Evolução §1
// ("caixas semi-transparentes... alertas visuais sutis quando o preço
// romper estrutura relevante"): locks TradePlanZonePlugin (the entry-zone
// box) and the chart-side stop/target hit-boost effect at source level —
// same technique as liquidity-zones-plugin.test.ts (node env, no real
// canvas; real visual verification via Playwright before commit).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');
const plugin = () => read('../src/chart/TradePlanZonePlugin.tsx');
const chart = () => read('../src/chart/EnhancedChart_110_Percent.tsx');

describe('TradePlanZonePlugin: "Fio de Seda" (Regra de Ouro 2) — border never dashed/dotted', () => {
  it('never calls setLineDash', () => {
    expect(plugin()).not.toMatch(/\.setLineDash\(/);
  });

  it('the border is always lineWidth = 1, never a larger value', () => {
    expect(plugin()).toContain('ctx.lineWidth = 1');
    expect(plugin()).not.toMatch(/ctx\.lineWidth = [2-9]/);
  });

  it('the fill is more translucent than the border — honest visual hierarchy, same law as LiquidityZonesPlugin', () => {
    const fillOpacity = Number(plugin().match(/ZONE_FILL = "rgba\([^)]+, ([0-9.]+)\)"/)?.[1]);
    const borderOpacity = Number(plugin().match(/ZONE_BORDER = "rgba\([^)]+, ([0-9.]+)\)"/)?.[1]);
    expect(Number.isFinite(fillOpacity)).toBe(true);
    expect(Number.isFinite(borderOpacity)).toBe(true);
    expect(fillOpacity).toBeLessThan(borderOpacity);
  });

  it('reuses the exact amber already used for the entry price lines — one color per role, never a second palette', () => {
    expect(plugin()).toContain('rgba(240, 193, 111,');
  });
});

describe('TradePlanZonePlugin: §17 confidence-scaled opacity — the SAME real §16 Confidence Zone, never a fabricated probability', () => {
  it('imports the real InstitutionalConfidenceZone type — zero second banding', () => {
    expect(plugin()).toContain('import type { InstitutionalConfidenceZone } from "../nexus/institutional-score";');
  });

  it('all 5 real tiers are mapped, each strictly decreasing toward a legible floor — never fully invisible', () => {
    const s = plugin();
    const m = s.match(/const OPACITY_BY_TIER: Record<InstitutionalConfidenceZone\["tier"\], number> = \{([\s\S]*?)\};/);
    expect(m, 'OPACITY_BY_TIER não encontrado').not.toBeNull();
    const body = m![1];
    expect(body).toContain('MUITO_FORTE: 1,');
    expect(body).toContain('FORTE: 0.85,');
    expect(body).toContain('MODERADA: 0.7,');
    expect(body).toContain('FRACA: 0.55,');
    expect(body).toContain('INVALIDA: 0.4,');
  });

  it('null zone (WAIT/DADOS_INSUFICIENTES) uses a neutral documented default — never zero, never the ceiling', () => {
    const s = plugin();
    expect(s).toContain('const DEFAULT_OPACITY_MULTIPLIER = 0.7;');
    expect(s).toContain('return zone ? OPACITY_BY_TIER[zone.tier] : DEFAULT_OPACITY_MULTIPLIER;');
  });

  it('the draw loop multiplies the SAME base ZONE_FILL/ZONE_BORDER alpha — never a second color/palette', () => {
    const s = plugin();
    expect(s).toContain('ctx.fillStyle = withAlpha(ZONE_FILL, alphaOf(ZONE_FILL) * multiplier);');
    expect(s).toContain('ctx.strokeStyle = withAlpha(ZONE_BORDER, alphaOf(ZONE_BORDER) * multiplier);');
  });

  it('confidenceZone is threaded through the same ref pattern as entryLow/entryHigh — always latest, never re-triggers the setup effect', () => {
    const s = plugin();
    // Rodada de acessibilidade da navegação/gráfico (achado real: "cada
    // item no seu canto, nada cobrindo nada") — activeLanes entra no
    // MESMO ref/dirty-check, mesmo padrão já provado por
    // entryLow/entryHigh/confidenceZone/visualWeight.
    expect(s).toContain('const rangeRef = useRef({ entryLow, entryHigh, confidenceZone, visualWeight, activeLanes });');
    expect(s).toContain('rangeRef.current = { entryLow, entryHigh, confidenceZone, visualWeight, activeLanes };');
    expect(s).toContain('}, [entryLow, entryHigh, confidenceZone, visualWeight, activeLanes]);');
  });

  it('Ordem Nº 03: visualWeight (competição cruzada real via nexus/visual-budget.ts) vence quando fornecido; cai em opacityMultiplierFor(zone) — nunca um segundo esquema — quando ausente', () => {
    const s = plugin();
    expect(s).toContain(
      'const multiplier = resolvedWeight !== undefined && resolvedWeight !== null ? resolvedWeight : opacityMultiplierFor(zone);',
    );
  });
});

describe('TradePlanZonePlugin: real geometry, fail-closed, never a fabricated pixel', () => {
  it('resolves price to pixel via series.priceToCoordinate — never a fixed/guessed coordinate', () => {
    expect(plugin()).toContain('series.priceToCoordinate(');
  });

  it('a missing plan or a zero-width zone (single acceptance price) is never drawn — the price line already covers it', () => {
    expect(plugin()).toMatch(/low === null \|\| high === null \|\| !Number\.isFinite\(low\) \|\| !Number\.isFinite\(high\) \|\| low === high/);
  });

  it('coordinates outside the current visible range are never extrapolated', () => {
    expect(plugin()).toMatch(/if \(y1 === null \|\| y2 === null\) return;/);
  });

  it('never uses Math.random or any synthetic data (Regra de Ouro 1)', () => {
    expect(plugin()).not.toMatch(/Math\.random/);
  });
});

describe('TradePlanZonePlugin: dirty-flag + requestAnimationFrame, never a perpetual loop', () => {
  it('schedules a redraw via requestAnimationFrame, guarded by a flag', () => {
    expect(plugin()).toContain('requestAnimationFrame(');
    expect(plugin()).toMatch(/if \(rafScheduled\) return;/);
  });

  it('reacts to visible-range changes (pan/zoom) via the real lib subscription', () => {
    expect(plugin()).toContain('subscribeVisibleLogicalRangeChange(');
  });

  it('tracks real canvas size via ResizeObserver, never a bespoke resize listener', () => {
    expect(plugin()).toContain('new ResizeObserver(');
  });

  it('unmounts clean: unsubscribes the range listener and disconnects the ResizeObserver', () => {
    expect(plugin()).toContain('unsubscribeVisibleLogicalRangeChange(');
    expect(plugin()).toContain('resizeObserver.disconnect()');
  });
});

describe('EnhancedChart_110_Percent: mounts TradePlanZonePlugin as the topmost overlay, real chart/series/plan only', () => {
  it('imports and mounts it with the real chart/series (never a fabricated default) and the real entry range', () => {
    const s = chart();
    expect(s).toContain('import { TradePlanZonePlugin, opacityMultiplierFor } from "./TradePlanZonePlugin";');
    expect(s).toContain('<TradePlanZonePlugin');
    expect(s).toContain('chart={chartReady?.chart ?? null}');
    expect(s).toContain('series={chartReady?.series ?? null}');
    expect(s).toContain('entryLow={tradePlan?.entry.low ?? null}');
    expect(s).toContain('entryHigh={tradePlan?.entry.high ?? null}');
  });

  it('§17: threads the real confidenceZone prop through to the plugin, fail-closed to null when absent', () => {
    const s = chart();
    expect(s).toContain('import type { InstitutionalConfidenceZone } from "../nexus/institutional-score";');
    expect(s).toContain('confidenceZone={confidenceZone ?? null}');
  });
});

describe('App.tsx: threads the real confidenceZone (§16) from context into ChartWidget → EnhancedChart_110_Percent', () => {
  it('ChartWidget destructures confidenceZone from the shared WidgetContext', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('setChartTimeframe, chartLayerVisibility, chartLayerAutoMode, emaPeriod, confidenceZone, institutionalScore, nexusDecision, vwapCtx, nlState, orderflowTrend, liquidations } = useContext(WidgetContext) || {};');
  });

  it('passes it straight through to EnhancedChart_110_Percent — zero recomputation', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('confidenceZone={confidenceZone ?? null}');
  });
});

describe('EnhancedChart_110_Percent: stop/target hit-boost v2 (Ordem Final Autonomia Evolução §1 + Diretriz Complementar §2/§4)', () => {
  it('updates the existing lines in place via applyOptions — never removes/recreates them on a live-price tick', () => {
    const s = chart();
    const block = s.slice(s.indexOf('const hits = targetsHit'), s.indexOf('}, [tradePlan, livePrice, targetsHit]);'));
    expect(block).toContain('stopLineRef.current?.applyOptions(');
    expect(block).toContain('line.applyOptions(');
    expect(block).not.toContain('createPriceLine(');
    expect(block).not.toContain('removePriceLine(');
  });

  it('hierarchy stays color/opacity-only (Regra de Ouro 2) — lineWidth/lineStyle are never touched by the hit-boost effect', () => {
    const s = chart();
    const block = s.slice(s.indexOf('const hits = targetsHit'), s.indexOf('}, [tradePlan, livePrice, targetsHit]);'));
    expect(block).not.toContain('lineWidth');
    expect(block).not.toContain('lineStyle');
  });

  it('is a separate effect from line creation — depends on [tradePlan, livePrice, targetsHit], not just [tradePlan]', () => {
    expect(chart()).toContain('}, [tradePlan, livePrice, targetsHit]);');
  });

  it('as literais base de EN/ST/TP continuam consistentes — em priceAxisLabels (sistema anti-colisão), nomenclatura curta real (EPC FINAL §8); Ordem "Lapidação das Etiquetas TP1/TP2" §3/§4 moveu basis/estado pro secundário, texto primário ficou só EN/ST/TP (a porcentagem saiu do canvas de vez)', () => {
    const s = chart();
    expect(s).toContain('`EN ${tradePlan.direction}');
    expect(s).toContain('text: "ST",');
    expect(s).toContain(': tradePlan.stop.basis;');
    expect(s).toContain('compactLabels ? null : target.basis,');
    // Sigla pura no primário (pedido do Operador).
    expect(s).toContain('text: `TP${i + 1}`,');
    // E a porcentagem NÃO volta ao canvas: pedido repetido em duas rodadas,
    // com captura real de ZEC 4H mostrando "TP1 3.14% FRACA 1:0.42" sobre
    // as velas. A distância real continua no painel do Trade Plan
    // (App.tsx) — realocada, nunca apagada (Regra de Ouro 4).
    expect(s).not.toContain('distPct');
  });

  it('v2: "REACHED" is driven by the AUTHORITATIVE targetsHit prop, never re-derived from livePrice alone — a target stays marked reached even if price later pulls back', () => {
    const s = chart();
    const block = s.slice(s.indexOf('const hits = targetsHit'), s.indexOf('}, [tradePlan, livePrice, targetsHit]);'));
    expect(block).toContain('const hits = targetsHit ?? 0;');
    expect(block).toContain('const reached = i < hits;');
  });

  it('v2: the stop line itself ratchets forward once targetsHit > 0 — "quando o cenário muda, o desenho muda"', () => {
    const s = chart();
    const block = s.slice(s.indexOf('const hits = targetsHit'), s.indexOf('}, [tradePlan, livePrice, targetsHit]);'));
    expect(block).toContain('const effectiveStopPrice = effectiveStopForTargetsHit(tradePlan, hits);');
    expect(block).toContain('price: effectiveStopPrice,');
  });

  it('§18 trailing stop além do break-even: the ratchet formula is imported from the SAME single real source signal-track-record.ts uses — never a second local formula', () => {
    const s = chart();
    expect(s).toContain('import { effectiveStopForTargetsHit } from "../nexus/trade-plan";');
    const block = s.slice(s.indexOf('const hits = targetsHit'), s.indexOf('}, [tradePlan, livePrice, targetsHit]);'));
    expect(block).not.toContain('const entryMid =');
  });

  it('a non-finite or absent live price never resolves a STOP BREACHED (fail-closed) — target REACHED still updates from the authoritative ratchet regardless', () => {
    const s = chart();
    const block = s.slice(s.indexOf('const hits = targetsHit'), s.indexOf('}, [tradePlan, livePrice, targetsHit]);'));
    expect(block).toContain('const stopHitNow = p !== null &&');
  });
});

describe('EnhancedChart_110_Percent: VWAP wiring (research-driven precision order)', () => {
  it('imports the real pure engine — never a second inline computation of the same math', () => {
    expect(chart()).toContain('import { computeSessionVwapSeries } from "../nexus/vwap";');
  });

  it('the VWAP series shares the MAIN price scale (no priceScaleId override) — unlike CVD, it IS a real price', () => {
    const s = chart();
    const block = s.slice(s.indexOf('const vwapSeries = chart.addSeries'), s.indexOf('vwapSeriesRef.current = vwapSeries;'));
    expect(block).not.toContain('priceScaleId');
  });

  it('is Fio de Seda compliant: lineWidth 1, LineStyle.Solid', () => {
    const s = chart();
    const block = s.slice(s.indexOf('const vwapSeries = chart.addSeries'), s.indexOf('vwapSeriesRef.current = vwapSeries;'));
    expect(block).toContain('lineWidth: 1');
    expect(block).toContain('lineStyle: LineStyle.Solid');
  });

  it('is fed straight from the real `data` prop (the same candles driving the whole chart) — zero new fetch', () => {
    const s = chart();
    const start = s.indexOf('if (!vwapSeriesRef.current) return;');
    const block = s.slice(start, s.indexOf('}, [data]);', start));
    expect(block).toContain('computeSessionVwapSeries(data)');
    expect(block).toContain('vwapSeriesRef.current.setData(');
  });

  it('the ref is cleared on unmount, same discipline as every other series ref', () => {
    const s = chart();
    const teardown = s.slice(s.indexOf('chart.remove();'), s.indexOf('setChartReady(null);'));
    expect(teardown).toContain('vwapSeriesRef.current = null;');
  });
});
