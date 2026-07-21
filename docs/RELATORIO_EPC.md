# RELATÓRIO EPC — Auditoria de Evolução Suprema (AR10 CYBORG / PRO)

Entregável exigido pela Diretiva de Evolução Suprema §12 ("ENTREGA").
Relatório técnico e auditável da trilha de evolução conduzida sob a série
de diretivas EPC (Evolução Suprema do Ecossistema Visual/Matemático,
MODO ELITE, MODO ELITE ABSOLUTO, Recuperação de Inteligência Oculta,
Diretiva de Evolução Suprema).

Cada item cita o commit real (hash) e a seção correspondente em
`SYSTEM_HANDBOOK.md` (§6.x) ou `AUDITORIA_ECOSSISTEMA_VISUAL.md` (§7/§8).
Nenhuma decisão baseada em opinião — todas com fundamento técnico
verificável no código e nos testes.

Data de referência: 2026-07-21 · Branch `claude/eloquent-cannon-qyt86y`
· PR #13 · **1691 testes (103 arquivos), tsc limpo, build ok, 11
viewports CLEAN**.

---

## 1. Inteligências RECUPERADAS (calculadas pelo núcleo, antes invisíveis)

| Inteligência | O que é | Antes | Agora | Commit | Doc |
|---|---|---|---|---|---|
| **`engine.condition`** | A confirmação REAL que o Core Engine exige antes do setup valer (`required_confirmation` LONG/SHORT) ou o gatilho de reavaliação (`trigger_to_reevaluate` WAIT) — `trade-setup-matrix.js`/`research-engine.js` | Computada pelo engine-bridge, **nunca lida por nenhum consumidor** (0 usos) | Linha "Confirmação exigida (Núcleo)" na Síntese Operacional (aba ANALYSIS), fail-closed | `81f4553` | §6.29 |
| **`council.opinionMass`** | Distribuição real do pool linear (Stone 1961/DeGroot 1974) — massa de opinião L/S/N | Alimentava o Scenario Engine, mas o painel só mostrava `agreement` (escalar de coesão derivado, projeção com perda) | Linha "Opinion Mass (L/S/N)" no painel Council — compacta `L 72 · S 15 · N 13`, fail-closed | `22ee891` | §6.30 |
| **STOP/TARGET1/TARGET2 do Núcleo no canvas** | O Core Engine (LEI 24) já computava seu próprio stop/target/R:R via Target Tracker | Só o Trade Plan do Conselho (mais raro) era desenhado — o Núcleo, caso comum, nunca | Fallback do Núcleo desenhado quando o Conselho ainda não confirma, com motivo honesto explícito | `3d69fad` | §6.20 |
| **Obstáculos estruturais do Núcleo** (ênfase ⚠ + contagem `⚠ N`) | `obstacleZonesInPath` conta zonas estruturais reais no caminho até cada alvo | Só o plano do Conselho tinha a ênfase; o Núcleo (comum) não | Borda ⚠ da zona + número `⚠ N` no rótulo do alvo do Núcleo | `6915a37`, `1fe6aac` | §6.27, §6.28 |

**Conclusão honesta**: após `condition` e `opinionMass`, a auditoria
campo-a-campo do núcleo (Core/Council/realCycle) confirma que o poço de
"inteligência de alto valor genuinamente escondida" está esgotado. Todos
os demais campos ricos já têm representação: `lorentzian` (k-NN,
classificação+confiança+n), `dataQuality`, `forecast` multi-horizonte,
votos individuais do Conselho, `agreement`/`quorum`, `htfUpdatedAt`,
`marketRegime`, `timeframeConfluence`, `moveToTargetPct`, `rationale`.

---

## 2. BUG REAL corrigido (a maior falha operacional da trilha)

| Bug | Causa raiz | Correção | Commit | Doc |
|---|---|---|---|---|
| **TARGET 1/2 do Núcleo nunca apareciam, em NENHUM ativo/timeframe** | O objeto `engine` expõe o alvo 1 sob o campo `target` — o código lia `engine?.target1` (inexistente, sempre `undefined`); o gate fail-closed retornava `null` 100% do tempo, disfarçado de "sem dado". `tsc` não pegou porque `WidgetContext` é tipado `any` | `engine?.target1` → `engine?.target`; + teste de EXECUÇÃO REAL que prova o bug pela matemática | `be1fbf8` | §6.22 |

---

## 3. Melhorias MATEMÁTICAS (sempre reaproveitando cálculo real)

