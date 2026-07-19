# SYSTEM_HANDBOOK — AR10 CYBORG

Documento central de organização do sistema, escrito sob ordem explícita
do Operador ("executa todas as etapas pendentes e organiza tudo").
Registra o estado REAL atual: o pipeline canônico de decisão, onde cada
peça vive, como se verifica, e — a parte mais importante — o destino
honesto de cada pendência histórica (fechada, coberta, ou adiada de
propósito com a razão registrada). As regras permanentes vivem em
`CLAUDE.md` (raiz) e não são repetidas aqui; este documento é o mapa,
não a lei.

Data de referência: 2026-07-19 · Branch: `claude/eloquent-cannon-qyt86y` · PR #13.

---

## 1. O que o sistema é (em uma frase)

Plataforma de inteligência de mercado **somente leitura** (READ_ONLY /
FAIL_CLOSED, zero execução, zero credencial) para USDT-M Futures —
Binance primária, MEXC/Bybit/OKX cross-check — que transforma dados
reais em UMA leitura operacional canônica por ativo/timeframe:
`BIAS → SETUP → ENTRY → OPERATION → TRADE PLAN → LEITURA`.

## 2. Pipeline canônico de decisão

```
DADOS REAIS (WS/REST públicos)
  ↓ market-data-bus (fonte canônica única por symbol:timeframe)
SNAPSHOT GLOBAL UNIFICADO (Zustand+Immer, 5 domínios)
  ↓ engines puros (research/engines + nexus/*)
CORE ENGINE — único emissor de LONG/SHORT/WAIT (LEI 24)
  ↓ Conselho/Confluence/Heat/Score/MTF (contexto, nunca decisão)
TRADE PLAN (trade-plan.ts — estrutura real: entrada/stop/alvos/R:R)
  ↓ buildNexusDecision (decision-layer.ts — contrato único, v2)
OPERATIONAL READABILITY (operational-readability.ts — contrato v6)
  ↓
HEADER (badge herói) + CHART + GAVETAS + ABA ANALYSIS + TOOLTIP
```

Regra estrutural provada por teste: nenhum consumidor visual recalcula
direção/entrada/stop/alvo — todos leem o mesmo `NexusDecision`.

### 2.1 Os quatro eixos (contrato estável)

| Eixo | Pergunta | Valores | Onde deriva |
|---|---|---|---|
| BIAS | Para que lado o contexto inclina? | `LONG_BIAS · SHORT_BIAS · NEUTRAL_BIAS · CONFLICTED_BIAS · INSUFFICIENT_DATA` | `deriveBiasLabel()` |
| SETUP | Existe estrutura real? (nunca timing) | `LONG_SETUP · SHORT_SETUP · WAITING_FOR_CONFIRMATION · INVALIDATED · NO_VALID_SETUP` (+`WAITING_FOR_RETEST` no tipo, hoje não-alcançável — ver §6.5) | `deriveSetupState()` |
| ENTRY | O timing autoriza AGORA? | `ENTRY_CONFIRMED · WAITING_FOR_RETEST · WAITING_FOR_CONFIRMATION · ENTRY_INVALIDATED · NO_ENTRY` | `deriveEntryState()` |
| OPERATION (Leitura) | Síntese de bate-olho | `LONG/SHORT — PLANO ATIVO · AGUARDAR LONG/SHORT · OBSERVAR · SEM OPERAÇÃO` | `deriveOutcomeLabel()` |

A direção exibida em QUALQUER lugar da tela (badge herói,
MarketBiasDecisionCard, MarketDirectionWidget, AssistantOrb expandido)
carrega o qualificador visível (`PLANO ATIVO / AGUARDANDO ENTRADA / SEM
ESTRUTURA`) — mesma tabela `OUTCOME_QUALIFIER`, nunca uma segunda lógica.

## 3. Onde cada peça vive

