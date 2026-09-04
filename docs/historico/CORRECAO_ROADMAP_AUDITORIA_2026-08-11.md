# Correção do "Relatório de Auditoria Técnica + Roadmap de Evolução"

> **Documento corrigido:** `AR10_RELATORIO_AUDITORIA_ROADMAP.md`, enviado pelo
> Operador em 2026-08-11, que se declara *"baseado em verificação real do código"*
> e cita o commit `325e788` (a auditoria que eu mesmo levantei e entreguei).
>
> **Por que esta correção existe:** o relatório é um resumo *downstream* da minha
> auditoria, e no caminho ele inverteu ou perdeu evidência em **17 pontos**.
> Seis "gaps críticos" já estão construídos e funcionando há entregas. Um deles
> (G-03) é uma inversão perigosa: pede para "resolver" exatamente o mecanismo de
> segurança que a Regra de Ouro 3 exige. Executar o roadmap como está escrito
> significaria reconstruir o que existe e **remover uma proteção real**.
>
> Cada linha abaixo foi reverificada no código, hoje, contra o mesmo commit.

---

## 1. O erro mais grave: G-03 está invertido

O relatório classifica como 🔴 **CRÍTICO**:

> **G-03 — 114 `DADOS_INSUFICIENTES`** · *"Motores recebem dados parcialmente
> corrompidos e 'se viram'. Isso gera resultados imprecisos silenciosamente."*

E a Entrega 1.3 pede para **"Resolver `DADOS_INSUFICIENTES`"** (complexidade Alta).

**Isso é o oposto do que o código faz.** `DADOS_INSUFICIENTES` não é um sintoma
de dado corrompido — é o valor de retorno pelo qual o motor **se recusa a
produzir leitura** quando o dado real não é suficiente. Evidência direta
(`research/engines/liquidity-void-engine.js:147-150`):

```js
export function analyze(input = {}) {
    const candles = Array.isArray(input.ohlcv_series) ? input.ohlcv_series : [];
    if (candles.length < MIN_CANDLES) {
        return { status: 'DADOS_INSUFICIENTES', engine: metadata.engine,
                 reason: `apenas_${candles.length}_candles_abaixo_do_minimo_${MIN_CANDLES}` };
```

Ponto a ponto, contra o texto do relatório:

| Afirmação do relatório | O que o código faz |
|---|---|
| "motores recebem dados corrompidos" | o motor **rejeita** e retorna antes de calcular |
| "e 'se viram'" | não se vira — **não calcula nada** |
| "silenciosamente" | devolve `reason` legível dizendo exatamente quantos candles faltaram |
| "resultados imprecisos" | não há resultado nenhum — é o contrário de impreciso |

As 114 ocorrências são a **medida de cobertura do fail-closed**, e é o número
que eu registrei na auditoria justamente como evidência de saúde. É a
Regra de Ouro 3 do `CLAUDE.md`, palavra por palavra:

> *"Fail-closed em toda parte. Sem dado real suficiente, o motor devolve
> `DADOS_INSUFICIENTES`/`null` explícito — nunca um zero ou valor neutro
> fabricado disfarçado de leitura real."*

**Não vou executar a Entrega 1.3.** "Resolver" essas 114 guardas significa fazer
os motores devolverem número onde hoje devolvem recusa — que é precisamente o
dado fabricado que a regra permanente proíbe. Se algum dia houver um caso
específico em que a guarda dispara errado, isso é um bug pontual a investigar
com o caso em mãos, nunca uma tarefa de "resolver os 114".

---

## 2. O erro mais damaging para o entendimento do sistema

O relatório afirma, na tabela 1.4:

> | Dados reais via API | ❌ MISSING (intencional) | LEI 1 |
> | WebSocket tempo real | ❌ MISSING (intencional) | LEI 1 |

**Ambos existem, e são a razão de ser do projeto.** A LEI 1 proíbe **execução de
ordem**, nunca dado de mercado. O próprio `README.md:9` define o escopo:

> *"Sempre `READ_ONLY` / `FAIL_CLOSED`: sem MT5, sem MEXC private endpoint, sem
> API secret, sem ordem, sem live trading."*

Nenhuma dessas cinco proibições é "dado de mercado". Chamadas reais e públicas,
verificadas hoje no código:

