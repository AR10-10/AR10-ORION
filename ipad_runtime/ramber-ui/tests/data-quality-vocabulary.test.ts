// data-quality-vocabulary.test.ts — execução REAL do Data Quality Monitor
// unificado (ADITIVO V-MAX Etapa 10). O ponto central provado aqui: os 3
// mapeadores (Bus/GMIL/Suficiência) reduzem para o MESMO vocabulário de 4
// estados usando limiares matematicamente equivalentes ao corte real que o
// próprio Market Data Bus já usa — nunca um 4º cálculo inventado, nunca uma
// leitura que diverge do que cada motor de origem já decidiu.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  classifyBusQuality,
  classifyWeight,
  classifySufficiencyScore,
  DATA_QUALITY_COLOR,
  type DataQualityLabel,
} from '../src/nexus/data-quality-vocabulary';
import { classifyScore, QUALITY_CLASSIFICATION, QUARANTINE_THRESHOLD } from '../../src/market-data-bus/quality-engine.js';

describe('classifyBusQuality — comprime os 5 estados reais do Bus para o vocabulário universal', () => {
  it('mapeia cada classificação REAL (vocabulário fechado de quality-engine.js), nunca uma string solta', () => {
    expect(classifyBusQuality(QUALITY_CLASSIFICATION.EXCELENTE)).toBe('OK');
    expect(classifyBusQuality(QUALITY_CLASSIFICATION.SAUDAVEL)).toBe('OK');
    expect(classifyBusQuality(QUALITY_CLASSIFICATION.DEGRADADA)).toBe('WARNING');
    expect(classifyBusQuality(QUALITY_CLASSIFICATION.QUARENTENA)).toBe('FAIL');
    expect(classifyBusQuality(QUALITY_CLASSIFICATION.DADOS_INSUFICIENTES)).toBe('DADOS_INSUFICIENTES');
  });

  it('fail-closed: null/undefined/string desconhecida nunca viram OK por acidente', () => {
    expect(classifyBusQuality(null)).toBe('DADOS_INSUFICIENTES');
    expect(classifyBusQuality(undefined)).toBe('DADOS_INSUFICIENTES');
    expect(classifyBusQuality('')).toBe('DADOS_INSUFICIENTES');
    expect(classifyBusQuality('lixo_desconhecido')).toBe('DADOS_INSUFICIENTES');
  });
});

describe('classifyWeight — genérico 0-1, limiares espelham EXATAMENTE o corte real do Bus (consistência matemática)', () => {
  it('limiar documentado (0.25) bate byte a byte com QUARANTINE_THRESHOLD real do Bus', () => {
    expect(QUARANTINE_THRESHOLD).toBe(0.25);
  });

  it('para qualquer score na mesma escala 0-1, a compressão para 4 estados NUNCA diverge do classifyScore() real do Bus', () => {
    const samples = [0, 0.1, 0.24, 0.249, 0.25, 0.3, 0.5, 0.59, 0.599, 0.6, 0.61, 0.7, 0.84, 0.85, 0.9, 1];
    for (const score of samples) {
      const busLabel = classifyScore(score);
      const universal = classifyWeight(score);
      const busIsOk = busLabel === QUALITY_CLASSIFICATION.EXCELENTE || busLabel === QUALITY_CLASSIFICATION.SAUDAVEL;
      const busIsWarning = busLabel === QUALITY_CLASSIFICATION.DEGRADADA;
      const busIsFail = busLabel === QUALITY_CLASSIFICATION.QUARENTENA;
      if (busIsOk) expect(universal, `score=${score}`).toBe('OK');
      else if (busIsWarning) expect(universal, `score=${score}`).toBe('WARNING');
      else if (busIsFail) expect(universal, `score=${score}`).toBe('FAIL');
    }
  });

  it('fronteiras exatas: >=0.6 é OK, [0.25, 0.6) é WARNING, <0.25 é FAIL', () => {
    expect(classifyWeight(0.6)).toBe('OK');
    expect(classifyWeight(0.599999)).toBe('WARNING');
    expect(classifyWeight(0.25)).toBe('WARNING');
    expect(classifyWeight(0.249999)).toBe('FAIL');
    expect(classifyWeight(0)).toBe('FAIL');
  });

  it('fail-closed: null/undefined/NaN/Infinity nunca viram um julgamento de qualidade — DADOS_INSUFICIENTES honesto', () => {
    expect(classifyWeight(null)).toBe('DADOS_INSUFICIENTES');
    expect(classifyWeight(undefined)).toBe('DADOS_INSUFICIENTES');
    expect(classifyWeight(Number.NaN)).toBe('DADOS_INSUFICIENTES');
    expect(classifyWeight(Number.POSITIVE_INFINITY)).toBe('DADOS_INSUFICIENTES');
  });
});