| Melhoria | Fundamento | Commit | Doc |
|---|---|---|---|
| **Histerese de dois patamares no stance do Council** | Causa raiz do "Trade Plan some": o Council recomputava a cada tick de preço; o pool decidia por argmax puro (sem faixa neutra), fazendo o stance piscar LONG↔NEUTRAL a cada ~300ms e destruir/recriar o plano. `councilStanceWithHysteresis` (ENTER 0.12 / EXIT 0.04, mesmo princípio de `vwap-state.ts`) — aplicada SÓ na camada de stance, sem tocar o pool compartilhado (`ensemble-engine.js`, usado por 2 outros consumidores). **Zero matemática de mercado nova** — só atrasa a transição publicada | `f0e0c85` | §6.19 |
| **Obstáculos por caminho reaproveitados** | `obstacleZonesInPath` (trade-plan.ts) — uma única definição de "zona no caminho entrada→alvo", agora servindo o Conselho E o Núcleo via `collect` (zero segundo cálculo) | `6915a37`, `1fe6aac` | §6.27-6.28 |

**Auditoria das 8 categorias do EPC §3** (filtros/pesos/confluências/
validações estruturais/temporais/projeções/risco/multi-timeframe):
**nenhuma genuinamente ausente** — todas cobertas por engine real e
testado. Detalhe em `AUDITORIA_ECOSSISTEMA_VISUAL.md` §7.3.

---

## 4. Melhorias VISUAIS (leitura instantânea, sem poluição)

| Melhoria | Fundamento | Commit | Doc |
|---|---|---|---|
| **Motivo honesto de ausência do Trade Plan** | "Nunca esconder": overlay `SEM TRADE PLAN · {motivo}` no canvas + barra de comando, derivado de `tradePlanAbsenceReason` (função pura única, reusada — Regra de Ouro 4) | `f0e0c85`, `3d69fad` | §6.19-6.20 |
| **Direção ↑/↓ nas zonas FVG/OB** | `z.type` já é a direção real do motor SMC — rótulo `FVG ↑`/`OB ↓` resolve a confusão real "essa zona vermelha é pra cima ou pra baixo?" | `7250418` | §6.18 |
| **Rótulos divididos entre os 2 lados do eixo** | Pesquisa real (Lightweight Charts suporta price scales nos 2 lados; TradingView até 8): direita = acionável agora (VWAP/NL/EMA/ENTRY/STOP/TARGET), esquerda = mapa estrutural (S1/R1/TREND/CHOC). Reduz o lado direito de até 12 caixas para até 8 | `209ecd8` | §6.24 |
| **CHOC×EMA21 (colisão real)** | Rótulo BOS/CHOCH migrado do canvas próprio (sem consciência de colisão) para o sistema anti-colisão unificado do eixo, preservando o decaimento por idade | `51cfb63` | §6.21 |
| **Compactação de rótulos (EPC §4/§5)** | `"(Núcleo)"` redundante removido (a distinção fica por cor + overlay do canto); `ASCENDING`→↑ glifo; harmônico `GARTLEY ↑ PRZ 87%`; Wolfe `WOLFE EPA · ETA`. Disclaimers de honestidade preservados no painel, nunca no rótulo flutuante | `045c0d0`, `ddcd860` | §6.25-6.26 |

---

## 5. Melhorias ARQUITETURAIS

| Melhoria | Fundamento | Commit |
|---|---|---|
| **`tradePlanAbsenceReason` como função pura única** | O motivo honesto vivia inline na barra de comando; extraído para module-scope e reusado no canvas — zero segunda implementação | `f0e0c85` |
| **`PriceAxisLabel` ganhou `side?`/`alpha?` opcionais** | Extensão aditiva (default preserva 100% o comportamento existente): 2 lados independentes + decaimento por idade dentro do resolvedor de colisão | `209ecd8`, `51cfb63` |
| **`obstacleZonesInPath` como fonte única de obstáculo** | Conselho e Núcleo cruzam a MESMA função — nunca dois cálculos | `6915a37` |

---

## 6. REDUNDÂNCIAS eliminadas

- `"(Núcleo)"` repetido em cada rótulo STOP/TARGET1/TARGET2 → dito uma
  vez no overlay do canto (`045c0d0`).
- `"(aderência, nunca probabilidade)"` repetido no rótulo harmônico
  flutuante → já vive no título do painel Harmonic Patterns (`ddcd860`).
- Palavra `ASCENDING`/`DESCENDING` (9-10 letras) → glifo ↑/↓, mesmo
  vocabulário de VWAP/NL (`ddcd860`).

---

## 7. Melhorias de DESEMPENHO (§7)