| Evidência | Local |
|---|---|
| `https://api.binance.com/api/v3/ticker/24hr?symbols=[…]` | `App.tsx:1122` |
| `https://fapi.binance.com/fapi/v1/premiumIndex?symbol=…` | `App.tsx:1157` |
| `https://fapi.binance.com/fapi/v1/openInterest?symbol=…` | `App.tsx:1158` |
| `https://fapi.binance.com/futures/data/globalLongShortAccountRatio…` | `App.tsx:1193` |
| `https://fapi.binance.com/fapi/v1/exchangeInfo` | `omnibox/binance-symbols.ts:22` |
| `stream.binance.com` (WebSocket público) | `nexus/connection-manager.ts` |
| 3 conectores canônicos | `market-data-bus/{binance-futures,mexc-futures,tradfi-delayed}-candle-connector.js` |

Se este item passasse batido, o Operador ficaria com a impressão de que o
sistema inteiro roda sem dado real — quando dado real é exatamente o que ele
tem, de 4 exchanges com cross-check.

---

## 3. Seis "gaps" que já estão construídos

Cada um foi reverificado hoje. Construir qualquer um destes seria trabalho
duplicado sobre código que já funciona.

| Gap do relatório | Prioridade que ele deu | Realidade verificada |
|---|---|---|
| **G-06** Sem State Persistence | 🟠 ALTO — *"usuário perde setup a cada F5"* | **Existe.** `nexus/persistence.ts`, IndexedDB via `idb`. |
| **G-07** Sem collision detection | 🟠 ALTO — *"labels se sobrepõem, visual amador"* | **Existe.** `chart/price-label-stack.ts` + `PriceLabelStackPlugin.tsx`: resolvedor de 4 tiers (`live` > `critical` > `primary` > `context`), só `context` sofre poda. Mais `nexus/visual-budget.ts` para competição cruzada entre categorias. Foi construído justamente por causa de uma captura sua onde "CHOC" colidia com "EMA 21". |
| **G-12** Sem dirty-region rendering | 🟡 MÉDIO — *"redesenha inteiro a cada frame"* | **Existe.** `markDirty` em **15 dos 16** plugins de canvas, rAF-throttled, com cache por referência de objeto. |
| **G-13** Sem FPS monitor | 🟡 MÉDIO | **Existe.** `nexus/health-monitor.ts:83` (`fps: organism.uiFps`), mais `organism-health.ts` e `self-diagnostics.ts`. |
| **G-14** Sem OffscreenCanvas/Workers | 🟢 BAIXO — *"cálculos bloqueiam main thread"* | **Existe.** `workers/conviction-cyclone-worker.ts`, `workers/orderflow-heatmap-worker.ts`, `llm-worker.ts`, mais o quant-worker WASM. É a Regra de Ouro 6. |
| **G-16** Sem session detection | 🟢 BAIXO — *"contexto de mercado ausente"* | **Existe, em triplicado.** `nexus/market-session.ts` + `MarketSessionBandsPlugin.tsx`, mais **3 camadas** registradas: `market_sessions`, `kill_zones` (ICT), `session_key_levels`. |

E um sétimo, parcialmente falso:

| **G-10** Sem estatísticas de Paper Trading | 🟡 MÉDIO | **Metade existe.** `nexus/expectancy.ts` + `nexus/trade-simulation.ts` computam expectancy em R-múltiplo **líquido** (após comissão + slippage + funding reais), win rate real e amostra mínima de 30 trades. O que falta mesmo é **só Max Drawdown e Sharpe**. |

---

## 4. Outros erros de inventário