describe('classifySufficiencyScore — 0-100 (ou teto customizado) normalizado para o MESMO limiar', () => {
  it('teto default 100: espelha os mesmos pontos de corte de classifyWeight, só em outra escala', () => {
    expect(classifySufficiencyScore(100)).toBe('OK');
    expect(classifySufficiencyScore(60)).toBe('OK');
    expect(classifySufficiencyScore(59)).toBe('WARNING');
    expect(classifySufficiencyScore(25)).toBe('WARNING');
    expect(classifySufficiencyScore(24)).toBe('FAIL');
    expect(classifySufficiencyScore(0)).toBe('FAIL');
  });

  it('teto customizado é honrado (nunca hardcoded 100 na comparação) — computeDataSufficiency sempre devolve seu próprio max_score', () => {
    expect(classifySufficiencyScore(30, 50)).toBe('OK'); // 30/50 = 0.6
    expect(classifySufficiencyScore(15, 50)).toBe('WARNING'); // 15/50 = 0.3
    expect(classifySufficiencyScore(12.5, 50)).toBe('WARNING'); // 12.5/50 = 0.25 exato (fronteira)
    expect(classifySufficiencyScore(12, 50)).toBe('FAIL'); // 12/50 = 0.24, abaixo da fronteira
  });

  it('fail-closed: score null/undefined/NaN OU maxScore inválido (<=0/NaN) nunca vira um julgamento', () => {
    expect(classifySufficiencyScore(null)).toBe('DADOS_INSUFICIENTES');
    expect(classifySufficiencyScore(undefined)).toBe('DADOS_INSUFICIENTES');
    expect(classifySufficiencyScore(Number.NaN)).toBe('DADOS_INSUFICIENTES');
    expect(classifySufficiencyScore(50, 0)).toBe('DADOS_INSUFICIENTES');
    expect(classifySufficiencyScore(50, -10)).toBe('DADOS_INSUFICIENTES');
    expect(classifySufficiencyScore(50, Number.NaN)).toBe('DADOS_INSUFICIENTES');
  });
});

describe('DATA_QUALITY_COLOR — paleta única, mesma cor por rótulo em todo consumidor', () => {
  it('cobre exatamente os 4 estados do vocabulário, nenhum a mais nem a menos', () => {
    const labels: DataQualityLabel[] = ['OK', 'WARNING', 'FAIL', 'DADOS_INSUFICIENTES'];
    expect(Object.keys(DATA_QUALITY_COLOR).sort()).toEqual([...labels].sort());
  });

  it('as cores são EXATAMENTE as que TelemetryHealthWidget já usava ad-hoc antes desta unificação (zero regressão visual)', () => {
    expect(DATA_QUALITY_COLOR.OK).toBe('text-[#00ffaa]');
    expect(DATA_QUALITY_COLOR.WARNING).toBe('text-[#f0d06f]');
    expect(DATA_QUALITY_COLOR.FAIL).toBe('text-[#ff0055]');
    expect(DATA_QUALITY_COLOR.DADOS_INSUFICIENTES).toBe('text-[#8ab4f8]/50');
  });
});

describe('LEI 24 / Regra de Ouro 4 no nível do fonte: camada de leitura pura, nunca uma 4ª fonte de verdade', () => {
  it('módulo folha sem NENHUM import — zero rede, zero store, zero acoplamento aos 3 motores de origem (Bus/GMIL/Research)', () => {
    const src = readFileSync(require.resolve('../src/nexus/data-quality-vocabulary.ts'), 'utf8');
    expect(src).not.toContain('import');
    expect(src).not.toMatch(/fetch\(|useUnifiedSnapshotStore|Math\.random/);
  });
});
