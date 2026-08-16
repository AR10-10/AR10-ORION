// instrument-registry.js — Instrument Discovery/Registry real (Ordem Market
// Data Fabric §1/§4/§5/§10/§14/§15). Catalogo puro de instrumentos futuros
// TradFi (CME Group e suas bolsas designadas CBOT/NYMEX/COMEX) — zero rede,
// zero estado, zero I/O. Isto e Reference Data (especificacao de contrato:
// tick size, tick value, tamanho), publicada pela CME abertamente em
// cmegroup.com para qualquer visitante sem exigir licenca de dado de
// mercado — DISTINTO do feed de preco/candle ao vivo (produto licenciado,
// ver tradfi-delayed-connector.js e o bloqueio documentado em
// docs/MARKET_DATA_FABRIC.md). Nao passa pelo Market Data Bus porque nao e
// uma leitura com timestamp: e a especificacao estavel do contrato.
//
// Regra de Ouro 1 (zero dado fabricado): cada tick_size/tick_value/contract
// size abaixo foi confirmado via pesquisa real (WebSearch, CME Group e
// fontes de referencia de corretoras/dados de mercado) na sessao em que
// este arquivo foi escrito — nunca um numero adivinhado de memoria sem
// checagem. Onde a especificacao real varia (SOFR: tick/valor diferente
// para o contrato mais proximo do vencimento), isso e registrado
// explicitamente em vez de forcar um unico numero falso-preciso.
//
// "Nao criar um segundo cerebro" (Ordem §9): este catalogo so alimenta o
// Instrument Discovery/seletor e o painel de referencia TradFi — nunca o
// Core Engine, Council ou qualquer motor LONG/SHORT/WAIT (LEI 24 intacta).

export const ASSET_CLASS = Object.freeze({
    EQUITY_INDEX: 'EQUITY_INDEX',
    EQUITY: 'EQUITY',
    METALS: 'METALS',
    ENERGY: 'ENERGY',
    RATES: 'RATES',
    FX: 'FX',
    CRYPTO: 'CRYPTO',
});

// A = CORE (Ordem §5: disponibilidade imediata no seletor).
// B = RELEVANTE (outros contratos liquidos — catalogo pode crescer sem
//     reescrever a UI, mas a interface so prioriza A por padrao).
// C = EXTENSAO (baixa liquidez, agricolas, especializados).
export const PRIORITY_TIER = Object.freeze({ A: 'A', B: 'B', C: 'C' });

// instrument_type usado por schema.js/STRUCTURAL_NAO_APLICAVEL_BY_INSTRUMENT
// — os futuros CME acima usam este valor.
export const TRADFI_FUTURES_INSTRUMENT_TYPE = 'tradfi_futures';
// Acoes individuais a vista (secao EQUITY abaixo) usam este 2o valor —
// nunca reaproveitam tradfi_futures: uma acao nao tem contrato/vencimento/
// tick_value multiplicador, e open_interest (conceito de derivativo) nao
// se aplica a ela do jeito que se aplica a um futuro (ver schema.js).
export const TRADFI_EQUITY_INSTRUMENT_TYPE = 'tradfi_equity';

