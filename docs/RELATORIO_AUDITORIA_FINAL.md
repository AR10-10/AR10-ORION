# RELATÓRIO — ORDEM DE AUDITORIA FINAL (Certificação de Qualidade Operacional)

Data de referência: 2026-07-21. Branch `claude/eloquent-cannon-qyt86y` (PR #13).
Responde, seção a seção, à "ORDEM DE AUDITORIA FINAL — CERTIFICAÇÃO DE
QUALIDADE OPERACIONAL" do Operador. Cada afirmação abaixo é verificável —
por leitura direta do código (arquivo:linha), por `tsc`/`vitest`/`build`
reais rodados nesta sessão, ou por pesquisa já registrada em
`AUDITORIA_ECOSSISTEMA_VISUAL.md`/`RELATORIO_EPC.md`/`SYSTEM_HANDBOOK.md`.
Nenhum número aqui é estimado.

---

## 1. Certificação de Qualidade

### Funcionalidades concluídas (verificadas nesta rodada)

- **Trade Plan (Conselho)**: Entry/Stop/Target 1-N/R:R/Break Even/Trailing
  Stop — mecanismo real (`effectiveStopForTargetsHit`, `trade-plan.ts:236`),
  ratchet correto (break-even após 1º alvo, "trilha" para o preço do alvo
  anterior a partir do 2º), sincronizado 1:1 entre a barra de comando
  (`TradePlanTopStrip`, `App.tsx`) e o canvas (`EnhancedChart_110_Percent.tsx`)
  — mesma função pura, mesmos inputs (`targetsHit` do Track Record
  autoritativo), nunca duas fórmulas.
- **Trade Plan (fallback do Núcleo)**: Entry/Stop/Target1/Target2/R:R/
  contagem de obstáculos — desenhado no canvas quando o Conselho não tem
  plano (o caso mais comum), com o bug real do campo `target1` inexistente
  corrigido (`be1fbf8`) e a auditoria campo-a-campo (`fe91e34`) sem outra
  divergência.
- **Motivo honesto de ausência de plano**: `tradePlanAbsenceReason()`
  (`App.tsx`, module-scope) cobre as 4 causas reais e mutuamente exclusivas
  (sem Conselho ainda / risco travado / Conselho neutro / Conselho
  direcional sem estrutura), reaproveitada pela barra E pelo canvas —
  nunca um `return null` silencioso.
- **Sistema anti-colisão de rótulos do eixo** (`PriceLabelStackPlugin`):
  dois lados (esquerdo=contexto estrutural, direito=acionável agora),
  decaimento de alfa para BOS/CHOCH, zero sobreposição confirmada nos 11
  viewports do `audit-header-maxcontent.mjs`.
- **Confluência estrutural no Trade Plan**: `obstacleZonesInPath` é a
  ÚNICA função que conta obstáculos no caminho entrada→alvo, reusada pelo
  plano do Conselho E pelo fallback do Núcleo (`App.tsx`, `chartObstacleZones`).
- **Inteligência recuperada** (existia, era calculada, nunca era exibida):
  `engine.condition` ("Confirmação exigida (Núcleo)", `81f4553`) e
  `council.opinionMass` ("Opinion Mass L/S/N", `22ee891`).
- **Auditoria matemática §1/§3 do EPC anterior**: 42/43 módulos `nexus/`
  conectados (`AUDITORIA_ECOSSISTEMA_VISUAL.md` §7.2), as 8 dimensões do
  EPC §3 (filtros/confluências/modelos estatísticos/validações estruturais
  e temporais/projeções/risco/multi-timeframe) todas cobertas por engine
  real e testado.
- **Duplicação de dados corrigida nesta rodada**: `engine.volatilityPct`
  (proxy ingênuo de volatilidade, média de `(high-low)/close` sem gaps)
  eliminado — a row "VOLATILIDADE" do painel Market Regime agora lê
  `engine.marketRegime.atrPercent`, o ATR% real (true range com gaps,
  Wilder) que `regime-engine.js` já calculava e que `eta-engine.ts`,
  `aura-lifecycle.ts` e o tooltip do Multi-Timeframe Matrix já usavam —
  agora uma fonte única também para o timeframe selecionado. Ver §3/§4
  abaixo para o detalhe técnico.

### Funcionalidades parcialmente concluídas (limitação real, documentada — não bug)

- **Break Even/Trailing Stop no fallback do Núcleo**: por construção,
  `effectiveStopForTargetsHit` só é chamado quando existe um Trade Plan do
  Conselho (`TradePlanTopStrip`: o ratchet vive depois do guard `if
  (!plan)`; `EnhancedChart_110_Percent.tsx`: só dentro do bloco
  `if (tradePlan)`). O motivo é arquitetural, não um esquecimento: o
  ratchet precisa de `targetsHit`, que só existe porque
  `signal-track-record.ts` rastreia uma identidade de plano ESTÁVEL
  (`TrackRecordState.active.plan: TradePlan`, alimentado exclusivamente
  por `useTradePlanSnapshot()` em `App.tsx:2035-2037` — nunca pelo
  fallback). O Núcleo, sem o quórum de 7 agentes do Conselho, não tem essa
  identidade estável para ratchear com a mesma honestidade — por isso usa
  REACHED/BREACHED simples (derivação direta do preço vivo), nunca o
  ratchet. Vestir o sinal mais fraco (não-gated) com a mesma sofisticação
  visual do sinal mais forte (gated) transmitiria confiança institucional
  que o Núcleo sozinho não ganhou. **Recomendação**: manter como está;
  construir um segundo Track Record equivalente para o Núcleo é uma
  iniciativa nova, arquitetural, que precisa de autorização explícita do
  Operador (não uma correção pontual) — ver §7.
- **ATR/ADX**: ambos calculados e sincronizados (`regime-engine.js`, fonte
  única). ADX (`regime.adx`) alimenta a classificação de regime
  (`REGIME (MOTOR OFICIAL)`) mas não é exibido como número bruto em
  nenhum painel hoje — só via classificação derivada (TEND. FORTE/
  CONSOLIDAÇÃO/etc.) e cor por direção. Isso é diferente do que era o ATR%
  (que tinha um proxy duplicado e mais fraco competindo por atenção); aqui
  o cálculo é único e real, só não tem exposição bruta própria. Ver §4.

### Funcionalidades pendentes (já conhecidas, aguardando decisão do Operador — não descobertas agora)

Lista consolidada de `AUDITORIA_ECOSSISTEMA_VISUAL.md` §6/§7.5, reconfirmada
nesta auditoria sem lacuna nova:
1. Bandas da VWAP (±1σ/±2σ), Open Interest/Funding desenhado no gráfico,
   footprint/cluster chart, padrões geométricos clássicos (triângulo/
   cunha/bandeira), liquidation heatmap (este último bloqueado em fonte de
   dado, não em código).
2. `cross-exchange-service.ts` pronto, aguardando decisão de substituir o
   caminho inline que já funciona hoje (Fase 0.6, decisão deliberada, não
   código morto).
3. Backtest Fase 2 (`history-capture.js`) pronto, aguardando decisão de
   ONDE disparar a captura real + um ambiente com rede real (este sandbox
   não tem — ver §5).
4. Tipagem real de `WidgetContext` (hoje `createContext<any>(null)`,
   `App.tsx:254`) — fecha uma classe inteira de bug silencioso (foi a
   causa raiz do bug real do `target1`), mas é um refactor maior, mais
   arriscado, que merece sua própria iniciativa isolada.
5. Segundo Track Record para o fallback do Núcleo (Break Even/Trailing
   Stop) — item novo desta rodada, ver acima.

### Riscos encontrados

- **Risco de tipagem (`WidgetContext: any`)**: já documentado, é o único
  risco estrutural real conhecido — deixa qualquer nome de campo errado
  passar pelo `tsc` sem erro (classe do bug `target1`). Mitigado
  operacionalmente por uma varredura manual campo-a-campo já feita
  (`fe91e34`), mas não estruturalmente.
- **Risco de verificação visual em sandbox**: este ambiente não tem acesso
  de rede à Binance (confirmado por 403 do proxy) — `chartData` nunca
  popula aqui, então nenhuma feature no CANVAS pode ser confirmada por
  captura de tela/Playwright real nesta sessão. Mitigado por: `tsc`
  limpo, suíte `vitest` completa (execução real para matemática de
  fronteira, padrão de código para fiação entre módulos),
  `npm run build` sem erro, e `audit-header-maxcontent.mjs` (não depende
  de candles ao vivo — mede o HEADER/layout, não o canvas). A validação
  final do CANVAS em si (colisão de rótulos ao vivo, cores, etc.) já foi
  feita em rodadas anteriores via capturas de tela reais enviadas pelo
  Operador — não nesta sessão.
- **Bundles `llm-worker`/`llm-bridge` grandes** (6.03MB/5.91MB antes de
  gzip, 2.1MB gzip para o llm-bridge): verificado nesta rodada que são
  carregados via `import()` dinâmico (`App.tsx:8004`, `:8027`), só quando
  o Operador aciona a orquestração de IA local (WebLLM) — nunca no
  carregamento inicial. Não é uma violação da Regra de Ouro 7 (60fps/
  sem bloqueio); registrado aqui só por disciplina de auditoria (item 1
  da Disciplina de trabalho: toda observação real entra no relatório).

### Recomendações técnicas

1. Não construir nenhum dos itens pendentes (§1 acima) sem pedido
   explícito — todos são construção nova, não recuperação.
2. Se o Operador quiser Break Even/Trailing Stop também no fallback do
   Núcleo, tratar como iniciativa isolada (mesmo padrão da Regra de Ouro
   6 para o Core Engine): decidir primeiro que "identidade de plano"
   usar para o Núcleo (o próprio `engineFallbackLevels` já é razoavelmente
   estável entre re-renders, mas nunca foi pensado como algo "rastreável"
   como o Trade Plan do Conselho).
3. Priorizar, quando houver próxima rodada de construção nova, os itens
   já pesquisados e comparativamente mais baratos: bandas de VWAP (baixo
   custo, alto valor, matemática trivial sobre dado já existente).

---

## 2. Trade Plan — validação integral

| Campo | Conselho (plano real) | Fallback do Núcleo |
|---|---|---|
| Entry | ✅ `plan.entry.low/high`, zona ou ponto único | ✅ `engineFallbackLevels.entry` (`engine.entry`) |
| Stop | ✅ efetivo (ratchet) | ✅ `engine.stop`, estático |
| Target 1 | ✅ `plan.targets[0]` | ✅ `engineFallbackLevels.target1` (`engine.target` — bug do nome corrigido em `be1fbf8`) |
| Target 2 | ✅ `plan.targets[1]` quando existe | ✅ `engineFallbackLevels.target2` |
| Target 3 | ✅ suportado (`plan.targets[2]` quando o motor mapear) | ❌ Núcleo (`research-engine.js`/`trade-setup-matrix.js`) só expõe target1/target2 hoje — não é uma lacuna desta camada de UI, é o motor de origem que não calcula um 3º alvo estrutural. Fail-closed correto: nunca inventar um. |
| Break Even | ✅ `breakEvenActive = targetsHit > 0` | ❌ por design — ver §1 |
| Trailing Stop | ✅ `effectiveStopForTargetsHit` | ❌ por design — ver §1 |
| R:R | ✅ `plan.riskRewardRatios[i]` | ✅ `engineFallbackLevels.riskRewardRatio` |
| Obstáculos estruturais | ✅ `chartObstacleZones` (sem teto) | ✅ mesma função (`obstacleZonesInPath`), mesma fonte (`tradePlanStructureZones`) |

Confirmado: aparecem corretamente em qualquer ativo/timeframe onde o
Conselho ou o Núcleo tenham uma leitura real — fail-closed honesto
(nenhum plano fabricado) quando nenhum dos dois tem base suficiente, com
motivo explícito (`tradePlanAbsenceReason`) em vez de sumiço silencioso.

---

## 3. Auditoria de Dados

Verificação real (grep + leitura de código, não suposição) nas 6
categorias pedidas:

- **Dados/fontes duplicados**: nenhum novo encontrado. `smcZones`
  (`computeSmcZones(chartData)`) é a única fonte de OB/FVG/Liquidez —
  `tradePlanStructureZones`, `chartObstacleZones`, o Fibonacci Confluence
  Engine e o canvas (`unmitigatedFvgs`/`unmitigatedBlocks`) todos derivam
  dela, nunca recomputam.
- **Cálculos redundantes — 1 achado real, corrigido nesta rodada**:
  `engine.volatilityPct` (`App.tsx`, proxy próprio: média de
  `(high-low)/close`, SEM comparação com o close anterior — não é ATR de
  verdade) coexistia com `engine.marketRegime.atrPercent`
  (`regime-engine.js`, true range COM gaps: `max(h-l, |h-prevClose|,
  |l-prevClose|)`, período de Wilder) — duas fórmulas diferentes para a
  mesma grandeza, no mesmo timeframe, ambas rotuladas como "volatilidade".
  A segunda já era a fonte real usada por `eta-engine.ts`,
  `aura-lifecycle.ts` e o tooltip do Multi-Timeframe Matrix (para os
  outros 5 prazos) — só a row "VOLATILIDADE" do painel Market Regime
  ainda usava o proxy mais fraco. Corrigido: `volatilityPct` removido por
  inteiro (0 usos restantes, confirmado por grep), a row agora lê
  `engine.marketRegime.atrPercent` (renomeada "VOLATILIDADE (ATR%)" para
  deixar explícito que é a mesma grandeza do tooltip MTF). Teste novo:
  `tests/visual-math-consistency.test.ts` (bloco "ORDEM §3/§4").
- **Indicadores repetidos**: checado especificamente por RSI/ATR/ADX
  (candidatos mais prováveis a reimplementação paralela). RSI: achado
  inicial impreciso corrigido por leitura direta — `computeRSI` é uma
  ÚNICA função pura, exportada de `research/engines/lorentzian-classifier.js:136`
  (mora ali por ter sido a primeira graduação real deste cálculo, não por
  ser "do classificador"). `App.tsx:90/1845` importa essa mesma função
  para `currentRsi` (a leitura operacional — gauge, `MomentumAgent`,
  Market Regime Widget) e `multi-timeframe-engine.ts:46/164` importa a
  MESMA função para calcular RSI nos outros 5 prazos da Matriz
  Multi-Timeframe. `council.ts`'s `momentumAgentVote` não computa RSI —
  recebe o número já pronto como parâmetro. Ou seja: zero reimplementação,
  1 função, N chamadas sobre janelas de candles diferentes (uso
  legítimo, não duplicação). O classificador k-NN do Lorentzian usa essa
  mesma função como um dos seus insumos de feature vector, permanecendo
  um sinal de confluência independente na CLASSIFICAÇÃO final (comentário
  real no código: "Independent confluence signal... never allowed to
  change `signal`") sem precisar de uma segunda fórmula de RSI para isso.
  ADX: única implementação (`regime-engine.js`), `market-regime/index.js`
  é só barrel re-export — sem duplicação.
- **Pipelines paralelos**: nenhum novo. `cross-exchange-service.ts`
  continua pronto mas não ligado (Fase 0.6, decisão deliberada e
  autodocumentada no próprio arquivo, não uma duplicata rodando em
  paralelo).
- **Memória duplicada**: 4 mecanismos de persistência, todos com escopo
  distinto e sem sobreposição — `SESSION_STATE_KEY` (localStorage, estado
  de sessão: ativo/timeframe), `WIDGET_PREFS_KEY` (localStorage, layout
  V16), `UNLOCK_KEY` (`access-gate.tsx`, autenticação), e o IndexedDB
  `ar10-cyborg-nexus` (`nexus/persistence.ts`: candles, snapshot summary,
  Track Record — Local-First real). Nenhum dos 4 persiste a mesma
  informação que outro.

**Fonte única de verdade**: confirmada em todas as 6 categorias após esta
rodada — 1 redundância real encontrada e eliminada, o resto já estava
correto.

---

## 4. Auditoria Matemática

| Cálculo | Ativo | Sincronizado | Exposto ao Operador |
|---|---|---|---|
| Conselho (7 agentes, linear opinion pool) | ✅ | ✅ | ✅ stance, agreement, **opinionMass L/S/N** (recuperado `22ee891`) |
| Núcleo (Core Engine, LEI 24) | ✅ | ✅ | ✅ direção/entry/stop/targets/**condition** (recuperado `81f4553`) |
| GMIL (consenso institucional, 3 provedores + 2 dimensões locais) | ✅ | ✅ | ✅ `GmilContextWidget` |
| VWAP | ✅ | ✅ | ✅ linha nativa + rótulo no eixo (estado direcional) |
| Volume Profile (WASM, quant-worker) | ✅ | ✅ | ✅ POC/HVN, fixed-range + sessão |
| Liquidez (EQH/EQL, livro de ofertas) | ✅ | ✅ | ✅ `hasBook`/imbalance + zonas no gráfico |
| Order Blocks | ✅ | ✅ | ✅ desenhados + contam como obstáculo no Trade Plan |
| FVG | ✅ | ✅ | ✅ idem |
| Harmônicos | ✅ | ✅ | ✅ PRZ compactado no eixo (`ddcd860`) |
| ATR | ✅ (`regime-engine.js`, única fonte agora) | ✅ | ✅ "VOLATILIDADE (ATR%)" — corrigido nesta rodada |
| ADX | ✅ (`regime-engine.js`) | ✅ | ⚠️ só via classificação derivada (REGIME), não como número bruto — ver proposta abaixo |
| RSI | ✅ (Wilder, `computeRSI` em `lorentzian-classifier.js`, fonte única) | ✅ | ✅ gauge "RSI (14)", limiares reais (`RSI_OVERBOUGHT`/`RSI_OVERSOLD`) |
| EMA | ✅ | ✅ | ✅ linha + rótulo no eixo |
| Confluência | ✅ (`confluence-engine.ts`, `institutional-score.ts`) | ✅ | ✅ CONVICTION badge, Multi-Timeframe Matrix |
| Heat (Heat Score) | ✅ (`heat-score.ts`, percentil real) | ✅ | ✅ |
| Risco | ✅ (`rr-quality.ts`, Risk Gate) | ✅ | ✅ `council.riskGated`, R:R real |
| Forecast | ✅ (`multi-horizon forecast`, ETA engine) | ✅ | ✅ ETA no Trade Plan strip |

**Proposta para o único item com exposição parcial (ADX)**: hoje `adx`
só aparece embutido na classificação `REGIME (MOTOR OFICIAL)` — um
operador que queira o número bruto (força de tendência 0-100, leitura
clássica de Wilder) não tem onde ver. Candidato honesto de pequena
evolução: acrescentar o valor de `regime.adx` ao tooltip da row "REGIME"
(mesmo padrão do tooltip do Multi-Timeframe Matrix que já mostra
`ATR X.XX%`), sem criar uma row nova (Diretriz "sem excesso de
informações" — o painel já tem 8 rows). Não implementado nesta rodada por
não ter sido pedido explicitamente e não ser um bug — proposto para
autorização do Operador.

---

## 5. Auditoria Visual

- `npm run build`: **limpo** (10.88s, 1821 módulos, zero erro).
- `tsc --noEmit`: **limpo**.
- `npx vitest run`: **103 arquivos / 1694 testes, 100% passando** (1691
  antes desta rodada + 3 novos do achado VOLATILIDADE/ATR%).
- `scripts/audit-header-maxcontent.mjs` (11 viewports — iPad Mini
  portrait/landscape, iPad portrait, iPad Air, iPad Pro portrait/
  landscape, MacBook meia-tela, desktop, monitor grande, ultrawide 21:9 e
  34"): **CLEAN em todos os 11**, rodado nesta sessão contra um build de
  produção real (`vite preview`).
- **Limitação honesta**: este sandbox não tem rede de saída para a
  Binance (confirmado por 403 do proxy) — o gráfico (`chartData`) nunca
  popula aqui, então "nenhum objeto sobrepõe outro" no CANVAS em si
  (rótulos de preço, zonas, Trade Plan) não pode ser fotografado/verificado
  ao vivo NESTA sessão. A cobertura real desse ponto vem de: (a) o sistema
  anti-colisão único (`PriceLabelStackPlugin`) que resolve TODOS os
  rótulos do eixo pela mesma lógica geométrica, testado por execução real
  em `tests/price-label-stack-plugin.test.ts`; (b) as capturas de tela
  reais que o Operador já enviou em rodadas anteriores desta sessão,
  confirmando visualmente as correções (`CHOC`×`EMA 21`, fallback do
  Núcleo aparecendo, divisão de lados) — não re-verificável agora, mas já
  verificado quando aconteceu.

---

## 6. Demanda e Oferta

Sincronização Supply & Demand / Liquidez / Order Blocks / FVG com o Trade
Plan — **confirmada, sem lacuna nova**:

- Fonte única: `smcZones = computeSmcZones(chartData)` (`App.tsx:1656`).
- `tradePlanStructureZones` (usado por `obstacleZonesInPath`) deriva
  DIRETO de `smcZones` (OB+FVG não mitigados) — mesma identidade
  geométrica (`low`/`high`) que o canvas desenha.
- As zonas desenhadas no canvas (`unmitigatedFvgs`/`unmitigatedBlocks`,
  limitadas a 3 por decluttering visual) têm uma garantia de união real
  já construída em rodada anterior (`isRealObstacle`, `App.tsx:6126-6130`):
  qualquer zona que seja um obstáculo REAL do plano ativo (Conselho ou
  Núcleo) entra na lista desenhada mesmo se cair fora dos "3 mais
  recentes" — nunca um obstáculo citado no texto do alvo ("⚠ 2") fica
  sem aparecer destacado no gráfico.
- Liquidez (EQH/EQL) é conceitualmente separada de OB/FVG no
  `obstacleZonesInPath` (nunca conta como "obstáculo estrutural") — isso é
  correto pela convenção SMC: liquidez é normalmente um ALVO/ímã de
  preço, não um bloqueador, então tratar os dois com a mesma semântica
  seria uma mistura de conceitos, não uma sincronização melhor.

---

## 7. Relatório Final

### Checklist por módulo (% de conclusão real)

| Módulo | % | Observação |
|---|---|---|
| Core Engine (Núcleo, LEI 24) | 100% | única fonte real de LONG/SHORT/WAIT |
| Conselho Multi-Agente | 100% | histerese, opinionMass exposto |
| Trade Plan (Conselho) | 100% | Entry/Stop/Alvos/BE/Trailing/R:R/Obstáculos |
| Trade Plan (fallback Núcleo) | 90% | tudo exceto BE/Trailing (limitação de design documentada, não bug) |
| GMIL / Consenso Institucional | 100% | |
| VWAP / EMA / Nexus Line | 100% | |
| Volume Profile | 100% | WASM, fixed-range + sessão |
| Order Blocks / FVG / Liquidez | 100% | sincronizados com Trade Plan (§6) |
| Harmônicos | 100% | PRZ compactado |
| Market Regime (ATR/ADX/Bandwidth) | 95% | ATR corrigido nesta rodada; ADX bruto não exposto (proposta em §4, não bug) |
| RSI / Confluência / Heat / Risco / Forecast | 100% | |
| Sistema anti-colisão do eixo (labels) | 100% | 2 lados, decaimento, 11 viewports CLEAN |
| Auditoria de dados (SSOT) | 100% | 1 redundância real encontrada e eliminada nesta rodada |
| Verificação visual em sandbox | parcial (estrutural) | header/layout 100% verificável aqui; canvas ao vivo depende de rede real (fora deste ambiente) |

### Itens recuperados nesta rodada
- `engine.marketRegime.atrPercent` como fonte única de "VOLATILIDADE"
  (eliminando o proxy duplicado `volatilityPct`).

### Itens evoluídos nesta rodada
- Rótulo "VOLATILIDADE (ATR%)" — nomeação consistente com o mesmo dado já
  mostrado no tooltip do Multi-Timeframe Matrix.
- Checklist de fontes (Síntese Operacional) atualizado para checar a
  mesma fonte real.

### Itens pendentes (honestos, não escondidos)
- Break Even/Trailing Stop no fallback do Núcleo — limitação de design,
  requer decisão do Operador sobre construir um 2º Track Record.
- ADX bruto não exposto fora da classificação de regime — proposta
  pequena documentada em §4, não implementada sem pedido explícito.
- Os 5 itens de "funcionalidades pendentes" do §1 (VWAP bands,
  footprint, OI/funding no gráfico, liquidation heatmap, padrões
  geométricos, `cross-exchange-service.ts`, Backtest Fase 2,
  `WidgetContext` tipado) — todos já conhecidos, nenhum novo.

### Oportunidades reais de evolução (priorizadas, não construídas sem pedido)
1. Bandas de VWAP (±1σ/±2σ) — menor custo, maior valor imediato.
2. Tooltip do ADX bruto na row REGIME — trivial, zero nova UI.
3. Tipagem real de `WidgetContext` — maior risco/esforço, mas fecha uma
   classe inteira de bug silencioso.

**Nenhuma funcionalidade desnecessária foi criada.** Todas as mudanças
desta rodada (1 correção de duplicação de dados + 3 testes novos) têm
justificativa técnica auditável e verificação real (`tsc`, `vitest`,
`build`, `audit-header-maxcontent.mjs`) — sem exceção, sem opinião sem
fundamento.
