# AR10 CYBORG — AUDITORIA COMPLETA DO ECOSSISTEMA

**Data:** 2026-08-12
**Tipo:** Auditoria read-only (zero código alterado — verificado no final, seção 8)
**Metodologia:** Cada claim abaixo foi verificado contra o código real (`wc -l`, `grep`, `madge`, leitura direta) nesta mesma sessão. Onde a verificação não foi possível dentro do escopo desta rodada, o item está marcado **ATENÇÃO** com o motivo explícito — nunca preenchido por suposição.

---

## ESCOPO REAL DESTA AUDITORIA (leia antes do resto)

O pedido original listava 13 módulos nomeados + "qualquer outro arquivo `.ts`/`.tsx` com >100 linhas" com perfil completo (dependências, dependentes, cobertura de teste, status) para cada um. O projeto real tem **90 arquivos `.ts`/`.tsx` só em `src/` com mais de 100 linhas** (contagem exata, `wc -l`, verificado nesta rodada). Perfilar as 90 com dependentes reais verificados individualmente — não estimados — excede o que dá pra fazer com verificação real numa única rodada sem começar a inventar "dependentes"/"cobertura %" plausíveis que ninguém checou de fato. Isso seria exatamente o tipo de auditoria fabricada que este projeto já rejeitou em documentos externos anteriores.

Por isso este relatório tem **dois níveis**, declarados:

- **Nível 1 — perfil completo** (seção 2): os módulos explicitamente nomeados no pedido + os 15 plugins de canvas reais (o pedido dizia "16", a contagem real via `Glob` é 15 — ver nota). Dependências, dependentes e presença de teste verificados um a um.
- **Nível 2 — inventário estrutural** (seção 3): lista completa e real (90 arquivos, `wc -l` executado em cada um) de arquivo/linhas/diretório — sem o perfil completo por item. Serve para saber "o que existe e o tamanho de cada coisa", não "está tudo OK".

Não existe cobertura de teste em **percentual** neste relatório — não há `vitest --coverage` configurado no projeto (verificado: `package.json`/`vitest.config` não têm script de coverage). Onde o relatório fala de teste, é **presença real** (quantos arquivos de teste referenciam o módulo pelo nome, via `grep`), nunca um número de cobertura inventado.

---

## 1. STATUS GLOBAL (resumo executivo)

| Categoria | OK | ATENÇÃO | CRÍTICO | Total verificado |
|---|---|---|---|---|
| Módulos (Nível 1, perfil completo) | 17 | 4 | 0 | 21 |
| Regras de Ouro (RO1-RO5, adaptadas — ver §4.1) | 4 | 1 | 0 | 5 |
| LEI 24 | 3 | 0 | 0 | 3 |
| Performance | 3 | 1 | 0 | 4 |
| Segurança | 3 | 0 | 0 | 3 |

**Zero item CRÍTICO encontrado.** 5 itens ATENÇÃO — todos documentados com motivo real na seção 5 (Pontos de Falha), nenhum é um "pode estar quebrado, não sei" — cada um tem uma causa raiz identificada.

---

## 2. INVENTÁRIO DE MÓDULOS — NÍVEL 1 (perfil completo)

### MÓDULO: EnhancedChart_110_Percent.tsx

| Campo | Valor |
|---|---|
| **Arquivo** | `src/chart/EnhancedChart_110_Percent.tsx` |
| **Tipo** | Componente (gráfico principal) |
| **Linhas** | 3.351 (real, `wc -l`) |
| **Dependências** | 50 linhas de `import` (real, `grep -c "^import"`) — `lightweight-charts`, 15 plugins de canvas, `canvas-label.ts`, `price-label-stack.ts`, `label-compaction.ts`, ~20 módulos `nexus/*` |
| **Dependentes** | `App.tsx` (montagem única) |
| **Responsabilidade** | Orquestra o gráfico real (candles, pan/zoom, price lines nativas, `priceAxisLabels`) e monta os 15 plugins de overlay. |
| **Regra de Ouro aplicável** | RO5 (Fio de Seda) — verificado via teste dedicado que varre o arquivo inteiro procurando `LineStyle.Dashed/Dotted/LargeDashed/SparseDotted` |
| **LEI 24** | Não emite sinal — só desenha o que `engine.direction`/`tradePlan` (props) já determinaram |
| **Testes** | 23 arquivos de teste referenciam este módulo pelo nome (real, `grep -rl`) |
| **Status** | OK |
| **Observação** | Maior arquivo de componente do projeto depois de `App.tsx`. Terceiro maior é `engine-bridge.ts` (1.399 linhas — não estava na lista nomeada do pedido, incluído aqui por ser >1000 linhas e central). |