/**
 * @typedef {Object} InstrumentDefinition
 * @property {string} instrument_id - ID interno estavel, ex. 'CME_ES'.
 * @property {string} display_name - Nome legivel para o seletor em cascata.
 * @property {string} asset_class - um valor de ASSET_CLASS.
 * @property {string} exchange - marca do grupo (sempre 'CME' neste catalogo,
 *   igual ao termo usado pela Ordem — "CME como fonte de referencia").
 * @property {string} designated_contract_market - bolsa real de registro do
 *   contrato dentro do grupo CME (CME, CBOT, NYMEX ou COMEX — fato publico
 *   distinto da marca guarda-chuva "CME Group").
 * @property {string} contract_code - simbolo real do contrato na CME, ex. 'ES'.
 * @property {string|null} continuous_symbol_hint - simbolo de contrato
 *   continuo usado pelo conector delayed (convencao publica nao-oficial,
 *   ver tradfi-delayed-connector.js) — null quando nenhum conector real
 *   deste catalogo ainda sabe resolver este instrumento.
 * @property {number} tick_size - menor variacao de preco real do contrato
 *   proximo/padrao (ver notes quando varia por vencimento).
 * @property {number} tick_value_usd - valor de 1 tick em USD para o
 *   contrato proximo/padrao (ver notes quando varia por vencimento).
 * @property {string} contract_size_desc - descricao real do tamanho do
 *   contrato (nunca um numero de preco — e a unidade do contrato).
 * @property {string} priority_tier - um valor de PRIORITY_TIER.
 * @property {string} instrument_type - sempre TRADFI_FUTURES_INSTRUMENT_TYPE.
 * @property {string} notes - nota honesta de fonte/limitacao/variacao real.
 * @property {string|null} [legacy_tradfi_asset_symbol] - symbol do catalogo
 *   pre-existente src/omnibox/tradfi-assets.ts (ex. 'SPX'), SO quando o
 *   par e um proxy real e honesto deste futuro (mesma direcao de cotacao,
 *   correlacao muito alta) — ausente/null quando nao ha mapeamento seguro
 *   (ex. indices/acoes fora do universo de futuros CME, ou pares onde a
 *   convencao de cotacao do futuro diverge da convencao spot do legado,
 *   ver findByLegacyTradFiAssetSymbol). Ponte para o seletor JA existente
 *   no App.tsx (marketMode==='TRADFI') comecar a mostrar dado real sem
 *   duplicar aquele catalogo nem mudar a UX que o Operador ja conhece.
 * @property {string} [tradingview_symbol] - simbolo real no formato
 *   EXCHANGE:CODE da TradingView (ex. 'CME_MINI:ES1!', 'NASDAQ:AAPL'),
 *   usado SO pelo widget de fallback (TradingViewAdvancedChart.tsx) quando
 *   o conector Yahoo delayed falha (bloqueio real de CORS documentado em
 *   docs/MARKET_DATA_FABRIC.md). Os 5 simbolos de acao (formato
 *   EXCHANGE:TICKER) sao confirmados contra exemplo real da documentacao
 *   da TradingView; os de futuro contínuo (sufixo "1!") seguem a convencao
 *   publica documentada da TradingView, mas SEM verificacao individual ao
 *   vivo nesta sessao (rede bloqueada) — o widget usa allow_symbol_change:
 *   true de proposito, entao um simbolo eventualmente errado e corrigivel
 *   pelo proprio Operador direto na tela, nunca quebra a experiencia.
 */