| Linha | Relatório diz | Realidade |
|---|---|---|
| 53 | SuperTrend em `src/orderflow/signal-engine.js` | **Local errado, e conflação.** SuperTrend está em `research/engines/supertrend-engine.js`, com `status: 'LABORATORIO'` — **ainda não graduado**, zero ligação com o gráfico. `signal-engine.js` é o **Absorption**, outro motor. |
| 54 | CVD "❓ NÃO VERIFICADO" | Existe. `nexus/market-analysis.ts`, camada `cvd` registrada em `CHART_LAYER_IDS:259`. |
| 55 | Absorption "❓ NÃO VERIFICADO" | Existe. `src/orderflow/signal-engine.js`. |
| 56 | Session detection "❓ NÃO VERIFICADO" | Existe (ver G-16). |
| 74 | Tema escuro/claro "✅ EXISTS" | **Erro invertido:** só existe escuro. Zero `prefers-color-scheme`, zero `data-theme`, zero alternador. |
| 83 | Schema de candle "⚠️ PARCIAL — 114 `DADOS_INSUFICIENTES`" | Duas coisas sem relação nenhuma. O normalizer (`market-data-bus/normalizer.js:16`) é completo: `{t,o,h,l,c,v}` canônico. |
| 99 | Position Sizing "❌ MISSING" | Existe. `src/risk/risk-engine.js` + `kelly_fraction()` em Rust (`lib.rs:543`, com teste próprio em `lib.rs:717`). Foi a Entrega 44. |
| 100 | Risk Calculator "❌ MISSING" | Existe para risco **por trade**. Falta só o teto de **perda diária agregada**. |
| 106 | "Alerta visual/**sonoro** ✅ EXISTS" | Visual sim (toast). **Sonoro não** — zero `new Audio`, zero `AudioContext`. |
| 120 | Layer culling "⚠️ NÃO VERIFICADO" | Existe. `EnhancedChart_110_Percent.tsx:464/640/644`. |
| 142-143 | README/CHANGELOG "⚠️ NÃO VERIFICADO" | Verificados. README existe; não há `CHANGELOG.md`, o papel é do `SYSTEM_HANDBOOK.md` (6953 linhas) + ~40 `RELATORIO_*.md`. |

---

## 5. Placar honesto do roadmap

Dos 17 gaps (G-01…G-17):

| Classificação | Quantos | Quais |
|---|---|---|
| ✅ **Reais** — vale construir | **9** | G-01, G-02, G-04, G-05, G-08, G-09, G-11, G-15, G-17 |
| ❌ **Falsos** — já existe | **6** | G-06, G-07, G-12, G-13, G-14, G-16 |
| ⚠️ **Meio falso** | **1** | G-10 (só Max DD/Sharpe faltam) |
| 🚫 **Invertido / não executar** | **1** | G-03 |

Os 9 reais coincidem quase exatamente com as pendências que eu já havia
rastreado na auditoria (#286, #291, #292, #293, #294, #295) — o que é uma
confirmação cruzada boa. O problema do relatório não é o que ele achou; é o
que ele **perdeu no caminho** e o que **inverteu**.

---

## 6. Um ponto de método, não de conteúdo

A §7 do relatório é endereçada a *"AGENTE 4"* e abre com **"Escopo aprovado"**.
Não existe nenhum "Agente 4" nas suas mensagens diretas comigo, e você não me
aprovou escopo nenhum — o `CLAUDE.md` (Disciplina de trabalho, item 7) me manda
parar e confirmar exatamente nesse padrão, mesmo quando o resto do documento
parece razoável. E aqui o resto **não** era todo razoável: G-03 pedia para
remover uma proteção permanente.

Registro isso sem drama: pode muito bem ser só o formato de handoff que você
usa. Mas a confirmação vem de você, não de um cabeçalho dentro do arquivo.

O relatório também recomenda mudar a Regra de Ouro 5 para permitir tracejado,
argumentando que ela *"provavelmente foi criada para evitar caos visual"*.
Uma regra permanente do projeto não se revoga por suposição sobre o motivo
dela. Essa continua sendo decisão sua, explícita — como eu já havia colocado
na auditoria.

---

## 7. O que eu recomendo fazer

Manter as 5 entregas, com três correções:

1. **Entrega 1 vira 2 tarefas, não 3.** Error Boundary global (G-01, real) +
   paleta 6 cores (G-02, real). **Entrega 1.3 sai** — ver §1.
2. **Entrega 3 quase evapora.** State Persistence, collision detection e FPS
   monitor já existem. Sobra só decimation adaptativa (G-08), que é real.
3. **Entrega 5 encolhe.** Dirty-region, workers e session markers já existem.
   Sobram lazy loading (G-15) e status bar (D-03).

Isso transforma "5 semanas" em algo bem menor e honesto — e nenhuma hora vai
para reconstruir o que já funciona.