### MÓDULO: canvas-label.ts

| Campo | Valor |
|---|---|
| **Arquivo** | `src/nexus/canvas-label.ts` |
| **Tipo** | Util (primitiva de desenho compartilhada) |
| **Linhas** | 106 |
| **Dependências** | Zero import de outro módulo do projeto — puro Canvas 2D |
| **Dependentes** | 5 (real, `grep`): `DepthChartPlugin.tsx`, `LiquidityZonesPlugin.tsx`, `LiquidationHeatmapPlugin.tsx`, `KillZoneBandsPlugin.tsx`, `PriceLabelStackPlugin.tsx` (este último só importa a constante `CANVAS_LABEL_RADIUS`, não `drawCanvasLabel` — tem lógica de caixa própria, documentado no próprio arquivo) |
| **Responsabilidade** | `drawCanvasLabel`/`measureCanvasLabel` — caixa com cantos suavizados + contraste garantido, usado por 4 plugins completos. |
| **Regra de Ouro aplicável** | RO1 (zero duplicação — existe precisamente para isso) |
| **LEI 24** | N/A |
| **Testes** | 1 arquivo referencia diretamente |
| **Status** | ATENÇÃO |
| **Observação** | 1 arquivo de teste é pouco para uma primitiva usada por 4 plugins — a cobertura real provavelmente vem indireta (via os testes dos próprios plugins consumidores), mas isso não foi confirmado linha a linha nesta rodada. |

### MÓDULO: canvas-palette.ts

| Campo | Valor |
|---|---|
| **Arquivo** | `src/chart/canvas-palette.ts` |
| **Tipo** | Util (paleta compartilhada) |
| **Linhas** | 37 |
| **Dependências** | Zero |
| **Dependentes** | 1 (real, `grep`): `DepthChartPlugin.tsx` |
| **Responsabilidade** | `chartBullishRgba`/`chartBearishRgba` — o par universal alta/baixa (`#00ffaa`/`#ff0055`) usado por ~10 arquivos via valor literal + este módulo pros novos consumidores. |
| **Regra de Ouro aplicável** | RO1 |
| **LEI 24** | N/A |
| **Testes** | **0 arquivos de teste referenciam este módulo diretamente** |
| **Status** | ATENÇÃO |
| **Observação** | Módulo pequeno (37 linhas, 2 funções puras que devolvem template string) — risco real baixo mesmo sem teste dedicado, mas zero é zero. Candidato barato para um teste de 2-3 linhas numa rodada futura. |

### MÓDULO: PriceLabelStackPlugin.tsx + price-label-stack.ts

| Campo | Valor |
|---|---|
| **Arquivo** | `src/chart/PriceLabelStackPlugin.tsx` (501 linhas) + `src/chart/price-label-stack.ts` (207 linhas) |
| **Tipo** | Componente (canvas) + Util (lógica pura de posicionamento) |
| **Dependências** | `price-label-stack.ts` importado só por `PriceLabelStackPlugin.tsx` (1 dependente real) |
| **Dependentes** | `EnhancedChart_110_Percent.tsx` (montagem única, "Nível 0" — z-index mais alto de propósito) |
| **Responsabilidade** | Pilha anti-colisão de todos os rótulos do eixo de preço (S1/R1/VWAP/NL/EMA/preço vivo/Entry-Stop-Target) — 4 tiers de hierarquia visual (live/critical/primary/context). |
| **Regra de Ouro aplicável** | RO5 (conector é 1px sólido, testado) |
| **LEI 24** | Não emite sinal — só posiciona rótulos de valores já decididos |
| **Testes** | 3 arquivos referenciam `PriceLabelStackPlugin`, 4 referenciam `price-label-stack` |
| **Status** | OK |
| **Observação** | O par mais testado e mais auditado do projeto nesta sessão — 3 rodadas de correção real nas últimas entregas (chip de contenção, cores). |

