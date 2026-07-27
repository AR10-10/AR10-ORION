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
  // mitigá-la: MarketDirectionWidget virou parte da GAVETA .terminal-left
  // (Market Intelligence, fechada por padrão) e AssistantOrb virou
  // detalhe expandido sob demanda na .terminal-strip — nenhum dos dois
  // compete mais pela altura OU largura do Gráfico. Este teste trava
  // essa separação estrutural para que a classe de bug não seja
  // reintroduzida.
  it('.terminal-main contém ChartWidget/TradFiEmptyState mas NUNCA MarketDirectionWidget nem AssistantOrb', () => {
    const app = read('../src/App.tsx');
    const mainMatch = app.match(/<div className="terminal-main[^"]*">([\s\S]*?)\n {20}<\/div>\n\n {20}\{\/\* Backdrop/);
    expect(mainMatch, '.terminal-main não encontrado com a estrutura esperada').not.toBeNull();
    const mainBody = mainMatch![1];
    expect(mainBody).toContain('ChartWidget');
    expect(mainBody).not.toContain('MarketDirectionWidget');
    expect(mainBody).not.toContain('<AssistantOrb');
  });

  it('.terminal-left (Market Intelligence) contém MarketDirectionWidget + MarketBiasDecisionCard, mas é uma GAVETA fechada por padrão (V16.1)', () => {
    const app = read('../src/App.tsx');
    // V16.1 correção crítica: o Operador rejeitou as 3 colunas sempre
    // visíveis (esmagavam o Gráfico) — esquerda/direita viraram
    // overlays fechados por padrão, className agora é um template
    // literal com o estado leftDrawerOpen/rightDrawerOpen.
    expect(app).toContain('const [leftDrawerOpen, setLeftDrawerOpen] = useState(false);');
    expect(app).toContain('const [rightDrawerOpen, setRightDrawerOpen] = useState(false);');
    const leftMatch = app.match(/className=\{`terminal-left flex flex-col gap-2[^`]*`\}\s*\n\s*>([\s\S]*?)\n {20}<\/div>\n\n {20}\{\/\* RIGHT/);
    expect(leftMatch, '.terminal-left não encontrado com a estrutura esperada').not.toBeNull();
    const leftBody = leftMatch![1];
    expect(leftBody).toContain('<MarketDirectionWidget');
    expect(leftBody).toContain('<MarketBiasDecisionCard');
  });

  it('as gavetas usam position:absolute (index.css) — nunca dividem espaço de flexbox com o Gráfico, mesmo abertas', () => {
    const css = read('../src/index.css');
    const rulesMatch = css.match(/\.terminal-left,\s*\n\.terminal-right \{([\s\S]*?)\n\}/);
    expect(rulesMatch, 'regra .terminal-left/.terminal-right não encontrada').not.toBeNull();
    expect(rulesMatch![1]).toContain('position: absolute');
    // .terminal-row só tem UM filho de verdade no fluxo (.terminal-main)
    // — confirmado por não haver mais "order"/"width" fixo em
    // .terminal-left/.terminal-right fora da regra absolute acima.
    expect(css).not.toMatch(/\.terminal-left\s*\{\s*\n\s*order:/);
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
    // .terminal-main/.terminal-strip usam className="..." (string
    // simples); .terminal-left/.terminal-right (V16.1, gavetas) usam
    // className={`...`} (template literal, por causa do estado
    // leftDrawerOpen/rightDrawerOpen) — os dois formatos precisam de
    // regex próprios, mas a garantia é a mesma para os 4.
    for (const cls of ['terminal-main', 'terminal-strip']) {
      const regex = new RegExp(`className="${cls}[^"]*"`, 'g');
      const matches = app.match(regex) ?? [];
      expect(matches.length, `nenhuma ocorrência de className="${cls}..." encontrada`).toBeGreaterThan(0);
      for (const m of matches) {
        expect(m, `${cls} não pode ter pointer-events-none (bloqueia gesto de toque)`).not.toContain('pointer-events-none');
      }
    }
    for (const cls of ['terminal-left', 'terminal-right']) {
      const regex = new RegExp('className=\\{`' + cls + '[^`]*`\\}', 'g');
      const matches = app.match(regex) ?? [];
      expect(matches.length, `nenhuma ocorrência de className={\`${cls}...\`} encontrada`).toBeGreaterThan(0);
      for (const m of matches) {
        expect(m, `${cls} não pode ter pointer-events-none (bloqueia gesto de toque)`).not.toContain('pointer-events-none');
      }
    }
  });
});

describe('diretriz 2 + V15.1 GOD TIER: roteamento Futuros exclusivo — Gráfico e Risk Engine SÓ consomem /fapi/v1/, zero fallback para Spot', () => {
  it('engine-bridge.ts resolve Binance Futuros via o Market Data Adapter (ADITIVO V-MAX Etapa 1) e NUNCA collectBinanceKlines (spot) — instrução explícita: "extinguindo qualquer roteamento de gráficos para mercado Spot"', () => {
    const bridge = read('../src/engine-bridge.ts');
    // ADITIVO V-MAX Etapa 1: nenhum consumidor importa
    // collectBinanceFuturesKlines diretamente mais — getMarketDataProvider
    // é o único caminho (market-data-adapter.ts), mesmo dado real por
    // baixo (collectBinanceFuturesKlines continua a única função que fala
    // com a Binance, só não é mais importada aqui).
    expect(bridge).toContain("import { getMarketDataProvider } from './market-data-adapter';");
    expect(bridge).not.toContain("from '../../src/market-data-bus/binance-futures-candle-connector.js'");
    expect(bridge).not.toContain('collectBinanceKlines');
    expect(bridge).not.toContain('binance-candle-connector.js');
  });

  it('requestFuturesCandleSnapshot não tem nenhuma perna de spot — só a chave symbol-PERP via getMarketDataProvider(\'BINANCE\')', () => {
    const bridge = read('../src/engine-bridge.ts');
    expect(bridge).toContain('async function requestFuturesCandleSnapshot(');
    const helperMatch = bridge.match(/async function requestFuturesCandleSnapshot\([\s\S]*?\n\}\n/);
    expect(helperMatch, 'requestFuturesCandleSnapshot não encontrada').not.toBeNull();
    const helper = helperMatch![0];
    expect(helper).toContain('symbol: `${symbol}-PERP`');
    expect(helper).toContain("collect: getMarketDataProvider('BINANCE').collect");
    expect(helper).not.toContain('collectBinanceKlines');
  });

  it('as 6 chamadas reais ao Bus (HTF, ciclo principal, getChartCandles, Fase Ω Multi-Timeframe, scanRadarCandidate x2) passam por requestFuturesCandleSnapshot — nenhuma chama requestSnapshot() direto', () => {
    const bridge = read('../src/engine-bridge.ts');
    const helperCallSites = bridge.match(/await requestFuturesCandleSnapshot\(\{/g) ?? [];
    // Fase Ω Priority 1: buildMultiTimeframeContext somou um 4º call site
    // real (mesmo helper, 6 prazos em paralelo) — nenhuma perna de spot,
    // nenhum bypass do helper. OMEGA CORE V-MAX (completar Fase 7):
    // scanRadarCandidate somou mais 2 (o candidato em si + o loop de 3
    // prazos de referência da confluência-leve) — mesmo helper, mesma
    // disciplina, zero perna de spot nova.
    expect(helperCallSites).toHaveLength(6);
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
