// ohlc-readout-wiring.test.ts — Ordem "Lapidação Visual Final" §7 (OHLC).
// Convenção mista já estabelecida neste repositório (CLAUDE.md): fiação
// entre módulos ganha teste de PADRÃO no código-fonte; o bug mais provável
// aqui não é "a matemática está errada" (não há matemática — são 4 leituras
// cruas), e sim "alguém depois deriva variação/percentual na UI" ou
// "alguém afrouxa o fail-closed e passa a desenhar traço no lugar do dado".
// São exatamente essas duas regressões que este arquivo trava.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const app = readFileSync(join(__dirname, '../src/App.tsx'), 'utf8');

function ohlcBlock(): string {
  const start = app.indexOf('function OhlcReadout(');
  expect(start).toBeGreaterThan(-1);
  const end = app.indexOf('function ChartWidget(', start);
  expect(end).toBeGreaterThan(start);
  return app.slice(start, end);
}

describe('OhlcReadout (§7): fonte única e zero cálculo derivado', () => {
  it('existe e é renderizado dentro do cabeçalho do próprio painel do gráfico', () => {
    expect(app).toContain('function OhlcReadout(');
    // Renderizado no extraHeader do Widget do gráfico, alimentado pelo
    // MESMO array que o gráfico desenha (prop chartData) — nunca por um
    // snapshot próprio.
    expect(app).toContain('<OhlcReadout candles={chartData} hoverCandle={hoveredCandle} />');
  });

  it('lê apenas os 4 campos crus do candle exibido — nunca deriva variação/percentual na UI', () => {
    const block = ohlcBlock();
    for (const field of ['shown.open', 'shown.high', 'shown.low', 'shown.close']) {
      expect(block).toContain(field);
    }
    // §6 da Ordem proíbe cálculo improvisado na UI. Variação (close-open) e
    // percentual seriam exatamente isso — e a §7 pede literalmente só
    // "O / H / L / C".
    expect(block).not.toMatch(/[-+*/]\s*shown\.(open|close|high|low)/);
    expect(block).not.toMatch(/Math\.(abs|round|pow|sqrt)/);
    expect(block).not.toContain('deltaPct');
    expect(block).not.toContain('%');
  });

  it('é fail-closed: sem candle real, ou com qualquer campo não-finito, não renderiza nada', () => {
    const block = ohlcBlock();
    // Sem array/sem candle nem hover -> null.
    expect(block).toContain('if (!shown) return null;');
    // Qualquer um dos 4 campos não-finito -> null (num() é o guarda real
    // já usado em todo o App.tsx), nunca um traço/zero fabricado.
    expect(block).toContain('if (!fields.every(([, v]) => num(v))) return null;');
    // Nunca desenha placeholder no lugar do dado ausente.
    expect(block).not.toContain('AWAIT');
    expect(block).not.toContain('DASH');
  });

  it('não cria uma segunda leitura de preço concorrente com o resto do terminal', () => {
    const block = ohlcBlock();
    // Nada de ler preço vivo, store ou motor aqui: a única entrada real é o
    // array de candles que o gráfico já recebeu, mais o candle sob o cursor
    // (também derivado do MESMO array, via prop — nunca um segundo fetch).
    expect(block).not.toContain('useContext');
    expect(block).not.toContain('useUnifiedSnapshot');
    expect(block).not.toContain('livePrice');
  });

  // Especificação Visual Profissional v1: V (volume) somado como 5º campo,
  // mesma disciplina de zero-cálculo-derivado — trava a única forma real
  // de regressão nova possível aqui: alguém multiplicar volume × preço
  // pra fabricar um "volume USD" que o dado real não garante.
  it('V (volume): mesmo campo cru shown.volume, opcional/aditivo (O/H/L/C continuam sem volume), nunca notional USD', () => {
    const block = ohlcBlock();
    expect(block).toContain('shown.volume');
    expect(block).toContain('const hasVolume = num(shown.volume);');
    // fail-closed por campo: falta de volume não derruba O/H/L/C.
    expect(block).toContain('{hasVolume && (');
    // Nunca vira notional: proibido multiplicar por preço ou prefixar "$".
    expect(block).not.toMatch(/volume\s*\*\s*shown\.(close|open)/);
    expect(block).not.toContain('$V');
    expect(block).not.toContain('"$"');
  });

  it('cores por campo seguem a paleta v1 (O neutro, H verde, L vermelho, C branco, V ciano)', () => {
    const block = ohlcBlock();
    expect(block).toContain('"text-[#888888]"');
    expect(block).toContain('"text-[#22c55e]"');
    expect(block).toContain('"text-[#ef4444]"');
    expect(block).toContain('"text-[#e5e5e5] font-semibold"');
    expect(block).toContain('text-[#06b6d4]');
  });
});

describe('OhlcReadout: tooltip de hover (achado B16 da AUDITORIA TÉCNICA COMPLETA)', () => {
  it('prefere hoverCandle sobre o último candle real, mas cai de volta quando ausente (fail-closed)', () => {
    const block = ohlcBlock();
    expect(block).toContain('const shown = hoverCandle ?? last;');
    expect(block).toContain('const isHover = !!hoverCandle;');
  });

  it('EnhancedChart_110_Percent alimenta o hover via API nativa (subscribeCrosshairMove), nunca mouse-tracking manual', () => {
    const chart = readFileSync(join(__dirname, '../src/chart/EnhancedChart_110_Percent.tsx'), 'utf8');
    expect(chart).toContain('onHoverCandleChange?: (candle: EnhancedChartCandle | null) => void;');
    expect(chart).toContain('chartReady.chart.subscribeCrosshairMove(handler);');
    expect(chart).toContain('chartReady.chart.unsubscribeCrosshairMove(handler);');
    // Fail-closed: cursor fora da área do gráfico -> null explícito, nunca
    // um candle congelado na última posição conhecida.
    expect(chart).toMatch(/if \(param\.time === undefined\) {\s*onHoverCandleChange\(null\);/);
  });

  it('o candle hover vem do MESMO array `data` já desenhado — zero segundo fetch/cálculo', () => {
    const chart = readFileSync(join(__dirname, '../src/chart/EnhancedChart_110_Percent.tsx'), 'utf8');
    expect(chart).toContain('const hovered = data.find((c) => c.time === hoveredTime);');
  });

  it('ChartWidget conecta onHoverCandleChange ao mesmo estado que alimenta OhlcReadout', () => {
    expect(app).toContain('onHoverCandleChange={setHoveredCandle}');
    expect(app).toContain('[hoveredCandle, setHoveredCandle] = useState<');
  });
});
