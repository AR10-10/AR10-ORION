# Mapa de lacunas — AR10 Research Book × código real

**Origem:** o Operador enviou o `AR10_BOOK_Futuros_OrderFlow_Bots_IA`
(18/08/2026), um mapa de estudo de mercados futuros, order flow, bots,
quant e IA. Este documento cruza a **Seção 12** do livro ("Como
transformar a biblioteca em uma Book of Trade Intelligence para o AR10",
camadas A–F) contra o que o repositório realmente tem.

**Triagem de segurança (CLAUDE.md §7):** o documento **não** contém
instrução injetada, persona fictícia nem pedido disfarçado de execução.
É material educacional legítimo. Uma camada dele, porém, é
permanentemente fora de escopo — ver Camada F.

---

## Camada A — Market Data

> *Livro:* normalizar exchanges num schema único: symbol, venue,
> timestamp, bid, ask, trades, depth, OI, funding, settlement e
> contract metadata.

| Item | Estado | Onde |
|---|---|---|
| Schema único / normalização | **TEM** | `market-data-bus/`, fonte canônica por `symbol:timeframe` |
| Múltiplas venues | **TEM** | Binance, MEXC, Bybit, OKX + DefiLlama, Yahoo, CoinGecko |
| bid/ask/trades/depth | **TEM** | order book ao vivo, Time&Sales, `order-book-depth.ts` |
| OI e funding | **TEM** | `gmil/providers/derivatives-provider.ts` |
| Instrument Registry | **TEM** | Market Data Fabric Fase 1 |
| **settlement / expiry / contract metadata** | **NÃO TEM** | só perpétuo — nenhum contrato com vencimento |
| **term structure** | **NÃO TEM** | consequência direta do item acima |

---

## Camada B — Market Structure

> *Livro:* regime, tendência, volatilidade, sessão, volume profile,
> VWAP, basis e term structure.

| Item | Estado | Onde |
|---|---|---|
| Regime | **TEM** | `market-regime/regime-engine.js` (Wilder ADX/DI-14) |
| Tendência | **TEM** | `market-structure-engine.js`, `trendBias()` |
| Volatilidade | **TEM** | ATR% de Wilder |
| Sessão | **TEM** | Session Engine, Kill Zones, Session Key Levels |
| Volume Profile | **TEM** | VP + TPO/Market Profile (POC, VAH/VAL, IB, single prints) |
| VWAP | **TEM** | com bandas ±σ |
| **basis** | **PARCIAL — achado real** | `derivatives-provider.ts:57` calcula `basisPct` (mark vs index) e ele só aparece numa string de UI. `research-engine.js:211` ainda devolve `basis: DADOS_INSUFICIENTES` com o comentário *"nenhum conector compara spot vs futuros nesta fase"* — **comentário obsoleto**: o conector passou a existir. |
| **term structure** | **NÃO TEM** | depende de contratos com vencimento (Camada A) |

### Ambiguidade registrada, não acusada como bug

`fetchDerivativesPositioning()` chama `premiumIndex?symbol=BTCUSDT`
fixo. O README do GMIL diz que a camada é **contexto macro global** e
os outros provedores também são market-wide (dominância, trending) —
então BTC como proxy de mercado é defensável. Mas **nada no código diz
que essa é a decisão**. Precisa de uma linha: se é proxy por design,
escreva; se não é, é funding/basis de BTC aparecendo sob outro ativo.

---

## Camada C — Order Flow

> *Livro:* delta, CVD, imbalance, absorption, liquidity sweep, heatmap,
> DOM e MBO quando disponível.

