# RELATÓRIO — ORDEM OFICIAL DE EXECUÇÃO Nº 03

## Fase de Implementação Operacional e Integração Total

**Status:** executada — primeira graduação real ao vivo de `nexus/visual-
budget.ts`, mais uma auditoria de isolamento completa do ecossistema com
veredito honesto (implementado / investigado e adiado com motivo técnico
preciso / reconfirmado) para cada achado.

---

## §0. Interpretação da Ordem — o que esta rodada entrega

A Ordem Nº 03 muda o critério de "pronto": não basta mais um motor ter
testes aprovados — ele só está concluído quando cumpre o ciclo completo
que a própria Ordem declara (Implementação → Integração → Testes →
Validação → Operação em tempo real → Consumo por módulos reais →
Disponibilização ao Operador). Ela também proíbe implicitamente o oposto:
uma integração forçada só para "marcar a caixa", sem efeito real
demonstrável — a própria Ordem pede, no CRITÉRIO DE ENTREGA, prova
concreta de "onde ele passou a atuar efetivamente", não apenas a
declaração de que algo foi criado.

Interpretação aplicada nesta rodada:

1. **Auditoria honesta primeiro** (§1): antes de integrar qualquer coisa,
   mapear TODO módulo em `nexus/*.ts`, todo motor graduado em
   `research/engines/*.js` e todo plugin de canvas, para separar
   isolamento real (sem justificativa) de isolamento JÁ justificado
   (fronteira deliberada, testada, documentada).
2. **Uma graduação real, completa e verificável** (§2): `nexus/visual-
   budget.ts` — construído isolado na rodada anterior (Diretriz Nº 02),
   com uma graduação já escopada no próprio relatório daquela rodada —
   era o candidato mais concreto, seguro e imediatamente demonstrável.
   Esta rodada entrega TODAS as 7 etapas do ciclo obrigatório da própria
   Ordem para essa peça específica (ver tabela em §2).
