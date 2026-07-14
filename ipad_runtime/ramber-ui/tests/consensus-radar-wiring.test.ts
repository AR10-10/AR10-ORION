// consensus-radar-wiring.test.ts — Diretriz Complementar (Evolução da
// Inteligência Operacional §8, "Radar de Consenso"): fiação real na store
// + App.tsx + CouncilWidget. A lógica pura já tem execução real em
// consensus-radar.test.ts — aqui trancam-se os pontos de conexão (mesma
// convenção mista de sempre).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');

describe('unified-snapshot-store.ts: consensusRadar segue exatamente o padrão de council/scenario/trapSignals (§4 CÉREBRO)', () => {
  it('4 lugares reais: state interface, actions interface, defaults, seletor atômico', () => {
    const store = read('../src/store/unified-snapshot-store.ts');
    expect(store).toContain('import type { ConsensusRadarReading } from "../nexus/consensus-radar";');
    expect(store).toContain('consensusRadar: ConsensusRadarReading | null;');
    expect(store).toContain('setConsensusRadar: (reading: ConsensusRadarReading | null) => void;');
    expect(store).toContain('consensusRadar: null,');
    expect(store).toContain('setConsensusRadar: (reading) => set((s) => { s.consensusRadar = reading; }),');
    expect(store).toContain('export const useConsensusRadarSnapshot = (): ConsensusRadarReading | null =>');
    expect(store).toContain('useUnifiedSnapshotStore((s) => s.consensusRadar);');
  });

  it('vive no domínio §4 CÉREBRO, na mesma vizinhança de council/scenario/trapSignals', () => {
    const store = read('../src/store/unified-snapshot-store.ts');
    const cerebroIdx = store.indexOf('§4 CÉREBRO (camada de análise');
    const trapSignalsIdx = store.indexOf('trapSignals: TrapSignal[];');
    const radarIdx = store.indexOf('consensusRadar: ConsensusRadarReading | null;');
    const tradePlanIdx = store.indexOf('// Signal Precision order (phase 4) — actionable plan from REAL structure');
    expect(cerebroIdx).toBeGreaterThan(-1);
    expect(cerebroIdx).toBeLessThan(trapSignalsIdx);
    expect(trapSignalsIdx).toBeLessThan(radarIdx);
    expect(radarIdx).toBeLessThan(tradePlanIdx);
  });
});

describe('App.tsx: efeito real escreve consensusRadar na store — zero comunicação direta motor→motor', () => {
  it('importa a função pura real', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('import { computeConsensusRadar, type ConsensusRadarCategory } from "./nexus/consensus-radar";');
  });

  it('o efeito relê councilFromSnapshot da PRÓPRIA store (mesma disciplina do efeito de Cenários) e usa as 2 leituras locais reais (bandwidthPercentile, GMIL score)', () => {
    const app = read('../src/App.tsx');
    const m = app.match(/useUnifiedSnapshotStore\.getState\(\)\.setConsensusRadar\(\s*computeConsensusRadar\(\{([\s\S]*?)\}\),\s*\);/);
    expect(m, 'efeito setConsensusRadar(computeConsensusRadar(...)) não encontrado').not.toBeNull();
    expect(m![1]).toContain('council: councilFromSnapshot ?? null,');
    expect(m![1]).toContain('bandwidthPercentile: engine?.marketRegime?.bandwidthPercentile ?? null,');
    expect(m![1]).toContain('gmilScore: institutionalConsensus.score,');
  });

  it('deps reais do efeito: councilFromSnapshot, engine.marketRegime, institutionalConsensus', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('}, [councilFromSnapshot, engine?.marketRegime, institutionalConsensus]);');
  });

  it('honestidade: comentário documenta a omissão do "Risk Engine" e cita a Regra de Ouro 1', () => {
    const app = read('../src/App.tsx');
    const idx = app.indexOf('Diretriz Complementar §8 ("Radar de Consenso"): mesma disciplina do');
    expect(idx).toBeGreaterThan(-1);
    const block = app.slice(idx, idx + 1000);
    expect(block).toContain('Risk Engine');
    expect(block).toContain('Regra de Ouro 1');
  });
});

describe('CouncilWidget: Radar de Consenso renderizado a partir da própria store, nunca recomputado', () => {
  it('importa o seletor real e nunca chama computeConsensusRadar dentro do componente (LEI 24: exibição, não cálculo)', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('useConsensusRadarSnapshot, useTrustScoreSnapshot');
    const widgetIdx = app.indexOf('function CouncilWidget()');
    const nextWidgetIdx = app.indexOf('function MultiTimeframeMatrixWidget()');
    expect(widgetIdx).toBeGreaterThan(-1);
    expect(nextWidgetIdx).toBeGreaterThan(widgetIdx);
    const widgetSrc = app.slice(widgetIdx, nextWidgetIdx);
    expect(widgetSrc).toContain('const consensusRadar = useConsensusRadarSnapshot();');
    expect(widgetSrc).not.toContain('computeConsensusRadar(');
  });

  it('rótulos das 6 categorias reais + fallback honesto AWAIT quando a store ainda não tem leitura ou spoke.value é null', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('const CONSENSUS_RADAR_LABEL: Record<ConsensusRadarCategory, string> = {');
    expect(app).toContain('RADAR DE CONSENSO');
    expect(app).toContain('spoke.value !== null ? `${Math.round(spoke.value * 100)}%` : AWAIT');
    expect(app).toContain('<span className="text-[0.4rem] text-[#8ab4f8]/40 text-center py-1">{AWAIT}</span>');
  });

  it('barras estáticas (sem animação) — Clareza Visual + 60fps: só width muda, zero transition/keyframe novo', () => {
    const app = read('../src/App.tsx');
    const idx = app.indexOf('RADAR DE CONSENSO');
    expect(idx).toBeGreaterThan(-1);
    const block = app.slice(idx, idx + 2000);
    expect(block).not.toMatch(/animate-\[/);
    expect(block).not.toContain('transition');
  });
});

describe('LEI 24 + Regras de Ouro: a camada de exibição do Radar nunca fabrica nem escreve de volta', () => {
  it('CouncilWidget não importa Math.random nem escreve em nenhuma store (read-only)', () => {
    const app = read('../src/App.tsx');
    const widgetIdx = app.indexOf('function CouncilWidget()');
    const nextWidgetIdx = app.indexOf('function MultiTimeframeMatrixWidget()');
    const widgetSrc = app.slice(widgetIdx, nextWidgetIdx);
    expect(widgetSrc).not.toMatch(/Math\.random/);
    expect(widgetSrc).not.toContain('.setConsensusRadar(');
    expect(widgetSrc).not.toContain('.setCouncil(');
  });
});
