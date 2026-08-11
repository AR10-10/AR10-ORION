# AR10 — AUDITORIA TÉCNICA COMPLETA (PREENCHIDA)

> **Origem:** formulário enviado pelo Operador (Seções A–J, ~100 itens).
> **Método:** cada célula abaixo foi preenchida a partir de `grep`/`find`/leitura
> direta do código real deste repositório, nunca por suposição ou memória.
> Onde o resultado bruto de um comando enganou (falso positivo por comentário,
> escopo de busca estreito demais, `grep` sensível a maiúsculas), o achado está
> registrado como **nota de método** em vez de virar uma linha errada da tabela.
>
> **Seções I e J ficaram em branco de propósito** — são perguntas sobre uso
> subjetivo e sobre a prioridade do Operador. Preenchê-las por conta própria
> seria inventar a resposta que o formulário existe para coletar. Ver o fim
> deste documento.

**Branch:** `claude/eloquent-cannon-qyt86y` · **Commit base:** `9e01e09`

---

## 0. COLETA — números reais medidos

| Medição | Valor real | Como foi obtido |
|---|---|---|
| Arquivos `.rs` | 1 | `find … -name "*.rs"` (só `wasm-src/cyborg_quant_core/src/lib.rs`) |
| Arquivos `.ts`/`.tsx` | 319 | `find`, excluindo `node_modules`/`dist` |
| Arquivos `.js`/`.jsx` | 71 | idem |
| Arquivos de teste | 175 | `ramber-ui/tests/` |
| Testes Rust | **16/16 passando** | `cargo test` executado de verdade |
| Testes JS/TS | **2816/2816 passando** | `vitest run` (175 arquivos) |
| Build de produção | 983.93 kB | `vite build` |
| Chamadas `console.*` em `ramber-ui/src` | **0** | `grep -rn "console\." --include="*.ts" --include="*.tsx"` |
| Ocorrências de `DADOS_INSUFICIENTES` | 114 | medida real do alcance do fail-closed |
| Camadas reais do gráfico (`CHART_LAYER_IDS`) | 24 | `EnhancedChart_110_Percent.tsx:248-304` |

---

## SEÇÃO A — ARQUITETURA & ESTRUTURA

| # | Item | Status | Arquivo/Local | Observações |
|---|------|--------|---------------|-------------|
| A1 | Monorepo (Rust + TS juntos)? | `[x]` EXISTS | `ipad_runtime/wasm-src/cyborg_quant_core/` (Rust) + `ipad_runtime/ramber-ui/` (TS) | Convivem no mesmo repo, mas **não** via ferramenta de monorepo: zero `workspaces` no `package.json`, zero `pnpm-workspace.yaml`/`turbo.json`/`nx.json`/`lerna.json`. São dois projetos independentes lado a lado, ligados só pelo binário `.wasm` compilado. |
| A2 | `Cargo.toml` com workspace? | `[x]` MISSING | `wasm-src/cyborg_quant_core/Cargo.toml` | Confirmado: só `[package]`, nenhum `[workspace]`. Crate único e standalone (`crate-type = ["cdylib"]`, `opt-level="z"`, `lto`, `panic=abort`). **Não é defeito** — com 1 crate, um workspace não acrescentaria nada. |
| A3 | `package.json` com build/test/dev? | `[x]` EXISTS | `ramber-ui/package.json` | `dev`, `build`, `preview`, `test`, `test:watch`. ramber-ui v15.0.0. |
| A4 | `tsconfig.json` configurado? | `[x]` EXISTS | `ramber-ui/tsconfig.json` | Único no repo. TypeScript `~5.8.2`. |
| A5 | Bundler? Qual? | `[x]` EXISTS | `ramber-ui/vite.config.ts` | **Vite `^6.4.3`** + Vitest `^4.1.9`. |
| A6 | Separação UI (React) ↔ motores (Rust/WASM)? | `[x]` EXISTS | `engine-bridge.ts`, `nexus/ema.ts`, `llm-bridge.ts` | 26 funções exportadas do `lib.rs`. A fronteira é explícita e estreita: React nunca fala com o `.wasm` direto, sempre pelo bridge. |
| A7 | Event Bus / pub-sub UI ↔ Engine? | `[x]` EXISTS | `src/market-data-bus/bus.js:124` | `subscribe(symbol, timeframe, callback)` devolve unsubscribe; `entry.subscribers.forEach` na notificação. Fonte canônica única por `symbol:timeframe`. Há também `event-bus.ts` (`ORGANISM.TRACK_RECORD.UPDATED`). |
| A8 | Camada de normalização (schema único de candle)? | `[x]` EXISTS | `src/market-data-bus/normalizer.js:16` | `normalizeCandles()` → forma canônica `{t,o,h,l,c,v}`. Função pura; linha malformada é **descartada**, nunca preenchida com valor inventado (Regra de Ouro 1/3). |
| A9 | Error Boundary no React? | `[x]` EXISTS *(parcial)* | `App.tsx:7162` `WidgetErrorBoundary` | **Ressalva honesta:** é por-widget (`getDerivedStateFromError`), aplicado em `App.tsx:7291` e `7353`. **Não existe boundary global na raiz** — `main.tsx:28` monta `<App />` sem envolvê-lo. Um erro fora de um Widget derruba a tela inteira. Gap real. |
| A10 | Logging estruturado (não só `console.log`)? | `[x]` EXISTS | `market-data-bus/pipeline-telemetry.js:36` (`class PipelineTelemetry`, `PIPELINE_STAGES`), `nexus/self-diagnostics.ts`, `nexus/organism-health.ts`, `nexus/health-monitor.ts` | Evidência forte: **zero `console.*` em todo `ramber-ui/src`**. Não é "estruturado além do console" — é estruturado *no lugar* do console. |

