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
    expect(app).toContain('<OhlcReadout candles={chartData} />');
  });

  it('lê apenas os 4 campos crus do candle — nunca deriva variação/percentual na UI', () => {
    const block = ohlcBlock();
    for (const field of ['last.open', 'last.high', 'last.low', 'last.close']) {
      expect(block).toContain(field);
    }
    // §6 da Ordem proíbe cálculo improvisado na UI. Variação (close-open) e
    // percentual seriam exatamente isso — e a §7 pede literalmente só
    // "O / H / L / C".
    expect(block).not.toMatch(/[-+*/]\s*last\.(open|close|high|low)/);
    expect(block).not.toMatch(/Math\.(abs|round|pow|sqrt)/);
    expect(block).not.toContain('deltaPct');
    expect(block).not.toContain('%');
  });

  it('é fail-closed: sem candle real, ou com qualquer campo não-finito, não renderiza nada', () => {
    const block = ohlcBlock();
    // Sem array/sem candle -> null.
    expect(block).toContain('if (!last) return null;');
    // Qualquer um dos 4 campos não-finito -> null (num() é o guarda real
    // já usado em todo o App.tsx), nunca um traço/zero fabricado.
    expect(block).toContain('if (!fields.every(([, v]) => num(v))) return null;');
    // Nunca desenha placeholder no lugar do dado ausente.
    expect(block).not.toContain('AWAIT');
    expect(block).not.toContain('DASH');
  });

  it('não cria uma segunda leitura de preço concorrente com o resto do terminal', () => {
    const block = ohlcBlock();
    // Nada de ler preço vivo, store ou motor aqui: a única entrada é o
    // array de candles que o gráfico já recebeu.
    expect(block).not.toContain('useContext');
    expect(block).not.toContain('useUnifiedSnapshot');
    expect(block).not.toContain('livePrice');
  });
});
