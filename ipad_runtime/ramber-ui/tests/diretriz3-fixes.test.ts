// diretriz3-fixes.test.ts — trava permanente dos 3 defeitos reportados
// pelo Operador após o Overhaul Cross-Market (gráfico colapsando,
// dropdown do Omnibox sem rolagem por toque, painéis sem responder a
// gesto em paisagem) e do roteamento Spot→Futuros real (Diretriz 2). São
// testes de PADRÃO NO CÓDIGO-FONTE (mesmo espírito dos boundary tests já
// existentes) — a prova física em navegador real (Playwright/Chromium,
// viewport de iPad com hasTouch:true) já confirmou os 4 comportamentos;
// isto garante que ninguém reintroduza a mesma classe de bug sem o CI
// avisar.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');

describe('V16 Institutional Command Center: o Gráfico é o único ocupante de .terminal-main (nunca mais divide a área "main" com o Vetor de Mercado/S.E.)', () => {
  // A causa raiz do bug 1 original (colapso do Gráfico) era um wrapper
  // MarketDirectionWidget+AssistantOrb competindo por altura DENTRO da
  // mesma .terminal-main que o Gráfico — corrigido na Diretriz 3 dando
  // flex-grow real ao wrapper. O V16 remove a causa inteira em vez de só
  // mitigá-la: MarketDirectionWidget virou parte fixa da coluna
  // .terminal-left (Market Intelligence) e AssistantOrb virou detalhe
  // expandido sob demanda na .terminal-strip — nenhum dos dois compete
  // mais pela altura do Gráfico. Este teste trava essa separação
  // estrutural para que a classe de bug não seja reintroduzida.
  it('.terminal-main contém ChartWidget/TradFiEmptyState mas NUNCA MarketDirectionWidget nem AssistantOrb', () => {
    const app = read('../src/App.tsx');
    const mainMatch = app.match(/<div className="terminal-main[^"]*">([\s\S]*?)\n {20}<\/div>\n\n {20}\{\/\* RIGHT/);
    expect(mainMatch, '.terminal-main não encontrado com a estrutura esperada').not.toBeNull();
    const mainBody = mainMatch![1];
    expect(mainBody).toContain('ChartWidget');
    expect(mainBody).not.toContain('MarketDirectionWidget');
    expect(mainBody).not.toContain('<AssistantOrb');
  });

  it('.terminal-left (Market Intelligence) contém MarketDirectionWidget + MarketBiasDecisionCard, sempre visíveis (sem gear)', () => {
    const app = read('../src/App.tsx');
    const leftMatch = app.match(/<div className="terminal-left[^"]*">([\s\S]*?)\n {20}<\/div>\n\n {20}\{\/\* MAIN/);
    expect(leftMatch, '.terminal-left não encontrado com a estrutura esperada').not.toBeNull();
    const leftBody = leftMatch![1];
    expect(leftBody).toContain('<MarketDirectionWidget');
    expect(leftBody).toContain('<MarketBiasDecisionCard');
  });
});

describe('bug 2: scroll do Smart Omnibox — cascata CSS corrigida', () => {
  it('o dropdown usa !overflow-y-auto (important) para vencer o overflow:hidden de .cyber-panel na cascata', () => {
    const omnibox = read('../src/omnibox/SmartOmnibox.tsx');
    // A mesma classe de bug já documentada no Widget() maximizado
    // (!fixed !inset-2) — .cyber-panel vem DEPOIS do Tailwind no CSS
    // compilado (index.css importa tailwindcss primeiro), então
    // overflow-y-auto simples perde a cascata para o overflow:hidden
    // de .cyber-panel na MESMA propriedade.
    expect(omnibox).toContain('!overflow-y-auto');
    expect(omnibox).toContain('cyber-panel');
    // nunca o overflow-y-auto "cru" (sem o modificador important) nesse
    // mesmo elemento — evita reintroduzir o bug por engano numa edição futura
    expect(omnibox).not.toMatch(/className="[^"]*\bcyber-panel\b[^"]*\boverflow-y-auto\b(?!["']|\s)/);
  });
});

describe('estabilização (Prioridade 4, UX Profissional): pinch-zoom nativo preservado', () => {
  it('index.html permite zoom real (nunca user-scalable=no nem maximum-scale=1.0) — um app nativo real não desativa o zoom do sistema', () => {
    const html = read('../index.html');
    // Isola o atributo content= da própria tag <meta name="viewport">, não
    // o arquivo inteiro — um comentário explicando o bug antigo (que cita o
    // valor errado como contexto histórico) não pode derrubar este teste.
    const viewportMatch = html.match(/<meta name="viewport" content="([^"]*)"/);
    expect(viewportMatch, 'meta viewport não encontrada').not.toBeNull();
    const viewportContent = viewportMatch![1];
    expect(viewportContent).not.toContain('user-scalable=no');
    expect(viewportContent).not.toMatch(/maximum-scale=1(\.0)?(,|$)/);
    // initial-scale continua 1.0: o boot é sempre em 100%, nunca com zoom
    // residual — só o TETO de zoom (maximum-scale) foi liberado.
    expect(viewportContent).toContain('initial-scale=1.0');
  });
});