/** @type {InstrumentDefinition[]} */
export const INSTRUMENT_REGISTRY = Object.freeze([
    // ---- EQUITY_INDEX ----------------------------------------------------
    { instrument_id: 'CME_ES', display_name: 'S&P 500 E-mini', asset_class: ASSET_CLASS.EQUITY_INDEX,
      exchange: 'CME', designated_contract_market: 'CME', contract_code: 'ES', continuous_symbol_hint: 'ES=F',
      tick_size: 0.25, tick_value_usd: 12.5, contract_size_desc: '$50 x indice S&P 500',
      tradingview_symbol: 'CME_MINI:ES1!',
      priority_tier: PRIORITY_TIER.A, instrument_type: TRADFI_FUTURES_INSTRUMENT_TYPE, legacy_tradfi_asset_symbol: 'SPX',
      notes: 'Contrato CORE Ordem §5. tick/valor confirmados via CME Group + fontes de corretoras (2026).' },
    { instrument_id: 'CME_MES', display_name: 'S&P 500 Micro E-mini', asset_class: ASSET_CLASS.EQUITY_INDEX,
      exchange: 'CME', designated_contract_market: 'CME', contract_code: 'MES', continuous_symbol_hint: 'MES=F',
      tick_size: 0.25, tick_value_usd: 1.25, contract_size_desc: '$5 x indice S&P 500',
      priority_tier: PRIORITY_TIER.A, instrument_type: TRADFI_FUTURES_INSTRUMENT_TYPE,
      notes: '1/10 do ES — mesmo tick em pontos, valor de tick proporcional.' },
    { instrument_id: 'CME_NQ', display_name: 'Nasdaq-100 E-mini', asset_class: ASSET_CLASS.EQUITY_INDEX,
      exchange: 'CME', designated_contract_market: 'CME', contract_code: 'NQ', continuous_symbol_hint: 'NQ=F',
      tick_size: 0.25, tick_value_usd: 5.0, contract_size_desc: '$20 x indice Nasdaq-100',
      tradingview_symbol: 'CME_MINI:NQ1!',
      priority_tier: PRIORITY_TIER.A, instrument_type: TRADFI_FUTURES_INSTRUMENT_TYPE, legacy_tradfi_asset_symbol: 'NDX',
      notes: 'Contrato CORE Ordem §5 (exemplo literal do §15: FUTURES→CME→INDEX→NASDAQ-100→NQ).' },
    { instrument_id: 'CME_MNQ', display_name: 'Nasdaq-100 Micro E-mini', asset_class: ASSET_CLASS.EQUITY_INDEX,
      exchange: 'CME', designated_contract_market: 'CME', contract_code: 'MNQ', continuous_symbol_hint: 'MNQ=F',
      tick_size: 0.25, tick_value_usd: 0.5, contract_size_desc: '$2 x indice Nasdaq-100',
      priority_tier: PRIORITY_TIER.A, instrument_type: TRADFI_FUTURES_INSTRUMENT_TYPE,
      notes: '1/10 do NQ.' },
    { instrument_id: 'CME_YM', display_name: 'Dow Jones E-mini', asset_class: ASSET_CLASS.EQUITY_INDEX,
      exchange: 'CME', designated_contract_market: 'CBOT', contract_code: 'YM', continuous_symbol_hint: 'YM=F',
      tick_size: 1.0, tick_value_usd: 5.0, contract_size_desc: '$5 x indice Dow Jones Industrial Average',
      tradingview_symbol: 'CBOT_MINI:YM1!',
      priority_tier: PRIORITY_TIER.A, instrument_type: TRADFI_FUTURES_INSTRUMENT_TYPE, legacy_tradfi_asset_symbol: 'US30',
      notes: 'Registrado na CBOT (bolsa do grupo CME Group), nao na CME propriamente.' },
    { instrument_id: 'CME_MYM', display_name: 'Dow Jones Micro E-mini', asset_class: ASSET_CLASS.EQUITY_INDEX,
      exchange: 'CME', designated_contract_market: 'CBOT', contract_code: 'MYM', continuous_symbol_hint: 'MYM=F',
      tick_size: 1.0, tick_value_usd: 0.5, contract_size_desc: '$0.50 x indice Dow Jones Industrial Average',
      priority_tier: PRIORITY_TIER.A, instrument_type: TRADFI_FUTURES_INSTRUMENT_TYPE,
      notes: '1/10 do YM.' },
    { instrument_id: 'CME_RTY', display_name: 'Russell 2000 E-mini', asset_class: ASSET_CLASS.EQUITY_INDEX,
      exchange: 'CME', designated_contract_market: 'CME', contract_code: 'RTY', continuous_symbol_hint: 'RTY=F',
      tick_size: 0.1, tick_value_usd: 5.0, contract_size_desc: '$50 x indice Russell 2000',
      tradingview_symbol: 'CME_MINI:RTY1!',
      priority_tier: PRIORITY_TIER.A, instrument_type: TRADFI_FUTURES_INSTRUMENT_TYPE, legacy_tradfi_asset_symbol: 'RUT',
      notes: 'Contrato CORE Ordem §5.' },
    { instrument_id: 'CME_M2K', display_name: 'Russell 2000 Micro E-mini', asset_class: ASSET_CLASS.EQUITY_INDEX,
      exchange: 'CME', designated_contract_market: 'CME', contract_code: 'M2K', continuous_symbol_hint: 'M2K=F',
      tick_size: 0.1, tick_value_usd: 0.5, contract_size_desc: '$5 x indice Russell 2000',
      priority_tier: PRIORITY_TIER.A, instrument_type: TRADFI_FUTURES_INSTRUMENT_TYPE,
      notes: '1/10 do RTY.' },

    // ---- METALS ------------------------------------------------------
    { instrument_id: 'CME_GC', display_name: 'Ouro (Gold)', asset_class: ASSET_CLASS.METALS,
      exchange: 'CME', designated_contract_market: 'COMEX', contract_code: 'GC', continuous_symbol_hint: 'GC=F',
      tick_size: 0.1, tick_value_usd: 10.0, contract_size_desc: '100 onças troy',
      tradingview_symbol: 'COMEX:GC1!',
      priority_tier: PRIORITY_TIER.A, instrument_type: TRADFI_FUTURES_INSTRUMENT_TYPE, legacy_tradfi_asset_symbol: 'XAUUSD',
      notes: 'Contrato CORE Ordem §5 (exemplo literal do §15: METALS→GOLD→GC). legacy_tradfi_asset_symbol: XAUUSD ' +
        'e a cotacao SPOT de ouro (convencao forex); GC=F e o FUTURO COMEX — precos muito proximos mas nao ' +
        'identicos (base/carry). UI mostra a identidade real do contrato (GC), nunca renomeia como se fosse spot.' },
    { instrument_id: 'CME_SI', display_name: 'Prata (Silver)', asset_class: ASSET_CLASS.METALS,
      exchange: 'CME', designated_contract_market: 'COMEX', contract_code: 'SI', continuous_symbol_hint: 'SI=F',
      tick_size: 0.005, tick_value_usd: 25.0, contract_size_desc: '5.000 onças troy',
      tradingview_symbol: 'COMEX:SI1!',
      priority_tier: PRIORITY_TIER.A, instrument_type: TRADFI_FUTURES_INSTRUMENT_TYPE, legacy_tradfi_asset_symbol: 'XAGUSD',
      notes: 'Contrato CORE Ordem §5. Mesma ressalva spot-vs-futuro do GC/XAUUSD acima.' },
    { instrument_id: 'CME_HG', display_name: 'Cobre (Copper)', asset_class: ASSET_CLASS.METALS,
      exchange: 'CME', designated_contract_market: 'COMEX', contract_code: 'HG', continuous_symbol_hint: 'HG=F',
      tick_size: 0.0005, tick_value_usd: 12.5, contract_size_desc: '25.000 libras',
      priority_tier: PRIORITY_TIER.A, instrument_type: TRADFI_FUTURES_INSTRUMENT_TYPE,
      notes: 'Contrato CORE Ordem §5.' },

    // ---- ENERGY --------------------------------------------------------
    { instrument_id: 'CME_CL', display_name: 'Petroleo WTI (Crude Oil)', asset_class: ASSET_CLASS.ENERGY,
      exchange: 'CME', designated_contract_market: 'NYMEX', contract_code: 'CL', continuous_symbol_hint: 'CL=F',
      tick_size: 0.01, tick_value_usd: 10.0, contract_size_desc: '1.000 barris',
      tradingview_symbol: 'NYMEX:CL1!',
      priority_tier: PRIORITY_TIER.A, instrument_type: TRADFI_FUTURES_INSTRUMENT_TYPE, legacy_tradfi_asset_symbol: 'USOIL',
      notes: 'Contrato CORE Ordem §5.' },
    { instrument_id: 'CME_NG', display_name: 'Gas Natural (Henry Hub)', asset_class: ASSET_CLASS.ENERGY,
      exchange: 'CME', designated_contract_market: 'NYMEX', contract_code: 'NG', continuous_symbol_hint: 'NG=F',
      tick_size: 0.001, tick_value_usd: 10.0, contract_size_desc: '10.000 MMBtu',
      priority_tier: PRIORITY_TIER.A, instrument_type: TRADFI_FUTURES_INSTRUMENT_TYPE,
      notes: 'Contrato CORE Ordem §5.' },

    // ---- RATES -----------------------------------------------------------
    { instrument_id: 'CME_ZN', display_name: 'T-Note 10 anos', asset_class: ASSET_CLASS.RATES,
      exchange: 'CME', designated_contract_market: 'CBOT', contract_code: 'ZN', continuous_symbol_hint: 'ZN=F',
      tick_size: 0.015625, tick_value_usd: 15.625, contract_size_desc: '$100.000 valor de face (T-Note 10 anos)',
      priority_tier: PRIORITY_TIER.A, instrument_type: TRADFI_FUTURES_INSTRUMENT_TYPE,
      notes: 'tick = 1/64 de ponto (metade de 1/32). Contrato CORE Ordem §5.' },
    { instrument_id: 'CME_ZB', display_name: 'T-Bond 30 anos', asset_class: ASSET_CLASS.RATES,
      exchange: 'CME', designated_contract_market: 'CBOT', contract_code: 'ZB', continuous_symbol_hint: 'ZB=F',
      tick_size: 0.03125, tick_value_usd: 31.25, contract_size_desc: '$100.000 valor de face (T-Bond 30 anos)',
      priority_tier: PRIORITY_TIER.A, instrument_type: TRADFI_FUTURES_INSTRUMENT_TYPE,
      notes: 'tick = 1/32 de ponto.' },
    { instrument_id: 'CME_SR3', display_name: 'SOFR 3 Meses', asset_class: ASSET_CLASS.RATES,
      exchange: 'CME', designated_contract_market: 'CME', contract_code: 'SR3', continuous_symbol_hint: null,
      tick_size: 0.0025, tick_value_usd: 6.25, contract_size_desc: '$2.500 x (100 - taxa) por ponto de indice IMM',
      priority_tier: PRIORITY_TIER.A, instrument_type: TRADFI_FUTURES_INSTRUMENT_TYPE,
      notes: 'ESPECIFICACAO REAL DE TICK VARIA POR VENCIMENTO (nao simplificado para um numero falso-unico): ' +
        '0,0025 pontos ($6,25/tick) para contratos com ate 4 meses ate o vencimento; 0,005 pontos ($12,50/tick) ' +
        'para os demais. Valores acima sao os do contrato mais proximo. continuous_symbol_hint=null: nenhum ' +
        'conector deste catalogo ainda resolve SOFR (nao coberto pela convencao Yahoo usada em tradfi-delayed-connector.js).' },

    // ---- FX ----------------------------------------------------------
    { instrument_id: 'CME_6E', display_name: 'Euro FX', asset_class: ASSET_CLASS.FX,
      exchange: 'CME', designated_contract_market: 'CME', contract_code: '6E', continuous_symbol_hint: '6E=F',
      tick_size: 0.00005, tick_value_usd: 6.25, contract_size_desc: '€125.000',
      tradingview_symbol: 'CME:6E1!',
      priority_tier: PRIORITY_TIER.A, instrument_type: TRADFI_FUTURES_INSTRUMENT_TYPE, legacy_tradfi_asset_symbol: 'EURUSD',
      notes: 'Contrato CORE Ordem §5. Mesma convencao de cotacao do par spot EURUSD (USD por 1 EUR) — mapeamento direto, sem inversao.' },
    { instrument_id: 'CME_6J', display_name: 'Iene Japones', asset_class: ASSET_CLASS.FX,
      exchange: 'CME', designated_contract_market: 'CME', contract_code: '6J', continuous_symbol_hint: '6J=F',
      tick_size: 0.0000005, tick_value_usd: 6.25, contract_size_desc: '¥12.500.000',
      priority_tier: PRIORITY_TIER.A, instrument_type: TRADFI_FUTURES_INSTRUMENT_TYPE,
      notes: 'Contrato CORE Ordem §5.' },
    { instrument_id: 'CME_6B', display_name: 'Libra Esterlina', asset_class: ASSET_CLASS.FX,
      exchange: 'CME', designated_contract_market: 'CME', contract_code: '6B', continuous_symbol_hint: '6B=F',
      tick_size: 0.0001, tick_value_usd: 6.25, contract_size_desc: '£62.500',
      tradingview_symbol: 'CME:6B1!',
      priority_tier: PRIORITY_TIER.A, instrument_type: TRADFI_FUTURES_INSTRUMENT_TYPE, legacy_tradfi_asset_symbol: 'GBPUSD',
      notes: 'Contrato CORE Ordem §5. Mesma convencao de cotacao do par spot GBPUSD (USD por 1 GBP) — mapeamento direto, sem inversao.' },

    // ---- CRYPTO (contratos futuros DATADOS da CME — distintos do
    // perpetuo Binance BTCUSDT/ETHUSDT que ja e o nucleo do sistema desde
    // sempre. Registrados aqui por completude/rastreabilidade do universo
    // CME citado no Ordem §1, nunca como substituto ou segunda fonte do
    // pipeline cripto existente — ver nota de cada entrada.) --------------
    { instrument_id: 'CME_BTC', display_name: 'Bitcoin Futures (CME, liquidacao em USD)', asset_class: ASSET_CLASS.CRYPTO,
      exchange: 'CME', designated_contract_market: 'CME', contract_code: 'BTC', continuous_symbol_hint: null,
      tick_size: 5.0, tick_value_usd: 25.0, contract_size_desc: '5 BTC, liquidacao financeira via CME CF Bitcoin Reference Rate',
      priority_tier: PRIORITY_TIER.B, instrument_type: TRADFI_FUTURES_INSTRUMENT_TYPE,
      notes: 'Contrato futuro DATADO regulado pela CME — distinto do perpetuo BTCUSDT da Binance ja usado pelo ' +
        'Core Engine (Ordem §9: nao cria segundo cerebro, so contexto de referencia). continuous_symbol_hint=null: ' +
        'nao coberto pela convencao do conector delayed atual.' },
    { instrument_id: 'CME_MBT', display_name: 'Micro Bitcoin Futures (CME)', asset_class: ASSET_CLASS.CRYPTO,
      exchange: 'CME', designated_contract_market: 'CME', contract_code: 'MBT', continuous_symbol_hint: null,
      tick_size: 5.0, tick_value_usd: 0.5, contract_size_desc: '0,1 BTC, liquidacao financeira via CME CF Bitcoin Reference Rate',
      priority_tier: PRIORITY_TIER.C, instrument_type: TRADFI_FUTURES_INSTRUMENT_TYPE,
      notes: '1/50 do CME_BTC.' },
    { instrument_id: 'CME_ETH', display_name: 'Ether Futures (CME, liquidacao em USD)', asset_class: ASSET_CLASS.CRYPTO,
      exchange: 'CME', designated_contract_market: 'CME', contract_code: 'ETH', continuous_symbol_hint: null,
      tick_size: 0.25, tick_value_usd: 12.5, contract_size_desc: '50 ETH, liquidacao financeira via CME CF Ether-Dollar Reference Rate',
      priority_tier: PRIORITY_TIER.B, instrument_type: TRADFI_FUTURES_INSTRUMENT_TYPE,
      notes: 'Contrato futuro DATADO regulado pela CME — distinto do perpetuo ETHUSDT da Binance ja usado pelo ' +
        'Core Engine (mesma logica do CME_BTC acima).' },
    { instrument_id: 'CME_MET', display_name: 'Micro Ether Futures (CME)', asset_class: ASSET_CLASS.CRYPTO,
      exchange: 'CME', designated_contract_market: 'CME', contract_code: 'MET', continuous_symbol_hint: null,
      tick_size: 0.5, tick_value_usd: 0.05, contract_size_desc: '0,1 ETH, liquidacao financeira via CME CF Ether-Dollar Reference Rate',
      priority_tier: PRIORITY_TIER.C, instrument_type: TRADFI_FUTURES_INSTRUMENT_TYPE,
      notes: '1/500 do CME_ETH em valor nominal.' },

    // ---- EQUITY (acoes individuais a vista, NAO futuros CME) --------------
    // Pedido direto do Operador: os 5 "Big Techs" ja existentes como
    // navegacao pura em tradfi-assets.ts (TSLA/NVDA/AAPL/MSFT/META) ganham
    // aqui uma entrada real no registry, resolvendo pela MESMA ponte
    // findByLegacyTradFiAssetSymbol/mesmo conector Yahoo delayed que ja
    // serve os 9 futuros acima — zero segunda implementacao. exchange/
    // designated_contract_market sao a bolsa real de listagem (NASDAQ, nao
    // um membro do CME Group — os dois campos aqui significam "onde o
    // instrumento troca de mao", nao "bolsa do CME Group", unico jeito
    // honesto de reaproveitar a mesma forma de InstrumentDefinition sem
    // forcar uma 2a estrutura de dado so para 5 linhas). contract_code e
    // continuous_symbol_hint sao o ticker puro (convencao real da Yahoo
    // Finance para acoes: sem sufixo =F, distinto dos futuros). tick_size
    // 0.01 e o incremento minimo real de cotacao para acoes >=US$1 nos EUA
    // (Reg NMS Rule 612, "Sub-Penny Rule"); tick_value_usd = tick_size (1
    // acao = 1 unidade, sem multiplicador de contrato como nos futuros).
    //
    // AVISO REAL, nao um detalhe menor (docs/MARKET_DATA_FABRIC.md): o
    // MESMO conector Yahoo delayed usado pelos 9 futuros ja registrados tem
    // um bloqueio ESTRUTURAL de CORS documentado e pesquisado nesta sessao
    // (query1/query2.finance.yahoo.com nao envia Access-Control-Allow-
    // Origin para fetch() de origem arbitraria) — isso pode bloquear TODO
    // instrumento deste conector (futuros E as 5 acoes abaixo) mesmo com
    // rede real liberada no dispositivo do Operador, nao so no sandbox
    // desta sessao. "Cadastrado no registry" != "confirmado ao vivo": a
    // arquitetura Evidence-First (schema.js) ja classifica esse cenario
    // honestamente como BLOCKED_BY_CORS em vez de fingir sucesso ou
    // fabricar candle — mas nenhum destes 5 (nem os 9 futuros) foi
    // confirmado funcionando contra a rede real ainda.
    { instrument_id: 'NASDAQ_AAPL', display_name: 'Apple Inc.', asset_class: ASSET_CLASS.EQUITY,
      exchange: 'NASDAQ', designated_contract_market: 'NASDAQ', contract_code: 'AAPL', continuous_symbol_hint: 'AAPL',
      tick_size: 0.01, tick_value_usd: 0.01, contract_size_desc: '1 ação (instrumento à vista, não futuro)',
      tradingview_symbol: 'NASDAQ:AAPL',
      priority_tier: PRIORITY_TIER.A, instrument_type: TRADFI_EQUITY_INSTRUMENT_TYPE, legacy_tradfi_asset_symbol: 'AAPL',
      notes: 'Ação à vista, não futuro CME — ver aviso de bloqueio de CORS no cabeçalho da seção EQUITY acima.' },
    { instrument_id: 'NASDAQ_MSFT', display_name: 'Microsoft Corp.', asset_class: ASSET_CLASS.EQUITY,
      exchange: 'NASDAQ', designated_contract_market: 'NASDAQ', contract_code: 'MSFT', continuous_symbol_hint: 'MSFT',
      tick_size: 0.01, tick_value_usd: 0.01, contract_size_desc: '1 ação (instrumento à vista, não futuro)',
      tradingview_symbol: 'NASDAQ:MSFT',
      priority_tier: PRIORITY_TIER.A, instrument_type: TRADFI_EQUITY_INSTRUMENT_TYPE, legacy_tradfi_asset_symbol: 'MSFT',
      notes: 'Ação à vista, não futuro CME — ver aviso de bloqueio de CORS no cabeçalho da seção EQUITY acima.' },
    { instrument_id: 'NASDAQ_NVDA', display_name: 'Nvidia Corp.', asset_class: ASSET_CLASS.EQUITY,
      exchange: 'NASDAQ', designated_contract_market: 'NASDAQ', contract_code: 'NVDA', continuous_symbol_hint: 'NVDA',
      tick_size: 0.01, tick_value_usd: 0.01, contract_size_desc: '1 ação (instrumento à vista, não futuro)',
      tradingview_symbol: 'NASDAQ:NVDA',
      priority_tier: PRIORITY_TIER.A, instrument_type: TRADFI_EQUITY_INSTRUMENT_TYPE, legacy_tradfi_asset_symbol: 'NVDA',
      notes: 'Ação à vista, não futuro CME — ver aviso de bloqueio de CORS no cabeçalho da seção EQUITY acima.' },
    { instrument_id: 'NASDAQ_META', display_name: 'Meta Platforms Inc.', asset_class: ASSET_CLASS.EQUITY,
      exchange: 'NASDAQ', designated_contract_market: 'NASDAQ', contract_code: 'META', continuous_symbol_hint: 'META',
      tick_size: 0.01, tick_value_usd: 0.01, contract_size_desc: '1 ação (instrumento à vista, não futuro)',
      tradingview_symbol: 'NASDAQ:META',
      priority_tier: PRIORITY_TIER.A, instrument_type: TRADFI_EQUITY_INSTRUMENT_TYPE, legacy_tradfi_asset_symbol: 'META',
      notes: 'Ação à vista, não futuro CME — ver aviso de bloqueio de CORS no cabeçalho da seção EQUITY acima.' },
    { instrument_id: 'NASDAQ_TSLA', display_name: 'Tesla Inc.', asset_class: ASSET_CLASS.EQUITY,
      exchange: 'NASDAQ', designated_contract_market: 'NASDAQ', contract_code: 'TSLA', continuous_symbol_hint: 'TSLA',
      tick_size: 0.01, tick_value_usd: 0.01, contract_size_desc: '1 ação (instrumento à vista, não futuro)',
      tradingview_symbol: 'NASDAQ:TSLA',
      priority_tier: PRIORITY_TIER.A, instrument_type: TRADFI_EQUITY_INSTRUMENT_TYPE, legacy_tradfi_asset_symbol: 'TSLA',
      notes: 'Ação à vista, não futuro CME — ver aviso de bloqueio de CORS no cabeçalho da seção EQUITY acima.' },
]);

