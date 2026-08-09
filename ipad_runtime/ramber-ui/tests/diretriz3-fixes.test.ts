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
    expect(bridge).toContain("import { getMarketDataProvider, type MarketDataProviderId } from './market-data-adapter';");
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

  it('as 4 chamadas reais ao ciclo Binance-only (HTF, ciclo principal, getChartCandles, Fase Ω Multi-Timeframe) passam por requestFuturesCandleSnapshot — nenhuma chama requestSnapshot() direto', () => {
    const bridge = read('../src/engine-bridge.ts');
    const helperCallSites = bridge.match(/await requestFuturesCandleSnapshot\(\{/g) ?? [];
    // Fase Ω Priority 1: buildMultiTimeframeContext somou um 4º call site
    // real (mesmo helper, 6 prazos em paralelo) — nenhuma perna de spot,
    // nenhum bypass do helper. ADITIVO V-MAX Etapa 9: scanRadarCandidate
    // migrou seus 2 call sites (o candidato em si + o loop de 3 prazos de
    // referência) para requestRadarCandleSnapshot (provider-aware, ver
    // teste abaixo) — o ciclo real do Core Engine/gráfico permanece 100%
    // Binance, intocado, sempre por este helper.
    expect(helperCallSites).toHaveLength(4);
    // requestSnapshot() aparece DENTRO de 3 pontos reais: os dois helpers
    // cripto (requestFuturesCandleSnapshot Binance-only;
    // requestRadarCandleSnapshot provider-aware, só Radar) MAIS
    // getTradFiChartCandles (Ordem Market Data Fabric, Fase 1) — este
    // último é um domínio genuinamente diferente (TradFi/CME via
    // getMarketDataProvider('TRADFI_DELAYED')), não um bypass: instrumentId
    // (ex. 'CME_ES') já é uma chave de cache inerentemente única (nunca
    // colide com um symbol cripto), então NENHUM dos dois helpers de
    // sufixo -PERP/-MEXC se aplica — reusar requestRadarCandleSnapshot
    // aqui na verdade ADICIONARIA um sufixo -PERP incorreto ao instrumentId
    // TradFi (a ternária daquele helper só conhece 'MEXC' vs. tudo mais).
    // Se este número mudar, um NOVO call site apareceu — confirme que é
    // igualmente legítimo antes de soltar o teste.
    const directBusCalls = bridge.match(/getMarketDataBus\(\)\.requestSnapshot\(\{/g) ?? [];
    expect(directBusCalls).toHaveLength(3);
  });

  it('ADITIVO V-MAX Etapa 9: os 2 call sites de scanRadarCandidate passam por requestRadarCandleSnapshot (provider-aware), nunca pelo helper Binance-only', () => {
    const bridge = read('../src/engine-bridge.ts');
    const radarHelperCallSites = bridge.match(/await requestRadarCandleSnapshot\(\{/g) ?? [];
    expect(radarHelperCallSites).toHaveLength(2);
  });

  it('requestRadarCandleSnapshot resolve o sufixo de cache-key por provider (-PERP Binance / -MEXC MEXC) — nunca colide as duas fontes na mesma chave do Bus', () => {
    const bridge = read('../src/engine-bridge.ts');
    const helperMatch = bridge.match(/async function requestRadarCandleSnapshot\([\s\S]*?\n\}\n/);
    expect(helperMatch, 'requestRadarCandleSnapshot não encontrada').not.toBeNull();
    const body = helperMatch![0];
    expect(body).toContain("const cacheSuffix = provider === 'MEXC' ? '-MEXC' : '-PERP';");
    expect(body).toContain('collect: getMarketDataProvider(provider).collect');
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

describe('ADITIVO V-MAX Etapa 10 (Data Quality Monitor unificado): dado real já computado todo ciclo, antes descartado, agora chega à UI', () => {
  it('RealCycleResult expõe dataSufficiency como passthrough puro do research-engine (achado de auditoria: era computado e descartado)', () => {
    const bridge = read('../src/engine-bridge.ts');
    expect(bridge).toContain('dataSufficiency?: {');
    // passthrough verbatim — nunca reconstrói o objeto, nunca renomeia campo
    expect(bridge).toContain('dataSufficiency: research.data_sufficiency,');
  });

  it('TelemetryHealthWidget lê gmilProviders do MESMO WidgetContext (nenhuma 2ª assinatura de useGmilSnapshot)', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain(
      'const { engine, realCycle, cycleLatencyMs, fps, chartTimeframe, engineStatus, gmilProviders, selectedAsset } = useContext(WidgetContext) || {};',
    );
    // a única assinatura real do hook continua exatamente 1 (topo de App())
    const subscriptions = app.match(/= useGmilSnapshot\(\);/g) ?? [];
    expect(subscriptions).toHaveLength(1);
  });

  it('SYSTEM HEALTH usa o vocabulário único (data-quality-vocabulary.ts) para as 3 leituras de qualidade — zero ternary ad-hoc divergente', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain(
      'import { classifyBusQuality, classifyWeight, classifySufficiencyScore, DATA_QUALITY_COLOR, type DataQualityLabel } from "./nexus/data-quality-vocabulary";',
    );
    expect(app).toContain('DATA_QUALITY_COLOR[classifyBusQuality(quality?.classification ?? null)]');
    expect(app).toContain('DATA_QUALITY_COLOR[classifySufficiencyScore(sufficiency?.score ?? null, sufficiency?.max_score ?? 100)]');
    expect(app).toContain('DATA_QUALITY_COLOR[classifyWeight(gmilAvgWeight)]');
    // as 2 novas linhas do painel — mesmo padrão <Row> das linhas já existentes
    expect(app).toContain('<Row label="SUFICIÊNCIA DE DADOS" value={sufficiencyLabel} valueClass={sufficiencyColor} />');
    expect(app).toContain('<Row label="QUALIDADE GMIL (CONTEXTO)" value={gmilLabel} valueClass={gmilColor} />');
  });

  it('a média de qualidade GMIL só considera provedores que já tentaram ao menos 1 fetch real — provedor nunca-rodado não conta como "ruim"', () => {
    const app = read('../src/App.tsx');
    const widgetMatch = app.match(/function TelemetryHealthWidget\(\) \{[\s\S]*?\n {2}return \(/);
    expect(widgetMatch, 'TelemetryHealthWidget não encontrado').not.toBeNull();
    const body = widgetMatch![0];
    expect(body).toContain('gmilList.filter((p: any) => p?.lastReading != null)');
  });

  it('self-diagnostics.ts reusa classifyBusQuality (mesmo vocabulário) em vez de reimplementar o corte QUARENTENA/DEGRADADA', () => {
    const diag = read('../src/nexus/self-diagnostics.ts');
    expect(diag).toContain("import { classifyBusQuality } from './data-quality-vocabulary';");
    expect(diag).toContain('const qualityState = classifyBusQuality(quality);');
  });
});

describe('Ferramentas Institucionais (achados de auditoria em background, 3 instâncias reais de "dado real computado, nunca surfaceado")', () => {
  it('RealCycleResult.extendedTarget seleciona pela MESMA direção que route (signal), lendo fib_extension_long_target/short_target direto do frame — nunca uma 4ª fórmula', () => {
    const bridge = read('../src/engine-bridge.ts');
    expect(bridge).toContain('extendedTarget?: number | null;');
    expect(bridge).toContain("signal === 'LONG' && isNum(frame.fib_extension_long_target)");
    expect(bridge).toContain('? frame.fib_extension_long_target');
    expect(bridge).toContain("signal === 'SHORT' && isNum(frame.fib_extension_short_target)");
    expect(bridge).toContain('? frame.fib_extension_short_target');
  });

  it('App.tsx engine useMemo repassa realCycle.extendedTarget puro (mesmo padrão de target/target2, fail-closed atrás de cycleOk)', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('const extendedTarget = cycleOk ? (realCycle?.extendedTarget ?? null) : null;');
  });

  it('bug real corrigido: "Consenso Entre Corretoras" não é mais um NÃO_APLICÁVEL hardcoded — lê trustScore.crossExchangeConvergence real (mesmo hook já usado por 2 outros widgets)', () => {
    const app = read('../src/App.tsx');
    expect(app).not.toContain('{ label: "Consenso Entre Corretoras", available: null }');
    expect(app).toContain('{ label: "Consenso Entre Corretoras", available: num(trustScore?.crossExchangeConvergence) },');
    const widgetMatch = app.match(/function DecisionValidationWidget\(\) \{[\s\S]*?\n {2}const trustScore = useTrustScoreSnapshot\(\);/);
    expect(widgetMatch, 'useTrustScoreSnapshot não encontrado dentro de DecisionValidationWidget').not.toBeNull();
  });

  it('affectiveMemory (reward/pain/eventCount reais) ganha tooltip no CPI do Council — mesmo padrão já usado pelo TRUST SCORE ao lado ("componentes reais no tooltip")', () => {
    const app = read('../src/App.tsx');
    const idx = app.indexOf('function CouncilWidget() {');
    expect(idx, 'CouncilWidget não encontrado').toBeGreaterThan(-1);
    const end = app.indexOf('TRUST SCORE · FONTE', idx);
    const body = app.slice(idx, end);
    expect(body).toContain('const affectiveMemory = useAffectiveMemorySnapshot();');
    expect(body).toContain('affectiveMemory.eventCount > 0');
    expect(body).toContain('affectiveMemory.reward.toFixed(2)');
    expect(body).toContain('affectiveMemory.pain.toFixed(2)');
  });
});