- `ipad_runtime/src/research/engines/` — 5 motores graduados + 1
  utilitário (`fractal-swings.js`, detecção de swing COMPARTILHADA).
  Lista e regra de graduação: `ipad_runtime/src/research/QUARANTINE.md`.
- `ipad_runtime/ramber-ui/src/nexus/` — ~40 módulos puros (decision-layer,
  operational-readability, trade-plan, eta-engine, vwap, harmonic-patterns,
  trend-channel-engine, rr-quality, premium-discount, heat-score, council,
  confluence-engine, scenario-engine, multi-timeframe-engine, …).
- `ipad_runtime/ramber-ui/src/chart/` — EnhancedChart (lightweight-charts,
  atribuição relocada ao rodapé conforme licença Apache-2.0) + 8 camadas
  togglable no painel "Camadas do Gráfico": FVG/OB · BOS/CHOCH · Liquidity
  Heatmap · Volume Profile · Trade Plan Zone · Neural Market Aura · EMA ·
  Trend Channel. Harmônicos (figura XABCD completa + PRZ/EPA), Fibonacci,
  Premium/Discount, Cenários e S/R são price-lines/séries sempre-ativas
  fail-closed. Tudo fio de seda (1px sólida).
- `ipad_runtime/ramber-ui/src/store/unified-snapshot-store.ts` — snapshot
  único; todo campo em 4 lugares (state/actions/defaults/seletor).
- `ipad_runtime/ramber-ui/src/engine-bridge.ts` — ponte única motores→UI.

## 4. Parâmetros declarados (números de convenção, nunca medições)

| Parâmetro | Valor | Onde | Natureza |
|---|---|---|---|
| Piso de qualidade R:R | 1:2 | `nexus/rr-quality.ts` | Convenção de mesa; anota `(abaixo do piso 1:2)` nos lugares que já mostram R:R. Display-only — nunca esconde/bloqueia um plano (LEI 24). Ajustável pelo Operador no módulo. |
| Compactação de rótulos TP | 0.35% | `chart/label-compaction.ts` | Distância mínima entre níveis antes de compactar rótulos; preço nunca desloca. |
| Janela do Trend Channel | 50 candles | `nexus/trend-channel-engine.ts` | Mesma ordem de grandeza do EMA50; bandas ±2σ (cobertura amostral, nunca probabilidade). |
| Janela ENCERRADO | 5 min | `nexus/decision-layer.ts` | Pós-operação recente. |
| Decaimento de zonas | 30→100 candles | `chart/annotation-decay.ts` | Zonas velhas esmaecem até 15% e saem da TELA (nunca do dado). |

## 5. Como se verifica (infraestrutura real)

- `npx tsc --noEmit` + `npx vitest run` (97+ arquivos, 1470+ testes) +
  `npm run build`.
