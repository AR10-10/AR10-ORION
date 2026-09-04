// market-structure-swing-wiring.test.ts — Evolução Total (fix documentado
// na Ordem Nº 03 §3, executado sob a autorização "não deixa nada
// pendente"): trava a cadeia real dos 2 swings fractais do Core Engine
// até o consolidador de Zonas Institucionais:
//   analysis-frame.js (last_swing_high/low no frame)
//   → engine-bridge.ts (lastSwingHigh/Low no RealCycleResult)
//   → App.tsx (props do chart)
//   → EnhancedChart_110_Percent.tsx (institutionalZoneInput)
//   → institutional-zones.ts (11ª fonte, MARKET_STRUCTURE_SWING).
// A matemática tem execução real em core-decision-rules.test.ts (frame ↔
// motor) e nexus-institutional-zones.test.ts (11ª fonte no clustering);
// aqui trancam-se só os pontos de conexão (convenção mista de sempre).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');

describe('analysis-frame.js: os 2 swings saem no frame (aditivo, fail-closed) — nunca mais descartados', () => {
  it('frame OK: ternário fail-closed idêntico ao de market_structure na mesma função', () => {
    const s = read('../../js/real-data/analysis-frame.js');
    expect(s).toContain("const lastSwingHigh = structureResult.status === 'OK' ? structureResult.last_swing_high : DADOS_INSUFICIENTES;");
    expect(s).toContain("const lastSwingLow = structureResult.status === 'OK' ? structureResult.last_swing_low : DADOS_INSUFICIENTES;");
    expect(s).toContain('last_swing_high: lastSwingHigh,');
    expect(s).toContain('last_swing_low: lastSwingLow,');
  });

  it('emptyFrame mantém a forma completa: os 2 campos novos também existem no frame vazio (DADOS_INSUFICIENTES)', () => {
    const s = read('../../js/real-data/analysis-frame.js');
    expect(s).toContain('last_swing_high: DADOS_INSUFICIENTES,');
    expect(s).toContain('last_swing_low: DADOS_INSUFICIENTES,');
  });
});

describe('engine-bridge.ts: passthrough puro do frame para RealCycleResult (zero cálculo novo)', () => {
  it('interface declara os 2 campos novos', () => {
    const s = read('../src/engine-bridge.ts');
    expect(s).toContain('lastSwingHigh?: number | null;');
    expect(s).toContain('lastSwingLow?: number | null;');
  });

  it('retorno usa o MESMO guard isNum já usado por support/resistance na mesma função', () => {
    const s = read('../src/engine-bridge.ts');
    expect(s).toContain('lastSwingHigh: isNum(frame.last_swing_high) ? frame.last_swing_high : null,');
    expect(s).toContain('lastSwingLow: isNum(frame.last_swing_low) ? frame.last_swing_low : null,');
  });
});

describe('App.tsx → EnhancedChart: props reais threaded até o consolidador', () => {
  it('ChartWidget passa engine?.lastSwingHigh/Low (mesmo padrão de engine?.support)', () => {
    const s = read('../src/App.tsx');
    expect(s).toContain('lastSwingHigh={engine?.lastSwingHigh ?? null}');
    expect(s).toContain('lastSwingLow={engine?.lastSwingLow ?? null}');
  });

  it('EnhancedChart declara as props e alimenta institutionalZoneInput (com deps atualizadas)', () => {
    const s = read('../src/chart/EnhancedChart_110_Percent.tsx');
    expect(s).toContain('lastSwingHigh?: number | null;');
    expect(s).toContain('lastSwingLow?: number | null;');
    expect(s).toContain('lastSwingHigh: lastSwingHigh ?? null,');
    expect(s).toContain('lastSwingLow: lastSwingLow ?? null,');
    // Assertiva POR DEPENDÊNCIA, não pela linha literal inteira: o array
    // cresce a cada fonte nova que passa a alimentar o consolidador
    // (SuperTrend e Breaker/Mitigation entraram nesta rodada), e travar a
    // string completa transformava toda adição aditiva em vermelho sem
    // nenhum fio realmente rompido. O que importa continua travado — o
    // swing REALMENTE está no dep array, e uma dep esquecida ali é
    // exatamente o bug "a zona não recomputa quando o swing muda".
    const deps =
      s.match(/const institutionalZoneInput = useMemo<InstitutionalZoneInput>\([\s\S]*?\n {4}\[([^\]]*)\],/)?.[1] ?? '';
    expect(deps, 'dep array de institutionalZoneInput não encontrado').not.toBe('');
    for (const dep of [
      'emaLastValue',
      'activeEmaPeriod',
      'vwapLastValue',
      'nlLastValue',
      'fairValueGaps',
      'orderBlocks',
      'liquidityZones',
      'support',
      'resistance',
      'volumeProfile',
      'freshestSessionKeyLevel',
      'institutionalZoneSweeps',
      'lastSwingHigh',
      'lastSwingLow',
    ]) {
      expect(deps, `${dep} fora do dep array de institutionalZoneInput`).toContain(dep);
    }
  });
});

describe('institutional-zones.ts: 11ª fonte real — MARKET_STRUCTURE_SWING', () => {
  it('sourceKind novo no union + 2 membros pontuais fail-closed (fin() como toda outra fonte)', () => {
    const s = read('../src/nexus/institutional-zones.ts');
    expect(s).toContain('| "MARKET_STRUCTURE_SWING";');
    expect(s).toContain('lastSwingHigh: number | null;');
    expect(s).toContain('lastSwingLow: number | null;');
    expect(s).toContain('if (fin(input.lastSwingHigh)) {');
    expect(s).toContain('members.push({ sourceKind: "MARKET_STRUCTURE_SWING", label: "Swing H", price: input.lastSwingHigh, top: input.lastSwingHigh, bottom: input.lastSwingHigh });');
    expect(s).toContain('if (fin(input.lastSwingLow)) {');
    expect(s).toContain('members.push({ sourceKind: "MARKET_STRUCTURE_SWING", label: "Swing L", price: input.lastSwingLow, top: input.lastSwingLow, bottom: input.lastSwingLow });');
  });

  it('nuance honesta documentada no código: swings e S/R vêm do MESMO fractal-swings.js (confluência marginal menor)', () => {
    const s = read('../src/nexus/institutional-zones.ts');
    expect(s).toContain('fractal-swings.js');
    expect(s).toContain('confluência marginal');
  });
});
