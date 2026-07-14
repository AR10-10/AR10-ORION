// refinamento-final-wiring.test.ts — Diretriz "Refinamento Final" (pós-
// auditoria): trava a fiação real dos itens §1 (header), §7 (Premium/
// Discount), §8 (harmônicos) e §10 (reset temporal). A matemática pura já
// tem execução real em market-session.test.ts / premium-discount.test.ts /
// harmonic-patterns.test.ts — aqui trancam-se os pontos de conexão (mesma
// convenção mista de sempre: "esqueceram de ligar A com B" é o bug provável).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');
const app = () => read('../src/App.tsx');
const store = () => read('../src/store/unified-snapshot-store.ts');
const chart = () => read('../src/chart/EnhancedChart_110_Percent.tsx');

describe('Store: premiumDiscount + harmonicPatterns nos 4 lugares canônicos do domínio §3', () => {
  it('estado, ação, default e seletor — os 4, para os 2 campos', () => {
    const s = store();
    expect(s).toContain('premiumDiscount: PremiumDiscountReading | null;');
    expect(s).toContain('harmonicPatterns: HarmonicPatternHit[];');
    expect(s).toContain('setPremiumDiscount: (reading: PremiumDiscountReading | null) => void;');
    expect(s).toContain('setHarmonicPatterns: (hits: HarmonicPatternHit[]) => void;');
    expect(s).toContain('premiumDiscount: null,');
    expect(s).toContain('harmonicPatterns: [],');
    expect(s).toContain('export const usePremiumDiscountSnapshot = (): PremiumDiscountReading | null =>');
    expect(s).toContain('export const useHarmonicPatternsSnapshot = (): HarmonicPatternHit[] =>');
    // referência estável para a lista vazia — sem isto todo consumidor
    // re-renderizaria a cada render (mesma disciplina de EMPTY_TRAPS).
    expect(s).toContain('EMPTY_HARMONIC_HITS');
  });
});

describe('App: efeito único computa os 2 motores novos da MESMA série real do gráfico', () => {
  it('lê chartData, usa o último CLOSE real como referência do P/D (30s, nunca o tick de 1s), escreve as 2 fatias', () => {
    const a = app();
    const idx = a.indexOf('st.setPremiumDiscount(computePremiumDiscount({ candles: chartData, price: lastClose }));');
    expect(idx, 'efeito de cômputo §7/§8 não encontrado').toBeGreaterThan(-1);
    const block = a.slice(Math.max(0, idx - 700), idx + 300);
    expect(block).toContain('const lastClose = chartData[chartData.length - 1]?.close ?? null;');
    expect(block).toContain('st.setHarmonicPatterns(detectHarmonicPatterns({ candles: chartData }));');
    expect(block).toContain('}, [chartData]);');
  });

  it('fail-closed: sem candles => null/[] explícitos, nunca leitura velha retida', () => {
    const a = app();
    const idx = a.indexOf('st.setPremiumDiscount(null);');
    expect(idx).toBeGreaterThan(-1);
    expect(a.slice(idx, idx + 120)).toContain('st.setHarmonicPatterns([]);');
  });

  it('§10 Inteligência Temporal: trocar timeframe reseta a série do Score (nunca mistura regimes na tendência)', () => {
    expect(app()).toContain('useUnifiedSnapshotStore.getState().resetInstitutionalScoreHistory();\n  }, [chartTimeframe]);');
  });
});

describe('Header §1: TF + LIVE + latência + sessão — todas leituras REAIS já existentes', () => {
  it('chip do timeframe é display-only do chartTimeframe real (controle continua único, no gráfico)', () => {
    const a = app();
    const idx = a.indexOf('{marketMode === "CRYPTO" && chartTimeframe && (');
    expect(idx, 'chip de TF não encontrado').toBeGreaterThan(-1);
    expect(a.slice(idx, idx + 700)).toContain('{chartTimeframe}');
  });

  it('LIVE vem do wsLive REAL via voiceSnapshot (zero segunda fonte), latência do cycleLatencyMs real', () => {
    const a = app();
    expect(a).toContain('const wsLiveNow: boolean = voiceSnapshot?.wsLive === true;');
    expect(a).toContain('{wsLiveNow ? "LIVE" : "OFF"}');
    expect(a).toContain('typeof cycleLatencyMs === "number" && Number.isFinite(cycleLatencyMs) ? `${Math.round(cycleLatencyMs)}ms` : DASH');
  });

  it('sessão: derivação pura do relógio UTC real (market-session.ts), tooltip divulga a janela verificável', () => {
    const a = app();
    expect(a).toContain('import { marketSessionFromUtc } from "./nexus/market-session";');
    expect(a).toContain('const marketSession = marketSessionFromUtc(new Date());');
    expect(a).toContain('{marketSession.label}');
    expect(a).toContain('${marketSession.windowUtc}');
  });
});