---

## SEÇÃO B — VISUAL & UI (Canvas)

| # | Item | Status | Arquivo/Local | Observações |
|---|------|--------|---------------|-------------|
| B1 | Header fixo 48px com badges de regime? | `[x]` MISSING *(a medida)* | `App.tsx:6529` `TopBar` | Os **badges de regime existem** (`REGIME_DISPLAY`, `App.tsx:4693/5039/6306`, fonte única `regime-engine.js`). O que não existe é o header com altura fixa de 48px do mockup. Pendência #290. |
| B2 | Toolbar lateral 36px, só ícones? | `[x]` MISSING *(a medida)* | `App.tsx:6995` `SideBar` | Existe e é só ícones, mas com `w-12 md:w-14` (**48px / 56px**), não 36px. Pendência #290. |
| B3 | Painel direito 280px com Layer Manager? | `[x]` MISSING | `App.tsx:4034` `ChartLayersPanel` | O Layer Manager existe e é completo, mas como **painel flutuante** (`if (!chartLayersOpen) return null`), não como trilho direito fixo. Pendência #290/#288. |
| B4 | Tags toggleáveis no Layer Manager? | `[x]` EXISTS | `App.tsx:778` `toggleChartLayer`, `App.tsx:3982` `CHART_LAYER_PANEL_MODULES` (24 entradas) | Modelo de 3 estados real (`auto` / `forced_on` / `forced_off`) + Relevance Engine. Mais rico que o "liga/desliga" do formulário. Falta só migrar para o painel direito (#288). |
| B5 | Grid quase invisível? | `[x]` EXISTS | `EnhancedChart_110_Percent.tsx` | `vertLines: rgba(255,255,255,0.02)`, `horzLines: rgba(255,255,255,0.03)`. Aplicado nesta rodada (commit `ab621f2`). |
| B6 | Labels de preço 9px #888 sem fundo/badge? | `[x]` EXISTS *(por tier)* | `PriceLabelStackPlugin.tsx` | `FONT_COMPACT = "500 9px …"`, `LABEL_NEUTRAL_COLOR = "#888"`. Tiers `primary`/`context` desenham **texto puro sem caixa**; `live`/`critical` mantêm caixa sólida **de propósito** (preço atual e Entry/Stop/Target ativos são a âncora de leitura). `MAX_CONTEXT_LABELS = 3`. |
| B7 | Labels de tempo 9px #888 sem sobreposição? | `[x]` EXISTS | `EnhancedChart_110_Percent.tsx:839` `timeScale` | `layout.textColor: "#888888"`, `fontSize: 9` (era `#8ab4f8`/10). Anti-sobreposição no eixo de tempo é nativa da lightweight-charts. |
| B8 | Candles `#10B981`/`#EF4444`? | `[x]` MISSING | `EnhancedChart_110_Percent.tsx:866-870` | Valores reais: `upColor: "#00ffaa"`, `downColor: "#ff0055"` (idem wicks). **Conflito aberto e não resolvido:** o mockup pede `#22c55e`, a especificação técnica pede `#10B981`. Não mudei porque as duas fontes do próprio Operador se contradizem — ver "Decisão pendente" no fim. |
| B9 | BOS/CHoCH como triângulo ≤8px sem texto no canvas? | `[x]` EXISTS | `StructureBreakMarkersPlugin.tsx:111-125` | `ARROW_HALF_SIZE = 4` → triângulo de exatamente 8px. O texto "BOS"/"CHOCH" **já foi migrado** para `priceAxisLabels` (achado de captura real do Operador: "CHOC" colidia com a caixa "EMA 21"). Nada de texto solto no canvas aqui. |
| B10 | Liquidity Zone = banda âmbar semi-transparente? | `[x]` MISSING *(a cor)* | `LiquidityZonesPlugin.tsx:72-103` | A **banda preenchida semi-transparente existe** (fill 0.10–0.15, borda 0.30–0.85). A cor não é âmbar: é verde/vermelho por direção (`rgba(0,255,170,…)` / `rgba(255,0,85,…)`) + ciano/magenta para voids. O âmbar `#f59e0b` foi aplicado nesta rodada só a **S1/R1 e EQH/EQL** — manter FVG/OB em verde/vermelho foi decisão explícita sua (pedido V18.2, reconfirmado por `AskUserQuestion`). |
| B11 | Trade Plan com linhas **tracejadas** + R:R 7px sem caixa? | `[x]` **CONFLITA COM A LEI** | `EnhancedChart_110_Percent.tsx` (todos `lineStyle: LineStyle.Solid`) | **Não implementado de propósito.** Regra de Ouro 5 ("Fio de Seda") proíbe tracejado: *toda* linha de marcação é 1px sólida, zero exceção. Varredura global confirma: o único `setLineDash` do código-fonte inteiro é `ctx.setLineDash([])` em `publication/canvas-primitives.ts:38` — que **reseta para sólido**. Todas as outras 15 ocorrências são comentários dizendo "nunca setLineDash". Preciso da sua decisão explícita para mudar isso — ver "Decisão pendente". |
| B12 | Paleta restrita a 6 cores no canvas? | `[x]` MISSING | contagem real em `chart/*.tsx` | **25+ cores distintas medidas.** Top: `rgb(0,255,170)`×29, `rgb(255,0,85)`×25, `rgb(138,180,248)`×8, `rgb(255,255,255)`×7, `rgb(240,208,111)`×7, `rgb(148,163,184)`×7, `rgb(0,240,255)`×6, `rgb(245,158,11)`×5, `rgb(255,60,172)`×4, `rgb(0,200,255)`×4, `rgb(255,176,32)`×3, `rgb(255,140,0)`×3, `rgb(176,38,255)`×3… Este é o número duro que justifica a pendência #286. |
| B13 | Status bar 20px no rodapé? | `[x]` MISSING | — | Existe `TERMINAL READ-ONLY` em `App.tsx:10796`, mas não como barra de status dedicada de 20px. Pendência #290. |
| B14 | Tema escuro/claro funcional? | `[x]` MISSING | `index.css:6` `@theme` | **Só escuro.** Zero `prefers-color-scheme`, zero `data-theme`, zero alternador. Nunca foi pedido; registro como gap factual, não como defeito. |
| B15 | Crosshair funcional? | `[x]` EXISTS | `EnhancedChart_110_Percent.tsx:837` | `crosshair: { mode: CrosshairMode.Magnet }` — gruda no close do candle. |
| B16 | Tooltip ao hover em candles/eventos? | `[x]` MISSING | — | **Zero `subscribeCrosshairMove` no código.** O `OhlcReadout` mostra o **último** candle, não o candle sob o cursor. Gap real e concreto. |
| B17 | Zoom/pan sem lag no iPad? | `[x]` EXISTS | `EnhancedChart_110_Percent.tsx:849-851` | `handleScroll` (arrastar, mouse+touch) e `handleScale` (roda + pinça) **nativos da lightweight-charts**, nunca reimplementados à mão. "Sem lag no iPad" é medição de dispositivo real — só você pode confirmar (Seção I). |
| B18 | Sub-header OHLCV existe ou foi removido? | `[x]` EXISTS | `App.tsx:7989` `OhlcReadout`, montado em `8427` | Existe **dentro do header single-line**, não como segunda linha. Ganhou Volume + cor por campo nesta rodada (commit `652e4d7`). O `volume` é unidade de **ativo-base**, nunca nocional em USD — rotular `$V` seria afirmação falsa sobre o dado. |

---

## SEÇÃO C — INDICADORES & MOTORES DE CÁLCULO

| # | Item | Status | Arquivo/Local | Observações |
|---|------|--------|---------------|-------------|
| C1 | EMA (9/21/50) em Rust/WASM? | `[x]` EXISTS | `nexus/ema.ts` → `lib.rs` | Cálculo no WASM Quant Core. |
| C2 | VWAP em Rust/WASM? | `[x]` EXISTS | `nexus/vwap-bands.ts` | Consumido por `council.ts`, `institutional-zones.ts`. |
| C3 | VWAP Bands (±1σ, ±2σ)? | `[x]` EXISTS | `nexus/vwap-bands.ts` | Motor puro + plugin de canvas + toggle (entrega Tier 1). |
| C4 | Volume Profile (POC, VA, IB, single prints)? | `[x]` EXISTS | `nexus/volume-profile.ts`, `chart/VolumeProfilePlugin.tsx` | Histograma pesado vem do WASM. HVN/LVN por **percentil real** da amostra, nunca limiar fixo. **Escopo declarado no próprio arquivo:** é aproximação OHLCV (volume do candle distribuído por `[low,high]`), nunca apresentada como perfil tick-level. |
| C5 | TPO / Market Profile? | `[x]` EXISTS | `nexus/tpo-profile.ts`, `chart/TpoProfilePlugin.tsx` | Entrega 41. POC/VA/IB por contagem de período (Steidlmayer/CBOT). |
| C6 | Footprint (volume-por-preço-por-candle)? | `[x]` **RECUSADO (documentado)** | `nexus/volume-profile.ts:20-36` | **Não é um gap esquecido — é uma recusa registrada.** Footprint real exige tick/trade stream do **próprio** mercado do candle. Binance Futures aqui só dá klines/liquidations/premium-index — nenhum trade-a-trade. O único tick real disponível é MEXC **Spot**, outro mercado. Bucketar ticks de um mercado dentro de candles de outro violaria a Regra de Ouro 1 mais diretamente que a aproximação OHLCV do C4. Registrado em `SYSTEM_HANDBOOK.md §6.92`. |
| C7 | Order Book Depth L2 / DOM? | `[x]` EXISTS | `nexus/order-book-depth.ts`, `chart/DepthChartPlugin.tsx` | Entrega 40. Mesmo `orderBook` do `OrderBookWidget`, zero segundo fetch. |
| C8 | Liquidity Sweep / Stop Hunt? | `[x]` EXISTS | `nexus/trap-detection.ts`, camada `liquidity_sweep` | **Nota de método:** o `grep` inicial trouxe `supertrend-engine.js` — falso positivo, era um comentário meu citando sweep. Confirmado no `CHART_LAYER_IDS`. |
| C9 | BOS/CHoCH? | `[x]` EXISTS | `src/research/engines/bos-choch-engine.js` | Camada `structure_breaks` + `StructureBreakMarkersPlugin`. |
| C10 | Fair Value Gap (FVG)? | `[x]` EXISTS | `src/research/engines/fvg-order-block-engine.js` | Camada `liquidity_zones`. |
| C11 | Order Blocks? | `[x]` EXISTS | idem C10 | Mesmo motor, empacotado na mesma camada (confirmado na entrega v16.0 PRO MAX §4). |
| C12 | Multi-Timeframe Confluence? | `[x]` EXISTS | `nexus/multi-timeframe-engine.ts`, `nexus/confluence-engine.ts` | Massa de opinião de pool linear (Stone 1961/DeGroot 1974) — **nunca** probabilidade calibrada. |
| C13 | Regime detection? | `[x]` EXISTS | `src/market-regime/regime-engine.js` + `regime-history.js` | ADX/DI + largura de banda. **Nota de método:** meu primeiro `find` falhou por procurar em `research/engines/` — o motor vive em `src/market-regime/`. Existe também `research/engines/hmm-regime-model.js` (Laboratório, pendência #281). |
| C14 | S1/R1, EQH/EQL? | `[x]` EXISTS | `src/research/engines/fvg-order-block-engine.js`, camada `equal_highs_lows` | Ambos rotulados no eixo; âmbar aplicado nesta rodada. |
| C15 | Institutional Zones (confluência multi-ferramenta)? | `[x]` EXISTS | `nexus/institutional-zones.ts`, `chart/InstitutionalZonePlugin.tsx` | Funde EMA/VWAP/Nexus Line/FVG/OB/EQH-EQL na mesma faixa de preço. Nunca substitui o desenho individual. |
| C16 | SuperTrend? | `[x]` EXISTS *(Laboratório)* | `src/research/engines/supertrend-engine.js` | **Construído nesta rodada** — era o único gap genuíno do documento de pesquisa. Ainda **não graduado**: `status: 'LABORATORIO'`, zero ligação com App.tsx/Core Engine (prova: build ficou em 983.93 kB, inalterado). 18 testes de execução real. |
| C17 | ATR? | `[x]` EXISTS | `research/engines/lorentzian-classifier.js:196` `computeAtrPercent` | ATR de Wilder. **Nota de método:** apareceu como MISSING numa varredura anterior porque eu tinha limitado o escopo a `ramber-ui/src`; corrigido ao ampliar. O SuperTrend **reusa** esta função (recuperação exata via `atr = (atrPct/100)*close`), zero segunda suavização de Wilder. |
| C18 | RSI ou oscilador de momentum? | `[x]` EXISTS | `research/engines/lorentzian-classifier.js:277` `computeRSI` | **Nota de método:** meu `grep` por `computeRsi` (minúsculo) devolveu vazio; o nome real é `computeRSI`. Falso MISSING corrigido. |
| C19 | MACD? | `[x]` EXISTS | `nexus/macd.ts` | Graduado como Row no painel MARKET REGIME. |
| C20 | Delta / Cumulative Delta (CVD)? | `[x]` EXISTS | `nexus/market-analysis.ts`, camada `cvd` | Já existia há entregas — era um dos "gaps críticos" errados do documento de pesquisa. |
| C21 | Absorption? | `[x]` EXISTS | `src/orderflow/signal-engine.js` | **Nota de método:** uma varredura anterior apontou `supertrend-engine.js` — falso positivo, meu próprio comentário citando o caminho. |
| C22 | Session detection (Asian/London/NY)? | `[x]` EXISTS | `nexus/market-session.ts`, `chart/MarketSessionBandsPlugin.tsx` | Mais 2 camadas relacionadas: `kill_zones` (ICT, conceito distinto) e `session_key_levels`. |

---

## SEÇÃO D — DADOS & FONTE

| # | Item | Status | Arquivo/Local | Observações |
|---|------|--------|---------------|-------------|
| D1 | Replay sintético? | `[x]` EXISTS | `src/replay/replay-engine.js` | "Sintético" aqui = re-execução de histórico **real** já capturado, nunca dado fabricado (Regra de Ouro 1). |
| D2 | Importação de CSV/JSON histórico? | `[x]` **MISSING** | — | Zero `FileReader`, zero `input type="file"`, zero parser de CSV no código. Gap real. |
| D3 | Playback control (play/pause/step/speed)? | `[x]` **MISSING** | — | Zero `isPlaying`/`playbackSpeed`/`stepForward`. O replay-engine existe, mas sem controle de transporte na UI. Gap real. |
| D4 | Dados reais via API? | `[x]` EXISTS | `market-data-bus/binance-futures-candle-connector.js` + `mexc-futures-candle-connector.js` | Binance primária; **MEXC já totalmente conectada** (18 módulos) — cross-check com Bybit/OKX. |
| D5 | WebSocket tempo real? | `[x]` EXISTS | `nexus/connection-manager.ts`, `nexus/cross-exchange-service.ts` | Só streams **públicos** de mercado. Nenhum de execução (ver H3). |
| D6 | Cache local (IndexedDB/localStorage)? | `[x]` EXISTS | `nexus/persistence.ts` (`idb`) | Local-First (Regra de Ouro 8). |
| D7 | Schema de candle normalizado? | `[x]` EXISTS | `market-data-bus/normalizer.js` | Ver A8. `{t,o,h,l,c,v}` para todos os motores. |
| D8 | Validação antes de injetar nos motores? | `[x]` EXISTS | `market-data-bus/integrity-validator.js`, `quality-engine.js`, `quality-monitor.js`, `time-synchronizer.js` | Divisão explícita: `normalizer` descarta linha malformada; `integrity-validator` rejeita a **série inteira**. |
| D9 | Múltiplos timeframes? | `[x]` EXISTS | `market-data-bus/bus.js` (chave `symbol:timeframe`) | Paginação histórica **nunca** passa pelo Bus (corromperia o snapshot canônico) — chama o conector direto, sem cache. |
| D10 | Múltiplos ativos/símbolos? | `[x]` EXISTS | `market-data-bus/instrument-registry.js` + `ASSETS` | Cripto USDT-M + TradFi atrasado + DefiLlama on-chain. |

---

## SEÇÃO E — PAPER TRADING & GESTÃO

| # | Item | Status | Arquivo/Local | Observações |
|---|------|--------|---------------|-------------|
| E1 | Paper Trading manual? | `[x]` EXISTS | `nexus/paper-trading.ts` | Painel de anotação manual. |
| E2 | Paper Trading automatizado? | `[x]` MISSING *(por decisão sua)* | — | Não construído deliberadamente: você escolheu "manual, sem automação" (v16.0 PRO MAX §9.1/9.4). Registro como decisão, não como falha. |
| E3 | Trade Plan (entrada/stop/alvo/R:R)? | `[x]` EXISTS | `nexus/trade-plan.ts` | Com reavaliação viva de TP2/TP3 que preserva progresso já provado. |
| E4 | Estatísticas (win rate, R:R, expectancy, max DD)? | `[x]` EXISTS *(parcial)* | `nexus/expectancy.ts`, `nexus/trade-simulation.ts` | **Existem de verdade:** expectancy em R-múltiplo líquido (após comissão+slippage+funding reais), win rate real, amostra mínima de 30 trades. **Não localizei Max Drawdown nem Sharpe** como métricas computadas — se você os quer, são construção nova. |
| E5 | Exportação de trades para CSV? | `[x]` **MISSING** | — | Zero `toCsv`/`text/csv`. Gap real. |
| E6 | Journal de trades (notas)? | `[x]` **MISSING** | — | Zero `journal`/`tradeNote`. Gap real. |
| E7 | Position sizing calculator? | `[x]` EXISTS | `src/risk/risk-engine.js` | Usa taxa de acerto **real** (`computeExpectancy`, ≥30 trades) + `kelly_fraction()` em Rust/WASM (Entrega 44). |
| E8 | Risk calculator (max loss/trade, max daily)? | `[x]` EXISTS *(parcial)* | `src/risk/risk-engine.js` | Risco por trade sim. **Limite de perda diária agregada não localizei** — gap real se você quiser. |

---

## SEÇÃO F — ALERTAS & NOTIFICAÇÕES

> **Correção de uma varredura minha anterior.** Numa passada rápida eu havia
> concluído "F2 faltando, resto existe". Ao ler o motor de verdade, isso estava
> **errado e generoso demais**. `deriveTrackRecordAlert` é o **único** produtor
> de `AlertEvent` em todo o código (verificado: nenhum outro arquivo além de
> `App.tsx` sequer importa o tipo). Ele dispara só na resolução de um plano
> rastreado. A tabela abaixo é o estado real.

| # | Item | Status | Arquivo/Local | Observações |
|---|------|--------|---------------|-------------|
| F1 | Alertas visuais? | `[x]` EXISTS *(toast, não canvas)* | `App.tsx:4979` `AlertToastStack` | Toast sobreposto com 3 tons (`success`/`info`/`danger`). **Não** é flash/borda no canvas. |
| F2 | Alertas sonoros? | `[x]` **MISSING** | — | Zero `new Audio`/`AudioContext`. |
| F3 | Alerta ao cruzar VWAP? | `[x]` **MISSING** | — | Nenhum produtor de alerta observa VWAP. |
| F4 | Alerta ao tocar POC? | `[x]` **MISSING** | — | idem. |
| F5 | Alerta em Liquidity Sweep? | `[x]` **MISSING** | — | idem — o sweep é detectado e desenhado, mas nunca alerta. |
| F6 | Alerta em BOS/CHoCH? | `[x]` **MISSING** | — | idem. |
| F7 | Alerta ao atingir nível do Trade Plan? | `[x]` EXISTS | `nexus/alert-center.ts:49` | **É o único que existe.** Compara a última entrada do Track Record por identidade de referência. `REPLACED` nunca gera alerta (é leitura consultiva substituída, não resultado real). |
| F8 | Cooldown anti-spam? | `[x]` MISSING *(mas há dedupe)* | `nexus/alert-center.ts:33-48` | Não há cooldown temporal. Há **deduplicação por identidade da última entrada** — deliberadamente não por `history.length`, que é ring-capped e pararia de crescer. Resolve repetição, não rajada. |
| F9 | Log/histórico de alertas? | `[x]` **MISSING** | `App.tsx:765` `useState<AlertEvent[]>` | A lista de alertas é estado transitório de toast, descartado ao dispensar. O `record.history` é o Track Record (fonte), não um log de alertas. |

**Leitura honesta da Seção F:** o Alert Center foi entregue como "primeiro assinante real do barramento" — uma fatia estreita e declarada como tal no próprio cabeçalho do arquivo. F3–F6 exigiriam dar publicador real no bus a sinais que hoje são computados por render. É trabalho de arquitetura, não fiação.

---

## SEÇÃO G — PERFORMANCE & ESTABILIDADE

| # | Item | Status | Arquivo/Local | Observações |
|---|------|--------|---------------|-------------|
| G1 | Canvas 2D (não SVG)? | `[x]` EXISTS | 16 plugins em `chart/*.tsx` | Cada um com `<canvas>` próprio, DPR-aware. Zero SVG no gráfico. |
| G2 | Workers para cálculo pesado? | `[x]` EXISTS | `workers/conviction-cyclone-worker.ts`, `workers/orderflow-heatmap-worker.ts`, `llm-worker.ts`, quant-worker (WASM) | Regra de Ouro 6. **Ressalva registrada:** o ciclo do Core Engine ainda roda no main thread — mover exige iniciativa isolada, nunca junto de outra coisa. |
| G3 | Decimation adaptativa por FPS? | `[x]` **MISSING** | — | Gap real. |
| G4 | Dirty-region rendering? | `[x]` EXISTS | `markDirty` em todos os plugins de `chart/` | rAF-throttled + `subscribeVisibleLogicalRangeChange` + `ResizeObserver` + cache por referência de objeto. |
| G5 | Layer culling? | `[x]` EXISTS | `EnhancedChart_110_Percent.tsx:464/640/644` | `layerVisibility` monta condicionalmente — camada desligada não renderiza. |
| G6 | Anti-sobreposição visual? | `[x]` EXISTS | `chart/price-label-stack.ts` + `chart/PriceLabelStackPlugin.tsx` | Resolvedor de colisão com 4 tiers: `live` > `critical` > `primary` > `context` (só `context` sofre poda). Mais `nexus/visual-budget.ts` para competição cruzada entre categorias. |
| G7 | FPS monitor? | `[x]` EXISTS | `nexus/health-monitor.ts`, `nexus/organism-health.ts`, `nexus/self-diagnostics.ts` | Relatório real sob demanda, não loop autônomo. |
| G8 | State Persistence (sobrevive F5)? | `[x]` EXISTS | `nexus/persistence.ts` | IndexedDB via `idb`. |
| G9 | Memoization? | `[x]` EXISTS | `useMemo` em App.tsx + cache-por-referência nos plugins | |
| G10 | Lazy loading de plugins/camadas? | `[x]` **MISSING** | — | Todos os plugins entram no bundle. Ligado ao bundle de 983.93 kB. Gap real. |
| G11 | Graceful degradation? | `[x]` EXISTS | 114 ocorrências de `DADOS_INSUFICIENTES` | Fail-closed em toda parte + `WidgetErrorBoundary` isola widget quebrado. **Ressalva:** sem boundary global (ver A9). |
| G12 | Testes unitários Rust? | `[x]` EXISTS | `cargo test` | **16/16 passando, executado de verdade.** |
| G13 | Testes de componentes React? | `[x]` EXISTS | `ramber-ui/tests/` (175 arquivos) | Convenção mista deliberada: lógica pura → **execução real**; fiação entre módulos → **padrão no código-fonte** (`readFileSync` + regex). |
| G14 | Testes de integração (UI + Engine)? | `[x]` EXISTS | testes de fiação + Playwright | |
| G15 | Testes de performance (FPS/memória)? | `[x]` MISSING *(automatizado)* | `scratchpad/perf-check*.mjs` | Existem **medições ad-hoc** por Playwright, não suíte versionada. Gap real. |

---

## SEÇÃO H — SEGURANÇA & REGRAS DE PROJETO

| # | Item | Status | Arquivo/Local | Observações |
|---|------|--------|---------------|-------------|
| H1 | LEI 1 (READ_ONLY) — zero execução de ordens? | `[x]` **EXISTS — verificado exaustivamente** | varredura global | Ver bloco de evidência abaixo. |
| H2 | Zero API keys de exchange? | `[x]` EXISTS | varredura global | Zero `X-MBX-APIKEY`, `apiSecret`, `secretKey`, `privateKey` no código-fonte. |
| H3 | Zero WebSocket de execução? | `[x]` EXISTS | `connection-manager.ts`, `cross-exchange-service.ts` | Só streams públicos de mercado. Execução exigiria endpoint autenticado — que não existe (H1). |
| H4 | LEI 24 — sem segundo cérebro de decisão? | `[x]` EXISTS *(com 1 exceção registrada)* | `CLAUDE.md` §LEI 24 | Core Engine é o único emissor de LONG/SHORT/WAIT; todas as 24 camadas são display-only. **Exceção única e escopada** (Entrega 42, autorizada por você via `AskUserQuestion`): `evaluateSignalFilter()` suprime a **exibição** no `CoreSignalBadge` quando a expectativa líquida real é negativa com ≥30 trades. `engine.direction` nunca é mutado; a razão fica sempre visível, nunca só no tooltip. |
| H5 | CLAUDE.md com regras? | `[x]` EXISTS | `CLAUDE.md` | Mais os 3 protocolos em `docs/`. |
| H6 | README atualizado? | `[x]` EXISTS | `README.md` | Inclui seção "O que continua bloqueado". |
| H7 | CHANGELOG / histórico de entregas? | `[x]` EXISTS *(forma diferente)* | `docs/SYSTEM_HANDBOOK.md` (**6953 linhas**) + ~40 `RELATORIO_*.md` + histórico de commits/PR | Não há arquivo chamado `CHANGELOG.md`. O papel é cumprido pelo SYSTEM_HANDBOOK numerado por §. |

### H1 — evidência direta (o item mais sensível do formulário)

Uma varredura anterior marcou este item como `ENCONTRADO(!)`, o que teria sido
gravíssimo. **Era falso positivo.** Resolvido com evidência, não por inferência:

1. **Símbolos de execução** (`order_send|placeOrder|createOrder|newOrder|submitOrder|sendOrder|executeOrder`) em todo o código-fonte → **2 ocorrências, ambas em testes**, e ambas asseverando o *oposto*:
   `tests/liquidity-void-engine.test.ts:156` e `tests/ciborgue-vivo-wiring.test.ts:20` verificam que `QUARANTINE.md` contém a frase *"Zero `fetch()` novo, zero credencial, zero `order_send`."* São **testes-guarda da proibição**.
2. **Endpoints privados** (`fapi/v*/order|position|account|leverage|marginType`, `api/v3/order|account|myTrades`) → **zero**.
3. **Assinatura HMAC** (obrigatória para qualquer chamada privada de exchange) → **zero no código**. A única menção é `gmil/README.md:113`, que documenta a **recusa explícita** de construí-la: *"HMAC é exatamente o mecanismo usado para autenticar chamadas privadas de API de exchange. Construir essa infraestrutura criaria o caminho técnico para credenciais/execução real — o que este projeto proíbe permanentemente, por design, desde a raiz. Não implementado."*
4. **Qualquer método HTTP não-GET** (`POST`/`PUT`/`DELETE`/`PATCH`) no código-fonte → **zero**.

O texto que disparou o alarme era o próprio aviso em `App.tsx:7941`: *"ORDER EXECUTION IS PERMANENTLY DISABLED… no order-routing code paths exist in this codebase."*

**Conclusão:** não existe caminho técnico de execução de ordem. Não é uma trava
que possa ser destravada por configuração — a infraestrutura necessária nunca
foi construída, e sua ausência é testada.

---

## SEÇÕES I e J — deixadas em branco de propósito

O formulário pede, na Seção I, o que quebra com frequência, o que trava, do que
o usuário mais reclama, qual a maior dor no iPad, qual feature é mais e menos
usada. Na Seção J, pede a **ordenação das suas prioridades** de 1 a 10.

Nada disso está no código. São observações de uso real e julgamento seu.
Preenchê-las por dedução produziria exatamente o tipo de número inventado que
sua instrução proíbe — e pior, num documento cujo propósito declarado é
*"identificar gaps reais (não inventados)"*. Ficam em branco para você.

Um único item da Seção I eu **posso** responder com dado real, e respondo:

**I.8 — bugs conhecidos não resolvidos.** Zero bugs abertos conhecidos: `tsc`
limpo, 2816/2816 vitest, 16/16 cargo. O que existe é **pendência declarada**,
não bug:

1. Sem Error Boundary global na raiz (A9) — erro fora de um Widget derruba a tela.
2. Sem tooltip de hover no candle (B16).
3. 25+ cores no canvas contra as 6 pedidas (B12, pendência #286).
4. Shell de layout do mockup não implementado — header 48px / toolbar 36px / painel direito / status bar (B1/B2/B3/B13, pendência #290).
5. Alertas cobrem só resolução de Trade Plan; VWAP/POC/Sweep/BOS não alertam (F3–F6).
6. Core Engine ainda no main thread (G2) — mudança que exige iniciativa isolada.

---

## Duas decisões que dependem de você (não decidi sozinho)

**1. Cor dos candles (B8).** Suas duas fontes se contradizem: o mockup HTML diz
`#22c55e`, a especificação técnica diz `#10B981`. O código está em `#00ffaa`.
Não escolhi por você — me diga qual vale.

**2. Trade Plan tracejado (B11).** A especificação pede linha tracejada. A Regra
de Ouro 5 ("Fio de Seda") proíbe tracejado em **toda** linha de marcação, "zero
exceção", e o código inteiro é coerente com isso hoje. Não vou quebrar uma regra
permanente por um item de formulário — se você quer mesmo mudar a lei, diga
explicitamente e eu mudo a lei e o código juntos, registrando em `CLAUDE.md`.

---

## Nota de método — 5 falsos resultados que peguei e corrigi

Registro porque o valor deste documento depende de o método ser auditável:

| Item | Resultado bruto errado | Causa | Como confirmei |
|---|---|---|---|
| H1 | `ENCONTRADO(!)` execução de ordens | texto de aviso + testes-guarda | 4 varreduras independentes (endpoint/HMAC/verbo HTTP/símbolo) |
| C17 ATR | MISSING | escopo do `grep` limitado a `ramber-ui/src` | ampliado para `ipad_runtime/src` |
| C18 RSI | MISSING | procurei `computeRsi`, o nome real é `computeRSI` | busca por conceito |
| C13 Regime | MISSING | procurei em `research/engines/`, vive em `src/market-regime/` | `find` por nome |
| Seção F | "só F2 falta" | li o nome do arquivo, não o motor | leitura do único produtor de `AlertEvent` |

O padrão: **`grep` vazio não é prova de ausência.** Cada MISSING desta tabela
foi confirmado por busca conceitual, não só por nome de símbolo.