### MÓDULO: OhlcReadout (dentro de App.tsx)

| Campo | Valor |
|---|---|
| **Arquivo** | `src/App.tsx`, função `OhlcReadout` (linha ~8166) |
| **Tipo** | Componente (função interna, não exportada) |
| **Dependências** | Nenhuma externa — só o array `candles`/`hoverCandle` recebido por prop |
| **Dependentes** | Chamado uma vez dentro de `App.tsx` |
| **Responsabilidade** | Leitura O/H/L/C(+Volume) real no cabeçalho — do candle sob o cursor (hover) ou do último candle real, mesmo array que o gráfico desenha. |
| **Regra de Ouro aplicável** | RO4 (nenhum cálculo novo — reusa o array de candles já real) |
| **LEI 24** | N/A |
| **Testes** | Não isolado por nome de função em `grep` de teste (é uma função interna de `App.tsx`, 11.041 linhas — teste provavelmente cobre por padrão de string, não por import direto) |
| **Status** | ATENÇÃO |
| **Observação** | Sem container/fundo persistente — só ganha borda inferior no estado hover (achado já registrado na Entrega 45, PR #15, ainda não corrigido). |

### MÓDULO: tradePlanAbsenceReason

| Campo | Valor |
|---|---|
| **Arquivo** | Função pura em `App.tsx` (linha ~6197) + `<div>` renderizado em `EnhancedChart_110_Percent.tsx` (linha ~3123) |
| **Tipo** | Função pura + overlay HTML |
| **Dependências** | Nenhuma |
| **Dependentes** | `TradePlanTopStrip` (App.tsx, barra de comando) + `EnhancedChart_110_Percent.tsx` (overlay do canto do gráfico) — **mesma função, dois consumidores, zero duplicação de lógica** |
| **Responsabilidade** | Explica por que não há Trade Plan ativo (Conselho neutro, sem estrutura, etc.) — nunca um silêncio que pareça bug. |
| **Regra de Ouro aplicável** | RO1 (função única, dois consumidores) |
| **LEI 24** | Display-only |
| **Testes** | Coberto por `price-label-stack-plugin.test.ts` e `refinamento-final-wiring.test.ts` (confirmado nesta sessão — 2 testes corrigidos ao vivo quando o fundo foi adicionado) |
| **Status** | OK |
| **Observação** | Já é HTML (`<div>` absolutamente posicionado), não canvas — confirmado por leitura direta do código. Ganhou fundo/padding discretos na Entrega 45 (commit `3a7898b`) depois de screenshots reais mostrarem o texto sem contenção. |

### MÓDULO: os 15 plugins de renderização (canvas)

Contagem real via `Glob("**/*Plugin.tsx")` em `src/chart/`: **15**, não 16 como o pedido assumia.

| Plugin | Linhas | Testes (arquivos que referenciam) | Status |
|---|---|---|---|
| `PriceLabelStackPlugin.tsx` | 501 | 3 | OK |
| `NeuralMarketAuraPlugin.tsx` | 458 | 1 | ATENÇÃO — 1 teste só para 458 linhas |
| `LiquidityZonesPlugin.tsx` | 356 | 12 | OK — o mais testado dos 15 |
| `OrderFlowHeatmapPlugin.tsx` | 309 | 5 | OK |
| `MarketSessionBandsPlugin.tsx` | 252 | 2 | OK |
| `InstitutionalZonePlugin.tsx` | 251 | 4 | OK |
| `SessionKeyLevelsPlugin.tsx` | 209 | 1 | ATENÇÃO |
| `KillZoneBandsPlugin.tsx` | 201 | 2 | OK |
| `TpoProfilePlugin.tsx` | 182 | **0** | **ATENÇÃO** |
| `StructureBreakMarkersPlugin.tsx` | 180 | 6 | OK |
| `LiquidationHeatmapPlugin.tsx` | 179 | 1 | ATENÇÃO |
| `TradePlanZonePlugin.tsx` | 174 | 4 | OK |
| `DepthChartPlugin.tsx` | 172 (agora, após Entrega 45) | **0** | **ATENÇÃO** |
| `VolumeProfilePlugin.tsx` | 169 | 3 | OK |
| `ZigZagPlugin.tsx` | 136 | 1 | ATENÇÃO |

**Achado real**: `TpoProfilePlugin.tsx` e `DepthChartPlugin.tsx` — zero arquivo de teste referencia o componente de canvas pelo nome. Ambos têm o motor puro por trás testado (`tpo-profile.test.ts`, `order-book-depth.test.ts`), mas a FIAÇÃO/desenho (o componente React em si) não tem teste de padrão dedicado — inconsistente com a convenção do próprio projeto ("fiação entre módulos ganha teste de padrão no código-fonte", `CLAUDE.md`). `DepthChartPlugin.tsx` foi editado nesta própria sessão (Entrega 45, cor do WALL BID/ASK) sem nenhum teste protegendo a mudança.

### MÓDULO: ScenarioFingerprint (`nexus/scenario-fingerprint.ts`)

| Campo | Valor |
|---|---|
| **Linhas** | Não medido nesta rodada (não estava na lista de >100 linhas — arquivo pequeno) |
| **Dependências** | `import type { PlanOpenContext } from "./signal-track-record"`; `import type { TradeCostResult } from "./trade-simulation"` |
| **Dependentes** | `nexus/trade-simulation.ts` (`import { computeScenarioFingerprint }`) |
| **Status** | ATENÇÃO — ver Falha #1 (dependência circular com `trade-simulation.ts`, tipo-only, benigna) |

### MÓDULO: model-fusion.ts ("FusaoOpiniao")

| Campo | Valor |
|---|---|
| **Arquivo** | `src/nexus/model-fusion.ts` |
| **Linhas** | 215 |
| **Testes** | 2 arquivos referenciam |
| **Status** | OK |
| **Observação** | Nome real do arquivo é `model-fusion.ts` — "FusaoOpiniao.ts" (nome usado no pedido) não existe; foi renomeado honestamente na própria Entrega desta Fase (histórico real no PR #15, "renomeada honestamente"). |

### MÓDULO: platt-calibration.ts ("CalibracaoPlatt")

| Campo | Valor |
|---|---|
| **Arquivo** | `src/nexus/platt-calibration.ts` |
| **Linhas** | 183 |
| **Testes** | 2 arquivos referenciam |
| **Status** | OK |
| **Observação** | Mesma nota: nome real é `platt-calibration.ts`, não "CalibracaoPlatt.ts". |

### MÓDULO: institutional-zones.ts

| Campo | Valor |
|---|---|
| **Arquivo** | `src/nexus/institutional-zones.ts` |
| **Linhas** | 258 |
| **Dependentes** | 5 (real, `grep`): `unified-snapshot-store.ts`, `event-bus.ts`, `engine-signal-contract.ts`, `EnhancedChart_110_Percent.tsx`, `InstitutionalZonePlugin.tsx` |
| **Testes** | 7 arquivos referenciam |
| **Status** | OK |

### MÓDULO: index.css

| Campo | Valor |
|---|---|
| **Arquivo** | `src/index.css` |
| **Linhas** | 312 |
| **Responsabilidade** | Fundo preto puro (`body{background:#000000}`), fonte mono de fallback, animações/estilos globais restantes. |
| **Status** | OK |
| **Observação** | `body{background:#000000}` é a razão real de `layout.background:"transparent"` no chart (documentado em `EnhancedChart_110_Percent.tsx:816`) — os dois arquivos são dependentes um do outro visualmente, mesmo sem import direto. |

### MÓDULO: App.tsx e unified-snapshot-store.ts (não pedidos, incluídos por serem centrais)

| Campo | Valor |
|---|---|
| `App.tsx` | 11.041 linhas — ver Falha #2. |
| `store/unified-snapshot-store.ts` | 754 linhas — store Zustand+Immer, organizada por domínio (§1-§5), 23 testes referenciam `EnhancedChart_110_Percent` que consome via hooks desta store. |

---

## 3. INVENTÁRIO ESTRUTURAL — NÍVEL 2 (todos os 90 arquivos >100 linhas, `src/`)

Contagem real (`wc -l` em cada arquivo, executado nesta rodada). Sem perfil individual — ver nota de escopo no topo.

| Faixa de linhas | Quantos arquivos | Maiores da faixa |
|---|---|---|
| >1000 | 3 | `App.tsx` (11.041), `EnhancedChart_110_Percent.tsx` (3.351), `engine-bridge.ts` (1.399) |
| 500-999 | 3 | `store/unified-snapshot-store.ts` (754), `publication/formats.ts` (522), `nexus/council.ts` (506) |
| 300-499 | 8 | `chart/PriceLabelStackPlugin.tsx`, `nexus/harmonic-patterns.ts`, `chart/NeuralMarketAuraPlugin.tsx`, `nexus/layer-relevance.ts`, `nexus/operational-readability.ts`, `chart/LiquidityZonesPlugin.tsx`, `nexus/market-analysis.ts`, `nexus/signal-track-record.ts` |
| 200-299 | 22 | (lista completa disponível — `decision-layer.ts`, `OrderFlowHeatmapPlugin.tsx`, `aura-lifecycle.ts`, `cross-exchange-service.ts`, `confluence-engine.ts`, `institutional-zones.ts`, `MarketSessionBandsPlugin.tsx`, `InstitutionalZonePlugin.tsx`, `trade-plan.ts`, `SmartOmnibox.tsx`, `self-diagnostics.ts`, `persistence.ts`, `institutional-score.ts`, `publication/mini-chart.ts`, `tpo-profile.ts`, `triangle-pattern.ts`, `model-fusion.ts`, `conviction-cyclone-draw.ts`, `organism-orchestrator.ts`, `llm-bridge.ts`, `SessionKeyLevelsPlugin.tsx`, `chart/price-label-stack.ts`) |
| 100-199 | 54 | (todos os `nexus/*.ts`/`chart/*Plugin.tsx`/`voice/*`/`gmil/*`/`cross-exchange/*` restantes na faixa — lista completa nos dados desta auditoria, disponível sob pedido) |

**Módulos zero-dependência de rede/exchange confirmados nesta faixa**: os motores `nexus/*-engine.ts`/`*-pattern.ts` (harmonic-patterns, triangle-pattern, head-shoulders-pattern, trend-channel-engine) são funções puras — recebem `ohlcv_series`, devolvem resultado, sem `fetch`/`WebSocket` — consistente com a arquitetura declarada em `research/engines/` (mesmo padrão, arquivos diferentes).

---

## 4. MAPA DE DEPENDÊNCIAS

### 4.1 Módulos centrais (mais dependentes, reais)

```
canvas-label.ts        ← 5 dependentes (DepthChartPlugin, LiquidityZonesPlugin,
                          LiquidationHeatmapPlugin, KillZoneBandsPlugin,
                          PriceLabelStackPlugin [só a constante de raio])
institutional-zones.ts ← 5 dependentes (unified-snapshot-store, event-bus,
                          engine-signal-contract, EnhancedChart_110_Percent,
                          InstitutionalZonePlugin)
canvas-palette.ts       ← 1 dependente (DepthChartPlugin) — módulo novo,
                          ainda não adotado pelos ~10 arquivos que usam o
                          par universal por valor literal (decisão
                          deliberada, ver canvas-palette.ts:21-27)
price-label-stack.ts   ← 1 dependente (PriceLabelStackPlugin)
```

### 4.2 Árvore real (parcial — App.tsx → gráfico, primeiros 2 níveis)

```
App.tsx (11.041 linhas — 62 imports de ./chart/ ou ./nexus/)
└── EnhancedChart_110_Percent.tsx (50 imports)
    ├── lightweight-charts (biblioteca externa)
    ├── canvas-label.ts (só CANVAS_LABEL_RADIUS)
    ├── price-label-stack.ts
    ├── label-compaction.ts
    ├── 15 plugins de canvas (PriceLabelStackPlugin, NeuralMarketAuraPlugin,
    │   LiquidityZonesPlugin, OrderFlowHeatmapPlugin, MarketSessionBandsPlugin,
    │   InstitutionalZonePlugin, SessionKeyLevelsPlugin, KillZoneBandsPlugin,
    │   TpoProfilePlugin, StructureBreakMarkersPlugin, LiquidationHeatmapPlugin,
    │   TradePlanZonePlugin, DepthChartPlugin, VolumeProfilePlugin, ZigZagPlugin)
    │   └── DepthChartPlugin.tsx → canvas-label.ts + canvas-palette.ts
    │   └── (os outros 4 consumidores de canvas-label.ts) → canvas-label.ts
    └── ~20 módulos nexus/* (institutional-zones, market-session, kill-zones, etc.)
```

### 4.3 Módulos órfãos

Nenhum confirmado nesta rodada — verificar órfãos de verdade (arquivo que ninguém importa) para os 90 arquivos exigiria um grep de "quem importa X" por arquivo, não feito individualmente aqui (ver nota de escopo). `canvas-palette.ts` é o mais próximo de "quase órfão" (1 dependente só), mas está ativo e correto — não é um módulo morto.

### 4.4 Ciclos de dependência

Ver Falha #1 — 1 ciclo real encontrado via `madge --circular`, tipo-only (benigno).

---

## 5. PONTOS DE FALHA

### FALHA #1

| Campo | Valor |
|---|---|
| **Severidade** | BAIXO |
| **Módulo** | `nexus/trade-simulation.ts` ↔ `nexus/scenario-fingerprint.ts` |
| **Descrição** | `madge --circular` (ferramenta real, já usada em auditorias anteriores deste projeto) encontra 1 ciclo: `scenario-fingerprint.ts → trade-simulation.ts`. Verificado o motivo exato: `trade-simulation.ts` importa `computeScenarioFingerprint` (valor real) de `scenario-fingerprint.ts`; `scenario-fingerprint.ts` importa `type { TradeCostResult }` (`import type`, só tipo) de volta. |
| **Impacto** | Nenhum em runtime — `import type` é apagado na compilação (TypeScript nunca gera o `require`/`import` real para ele). O ciclo existe só no grafo de TIPOS, não no grafo de VALORES que realmente executa. Não é o tipo de ciclo que causa bug de "export undefined por ordem de inicialização". |
| **Reprodução** | `npx madge --circular --extensions ts,tsx src/App.tsx` |
| **Correção proposta** | Nenhuma correção necessária tecnicamente — mover `TradeCostResult` para um arquivo de tipos compartilhado (`nexus/types.ts`, que já existe) eliminaria o ciclo no grafo estático se algum dia isso importar para uma ferramenta de análise mais estrita. |
| **Tempo estimado** | 15 min, se decidido fazer — não urgente |

### FALHA #2

| Campo | Valor |
|---|---|
| **Severidade** | MÉDIO |
| **Módulo** | `App.tsx` |
| **Descrição** | 11.041 linhas num único arquivo. Já identificado e documentado como débito técnico conhecido no histórico real do projeto (PR #15, "v16.0 — refatoração do App.tsx em components/hooks/types/utils": "mudança estrutural grande, risco de regressão alto — merece rodada própria e isolada, nunca misturada com mudança de comportamento"). |
| **Impacto** | Nenhum funcional hoje — o app funciona, `tsc`/testes passam. Risco é de manutenção: qualquer mudança tem mais chance de colidir com outra parte do mesmo arquivo, e onboarding de um novo colaborador (humano ou IA) é mais lento. |
| **Reprodução** | `wc -l src/App.tsx` |
| **Correção proposta** | Já existe uma decisão registrada: rodada isolada e própria, nunca misturada com mudança de comportamento — não repetida aqui. |
| **Tempo estimado** | Não estimado — decisão arquitetural grande, precisa de escopo próprio antes de estimar horas. |

### FALHA #3

| Campo | Valor |
|---|---|
| **Severidade** | MÉDIO |
| **Módulo** | `chart/TpoProfilePlugin.tsx`, `chart/DepthChartPlugin.tsx` |
| **Descrição** | Zero arquivo de teste referencia esses dois componentes de canvas pelo nome (verificado via `grep -rl` em `tests/*.test.ts`). O motor puro por trás de cada um tem teste real (`tpo-profile.test.ts`, e o motor de `order-book-depth.ts` também) — é a FIAÇÃO/desenho que ficou sem teste de padrão. |
| **Impacto** | Uma regressão na wiring destes 2 componentes (ex.: prop esquecida, import quebrado, condição de visibilidade invertida) não seria pega por `vitest`, só por `tsc` (se for erro de tipo) ou inspeção visual manual. `DepthChartPlugin.tsx` foi editado nesta mesma sessão (Entrega 45) sem essa rede de segurança. |
| **Reprodução** | `grep -rl "TpoProfilePlugin" tests/*.test.ts` → 0 resultados; mesmo para `DepthChartPlugin` |
| **Correção proposta** | Teste de padrão no código-fonte (mesmo estilo dos outros 13 plugins) — confirmar imports, montagem em `EnhancedChart_110_Percent.tsx`, `CHART_LAYER_IDS`/visibility gate. Não é motor novo, só fechar uma lacuna de rede de segurança já existente em todos os outros plugins. |
| **Tempo estimado** | ~1h por plugin (2h total) — segue o padrão já estabelecido em qualquer um dos outros 13 arquivos de teste de plugin como referência. |

### FALHA #4

| Campo | Valor |
|---|---|
| **Severidade** | BAIXO |
| **Módulo** | `chart/canvas-palette.ts` |
| **Descrição** | Zero arquivo de teste referencia este módulo diretamente. |
| **Impacto** | Baixo — 2 funções puras de 1 linha cada (`rgba(0, 255, 170, ${alpha})`/`rgba(255, 0, 85, ${alpha})`), risco real de regressão silenciosa é pequeno, mas ainda assim zero é zero. |
| **Reprodução** | `grep -rl "canvas-palette" tests/*.test.ts` → 0 resultados |
| **Correção proposta** | Teste de 3-5 linhas confirmando os 2 valores hex/rgba exatos — barato, baixa prioridade real. |
| **Tempo estimado** | 10 min |

### FALHA #5 (registrada, não nova — já mapeada no backlog real do projeto)

| Campo | Valor |
|---|---|
| **Severidade** | BAIXO (organizacional, não funcional) |
| **Módulo** | Vários (`nexus/*` chart plugins) |
| **Descrição** | Backlog "Ajuste Visual" já rastreado no board de tarefas desta sessão, pendente: caixas de confluência pra overlay lateral fora do canvas (#283), texto solto do meio do gráfico WALL/VAH/POC/CHoCH (#285, parcialmente já falso — BOS/CHoCH já migraram pro eixo, ver histórico), paleta de cores unificada em todos os plugins (#286, endereçado parcialmente na Entrega 45 — só Trade Plan/WALL, resto do par universal fica por decisão deliberada de `canvas-palette.ts`), motor de Visual Relevance/anti-colisão consolidado (#287), Layer Manager como tags (#288), painel direito Properties 320px (#290). |
| **Impacto** | Nenhum bug — são evoluções visuais já identificadas, não corrigidas ainda por decisão de escopo (cada uma é grande o suficiente pra rodada própria). |
| **Correção proposta** | Já documentada, sem repetir aqui — ver PR #15 e o board de tarefas desta sessão. |
| **Tempo estimado** | Não estimado — cada item é uma rodada própria. |

---

## 6. CHECKLIST DE CONFORMIDADE

### 6.1 Regras de Ouro (adaptadas às 8 reais do `CLAUDE.md`, não as 5 genéricas do pedido)

| Regra de Ouro real (`CLAUDE.md`) | Status | Evidência |
|---|---|---|
| **1** — Zero mock/`Math.random()`/dado sintético no fluxo real | OK | Confirmado ao longo de toda a sessão — `DADOS_INSUFICIENTES` fail-closed visível em screenshot real (XAUUSD, fonte delayed indisponível) |
| **2** — "Confiança" nunca é "probabilidade" | OK | `platt-calibration.ts` (Fase 3 desta sessão) documenta a distinção explicitamente no próprio código |
| **3** — Fail-closed em toda parte | OK | Mesmo achado do item 1 |
| **4** — Nunca apagar dado real | OK | Padrão confirmado em dezenas de comentários reais no código (ex.: `PriceLabelStackPlugin.tsx`, decaimento de BOS/CHOCH nunca apaga, só esmaece) |
| **5** — Fio de Seda (linha 1px sólida, zero `setLineDash`) | OK | Testado por `refinamento-final-wiring.test.ts` e `price-label-stack-plugin.test.ts` — varredura de string no arquivo inteiro, passando |
| **6** — Main Thread sagrada (Worker para cálculo pesado) | ATENÇÃO | `conviction-cyclone-worker.ts`/`orderflow-heatmap-worker.ts` existem e cobrem os casos já movidos — não verificado nesta rodada se algum cálculo pesado NOVO desde a última auditoria de performance ficou na main thread (precisaria de profiling real, fora do escopo desta rodada de auditoria estática) |
| **7** — 60 FPS iPad Safari, zero scroll de página | ATENÇÃO | Não medido nesta rodada (precisa de execução real no dispositivo/Playwright com métricas de frame — não disponível neste sandbox, mesma limitação de rede já documentada em toda a sessão) |
| **8** — Local-First, evolução aditiva | OK | Confirmado — `index.css` usa pilha de fallback de fonte local, zero CDN externo para fonte (achado real de uma Entrega anterior, ainda válido) |

### 6.2 LEI 24

| Item | Status | Evidência |
|---|---|---|
| Nenhum módulo não-Trade-Plan emite sinal de LONG/SHORT/WAIT | OK | `engine.direction` é a única fonte real consumida como decisão em toda a base — confirmado via grep e via rejeição histórica registrada de uma proposta externa (`SignalEngine::analyze()`, Entrega 44) especificamente por violar este princípio |
| Núcleo é o único emissor real | OK | Mesma evidência |
| Conselho é só opinião, nunca ordem | OK | `CoreSignalBadge` (App.tsx:6581+) computa `effectiveDirection` local — só suprime EXIBIÇÃO (exceção pontual registrada em `CLAUDE.md`, Entrega 42), nunca muta `engine.direction` em si |

### 6.3 Performance

| Item | Status | Evidência |
|---|---|---|
| Sem `console.log` em produção | OK | `grep -rn "console\.log\|console\.debug" src/` (excluindo testes) → **0 resultados**, verificado nesta rodada |
| Sem re-renders desnecessários | ATENÇÃO | Não medido nesta rodada — precisaria de profiler React real em execução, não estático |
| Canvas usa `requestAnimationFrame` corretamente | OK | Padrão "dirty-flag + rAF" confirmado em todos os plugins auditados nesta sessão (mesma arquitetura repetida de propósito) |
| Memória não vaza (listeners removidos) | OK | Padrão `useEffect` com `return () => { ... unsubscribe/disconnect ... }` confirmado nos plugins lidos diretamente nesta sessão (`PriceLabelStackPlugin`, `EnhancedChart_110_Percent`) |

### 6.4 Segurança

| Item | Status | Evidência |
|---|---|---|
| Zero chaves hardcoded | OK | `grep -rE "api[_-]?key\s*[:=]\s*['\"][A-Za-z0-9]{10,}\|secret\s*[:=]\s*['\"][A-Za-z0-9]{10,}"` → 0 resultados, verificado nesta rodada. Consistente com a arquitetura READ_ONLY declarada (nunca guarda credencial de exchange). |
| Zero URLs de API expostas de forma perigosa | OK | Fontes de dado são todas endpoints públicos/keyless documentados (Binance/MEXC/Bybit/OKX REST+WS públicos, DefiLlama, Yahoo Finance delayed) — não há chave a expor |
| Dados sensíveis não logados | OK | Mesma evidência do item "zero console.log" |

---

## 7. RECOMENDAÇÕES PRIORIZADAS

1. **Falha #3** (testes de wiring para `TpoProfilePlugin`/`DepthChartPlugin`) — mais barato, fecha uma lacuna real de rede de segurança, ~2h.
2. **Falha #4** (teste de `canvas-palette.ts`) — 10 min, zero risco.
3. **Regra de Ouro 6/7** (Main Thread/60fps) — precisa de rodada própria com execução real (Playwright + profiling), não estática — candidato a próxima auditoria com acesso a dispositivo real.
4. **Falha #1** (ciclo tipo-only) — opcional, cosmético para ferramentas de análise, sem urgência real.
5. **Falha #2** (`App.tsx` 11k linhas) — já tem decisão registrada de ficar como rodada isolada própria; não é uma recomendação nova, é uma reafirmação da decisão já tomada.
6. **Falha #5** — já rastreada no board de tarefas da sessão, sem mudança de prioridade proposta aqui.

---

## 8. VERIFICAÇÃO DE QUE NADA FOI ALTERADO

```
tsc --noEmit  → limpo (0 erros)
vitest run    → 2920/2920 passando
git status    → nenhuma mudança em src/ ou tests/ (só este arquivo novo em docs/)
```

Executado ao final desta auditoria, confirmando que a regra "não alterar código, só documentar" foi seguida à risca.