| Item | Estado |
|---|---|
| Delta / CVD | **TEM** |
| Imbalance / OFI | **TEM** |
| Absorption / Exhaustion | **TEM** (auditado contra microestrutura real, task #199) |
| Liquidity Sweep | **TEM** |
| Heatmap | **TEM** (worker dedicado) |
| DOM | **TEM** (`DepthChartPlugin`) |
| Footprint | **TEM** |
| **MBO (Market By Order)** | **NÃO TEM** — nenhuma API pública de cripto retail expõe MBO real. Fabricar seria violar a Regra de Ouro 1. |

**Camada mais completa do sistema.** Só falta o que não existe fonte real.

---

## Camada D — Intelligence

> *Livro:* regras + modelos estatísticos + ML + anomaly detection +
> agentes. **"Cada sinal deve carregar evidência e confiança, não
> 'certeza'."**

Essa frase do livro **já é** a Regra de Ouro 2 deste projeto, escrita de
forma independente. Convergência, não lacuna.

| Item | Estado |
|---|---|
| Regras determinísticas | **TEM** — 8 motores graduados |
| Modelos estatísticos | **TEM** — Lorentziano k-NN, Platt, fusão bayesiana |
| Evidência + confiança por sinal | **TEM** — Evidence Fusion Engine |
| Anomaly detection | **PARCIAL** — Data Quality Monitor cobre anomalia de *dado*, não de *mercado* |
| **Backtest sem look-ahead** | **NÃO TEM** — `structural-backtest.js` existe, nunca rodou sobre mercado real |

---

## Camada E — Risk

> *Livro:* position sizing, max exposure, liquidation distance,
> portfolio correlation, daily loss limit, stale-data protection,
> kill switch.

| Item | Estado |
|---|---|
| Position sizing | **TEM** — Kelly em WASM, com taxa de acerto real (≥30 trades) |
| Liquidation distance | **TEM** — heatmap de liquidação |
| Stale-data protection | **TEM** — Data Quality Monitor |
| **Max exposure** | **NÃO TEM** |
| **Portfolio correlation** | **NÃO TEM** — nenhuma correlação entre ativos no repositório |
| **Daily loss limit** | **NÃO TEM** — já rastreado como task #295 |
| Kill switch | **NÃO SE APLICA** — não há execução para matar |

---

## Camada F — Shadow: **fora de escopo, permanentemente**

> *Livro:* "Executar tudo em simulação antes de qualquer integração de
> ordem real: replay, paper trading, forward test e auditoria." E:
> "a autorização para enviar uma ordem deve ser uma camada independente,
> explícita e bloqueável."

Essa é uma boa regra de engenharia **para outro produto**. Aqui ela não
se aplica, porque a decisão já foi tomada num nível acima: o AR10 é
READ_ONLY / FAIL_CLOSED incondicional — nenhuma execução real de ordem,
nenhuma chave de API de exchange, **nunca**, e isso vale sob qualquer
reformulação ("shadow", "paper", "simulação", "forward test com
integração de ordem").

O que existe e continua permitido: o **painel manual de paper trading**
já construído (decisão registrada na task #250) — o Operador anota, o
sistema calcula. O que não vai existir: qualquer caminho de código que
envie ordem, mesmo desligado, mesmo atrás de autorização.

Replay histórico e forward test **sem integração de ordem** são
legítimos e estão cobertos na Fase A do plano — são backtest, não shadow
execution.

---

## Seção 13 do livro — convergência independente

O checklist do livro coloca, nesta ordem: *construir baseline simples →
backtest sem look-ahead → walk-forward → múltiplos regimes → stress →
**somente depois** ML → **somente depois** RL → **somente depois**
agentes.*

É exatamente a conclusão da auditoria de verificação desta mesma sessão:
**validação contra mercado real vem antes de qualquer sofisticação do
emissor de sinal.** Duas fontes independentes chegando no mesmo lugar é
o argumento mais forte disponível para essa priorização.

---

## Lacunas reais, ranqueadas por valor

1. **Backtest sem look-ahead sobre histórico real** (D) — pré-requisito
   de tudo, e o livro concorda.
2. **`basis` chegar ao frame do Core Engine** (B) — o dado já é
   calculado; o comentário que diz o contrário está obsoleto. Barato.
3. **Daily loss limit + max exposure** (E) — task #295, já rastreada.
4. **Portfolio correlation** (E) — não existe nada; útil de verdade para
   quem opera mais de um ativo.
5. **Anomaly detection de mercado** (D) — hoje só há anomalia de dado.
6. **Contratos com vencimento + term structure** (A/B) — o maior salto
   de escopo, e o único que muda a classe de ativo do produto.
7. **MBO** — impossível sem fonte real. Fica registrado como
   impossibilidade, não como pendência.