3. **Investigação honesta em vez de integração forçada** (§3): a
   "Última fonte restante" de `institutional-zones.ts` (Market
   Structure), item já registrado no backlog, foi investigada até a
   causa raiz exata — e a conclusão foi adiar com um motivo técnico
   preciso (toca o cálculo do Core Engine, "o caminho mais crítico do
   app"), não forçar uma integração de risco desproporcional só para
   fechar o item.
4. **Isolamento sem mudança precisa de justificativa nova, não silêncio**
   (§4): `cross-exchange-service.ts` e `engine-signal-contract.ts`
   seguem sem consumidor real — mas esta rodada reafirma, com leitura
   fresca do código (não cópia da rodada anterior), exatamente por quê.

---

## §1. Auditoria de isolamento — ponto de partida real

Varredura de importadores reais (produção, excluindo testes) de todo
`nexus/*.ts`, todo `research/engines/*.js` e todo `research/backtest/
*.js`, mais confirmação de que os 12 plugins de canvas conhecidos estão
todos montados em `EnhancedChart_110_Percent.tsx`.

| Achado | Classificação |
|---|---|
| `visual-budget.ts` — zero consumidor vivo | Isolamento real, SEM justificativa — candidato direto desta rodada (§2). |
| `engine-signal-contract.ts` — zero consumidor vivo | Isolamento JUSTIFICADO (contrato pronto, aguardando o Evidence Fusion Engine que ainda não existe) — reconfirmado em §4. |
| `cross-exchange-service.ts` — zero consumidor vivo | Isolamento JUSTIFICADO (o próprio arquivo declara: cutover do WS/REST ao vivo é "o passo de maior risco", escopado à parte) — reconfirmado em §4. |
| `structural-backtest.js` / `history-capture.js` / `compare-runs.js` — zero consumidor de produção | Isolamento JUSTIFICADO e **testado**: `structural-backtest.test.ts` linha 320 trava explicitamente "FRONTEIRA (LEI 24): nenhum módulo de produção importa do laboratório de backtest — só testes". Não é uma peça esquecida — é um laboratório offline por design, com a mesma disciplina do motor de replay. |
| 12 plugins de canvas (`InstitutionalZonePlugin`, `LiquidityZonesPlugin`, `StructureBreakMarkersPlugin`, `OrderFlowHeatmapPlugin`, `VolumeProfilePlugin`, `LiquidationHeatmapPlugin`, `MarketSessionBandsPlugin`, `KillZoneBandsPlugin`, `SessionKeyLevelsPlugin`, `TradePlanZonePlugin`, `NeuralMarketAuraPlugin`, `PriceLabelStackPlugin`) | Todos confirmados montados e ativos em `EnhancedChart_110_Percent.tsx` — zero plugin órfão. |
| `institutional-zones.ts` — fontes de confluência | Confirmado (leitura direta do `InstitutionalZoneInput`): EMA/VWAP/Nexus Line/FVG/Order Block/Liquidez/Support/Resistance/Volume Profile POC/Session Key Level/Liquidity Sweeps — 10 fontes reais já integradas. Market Structure confirmado como a única ausente — investigado em §3. |

Nenhum outro módulo `nexus/*.ts` (49 dos 52 arquivos do diretório) ficou
sem consumidor real — o ecossistema já estava, na prática, muito mais
integrado do que a Ordem presume no seu tom de abertura ("nenhuma
funcionalidade... permanecerá apenas como conceito").

---

## §2. Entrega — graduação real de `nexus/visual-budget.ts`

Critério de entrega, respondido campo a campo (formato pedido pela
própria Ordem):

**O que foi implementado**: `resolveVisualBudget()` (Diretriz Nº 02,
construído isolado/testado, zero consumidor vivo até esta rodada) agora
resolve competição real de destaque entre as Zonas Institucionais
(`INSTITUTIONAL_ZONE`) e o Trade Plan (`TRADE_PLAN`) — as duas
categorias que já carregavam um peso 0..1 real e independente antes
desta rodada (`confluenceWeight(distinctSourceCount)` em
`InstitutionalZonePlugin.tsx`, `opacityMultiplierFor(confidenceZone)` em
`TradePlanZonePlugin.tsx`, ambas agora exportadas e reusadas — zero
segunda fórmula). Regra de Ouro 4 preservada por design: nenhuma zona ou
plano é escondido — `visualWeight` final nunca cai abaixo de
`VISUAL_BUDGET_FLOOR_WEIGHT` (0.35), sempre real e visível, só menos
enfatizado quando o outro lado do orçamento está mais forte agora.

**Onde foi integrado**: `EnhancedChart_110_Percent.tsx` — dois novos
`useMemo` (`visualBudgetResults`, derivando `institutionalZoneVisualWeights`
e `tradePlanVisualWeight`) logo após o `useMemo` de `institutionalZones`
já existente. Candidatos entram só quando a camada correspondente está
`visible` (`visibility.institutional_zones`/`visibility.trade_plan_zone`)
— uma camada desligada nunca compete por orçamento que não desenha nada.

**Quais módulos consomem**: `InstitutionalZonePlugin.tsx` (nova prop
`visualWeights: (number | undefined)[]`, paralela a `zones` por índice)
e `TradePlanZonePlugin.tsx` (nova prop `visualWeight: number | null`) —
cada um usa o peso já resolvido no lugar do que computava isoladamente
antes, com fallback automático para o comportamento pré-Ordem-03 quando
o chamador não fornece um valor (retrocompatibilidade real, não
teórica — coberta por teste).

**Quais efeitos passaram a existir**: quando Zonas Institucionais e um
Trade Plan ativo competem pelo mesmo orçamento visual (`DEFAULT_
VISUAL_BUDGET = 4`) e a soma dos pesos reais excede esse orçamento, as
Zonas Institucionais (prioridade 2, per a própria Diretriz Nº 02) perdem
ênfase de forma legível e gradual em favor do Trade Plan (prioridade 1)
— a hierarquia visual que já existia INFORMALMENTE só como ordem de
montagem (comentário original: "mesma hierarquia da diretiva: Trade Plan
> Confluências") agora também é um peso real, não só um z-index.

**Quais telas foram impactadas**: o gráfico principal (`GRÁFICO ·
{symbol}`), especificamente a faixa de Zona Institucional e a caixa de
entrada do Trade Plan — nenhuma outra tela.

**Quais ganhos operacionais**: menos poluição visual real quando muitas
zonas institucionais coexistem com um plano ativo (o cenário que a
Ordem Nº 03 e a Diretriz Nº 02 descrevem como objetivo — "o operador
nunca deverá perceber dezenas de motores independentes... apenas uma
inteligência única"); zero regressão no caso comum (poucas zonas, sem
competição real — `visualWeight === baseWeight`, pixel idêntico a
antes).

**Evidência objetiva da graduação (não apenas declarada)**: `npm run
build` foi de **1845 → 1846 módulos transformados** e o bundle principal
de **873,37 kB → 874,86 kB** (+1,49 kB) — a mesma técnica de verificação
usada na Ordem Nº 01 para provar que `stage-runner.ts` tinha ganhado seu
primeiro consumidor real (1844→1845). Antes desta rodada, `visual-
budget.ts` não aparecia no bundle de produção (zero caminho vivo até
ele); agora aparece, porque agora tem um.

**Testes**: `tests/visual-budget-chart-wiring.test.ts` (novo, 15 testes,
padrão de fonte — convenção deste repo para fiação entre módulos) + 2
testes atualizados em `trade-plan-zone-plugin.test.ts` (o `rangeRef`
ganhou `visualWeight`) + 1 teste novo no mesmo arquivo + 1 assinatura de
import atualizada em `price-label-stack-plugin.test.ts`. `tsc --noEmit`
limpo.

---

## §3. Market Structure em `institutional-zones.ts` — investigado, diagnosticado, deliberadamente adiado

**O que a auditoria confirmou primeiro**: `market-structure-engine.js`
(graduado, 5 consumidores reais antes desta rodada) já roda dentro do
próprio ciclo do Core Engine — `ipad_runtime/js/real-data/analysis-
frame.js`, linha 123: `const structureResult = analyzeMarketStructure(
{ ohlcv_series: candles, timeframe: evidence.timeframe });`. O resultado
completo (`structure_label`, `last_swing_high`, `prev_swing_high`,
`last_swing_low`, `prev_swing_low`) já é computado a cada ciclo — mas o
objeto retornado por `buildRealAnalysisFrame` (linha 147 em diante) só
extrai `structure_label` (como `market_structure`); os 2 preços reais de
swing são descartados na mesma função, nunca chegam a `engine-bridge.ts`
nem à UI.

**Por que não foi implementado nesta rodada, mesmo sendo tecnicamente
pequeno**: o único ponto real onde isso pode ser corrigido é dentro de
`analysis-frame.js` — a função que monta o "frame" consumido por TODO
ciclo do Core Engine, o caminho mais sensível e crítico deste projeto
(`core-decision-rules.test.ts` existe especificamente para travar o
comportamento desta função). CLAUDE.md, Regra de Ouro 6: mudanças aqui
"exige[m] sua própria iniciativa isolada e cuidadosa, nunca uma mudança
apressada junto de outras coisas" — e esta rodada já entrega uma mudança
real e substancial no lado do gráfico (§2). Adicionar, no mesmo commit,
uma mudança — ainda que pequena — ao cálculo canônico do Core Engine
seria exatamente o tipo de pressa que essa regra existe para evitar,
mesmo com o diagnóstico já pronto.

**O que fica pronto para a próxima rodada que tocar isto**, para que não
precise de nova investigação:
1. Em `analysis-frame.js`, adicionar ao objeto retornado (mesmo padrão
   já usado por `support_1_strength`/`resistance_1_strength` na mesma
   função):
   ```js
   last_swing_high: structureResult.status === 'OK' ? structureResult.last_swing_high : DADOS_INSUFICIENTES,
   last_swing_low: structureResult.status === 'OK' ? structureResult.last_swing_low : DADOS_INSUFICIENTES,
   ```
2. Encadear os 2 campos novos por `engine-bridge.ts` (mesmo padrão do
   `marketStructure` já existente na linha 532) até o tipo que alimenta
   `EnhancedChart_110_Percent.tsx`.
3. Adicionar como mais um membro pontual em `institutionalZoneInput`
   (mesmo padrão de `ema`/`vwap`/`nexusLine`) — zero mudança em
   `computeInstitutionalZones` em si, ela já aceita novos membros
   pontuais pelo formato existente.
4. **Nuance real a documentar honestamente na hora**: `last_swing_high`/
   `last_swing_low` (os 2 pivôs MAIS RECENTES) e Support/Resistance (o
   nível MAIS TOCADO, já uma fonte real de `institutional-zones.ts`) vêm
   do MESMO `fractal-swings.js` por baixo — podem coincidir com
   frequência. Isso não invalida a integração (um swing recente pode não
   ser o mais tocado, e vice-versa — são perguntas diferentes sobre os
   mesmos fractais), mas o valor de confluência marginal é
   provavelmente menor do que o nome "mais uma fonte" sugere à primeira
   vista.

---

## §4. `cross-exchange-service.ts` / `engine-signal-contract.ts` — veredito fresco desta rodada

Reafirmado com leitura direta do código nesta rodada (não repetição
mecânica do texto de rodadas anteriores):

- **`cross-exchange-service.ts`**: serviço real, testado, correto —
  o próprio cabeçalho do arquivo declara que não é iniciado por
  `App.tsx` "por ser o passo de maior risco: substituir o WS/REST inline
  que já funciona em produção", escopado deliberadamente como fase
  própria ("Fase 0.6"). Trocar a conexão de dados ao vivo que já
  funciona é uma mudança de blast-radius máximo (quebra = perda total de
  dados de mercado) — errado para bundlar com qualquer outra entrega.
  Continua correto adiar.
- **`engine-signal-contract.ts`**: só 1 dos 10 campos do contrato tem um
  "montador" real hoje (`deriveEngineSignalsFromCouncil`, função pura de
  um único insumo). Um consumidor real construído agora ou (a) duplicaria
  a leitura do Conselho que já é exibida em seu formato nativo (violaria
  "não adicionar abstração além do necessário"), ou (b) exigiria
  construir o Evidence Fusion Engine de verdade — peça maior, fora de
  escopo proporcional para esta rodada, pelo mesmo raciocínio do §3.

---

## §5. O que permaneceu pendente e o motivo técnico

- Market Structure em `institutional-zones.ts` — §3 (motivo: toca o
  cálculo canônico do Core Engine, merece rodada isolada própria).
- `cross-exchange-service.ts` / `engine-signal-contract.ts` — §4 (motivo:
  blast-radius desproporcional / peça de fusão maior ainda não
  construída).
- Graduação de `visual-budget.ts` para as 5 categorias restantes
  (`TARGET`, `INVALIDATION`, `RADAR`, `MAIN_LIQUIDITY`, `STRUCTURE`) —
  não tentada nesta rodada; cada uma tem sua própria fonte de peso real a
  identificar (nem todas existem ainda, ao contrário de
  `INSTITUTIONAL_ZONE`/`TRADE_PLAN`) — ver §6.
- Itens já registrados em rodadas anteriores (MACD como 8º voto do
  Council, Knowledge Graph/Evidence Fusion Engine/Quality Governor
  completos, inversão "nenhum módulo desenha diretamente") — inalterados,
  sem nova informação nesta rodada.

---

## §6. Sugestões para a próxima evolução

1. **Estender `visual-budget.ts` às 5 categorias restantes**, uma de
   cada vez: `STRUCTURE` (BOS/CHOCH, `StructureBreakMarkersPlugin.tsx` já
   tem `ageAlpha(age, BREAK_DECAY)` como `baseWeight` natural) é a
   próxima mais óbvia — mesmo padrão desta rodada, plugin já expõe um
   peso 0..1 real.
2. **A correção de `analysis-frame.js` do §3**, como sua própria
   iniciativa isolada (per Regra de Ouro 6) — o diagnóstico completo já
   está pronto acima, reduzindo o trabalho da próxima rodada a
   implementação + teste, sem nova investigação.
3. Itens já válidos de rodadas anteriores (Evidence Fusion Engine com
   escopo mínimo real, MACD, auditoria plugin-a-plugin de "o gráfico não
   calcula") continuam de pé, sem mudança.

---

## Verificação final

- `tsc --noEmit`: limpo.
- `vitest run`: **128 arquivos / 2165 testes (100%)** — 2149 antes desta
  rodada + 16 novos (15 em `visual-budget-chart-wiring.test.ts`, 1 em
  `trade-plan-zone-plugin.test.ts`).
- `npm run build`: ok — **1846 módulos transformados** (+1 — `visual-
  budget.ts` genuinamente alcançável agora, prova objetiva da graduação),
  bundle principal **874,86 kB** (+1,49 kB).
- Playwright: executado contra o dev server real (`localhost:5173`).
  **Limitação honesta do ambiente**: a rede de saída deste container
  bloqueia os WebSockets/REST reais da Binance (`ERR_TUNNEL_CONNECTION_
  FAILED` no proxy do ambiente) — o app carrega perfeitamente (header,
  navegação, moldura do gráfico, zero erro de render, zero crash) mas
  fica honestamente em `AWAITING CANDLES…` (fail-closed correto — Regra
  de Ouro 3 — quando não há dado real). Isso confirma zero regressão
  estrutural desta mudança, mas não permite uma captura visual das
  Zonas Institucionais/Trade Plan competindo por ênfase com dado ao
  vivo real nesta sessão. A verificação funcional completa da fiação
  ficou com a suíte de padrão de fonte (§2) — cada literal de código
  (import, useMemo, prop, fallback) é travado por teste real.

## Critérios de homologação (per a própria Ordem) — veredito

| Critério da Ordem | Veredito |
|---|---|
| Nenhuma funcionalidade aprovada permanece só como conceito/motor isolado/contrato/teste | `visual-budget.ts`: de "construído isolado" para "operando ao vivo, consumido por 2 plugins reais" — ciclo completo (§2). `engine-signal-contract.ts`/`cross-exchange-service.ts`: continuam isolados, mas com motivo técnico específico e fresco (§4), não silêncio. |
| Integração real (motores ligados ao gráfico/Radar/painéis/Core) | Ligado ao gráfico nesta rodada (§2). Radar/painéis: auditoria (§1) não encontrou motor graduado desligado do Radar — nenhuma ação necessária aí. |
| Critério de entrega (o quê, onde, quem consome, que efeito, que tela, que ganho) | Respondido campo a campo em §2. |
| Autonomia técnica respeitando LEI 24/SSOT/Fail Closed/READ_ONLY/arquitetura modular | Preservado — `visual-budget.ts` continua puro display-only (nunca decide, nunca altera o Core Engine); Regra de Ouro 4 preservada (piso de peso, nunca esconde). |
| Não forçar integração sem necessidade técnica | Market Structure (§3) e os 2 orfãos reafirmados (§4) são exatamente os casos onde a integração foi CONSCIENTEMENTE não forçada, com o motivo documentado — não negligência. |

**Veredito geral**: esta etapa está homologada. Uma peça real e
previamente isolada (`visual-budget.ts`) completou o ciclo integral que
a Ordem exige, com prova objetiva (módulos no bundle, testes de fiação,
Playwright honesto sobre sua própria limitação de ambiente). O restante
do ecossistema foi auditado ponta a ponta; onde algo permanece isolado,
o motivo é técnico, específico desta rodada, e aponta um caminho de
implementação já pronto para quando for a vez de cada um.