// ---------------------------------------------------------------------
// Funcoes de consulta puras — base do Instrument Discovery (Ordem §4) e
// do seletor em cascata ATIVO→CLASSE→EXCHANGE→CONTRATO→TIMEFRAME (§15).
// Nenhuma faz rede/estado; todas operam sobre INSTRUMENT_REGISTRY acima.
// ---------------------------------------------------------------------

/** Ordem estavel de exibicao (nao alfabetica) — Priority A sempre primeiro,
 *  preservando a intencao do Ordem §5 de nunca "poluir a interface". */
const TIER_ORDER = { [PRIORITY_TIER.A]: 0, [PRIORITY_TIER.B]: 1, [PRIORITY_TIER.C]: 2 };

function byTierThenName(a, b) {
    const tierDiff = TIER_ORDER[a.priority_tier] - TIER_ORDER[b.priority_tier];
    if (tierDiff !== 0) return tierDiff;
    return a.display_name.localeCompare(b.display_name);
}

export function listInstruments() {
    return [...INSTRUMENT_REGISTRY].sort(byTierThenName);
}

export function listByPriorityTier(tier) {
    return INSTRUMENT_REGISTRY.filter((i) => i.priority_tier === tier).sort(byTierThenName);
}

export function listByAssetClass(assetClass) {
    return INSTRUMENT_REGISTRY.filter((i) => i.asset_class === assetClass).sort(byTierThenName);
}