- `scripts/audit-header-maxcontent.mjs` — auditoria responsiva em 10
  viewports (iPad Mini→ultrawide 34") com CONTEÚDO MÁXIMO injetado no
  header E na gaveta Market Intelligence (nunca só estado vazio).
- Replay sem look-ahead: `tests/replay-walk-forward.test.ts` (521 janelas,
  snapshot congelado) sobre fixture versionada por seed
  (`tests/replay-fixture.test.ts` — proveniência bit-a-bit).
- Convenção mista deliberada de teste: matemática de fronteira = execução
  real; fiação entre módulos = padrão de fonte (ver `CLAUDE.md`).
- Limite conhecido do sandbox de CI: sem egress para exchanges — cenários
  LONG/SHORT ao vivo são provados por execução real de testes, nunca
  observados com feed real dentro do sandbox.

## 6. Registro de pendências — o destino honesto de cada uma

### 6.1 Fechadas por código (nesta trilha, PR #13)
- BIAS/SETUP/ENTRY/OPERATION como eixos separados + guarda
  `DIRECTION_CONFLICT` + reset por ativo/timeframe + filtro de TP com
  R:R inválido.
- Qualificador BIAS≠ENTRY visível nos 4 pontos de direção da tela.
- Figura XABCD/Wolfe completa no gráfico (antes só a linha do ponto D).
- Trend Channel (Linear Regression Channel real, 8ª camada).
- Logo de terceiro removido do canvas, atribuição relocada ao rodapé
  (obrigação de licença preservada).
- Piso R:R 1:2 como parâmetro declarado (este documento, §4).
- Auditoria visual com conteúdo real na gaveta Market Intelligence.
- Gap de teste: resets de L2/orderflow/score escopados ao efeito real de
  troca de ativo.

### 6.2 Fechadas como JÁ COBERTAS (auditadas, nada a construir)
- **Contexto HTF vs timing atual**: o cruzamento já existe em DOIS
  lugares reais — o membro `Conviction·MULTI_TIMEFRAME` alimenta
  Favoráveis/Contrários do contrato (ex.: "3/9 prazos concordam") e a
  Matriz Multi-Timeframe exibe a estrutura por prazo. Uma terceira
  apresentação seria a "complexidade externa" que a Diretriz de Evolução
  Profissional veta.
- **"Migração dos demais consumidores à Readability Layer"**: a parte
  com significado real (linguagem única de direção) está completa; os
  widgets numéricos leem os MESMOS campos do `NexusDecision`/plano por
  necessidade de estrutura (número+cor), não por divergência. Forçá-los a
  consumir strings prontas perderia estrutura sem ganho ao Operador.

### 6.3 Recusas permanentes (nunca "pendências")
- Execução real de ordens / chaves de API — recusa permanente
  (`CLAUDE.md`, restrição inegociável).
- **§13 "Alvo Máximo Estatístico"** — exigiria probabilidade calibrada
  sem backtest real neste repositório (Regra de Ouro 2). Só reabre se um
  dia existir infraestrutura real de backtest com histórico auditável.

### 6.4 Adiamentos deliberados (decisão registrada, não esquecimento)
Cada um destes é da classe que `CLAUDE.md` (Regra de Ouro 6) exige tratar
como iniciativa própria isolada — nunca um item embutido numa faxina:
- **Cutover CrossExchangeService** (serviço pronto; troca da pipeline de
  dados ao vivo). Gatilho para reabrir: evidência real de problema na
  pipeline atual, ou pedido explícito do Operador.
- **k-NN/regime para Worker** (main thread sagrada — mover cálculo pesado
  exige medição própria de FPS antes/depois).
- **Migração WidgetContext → seletores atômicos Zustand** (refatoração
  ampla sem evidência de necessidade hoje; os pontos quentes já usam
  seletores atômicos).

### 6.5 Limitações honestas de dado (documentadas no código)
- `SETUP: WAITING_FOR_RETEST` e um 3º sinal de timing
  (`LONG_SETUP + WAITING_FOR_CONFIRMATION` simultâneos, exemplo recorrente
  das diretrizes): os dados reais atuais só sustentam UM sinal de timing
  quando um plano já existe (preço na zona ou não). Distinguir "reteste"
  de "confirmação" nesse estado exigiria inventar limiar de quórum do
  Conselho — mesma categoria de número que o piso R:R, mas SEM convenção
  de indústria para ancorar. Fica como está até existir fonte real.

### 6.6 Tarefas históricas superadas
As tarefas de documentação da era pré-`ramber-ui` (handbook antigo,
arquivamento de handoffs HTML, poda de docs do PR #6 — já mergeado)
são SUPERADAS por este documento: escrever aquele conteúdo hoje
descreveria um sistema que não existe mais. Os `docs/` históricos
permanecem como registro (Regra de Ouro 4 — nunca apagar sem ordem).

---

*Manutenção: atualizar as seções 2-4 quando a arquitetura mudar (mesma
disciplina da seção Arquitetura do `CLAUDE.md`); a seção 6 só cresce —
uma pendência nova entra com destino declarado, nunca fica vaga.*
