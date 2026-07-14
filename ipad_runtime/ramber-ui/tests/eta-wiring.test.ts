// eta-wiring.test.ts — Diretriz Complementar (Nexus Predictive Engine)
// §3/§7: fiação real da ETA dinâmica. A matemática pura já tem execução
// real em eta-engine.test.ts — aqui trancam-se os pontos de conexão
// (mesma convenção mista de sempre).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');

describe('App.tsx: etaReading computada UMA vez (padrão currentRsi/convictionReading), compartilhada via contextValue', () => {
  it('importa o motor puro real', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('import { computeTargetEtas, formatEtaDuration } from "./nexus/eta-engine";');
  });

  it('consome o plano/ratchet AUTORITATIVOS do track record + ATR real + closes reais + timeframe real — nunca segunda fonte', () => {
    const app = read('../src/App.tsx');
    const m = app.match(/const etaReading = useMemo\(([\s\S]*?)\);/);
    expect(m, 'etaReading não encontrado').not.toBeNull();
    expect(m![1]).toContain('plan: trackRecordSlice.active?.plan ?? null,');
    expect(m![1]).toContain('targetsHit: trackRecordSlice.active?.targetsHit ?? 0,');
    expect(m![1]).toContain('atrPercent: engine?.marketRegime?.atrPercent ?? null,');
    expect(m![1]).toContain('closes: chartData.map(');
    expect(m![1]).toContain('timeframeMs: TIMEFRAME_MS[chartTimeframe as string] ?? TIMEFRAME_MS["15m"],');
  });

  it('recomputa continuamente: deps incluem chartData (novas velas) e o preço real (novos ticks) — "nunca são fixas" (§3)', () => {
    const app = read('../src/App.tsx');
    const m = app.match(/const etaReading = useMemo\(([\s\S]*?)\);/);
    expect(m![1]).toContain('[trackRecordSlice.active, livePriceForZone, engine?.marketRegime, chartData, chartTimeframe]');
  });

  it('TDZ real: etaReading declarada DEPOIS de trackRecordSlice/livePriceForZone e ANTES de contextValue', () => {
    const app = read('../src/App.tsx');
    const trackIdx = app.indexOf('const trackRecordSlice = useTrackRecordSnapshot();');
    const zoneIdx = app.indexOf('const livePriceForZone =');
    const etaIdx = app.indexOf('const etaReading = useMemo(');
    const contextIdx = app.indexOf('const contextValue = useMemo(');
    expect(trackIdx).toBeGreaterThan(-1);
    expect(trackIdx).toBeLessThan(etaIdx);
    expect(zoneIdx).toBeLessThan(etaIdx);
    expect(etaIdx).toBeLessThan(contextIdx);
  });

  it('contextValue expõe etaReading (objeto e deps)', () => {
    const app = read('../src/App.tsx');
    const memoMatch = app.match(/const contextValue = useMemo\(\s*\(\) => \(\{([\s\S]*?)\}\),/);
    expect(memoMatch).not.toBeNull();
    expect(memoMatch![1]).toContain('etaReading,');
  });
});

describe('TradePlanTopStrip + painel Trade Plan: exibição honesta da ETA (§3/§7/§8)', () => {
  it('a barra mostra a ETA do alvo ATIVO da leitura única do contexto — nunca recalcula', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('const activeEta = etaReading?.status === "OK" ? (etaReading.etas[activeTargetIndex] ?? null) : null;');
    expect(app).toContain('const etaLabel = activeEta && !targetHit ? formatEtaDuration(activeEta.ms) : null;');
  });

  it('ETA ausente (sem progresso direcional/ATR/horizonte) => campo simplesmente não renderiza — nunca um número fabricado', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('{etaLabel && (');
  });

  it('tooltip carrega a base real verificável + o aviso §8 ("nunca afirma que o mercado \\"vai\\" atingir")', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('nunca afirma que o mercado "vai" atingir o alvo (§8)');
  });

  it('painel Trade Plan (ANALYSIS) anexa a ETA real por alvo restante da mesma leitura única', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('etaReading?.status === "OK" && etaReading.etas[i] ? ` · ${formatEtaDuration(etaReading.etas[i].ms) ?? ""}` : ""');
  });
});

describe('LEI 24 + Regras de Ouro: eta-engine.ts é puro e honesto', () => {
  it('zero escrita de volta, zero rede, zero Math.random', () => {
    const src = read('../src/nexus/eta-engine.ts');
    expect(src).not.toContain('setTradePlan(');
    expect(src).not.toContain('useUnifiedSnapshotStore');
    expect(src).not.toContain('fetch(');
    expect(src).not.toMatch(/Math\.random/);
  });

  it('a palavra "probabilidade" não aparece — ETA é estimativa de tempo, nunca chance de acerto (Regra de Ouro 2)', () => {
    const src = read('../src/nexus/eta-engine.ts');
    expect(src.toLowerCase()).not.toContain('probabilidade de acerto');
  });
});