describe('§7 Premium/Discount: gráfico + Trade Plan strip (display-only, LEI 24)', () => {
  it('EnhancedChart: prop fail-closed + 3 linhas fio-de-seda (1px sólida, sem rótulo de eixo)', () => {
    const c = chart();
    expect(c).toContain('premiumDiscount?: PremiumDiscountReading | null;');
    const idx = c.indexOf('premiumDiscountLinesRef.current.forEach((line) => series.removePriceLine(line));');
    expect(idx).toBeGreaterThan(-1);
    const block = c.slice(idx, idx + 900);
    expect(block).toContain('if (!premiumDiscount) return;');
    expect(block).toContain('lineWidth: 1,');
    expect(block).toContain('lineStyle: LineStyle.Solid,');
    expect(block).toContain('axisLabelVisible: false,');
    expect(block).toContain('"Premium · topo do range"');
    expect(block).toContain('"Equilibrium · 50%"');
    expect(block).toContain('"Discount · fundo do range"');
    // ref limpa no unmount, mesma disciplina das outras
    const cleanupIdx = c.indexOf('chart.remove();');
    expect(c.slice(cleanupIdx, cleanupIdx + 600)).toContain('premiumDiscountLinesRef.current = [];');
  });

  it('ChartWidget passa a MESMA fatia da store ao gráfico (zero segunda leitura)', () => {
    const a = app();
    expect(a).toContain('const chartPremiumDiscount = usePremiumDiscountSnapshot();');
    expect(a).toContain('premiumDiscount={chartPremiumDiscount ?? null}');
  });

  it('TradePlanTopStrip: badge "Zona" qualifica a ENTRADA do plano — nunca escreve/bloqueia o plano', () => {
    const a = app();
    const stripStart = a.indexOf('function TradePlanTopStrip(');
    const strip = a.slice(stripStart, a.indexOf('// --- TOP BAR ---'));
    expect(strip).toContain('const premiumDiscount = usePremiumDiscountSnapshot();');
    expect(strip).toContain('const entryMid = (plan.entry.low + plan.entry.high) / 2;');
    expect(strip).toContain('const favored = (long && entryZone === "DISCOUNT") || (!long && entryZone === "PREMIUM");');
    expect(strip).not.toMatch(/setTradePlan|setPremiumDiscount/);
  });
});

describe('§8 Harmônicos: display gated pelo fit mínimo honesto', () => {
  it('aba ANALYSIS lista os hits reais da store; título nega probabilidade; vazio honesto mostra o piso', () => {
    const a = app();
    expect(a).toContain('const harmonicHits = useHarmonicPatternsSnapshot();');
    expect(a).toContain('title="Harmonic Patterns · ratio fit, never probability"');
    expect(a).toContain('NO FRESH XABCD PATTERN ≥ {(MIN_FIT_SCORE * 100).toFixed(0)}% RATIO FIT (honest result)');
    expect(a).toContain('value={`D @ ${h.points.D.price.toFixed(0)} · fit ${(h.fitScore * 100).toFixed(0)}%`}');
  });

  it('LEI 24: o motor harmônico nunca alimenta engine/tradePlan — só a própria fatia de display', () => {
    const a = app();
    // detectHarmonicPatterns só aparece no import e no efeito de escrita da própria fatia
    const uses = a.split('detectHarmonicPatterns').length - 1;
    expect(uses).toBe(2); // 1 import + 1 chamada no efeito
    const harmonic = read('../src/nexus/harmonic-patterns.ts');
    expect(harmonic).not.toMatch(/setTradePlan|setCouncil|fetch\(|Math\.random/);
  });
});
