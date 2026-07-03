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

## Provedores ativos (3)

| Provedor | Categoria | Endpoint real | Por quê |
|---|---|---|---|
| `coingecko_global` | BLOCKCHAIN | `api.coingecko.com/api/v3/global` | Público, sem chave, CORS aberto. Dominância BTC+ETH, volume 24h agregado do mercado cripto e variação do market cap global 24h — contexto que nenhum feed existente (Binance/MEXC, ambos por-ativo) fornece. |
| `fear_greed_index` | SENTIMENT | `api.alternative.me/fng/` | Público, sem chave, CORS aberto. Índice de sentimento cripto mais referenciado que não exige autenticação. |
| `trending_coins` | ATTENTION | `api.coingecko.com/api/v3/search/trending` | (V11.5 Fase 4) Mesmo host já integrado por `coingecko_global`, endpoint diferente. Top símbolos mais buscados nas últimas 24h — sinal real de atenção de mercado, categoria distinta de sentimento. `lean` é sempre `null`: "o que está sendo mais buscado" não tem direção alta/baixa inerente, e inventar uma violaria o princípio de dado real deste módulo — por isso nunca entra no `GLOBAL_CONSENSUS_SCORE`, só aparece como contexto exibido. |

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

Funções puras (`circuit-breaker.ts`, `quality-engine.ts`,
`consensus-engine.ts`, `gmil-voice-alerts.ts`) têm cobertura node em
`gmil-tests/test-gmil.mjs` (não versionado — mesmo padrão de teste
ad-hoc usado pelo classificador Lorentziano e pela camada de voz nesta
sessão de desenvolvimento).
