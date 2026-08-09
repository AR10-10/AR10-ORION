# GMIL — Global Market Intelligence Layer

Camada consultiva, desacoplada do Core Engine (LEI 01 do protocolo V10.1:
Core Quantitativo é sagrado). Nenhum arquivo em `engine-bridge.ts` importa
nada daqui, e nada aqui escreve em `engine`/`realCycle`. GMIL só existe para
dar contexto macro adicional na UI — nunca uma segunda fonte de sinal.

## Arquitetura

```
providers/*.ts  →  circuit-breaker.ts + quality-engine.ts  →  event-bus.ts  →  consensus-engine.ts
                                                                    ↓
                                                        use-gmil-snapshot.ts (hook React)
                                                                    ↓
                                                  App.tsx: GmilContextWidget / EventsWidget
```

- **event-bus.ts** — pub/sub único; providers/consumidores nunca se chamam
  direto (LEI 02/11).
- **circuit-breaker.ts** — máquina de estados pura (CLOSED/OPEN/HALF_OPEN);
  3 falhas seguidas abre, 30s de cooldown antes de uma sonda HALF_OPEN
  (LEI 06).
- **quality-engine.ts** — converte latência/idade/falhas num peso 0..1;
  circuito aberto = peso zero (LEI 05).
- **consensus-engine.ts** — média ponderada dos `lean` normalizados de cada
  provedor; `sample_size` sempre reportado, nunca escondido (LEI 04, mesmo
  princípio do classificador Lorentziano em `src/research/engines/`).
- **gmil-voice-alerts.ts** — texto falado para perda/recuperação de
  provedor (LEI 08), função pura separada do `voice-dispatcher.ts` do
  Core Engine para não misturar os dois domínios num único tipo.

## Provedores ativos (5)

| Provedor | Categoria | Endpoint real | Por quê |
|---|---|---|---|
| `coingecko_global` | BLOCKCHAIN | `api.coingecko.com/api/v3/global` | Público, sem chave, CORS aberto. Dominância BTC+ETH, volume 24h agregado do mercado cripto e variação do market cap global 24h — contexto que nenhum feed existente (Binance/MEXC, ambos por-ativo) fornece. |
| `fear_greed_index` | SENTIMENT | `api.alternative.me/fng/` | Público, sem chave, CORS aberto. Índice de sentimento cripto mais referenciado que não exige autenticação. |
| `trending_coins` | ATTENTION | `api.coingecko.com/api/v3/search/trending` | (V11.5 Fase 4) Mesmo host já integrado por `coingecko_global`, endpoint diferente. Top símbolos mais buscados nas últimas 24h — sinal real de atenção de mercado, categoria distinta de sentimento. `lean` é sempre `null`: "o que está sendo mais buscado" não tem direção alta/baixa inerente, e inventar uma violaria o princípio de dado real deste módulo — por isso nunca entra no `GLOBAL_CONSENSUS_SCORE`, só aparece como contexto exibido. |
| `derivatives_positioning` | DERIVATIVES | `fapi.binance.com/fapi/v1/premiumIndex` | (V15 Fase E) Público, sem chave — mesmo host que o painel de derivativos do App já usa. Funding rate + basis (mark×index) numa única resposta atômica: o feed combinado Spot×Perpetual do Cap. 7. `lean` = posicionamento por funding (±0.05%/8h clampado), nunca recomendação. |
| `onchain_tvl_flow` | ONCHAIN | `api.llama.fi/v2/historicalChainTvl` | (Ordem Mestra §7) Público, sem chave. Fluxo real de TVL agregado (soma de todas as chains rastreadas) — variação real de 7 dias vs. valor atual, nunca interpolado. `lean` = capital entrando/saindo (±5%/7d clampado). Nota honesta: é um proxy de fluxo agregado de capital on-chain, não rastreamento de whale/carteira individual (a definição original desta categoria em `types.ts`) — nenhuma fonte keyless de whale-tracking foi encontrada; documentado como tal, nunca apresentado como equivalente. CORS de `api.llama.fi` não foi verificado ao vivo nesta sessão (rede do sandbox bloqueada) — confiança moderada por uso amplo conhecido em dashboards DeFi client-side, não uma certeza confirmada; `probeJsonEndpoint`/fetch já classifica `BLOCKED_BY_CORS` honestamente se a suposição estiver errada. |