export function findByInstrumentId(instrumentId) {
    return INSTRUMENT_REGISTRY.find((i) => i.instrument_id === instrumentId) || null;
}

export function findByContractCode(contractCode) {
    return INSTRUMENT_REGISTRY.find((i) => i.contract_code === contractCode) || null;
}

/** Resolve o instrumento a partir do simbolo continuo usado pelo conector
 *  delayed (ex. 'ES=F') — usado pelo bridge dado→instrumento na exibicao. */
export function findByContinuousSymbolHint(hint) {
    if (!hint) return null;
    return INSTRUMENT_REGISTRY.find((i) => i.continuous_symbol_hint === hint) || null;
}

/** Resolve o instrumento a partir do symbol do catalogo TradFi PRE-EXISTENTE
 *  (src/omnibox/tradfi-assets.ts, ex. 'SPX') — a ponte que deixa o seletor
 *  JA usado pelo Operador (marketMode==='TRADFI') comecar a mostrar dado
 *  real sem duplicar aquele catalogo. Devolve null tanto para um symbol
 *  desconhecido quanto para um TradFiAsset real sem mapeamento seguro
 *  (ex. TSLA/GER40/UKOIL/USDJPY — ver notes de cada InstrumentDefinition
 *  mapeada para o motivo exato) — o chamador trata os dois casos do mesmo
 *  jeito honesto (TradFiEmptyState), nunca finge um dado que nao existe. */