Auditoria honesta: **nenhuma regressão introduzida**. Todas as adições
desta trilha são `useMemo`/derivações puras (`engineFallbackLevels`,
`chartObstacleZones`, `priceAxisLabels`) — recomputam só quando as deps
reais mudam, nunca a cada render. A histerese do Council (`f0e0c85`)
REDUZIU trabalho: antes o Trade Plan era destruído/recriado a cada tick
perto de fronteiras; agora é estável. Nenhuma otimização de perf
específica foi necessária além disso — o caminho quente (ciclo do Core
Engine, Web Workers para WASM) permanece intocado, por disciplina
(mover o ciclo do Core Engine para Worker exige iniciativa isolada
própria, nunca junto de outra coisa — Regra de Ouro 6).

---

## 8. SINCRONIZAÇÃO (§6) e RESPONSIVIDADE (§8) — auditado, sem regressão

- **Troca de ativo**: zera `chartData`/`priceData`/`orderBook`/
  `realCycle` (`App.tsx:936`) — nenhum dado antigo permanece.
- **Troca de timeframe**: reset explícito de `realCycle`/`engineStatus`/
  VolumeProfile (`App.tsx`, efeito `[chartTimeframe]`) — protege
  `engine`/`engineFallbackLevels`/S1/R1 transitivamente. Auditado nesta
  trilha, **nenhum bug novo** (`a093038`).
- **Header + Canvas**: `audit-header-maxcontent.mjs` — 11 viewports
  (iPad Mini portrait+landscape, iPad Pro, MacBook ~1000px lógicos,
  desktop, ultrawide 34") **CLEAN** com conteúdo máximo injetado.

---

## 9. Funcionalidades RECUSADAS (com justificativa técnica)

Nenhuma inteligência real foi recusada — mas várias ADIÇÕES foram
deliberadamente NÃO construídas, por fundamento técnico:

| Item | Por que NÃO | Fonte |
|---|---|---|
| **Preditor de IA / "probabilidade de subir"** | Pesquisa real (papers 2025-2026): análise técnica pura ~40-45% de acerto direcional em 7 dias (≈ acaso); séries de cripto ≈ ruído Browniano; modelos caixa-preta não superam abordagens simples. Fabricar uma probabilidade calibrada violaria a Regra de Ouro 2 — o repositório não tem backtest que a sustente | `AUDITORIA` §8.2 |
| **Osciladores clássicos desenhados** (MACD/Ichimoku/Bollinger/RSI em série) | RSI/ADX/ATR já alimentam o Council; desenhar a "sopa" contradiz a tese "o Core Engine decide" e a filosofia "não parecer TradingView cheio de indicador" | `AUDITORIA` §5 |
| **`opinionMass` bruta duplicada no gráfico** | Já refletida no peso dos cenários; mostrada como número no painel (§6.30), NÃO replicada no canvas (§2 "nunca duplicar") | §6.30 |

---

## 10. Inteligências NOVAS propostas (construções — dependem de decisão do Operador)

Não são "recuperar algo escondido" — são construir algo que ainda não
existe. Por isso aguardam autorização explícita (mudam layout/fonte de
dado), não iniciadas sozinhas:

1. **ChartDOM** (achado da pesquisa Sierra Chart/Bookmap §8.1) — book de
   ofertas real (já coletado) como escada visual ao lado do candle.
   Exige painel lateral dedicado. Maior valor potencial.
2. **Bandas da VWAP (±σ)** — a VWAP já é computada; as bandas são o
   mesmo cálculo + desvio real. Baixo custo, zero dado novo.
3. **OI/Funding desenhado** — dado já coletado, nunca desenhado como
   sub-série.
4. **Footprint / cluster** (bid×ask por vela) — exige auditar a
   granularidade do `orderflow-history` antes.
5. **Fase 2 do backtest** (`history-capture.js` pronto) — precisa de
   decisão de ONDE o Operador dispara + ambiente com rede real.
6. **Tipagem real do `WidgetContext`** (hoje `any`) — fecha a classe de
   bug que escondeu o `target1`; refactor maior, própria iniciativa.

Bloqueado em fonte de dado externa nova: **liquidation heatmap**.

---

## PRINCÍPIO FINAL — cumprido e honesto

"Se o Core calcula, o operador deve enxergar": os dois últimos campos
órfãos reais (`condition`, `opinionMass`) foram recuperados. "Nunca
fabricar previsões": a pesquisa confirmou externamente a disciplina que
já existia — nenhuma probabilidade inventada entrou. "Cada elemento
existe porque melhora a decisão": os rótulos foram compactados e
divididos, nunca multiplicados. O sistema está num platô sólido — o
próximo salto real é CONSTRUÇÃO (ChartDOM et al.), decisão de produto do
Operador, com fundamento técnico já documentado aqui e em
`AUDITORIA_ECOSSISTEMA_VISUAL.md`.
