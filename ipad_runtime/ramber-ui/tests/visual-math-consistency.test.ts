// visual-math-consistency.test.ts — Diretriz do Operador ("evolução no
// sistema visual + matemática, tudo sincronizado"): fiação/padrão real
// para os achados de um agente de exploração dedicado (visual/presentation
// consistency + math/quant integrity), cada um confirmado por leitura
// direta do código antes de qualquer correção. App.tsx não exporta estas
// funções individualmente (arquivo de entrada monolítico) — mesma
// convenção de padrão-de-código já usada nos outros testes de fiação
// deste arquivo.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');

describe('A2: formatConsensusScore nunca produz "-0" — arredonda antes de decidir o sinal', () => {
  it('a implementação real arredonda primeiro (Math.round) e decide o sinal do valor já arredondado', () => {
    const app = read('../src/App.tsx');
    const m = app.match(/function formatConsensusScore\(score: number \| null\): string \{([\s\S]*?)\n\}/);
    expect(m, 'formatConsensusScore não encontrada').not.toBeNull();
    expect(m![1]).toContain('const rounded = Math.round(score * 100);');
    expect(m![1]).toContain('return rounded > 0 ? `+${rounded}` : `${rounded}`;');
    // a fórmula antiga decidia o sinal ANTES de arredondar — nunca mais.
    expect(m![1]).not.toContain('score >= 0 ? "+" : ""');
  });

  it('execução real: -0.001 (que produzia "-0" com .toFixed) agora vira "0" honesto', () => {
    // Mesma lógica exata da implementação real acima — reproduzida aqui só
    // para provar a matemática (nenhuma segunda fonte de verdade: o teste
    // de padrão acima já trava que App.tsx usa ESTA fórmula, não outra).
    const format = (score: number | null): string => {
      if (score === null) return 'AWAITING';
      const rounded = Math.round(score * 100);
      return rounded > 0 ? `+${rounded}` : `${rounded}`;
    };
    expect(format(-0.001)).toBe('0');
    expect(format(0)).toBe('0');
    expect(format(0.42)).toBe('+42');
    expect(format(-0.17)).toBe('-17');
    expect(format(null)).toBe('AWAITING');
  });
});

describe('B1: gauge de RSI reusa RSI_OVERBOUGHT/RSI_OVERSOLD reais do Conselho — zero limiar duplicado', () => {
  it('council.ts exporta os limiares reais (antes eram const locais, nunca importáveis)', () => {
    const council = read('../src/nexus/council.ts');
    expect(council).toContain('export const RSI_OVERBOUGHT = 70;');
    expect(council).toContain('export const RSI_OVERSOLD = 30;');
  });

  it('App.tsx importa e usa os MESMOS limiares no gauge — nunca mais 70/30 soltos', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('import { buildCouncilDecision, RSI_OVERBOUGHT, RSI_OVERSOLD, type CouncilDecision } from "./nexus/council";');
    expect(app).toContain('currentRsi >= RSI_OVERBOUGHT');
    expect(app).toContain('currentRsi <= RSI_OVERSOLD');
  });
});

describe('A1: CouncilWidget usa DASH consistentemente para percentuais nulos (agreementLabel + cpiLabel)', () => {
  it('agreementLabel e o cpiLabel local do widget usam a MESMA constante DASH — nunca AWAIT nem literal solto', () => {
    const app = read('../src/App.tsx');
    const idx = app.indexOf('function CouncilWidget()');
    const nextWidgetIdx = app.indexOf('function MultiTimeframeMatrixWidget()');
    const widgetSrc = app.slice(idx, nextWidgetIdx);
    expect(widgetSrc).toContain(': DASH;');
    expect(widgetSrc).toContain('const cpiLabel = cpi === null ? DASH : ');
    // achado real de auditoria: cpiLabel usava AWAIT aqui, divergindo do
    // agreementLabel vizinho e da outra leitura real do mesmo CPI alhures.
    expect(widgetSrc).not.toContain('const cpiLabel = cpi === null ? AWAIT');
  });

  it('NucleoVoiceOrb (outra leitura real do MESMO CPI) também usa DASH, não um literal separado', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('const cpiLabel = cpi === null ? DASH : `${Math.round(cpi * 100)}%`;');
  });
});

