# AR10 CYBORG — Estratégia de Evolução para Nível Elite

**Data:** 2026-08-16 · **Pedido de origem:** Operador — "faz uma verificação
em todo o ecossistema... o que está faltando, redundância... traz uma
estratégia de evolução pra ficar perfeito igual as plataforma de elite,
profissional... terminais profissionais... liberdade total."

**Método:** este NÃO é um novo levantamento do zero. Existem hoje **9
documentos de auditoria** + `SYSTEM_HANDBOOK.md` (6.953 linhas, log
cronológico completo) + `docs/MAPA_EVOLUCAO_CIBORGUE.md` (fotografia de
2026-07-27) + `docs/ELITE_TRADING_RESEARCH_MAP.md` (pesquisa externa
consolidada, ~3 semanas). Reconstruir tudo isso do zero seria trabalho
duplicado e pior (menos verificado) que o que já existe. O trabalho real
desta rodada foi: **reconciliar** essas fontes contra o código de HOJE,
achar onde a fotografia envelheceu, e julgar o que sobra.

Achado central: **a fotografia de 2026-07-27 está desatualizada em pelo
menos 5 pontos verificáveis** — três semanas de entregas reais (TPO
Profile, Order Book Depth, Trade Simulation/Expectancy/Platt Calibration,
Market Data Fabric TradFi, ZigZag graduado, Visual Budget, e a correção de
hoje mesmo) fecharam gaps que o board de tarefas e os documentos ainda
listavam como abertos. Isso não é falha de disciplina — é o preço real de
mover rápido sem parar pra sincronizar a cada passo. Corrigido abaixo.

---

## 1. Correções ao registro existente (verificado código-a-código, hoje)