## Fase E — agregação por categoria (V15 Cap. 6)

`context-aggregator.ts` produz as 4 saídas oficiais da Constituição sobre as
MESMAS linhas de provedor do snapshot, com a MESMA `computeConsensus`
(LEI 04 — só particionamento por categoria, nunca uma segunda matemática):
`contextScore` (todas), `institutionalBias` (DERIVATIVES+ONCHAIN),
`macroBias` (MACRO), `liquidityBias` (BLOCKCHAIN). `institutionalBias`
agora tem 2 categorias reais contribuindo (DERIVATIVES + ONCHAIN, desde a
Ordem Mestra §7). MACRO continua sem provedor ativo — toda fonte
prescrita exige chave de API ou não tem CORS keyless verificado (ver
tabela abaixo e "Fontes avaliadas e adiadas") — produz score `null`
honesto: o gancho existe e é visível na UI como AGUARDANDO; um provedor
futuro é 1 arquivo em `providers/` + 1 linha de registro no orquestrador,
e o viés da categoria passa a existir sozinho.

## Fontes avaliadas e adiadas (com motivo real, não silenciosamente ignoradas)

O protocolo V10.1 pediu ~15 fontes em 5 categorias. Só as 3 acima passam no
critério "funciona de verdade num PWA estático sem backend e sem segredo
embutido". As demais:

- **Bybit / Coinbase Exchange / Kraken / OKX** (Market Data) — tecnicamente
  possível (a maioria expõe endpoints públicos de mercado com CORS aberto),
  mas duplicam a categoria que Binance/MEXC já cobrem sem agregar tipo novo
  de informação. Adiado por prioridade, não por inviabilidade — candidato
  natural para uma segunda leva de providers na mesma arquitetura.
- **Yahoo Finance** (Macro Market) — os endpoints não-oficiais mais usados
  bloqueiam CORS para `fetch()` de origem arbitrária; exigiria um proxy de
  backend que este projeto (100% estático, GitHub Pages) não tem.
- **FRED, Alpha Vantage** (Macro Market) — exigem chave de API registrada.
  Embutir uma chave no bundle de um site estático público não é manejo
  seguro de segredo, e viola o espírito do "zero exposição de chaves" do
  próprio protocolo (LEI 13).
- **Stooq** (Macro Market) — endpoint público existe mas o suporte a CORS
  não é oficialmente documentado nem estável o bastante para prometer como
  "real e funcionando".
- **Economic Calendar** — nenhuma fonte gratuita, sem chave, CORS-aberta e
  compatível com os termos de uso foi identificada.
- **RSS financeiro / notícias** — RSS/XML não é pensado para `fetch()` de
  navegador; a maioria dos publishers não envia cabeçalho CORS permissivo.
- **Blockchain.com stats, Book Depth agregado entre exchanges** — viáveis
  tecnicamente, mas fora do escopo desta primeira leva por tempo/revisão.

## Explicitamente recusado (LEI 13 vs. restrição permanente do projeto)

- **Secure Enclave** — não existe API de Secure Enclave acessível a partir
  de uma página web. Nada para construir; a pedida não se aplica a uma PWA.
- **HMAC / assinatura local** — HMAC é exatamente o mecanismo usado para
  autenticar chamadas privadas de API de exchange. Construir essa
  infraestrutura criaria o caminho técnico para credenciais/execução real
  — o que este projeto proíbe permanentemente, por design, desde a raiz
  (ver `../README.md`, seção "O que continua bloqueado"). Não implementado.

## Testes

Suíte permanente e versionada (Vitest, gate real de CI desde o Caminho 3):
`ramber-ui/tests/gmil-consensus.test.ts` (consensus-engine) e
`ramber-ui/tests/gmil-expansion.test.ts` (Fase E: context-aggregator,
derivatives-provider puro). A cobertura ad-hoc node antiga
(`gmil-tests/test-gmil.mjs`, não versionada) foi superada por esta suíte.