describe('bug 3: scroll em paisagem — pointer-events-none removido dos containers do grid', () => {
  it('nenhum dos 4 containers nomeados (.terminal-main/.terminal-left/.terminal-right/.terminal-strip) declara pointer-events-none', () => {
    const app = read('../src/App.tsx');
    for (const cls of ['terminal-main', 'terminal-left', 'terminal-right', 'terminal-strip']) {
      const regex = new RegExp(`className="${cls}[^"]*"`, 'g');
      const matches = app.match(regex) ?? [];
      expect(matches.length, `nenhuma ocorrência de className="${cls}..." encontrada`).toBeGreaterThan(0);
      for (const m of matches) {
        expect(m, `${cls} não pode ter pointer-events-none (bloqueia gesto de toque)`).not.toContain('pointer-events-none');
      }
    }
  });
});

describe('diretriz 2 + V15.1 GOD TIER: roteamento Futuros exclusivo — Gráfico e Risk Engine SÓ consomem /fapi/v1/, zero fallback para Spot', () => {
  it('engine-bridge.ts importa collectBinanceFuturesKlines e NUNCA collectBinanceKlines (spot) — instrução explícita: "extinguindo qualquer roteamento de gráficos para mercado Spot"', () => {
    const bridge = read('../src/engine-bridge.ts');
    expect(bridge).toContain("import { collectBinanceFuturesKlines } from '../../src/market-data-bus/binance-futures-candle-connector.js'");
    expect(bridge).not.toContain('collectBinanceKlines');
    expect(bridge).not.toContain('binance-candle-connector.js');
  });

  it('requestFuturesCandleSnapshot não tem nenhuma perna de spot — só a chave symbol-PERP via collectBinanceFuturesKlines', () => {
    const bridge = read('../src/engine-bridge.ts');
    expect(bridge).toContain('async function requestFuturesCandleSnapshot(');
    const helperMatch = bridge.match(/async function requestFuturesCandleSnapshot\([\s\S]*?\n\}\n/);
    expect(helperMatch, 'requestFuturesCandleSnapshot não encontrada').not.toBeNull();
    const helper = helperMatch![0];
    expect(helper).toContain('symbol: `${symbol}-PERP`');
    expect(helper).toContain('collect: collectBinanceFuturesKlines');
    expect(helper).not.toContain('collectBinanceKlines');
  });

  it('as 3 chamadas reais ao Bus (HTF, ciclo principal, getChartCandles) passam por requestFuturesCandleSnapshot — nenhuma chama requestSnapshot() direto', () => {
    const bridge = read('../src/engine-bridge.ts');
    const helperCallSites = bridge.match(/await requestFuturesCandleSnapshot\(\{/g) ?? [];
    expect(helperCallSites).toHaveLength(3);
    // requestSnapshot() só pode aparecer DENTRO do próprio helper (1 única
    // perna, futuros) — se esse número mudar, algum call site voltou a
    // ignorar o helper e chamar o Bus direto, ou uma perna de spot voltou.
    const directBusCalls = bridge.match(/getMarketDataBus\(\)\.requestSnapshot\(\{/g) ?? [];
    expect(directBusCalls).toHaveLength(1);
  });

  it('CoreEvidence.instrument_type na construção real é sempre \'crypto_futures\' (união de tipos permanece fechada, sem fallback pra decidir dinamicamente)', () => {
    const bridge = read('../src/engine-bridge.ts');
    expect(bridge).toContain("instrument_type: 'crypto_spot' | 'crypto_futures';");
    expect(bridge).toContain("instrument_type: 'crypto_futures',");
    const valueAssignments = bridge.match(/^\s*instrument_type: 'crypto_futures',\s*$/gm) ?? [];
    expect(valueAssignments).toHaveLength(1);
  });

  it('RealCycleResult expõe instrumentType como passthrough honesto (nunca uma string fixa na UI)', () => {
    const bridge = read('../src/engine-bridge.ts');
    expect(bridge).toContain("instrumentType?: 'crypto_spot' | 'crypto_futures' | null;");
    expect(bridge).toContain('instrumentType: evidence.instrument_type,');
  });

  it('binance-futures-candle-connector.js existe, exporta collectBinanceFuturesKlines e reaproveita o probe real de futuros', () => {
    const connector = read('../../src/market-data-bus/binance-futures-candle-connector.js');
    expect(connector).toContain('export async function collectBinanceFuturesKlines');
    expect(connector).toContain("import { probe as probeBinanceFutures } from '../../js/real-data/binance-futures-public.js'");
  });

  it('App.tsx deriva o rótulo do mercado de realCycle.instrumentType — nunca a string fixa "Spot"', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('realCycle?.instrumentType === "crypto_futures"');
    expect(app).toContain('"Futures/Perp"');
    // o badge de modo cripto usa a variável derivada, não um literal "Spot"
    expect(app).toContain('marketMode === "TRADFI" ? "Macro" : cryptoMarketLabel');
    expect(app).not.toMatch(/\{marketMode === "TRADFI" \? "Macro" : "Spot"\}/);
  });
});