| Item rastreado como aberto | Estado real verificado agora | Evidência |
|---|---|---|
| #287 "motor de Visual Relevance (anti-colisão)" | **JÁ EXISTE** | `nexus/visual-budget.ts` (competição cruzada, 7 prioridades) + `nexus/layer-relevance.ts` (relevância por camada) + `PriceLabelStackPlugin.tsx` (resolvedor de 4 tiers no eixo) |
| #295 "Max Drawdown/Sharpe" | **JÁ EXISTE** | `nexus/expectancy.ts` (`maxDrawdownR`, `sharpeRatio`, `recoveryFactor`) exibidos em `App.tsx:5435-5436`. Só CSV export/journal/teto de perda diária continuam reais |
| #285 "CHoCH como texto solto" | **JÁ FALSO** | BOS/CHOCH migrou pro eixo (`PriceLabelStackPlugin`) há várias rodadas |
| #281 "Graduar HMM de regime" | **RECUSADO, não pendente** | Task #272 já decidiu o escopo real (RegimeBadge, não HMM) |
| #82 "ADITIVO V-MAX Etapas 2-15" | **JÁ FECHADO** | Task #241 fechou explicitamente; ficou marcado `pending` no board por bug de higiene, não por trabalho real |
| ZigZag "PARCIAL, nunca camada própria" (MAPA §3) | **JÁ FALSO** | Graduado com `CHART_LAYER_IDS`/plugin próprio (Entrega 47, task #280) — depois da data do MAPA |
| ATR% "Wilder não usada fora do próprio módulo" (MAPA Tier 2 #13) | **JÁ FALSO** | `supertrend-engine.js`, `liquidity-void-engine.js` e `hmm-regime-model.js` (todos construídos depois) já importam `computeAtrPercent` — 3 consumidores reais novos. A divergência com `regime-engine.js` continua real, mas "ninguém usa" não é mais verdade |

Board de tarefas já corrigido nesta rodada (#82, #281, #287 fechados;
#285/#295 com escopo real restrito ao que genuinamente falta).

---

## 2. O que é REDUNDÂNCIA real (não percepção)

1. **Resolvido hoje**: `VolumeProfilePlugin`, `TpoProfilePlugin` e
   `DepthChartPlugin` desenhavam os três a partir do mesmo `cssWidth`
   (mesma faixa de pixels à direita) — achado do próprio Operador nesta
   sessão, confirmado por leitura de código, corrigido via
   `chart-profile-lanes.ts` (commit `8984f91`).
2. **Duas fórmulas de ATR%** (Wilder real vs. média simples) — real,
   documentada há 3 semanas, hoje mais urgente (3 novos consumidores
   reais preferem a Wilder) mas **não é segura pra trocar às pressas**:
   a versão simples alimenta Risk Engine/ETA/VWAP-NL hoje — é matemática
   de sizing. Fica registrada (task #342), rodada própria.
3. **`WidgetContext` como leitura paralela aos seletores da store** — a
   dívida arquitetural mais validada externamente (a pesquisa achou o
   nome exato do antipadrão na literatura Zustand). Grande, não
   funcional hoje, mas cresce a cada widget novo que lê de lá em vez da
   store. Tier 4 — merece trilha isolada, não uma rodada tangencial.
4. **NÃO é redundância** (engano comum, já documentado): VWAP vs. Nexus
   Line (métodos distintos, convergência é informação real); Kill Zones
   vs. Sessões de Mercado (conceitos ICT diferentes); Zona Institucional
   vs. Volume Profile (a primeira é confluência de PREÇO entre
   ferramentas, a segunda é volume — zero sobreposição de conceito).

---

## 3. O que está genuinamente FALTANDO (gaps reais, não fabricados)

Ordenados por julgamento de impacto × esforço × quanto tempo já ficou
adiado.

### 3.1 — O maior gap: Andrews Pitchfork
Citado como prioridade #1 do Operador em **múltiplas** rodadas de
auditoria ao longo de semanas (`ELITE_TRADING_RESEARCH_MAP.md` §6/§11,
`MAPA_EVOLUCAO_CIBORGUE.md` Tier 2 #8) — e reconfirmado **ausente** agora
(`grep -ri pitchfork` em todo `ipad_runtime/`: zero ocorrência). É a
ferramenta institucional mais claramente pedida que nunca chegou a ser
construída, sempre empurrada por outro pedido mais urgente. Matemática
simples e real (3 pivôs → mediana + 2 canais), reaproveita
`fractal-swings.js` já graduado — zero motor de detecção novo.
**Recomendação: próxima rodada dedicada, sem mais adiamento.**

### 3.2 — Paridade "terminal profissional": rótulos de preço ausentes
Achado NOVO desta auditoria: **POC do Volume Profile, POC do TPO
Profile, Value Area High/Low e Initial Balance High/Low — 5 linhas de
preço reais — não têm nenhum rótulo numérico legível.** Um Operador vendo
o gráfico enxerga a LINHA mas precisa passar o mouse pra saber o preço
exato. Todo terminal de Market Profile profissional (Sierra Chart,
Bookmap, TradingView Premium) rotula POC/VAH/VAL com o valor. S1/R1/EMA/
VWAP já ganham isso via `PriceLabelStackPlugin` — os 5 valores acima
ficaram pra trás quando os plugins foram construídos. Não é reintroduzir
texto solto (o projeto já migrou pra longe disso, de propósito) — é
estender o sistema de eixo que já existe. Esforço médio, valor alto,
exatamente a categoria de coisa que separa "motor real por baixo" de
"lê como profissional por cima".

### 3.3 — Auditorias baratas nunca feitas (Tier 1 do research map, ainda real)
- **Touch targets 44×44pt** (Apple HIG, Regra de Ouro 7) — nunca medido
  de verdade, só por inspeção visual pontual.
- **Virtualização de listas longas** (Order Book L2, candidatos do
  Radar, símbolos do Omnibox) — confirmado agora: zero `react-window`/
  `react-virtual` no projeto. Pode ser um não-problema (listas hoje
  curtas) ou um risco real (Radar MEXC-wide pagina o universo inteiro) —
  não medido.
- `reconnecting-websocket`: **resolvido só de checar** — não é uma
  dependência do projeto (`package.json` confirmado agora), risco zero,
  item fecha sem nenhuma linha de código.

### 3.4 — UX ainda dispersa (backlog "Ajuste Visual", real, grande)
Caixas de confluência fora do canvas (#283), Layer Manager como tags +
painel Properties 320px consolidado (#288/#290) — decisões de
reorganização de UI já escopadas em rodadas anteriores, nunca
executadas. Grandes o suficiente pra merecerem rodada própria (mexem no
shell inteiro do layout), não uma correção pontual.

### 3.5 — Paper Trading, metade real
CSV export do Track Record, trade journal (anotação manual) e teto de
perda diária agregada (hoje o Risk Engine só cobre risco por trade
individual) — os três reais, os três ausentes. Max DD/Sharpe (que
pareciam faltar) já existem.

---

## 4. O julgamento: "elite" não é mais camadas — é 3 coisas específicas

O núcleo quantitativo do AR10 já é **profundo** — 24 camadas reais de
gráfico, Conselho de 7 agentes com pool linear real, Risk Engine com
Kelly fracionado, Track Record com custo real (comissão+slippage+
funding), calibração Platt, Multi-Timeframe Matrix, GMIL. Isso não é o
gap. Comparado a um terminal de elite de verdade (Bloomberg, Sierra
Chart, Bookmap, TradingView Premium), a distância real está em três
eixos específicos, não em "faltam motores":

1. **Precisão de leitura numérica em CADA linha desenhada** — item 3.2
   acima é o exemplo mais claro: o dado já é real, só não está rotulado.
2. **Nenhuma colisão/redundância visual, nunca** — o achado do Operador
   nesta própria sessão (Volume/TPO/Depth na mesma lane) é exatamente a
   classe de bug que faz um sistema PROFUNDO parecer amador na tela.
   Corrigido hoje; o princípio (cada objeto visual tem sua própria faixa,
   nunca presume ser dono do canvas inteiro) precisa virar hábito, não um
   fix pontual — próxima vez que um plugin novo ancorar à direita/
   esquerda, ele nasce já sabendo do `chart-profile-lanes.ts`.
3. **Ferramentas de desenho manual que faltam** — Pitchfork é a única
   real e nomeada; o resto (Elliott Wave, Wyckoff) é Laboratório/
   Tier 3-4, não uma lacuna óbvia que qualquer trader profissional sente
   na hora.

**O que elite NÃO significa aqui, e o research map já descartou
corretamente**: mais painéis simultâneos estilo Bloomberg, replay
multi-gráfico, glassmorphism, motor de ML preditivo de preço. Adicionar
qualquer um desses seria ir na direção ERRADA — o AR10 é
deliberadamente um terminal de UM ativo, UMA decisão real por vez,
fail-closed. "Elite" pra este produto específico é rigor visual e
precisão numérica, não superfície.

---

## 5. Estratégia de evolução priorizada

**Tier 1 — próxima rodada natural (barato, baixo risco, já maduro pra construir):**
1. Rótulos de preço POC(×2)/VAH/VAL/IB no eixo (§3.2, task #341)
2. Auditoria real de touch targets 44×44pt (Playwright + bounding box)
3. Auditoria de virtualização de listas longas (Order Book/Radar/Omnibox)

**Tier 2 — rodada própria, bem definida:**
4. **Andrews Pitchfork** (§3.1, task #340) — o item mais adiado do
   projeto, motor puro + plugin de canvas
5. Unificação de ATR% (task #342) — só depois de decidir com cuidado
   qual das duas vira a canônica única, toca sizing

**Tier 3 — UX estrutural, cada um merece trilha isolada:**
6. Caixas de confluência → overlay lateral fora do canvas (#283)
7. Layer Manager como tags + painel Properties 320px (#288/#290)
8. Paper Trading: CSV export + journal + teto de perda diária (#295)

**Tier 4 — arquitetural, grande, isolado por disciplina do próprio projeto:**
9. Migração `WidgetContext` → seletores granulares Zustand
10. Mover o ciclo do Core Engine para Web Worker (Regra de Ouro 6 exige
    isolamento total, nunca misturado com outra mudança)
11. `OffscreenCanvas`+Worker para os overlays mais pesados (Heatmap)

**Permanece corretamente fora de escopo** (decisão já tomada, não
reaberta sem pedido explícito novo): execução real de ordens, ML
preditivo de preço, layout multi-painel Bloomberg-style, probabilidade
calibrada sem backtest real, Footprint (bloqueado por dado real
inexistente), Volume Clusters/Liquidity Voids como camadas distintas
(duplicariam Volume Profile).

---

## 6. O que esta rodada NÃO fez, e por quê (honestidade, não desculpa)

Não implementei Tier 1-4 acima nesta mesma resposta. Três motivos reais,
não preguiça:
1. Esta MESMA sessão já entregou 2 mudanças reais de código antes desta
   auditoria começar (fallback TradingView + correção de lane
   Volume/TPO/Depth, commit `8984f91`, já verificado e na PR #15) —
   empilhar uma 3ª mudança de código em cima de uma auditoria deste
   tamanho, sem parar pra registrar o achado direito, é o tipo de pressa
   que gera bug.
2. Os dois candidatos que pareciam "rápidos" numa primeira olhada — ATR%
   e rótulos de POC — os dois se revelaram, na verificação real, maiores
   do que pareciam (ATR toca sizing; rótulos de preço exigem integrar
   corretamente no sistema de eixo, não desenhar texto solto de novo).
   Melhor registrar com precisão do que forçar um fix apressado.
3. Andrews Pitchfork — o item de maior valor real — é motor novo +
   plugin, correto começar como sua própria rodada (mesma disciplina que
   este projeto já aplica a todo motor novo: isolar no Laboratório antes
   de graduar).

---

## 7. Próximo passo recomendado

Se autorizado a continuar imediatamente: começar pelo Tier 1 (itens 1-3
acima), depois Andrews Pitchfork como a entrega de maior impacto real
pendente há mais tempo. Nenhum dos dois precisa de decisão de design do
Operador antes de começar — são execução direta.