describe('A3: Hit Rate calcula hitRate(trackRecord) uma única vez, não 4x na mesma expressão', () => {
  it('IIFE real hoisting currentHitRate — mesmo padrão já documentado em lorentzianConfidencePct', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('const currentHitRate = hitRate(trackRecord);');
    expect(app).not.toContain('hitRate(trackRecord) !== null ? pct(hitRate(trackRecord))');
  });
});

describe('A4/B3: código morto real removido (confirmado por zero uso antes da remoção)', () => {
  it('TopStat (componente sem nenhum caller) não existe mais em App.tsx', () => {
    const app = read('../src/App.tsx');
    expect(app).not.toContain('TopStatProps');
    expect(app).not.toMatch(/const TopStat = React\.memo/);
  });

  it('import morto de StructureBreak (type nunca usado) removido do import de engine-bridge', () => {
    const app = read('../src/App.tsx');
    expect(app).not.toContain('type StructureBreak');
  });
});

describe('B2: conviction-cyclone-draw.ts nomeia os 2 parâmetros de velocidade axial (zero literal solto)', () => {
  it('SPEED_ALONG_AXIS_BASE/CONVICTION_SCALE nomeados e com os MESMOS valores reais de antes', () => {
    const src = read('../src/nexus/conviction-cyclone-draw.ts');
    expect(src).toContain('const SPEED_ALONG_AXIS_BASE = 0.00012;');
    expect(src).toContain('const SPEED_ALONG_AXIS_CONVICTION_SCALE = 0.00028;');
    expect(src).toContain('const speedAlongAxis = SPEED_ALONG_AXIS_BASE + conviction * SPEED_ALONG_AXIS_CONVICTION_SCALE;');
    expect(src).not.toContain('0.00012 + conviction * 0.00028');
  });
});

// ORDEM DE AUDITORIA FINAL §3/§4 (achado real): MarketRegimeWidget
// recomputava seu PRÓPRIO proxy de volatilidade (média ingênua de
// (high-low)/close, sem gaps) na mesma hora em que regime-engine.js já
// calcula o ATR% real (true range com gaps, período de Wilder) e repassa
// via engine.marketRegime.atrPercent — o MESMO campo que eta-engine.ts,
// aura-lifecycle.ts e o tooltip do Multi-Timeframe Matrix (para os outros
// 5 prazos) já usam como fonte única. Duas fórmulas para a mesma grandeza
// no mesmo timeframe é o tipo exato de "cálculo redundante" que a
// auditoria de dados pede para eliminar — corrigido para ler a única
// fonte real (Single Source of Truth).
describe('ORDEM §3/§4: VOLATILIDADE (MarketRegimeWidget) lê o ATR% real do Market Regime Engine — zero proxy paralelo', () => {
  it('engine.volatilityPct (proxy ingênuo duplicado) não existe mais em App.tsx', () => {
    const app = read('../src/App.tsx');
    expect(app).not.toContain('volatilityPct');
  });

  it('a row VOLATILIDADE lê engine.marketRegime.atrPercent (mesma fonte real do resto do app)', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('const volPct = num(engine?.marketRegime?.atrPercent) ? engine.marketRegime.atrPercent : null;');
    expect(app).toContain('<Row label="VOLATILIDADE (ATR%)" value={volLabel} valueClass={volColor} />');
  });

  it('o checklist de fontes (Síntese Operacional) confere a mesma fonte real, não o proxy removido', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('{ label: "Volatilidade (ATR%)", available: num(engine?.marketRegime?.atrPercent) },');
  });
});
