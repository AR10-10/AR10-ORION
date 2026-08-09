// organism-health.test.ts — ADITIVO V-MAX Etapa 19: execução real da
// redução "pior sinal real vence" (mesma disciplina de teste que
// chart-integrity.test.ts — motor puro isolado, sem ligação com App.tsx).
import { describe, it, expect } from 'vitest';
import { computeOrganismHealth, type OrganismHealthInput } from '../src/nexus/organism-health';

const ALL_OK: OrganismHealthInput = {
  offline: false,
  workersAlive: 1,
  busQuality: 'OK',
  sufficiencyQuality: 'OK',
  gmilQuality: 'OK',
  chartIntegrityQuality: 'OK',
  fpsClass: 'FLUIDO',
  cycleClass: 'RAPIDO',
};

describe('computeOrganismHealth — veredito agregado (Organism Health, sempre visível)', () => {
  it('todos os sinais reais OK => veredito OK', () => {
    const reading = computeOrganismHealth(ALL_OK);
    expect(reading.verdict).toBe('OK');
  });

  it('offline=true domina qualquer outro sinal => CRITICAL, aponta Conectividade', () => {
    const reading = computeOrganismHealth({ ...ALL_OK, offline: true });
    expect(reading.verdict).toBe('CRITICAL');
    expect(reading.worstSignal).toBe('Conectividade');
  });

  it('workersAlive===0 => CRITICAL, aponta Worker WASM (mesma severidade que self-diagnostics.ts)', () => {
    const reading = computeOrganismHealth({ ...ALL_OK, workersAlive: 0 });
    expect(reading.verdict).toBe('CRITICAL');
    expect(reading.worstSignal).toBe('Worker WASM');
  });

  it('1 sinal WARNING entre 7 OK => veredito geral WARN (nunca escondido)', () => {
    const reading = computeOrganismHealth({ ...ALL_OK, sufficiencyQuality: 'WARNING' });
    expect(reading.verdict).toBe('WARN');
    expect(reading.worstSignal).toBe('Suficiência de dados');
  });

  it('1 sinal FAIL entre 7 OK => veredito geral CRITICAL', () => {
    const reading = computeOrganismHealth({ ...ALL_OK, gmilQuality: 'FAIL' });
    expect(reading.verdict).toBe('CRITICAL');
    expect(reading.worstSignal).toBe('GMIL');
  });

  it('CRITICAL sempre vence WARN mesmo quando o WARN aparece primeiro na ordem interna', () => {
    const reading = computeOrganismHealth({
      ...ALL_OK,
      sufficiencyQuality: 'WARNING', // aparece antes de GMIL na lista interna
      gmilQuality: 'FAIL',
    });
    expect(reading.verdict).toBe('CRITICAL');
    expect(reading.worstSignal).toBe('GMIL');
  });

  it('todos os sinais reais ainda sem medição (boot) => AGUARDANDO, nunca falso-OK', () => {
    const reading = computeOrganismHealth({
      offline: false,
      workersAlive: 1,
      busQuality: 'DADOS_INSUFICIENTES',
      sufficiencyQuality: 'DADOS_INSUFICIENTES',
      gmilQuality: 'DADOS_INSUFICIENTES',
      chartIntegrityQuality: 'DADOS_INSUFICIENTES',
      fpsClass: null,
      cycleClass: null,
    });
    expect(reading.verdict).toBe('AGUARDANDO');
  });

  it('1 sinal AGUARDANDO entre 7 OK => veredito geral AGUARDANDO (nunca mascarado como OK)', () => {
    const reading = computeOrganismHealth({ ...ALL_OK, chartIntegrityQuality: 'DADOS_INSUFICIENTES' });
    expect(reading.verdict).toBe('AGUARDANDO');
    expect(reading.worstSignal).toBe('Integridade do gráfico');
  });

  it('WARN real sempre vence AGUARDANDO (confirmado > ainda não medido)', () => {
    const reading = computeOrganismHealth({
      ...ALL_OK,
      chartIntegrityQuality: 'DADOS_INSUFICIENTES',
      busQuality: 'WARNING',
    });
    expect(reading.verdict).toBe('WARN');
    expect(reading.worstSignal).toBe('Qualidade da fonte');
  });

  it('fpsClass ACEITAVEL => WARN; CRITICO => CRITICAL; null => AGUARDANDO', () => {
    expect(computeOrganismHealth({ ...ALL_OK, fpsClass: 'ACEITAVEL' }).verdict).toBe('WARN');
    expect(computeOrganismHealth({ ...ALL_OK, fpsClass: 'CRITICO' }).verdict).toBe('CRITICAL');
    expect(computeOrganismHealth({ ...ALL_OK, fpsClass: null }).verdict).toBe('AGUARDANDO');
  });

  it('cycleClass OK conta como saudável (só LENTO é degradado); null => AGUARDANDO', () => {
    expect(computeOrganismHealth({ ...ALL_OK, cycleClass: 'OK' }).verdict).toBe('OK');
    expect(computeOrganismHealth({ ...ALL_OK, cycleClass: 'LENTO' }).verdict).toBe('WARN');
    expect(computeOrganismHealth({ ...ALL_OK, cycleClass: null }).verdict).toBe('AGUARDANDO');
  });

  it('determinístico: mesma entrada sempre produz o mesmo veredito (zero Math.random/Date.now no cálculo)', () => {
    const a = computeOrganismHealth(ALL_OK);
    const b = computeOrganismHealth(ALL_OK);
    expect(a).toEqual(b);
  });
});