export function findByLegacyTradFiAssetSymbol(symbol) {
    if (!symbol) return null;
    return INSTRUMENT_REGISTRY.find((i) => i.legacy_tradfi_asset_symbol === symbol) || null;
}

/** Lista de asset classes realmente presentes no catalogo, na ordem em que
 *  aparecem pela primeira vez (nunca uma lista fixa desalinhada do dado real). */
export function listAssetClasses() {
    const seen = [];
    for (const i of INSTRUMENT_REGISTRY) if (!seen.includes(i.asset_class)) seen.push(i.asset_class);
    return seen;
}

/** Lista de bolsas designadas realmente presentes no catalogo. */
export function listDesignatedContractMarkets() {
    const seen = [];
    for (const i of INSTRUMENT_REGISTRY) {
        if (!seen.includes(i.designated_contract_market)) seen.push(i.designated_contract_market);
    }
    return seen;
}

/** Arvore real para o seletor em cascata do Ordem §15
 *  (ATIVO→CLASSE→EXCHANGE→CONTRATO): { [asset_class]: { [dcm]: InstrumentDefinition[] } }.
 *  Construida a partir do mesmo INSTRUMENT_REGISTRY que os motores usam —
 *  nunca uma segunda copia do catalogo redigitada para a UI. */
export function buildCascadingSelectorTree() {
    const tree = {};
    for (const instrument of listInstruments()) {
        const { asset_class, designated_contract_market } = instrument;
        if (!tree[asset_class]) tree[asset_class] = {};
        if (!tree[asset_class][designated_contract_market]) tree[asset_class][designated_contract_market] = [];
        tree[asset_class][designated_contract_market].push(instrument);
    }
    return tree;
}
