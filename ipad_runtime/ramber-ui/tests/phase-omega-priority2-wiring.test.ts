// phase-omega-priority2-wiring.test.ts — Phase Ω Priority 2 ("Probability
// Engine" no pedido original, entregue honestamente como Confluence/
// Conviction Engine): source-level wiring locks. A matemática pura já tem
// cobertura de execução real em confluence-engine.test.ts — este arquivo
// tranca só a fiação (import certo, hooks certos, nunca escreve de volta em
// engine.direction), mesma convenção já usada por ciborgue-vivo-wiring.test.ts.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');

describe('App.tsx: DecisionValidationWidget consome os 3 subsistemas reais já na store (zero fetch novo)', () => {
  it('importa buildConvictionReading de nexus/confluence-engine', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('import { buildConvictionReading } from "./nexus/confluence-engine";');
  });

  it('usa useCouncilSnapshot/useMultiTimeframeSnapshot/useTrustScoreSnapshot — os MESMOS hooks já usados pelos widgets irmãos', () => {
    const app = read('../src/App.tsx');
    const fnMatch = app.match(/function DecisionValidationWidget\(\) \{([\s\S]*?)\n\}\n/);
    expect(fnMatch, 'DecisionValidationWidget não encontrada').not.toBeNull();
    const body = fnMatch![1];
    expect(body).toContain('const councilForConviction = useCouncilSnapshot();');
    expect(body).toContain('const multiTimeframeForConviction = useMultiTimeframeSnapshot();');
    expect(body).toContain('const trustScoreForConviction = useTrustScoreSnapshot();');
  });

  it('convictionReading vem de buildConvictionReading com coreDirection = engine.direction real (nunca um valor fabricado)', () => {
    const app = read('../src/App.tsx');
    const fnMatch = app.match(/function DecisionValidationWidget\(\) \{([\s\S]*?)\n\}\n/);
    const body = fnMatch![1];
    expect(body).toContain('coreDirection: engine?.direction ?? null,');
    expect(body).toContain('council: councilForConviction ?? null,');
    expect(body).toContain('multiTimeframe: multiTimeframeForConviction ?? null,');
    expect(body).toContain('trustScore: trustScoreForConviction?.score ?? null,');
  });

  it('LEI 24: nenhuma escrita de volta em engine.direction/engine.confidence a partir da leitura de convicção', () => {
    const app = read('../src/App.tsx');
    const fnMatch = app.match(/function DecisionValidationWidget\(\) \{([\s\S]*?)\n\}\n/);
    const body = fnMatch![1];
    expect(body).not.toMatch(/engine\.direction\s*=(?!=)/);
    expect(body).not.toContain('setEngine(');
  });

  it('a linha "CONFLUÊNCIA CRUZADA" está montada no JSX, com tooltip explicando que não é probabilidade', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('CONFLUÊNCIA CRUZADA · 3 SUBSISTEMAS');
    expect(app).toContain('Nunca probabilidade de acerto de mercado.');
  });
});

describe('nexus/confluence-engine.ts: reaplica o pool linear real, zero segunda matemática de consenso', () => {
  it('importa buildEnsembleConsensus/opinionFromVote do MESMO módulo consensus já usado por council.ts e multi-timeframe-engine.ts', () => {
    const engineSrc = read('../src/nexus/confluence-engine.ts');
    expect(engineSrc).toContain("import { buildEnsembleConsensus, opinionFromVote } from '../../../src/consensus/index.js';");
    // Nenhuma segunda fórmula de "força"/"conviction" reinventada aqui —
    // o valor final vem sempre de pool.forca / pool.forca_ajustada.
    expect(engineSrc).toContain('conviction: pool.forca as number,');
    expect(engineSrc).toContain('convictionAdjusted: pool.forca_ajustada as number | null,');
  });

  it('Multi-Timeframe entra como 1 voto (fração real dos prazos), nunca 6 votos separados no pool', () => {
    const engineSrc = read('../src/nexus/confluence-engine.ts');
    // O array de membros do pool é montado a partir de `readable` (só os 3
    // subsistemas de topo) — nunca itera MULTI_TIMEFRAME_LIST dentro do pool.
    const fnMatch = engineSrc.match(/const pool = buildEnsembleConsensus\(\{([\s\S]*?)\}\) as any;/);
    expect(fnMatch, 'chamada a buildEnsembleConsensus não encontrada').not.toBeNull();
    expect(fnMatch![1]).toContain('members: readable.map(');
  });

  it('fail-closed: WAIT ou null vira DADOS_INSUFICIENTES antes de qualquer leitura de subsistema', () => {
    const engineSrc = read('../src/nexus/confluence-engine.ts');
    expect(engineSrc).toContain("if (coreDirection === null) {");
    expect(engineSrc).toContain("insufficient('core_engine_sem_direcao_ativa_no_momento_(WAIT)', null, [], computedAt);");
  });
});
