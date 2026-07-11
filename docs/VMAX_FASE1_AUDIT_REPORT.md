# AR10-CYBORG — Relatório de Auditoria: Blueprint V-MAX, Fase 1 ("Densidade Institucional")

**Data:** 11 de Julho de 2026
**Autor:** Agente 4 (Engenheiro de Software Principal / Executor)
**Documento de referência:** `AR10_CYBORG_BLUEPRINT_VMAX.md` — Parte 8, Fase 1 ("Densidade + Cérebro Básico")
**Diretriz do Operador:** "[PROTOCOLO DE VALIDAÇÃO E FASE 1: DENSIDADE INSTITUCIONAL]" — itens 1–3 (OrderFlowHeatmapPlugin, WASM Quant Core, Matriz de Confluência Fibonacci), com os lembretes de governança "Main Thread sagrada", "Zero Mock Data" e "Fail-Closed imediato".
**Branch:** `claude/eloquent-cannon-qyt86y` · **Pull Request:** #10
**Propósito:** mesmo formato do relatório da Fase 0 — o que foi pedido, o que foi entregue, como foi verificado, quais decisões de escopo foram tomadas e por quê. Sem marketing; evidência concreta para cada afirmação.

---

## 1. Sumário executivo

Os três itens da diretriz foram entregues e estão vivos no organismo:

1. **OrderFlowHeatmapPlugin** (OffscreenCanvas + fallback) — densidade L2 real + bolhas de trades grandes reais, desenhado atrás das velas, com o trabalho de pixel movido para um Worker dedicado quando o browser confirma suporte por handshake real (nunca por suposição), e fallback main-thread idêntico caso contrário.
2. **WASM Quant Core estendido** — `volume_profile` real em Rust (Fixed Range + Session pela mesma função, POC determinístico, HVN/LVN por percentil real), compilado nos dois binários (escalar + SIMD), integrado do worker até a store. CVD e Footprint tratados com as decisões de honestidade documentadas na Seção 4.
3. **Matriz de Confluência Fibonacci** (agente transversal) — retração real da última perna confirmada (o motor de retração que a documentação do sistema declarava ausente), cruzada contra TODAS as fontes reais de nível já produzidas pelos outros motores.

Números da fase: **7 commits**, 62 testes novos na suíte TS (547 → 609, zero regressão), **7 testes nativos `cargo test` novos** (primeiros testes Rust do crate), `tsc` estrito limpo em todas as passagens, build de produção limpo, recompilação dos `.wasm` bit-a-bit determinística, boot real do app verificado via Playwright com **zero erros de código** (só as falhas de rede esperadas do sandbox, com o app degradando fail-closed exatamente como projetado).

Durante o trabalho, a disciplina de "auditar antes de construir" (zero repetição) encontrou e corrigiu **dois defeitos reais** que nenhuma diretriz apontou: a duplicação de medição de FPS entre App.tsx e Health Monitor, e o vazamento de histórico L2/orderflow do ativo anterior ao trocar de ativo (Seção 5).

---

## 2. Entregas por sub-fase

| Sub-fase | Entrega | Commits | Onde |
|---|---|---|---|
| 1.1 | Histórico L2 real (ring 180×2s, pré-requisito do heatmap) | `7765e57` | `nexus/l2-history.ts`, store `l2History` |
| 1.2 (dados) | Ticks reais expostos (`onTrades`), trade grande por percentil real, histórico CVD+bolhas | `f16339c`, `b0e3ed0` | `engine-bridge.ts`, `nexus/orderflow-history.ts`, store `orderflowHistory` |
| 1.2 (render) | OrderFlowHeatmapPlugin: OffscreenCanvas via handshake + fallback, primitiva de desenho única | `4c0e088` | `chart/OrderFlowHeatmapPlugin.tsx`, `workers/orderflow-heatmap-worker.ts`, `nexus/orderflow-heatmap-draw.ts` |
| 1.3 | `volume_profile` em Rust + cadeia worker→client→bridge→store + HVN/LVN | `6e45b08` | `wasm-src/.../lib.rs`, `workers/quant-worker.js`, `js/worker-client.js`, `nexus/volume-profile.ts` |
| 1.4 | Matriz de Confluência Fibonacci (retração + cruzamento transversal) | `ecb8776` | `nexus/fibonacci-confluence.ts`, `engine-bridge.ts`, store `fibonacciConfluence` |
| 1.5/1.6 | Varredura de verificação + este relatório | (este commit) | — |

Correção real avulsa: `74ea317` (dedup de FPS — Seção 5).

---

## 3. Como cada exigência de governança foi cumprida

**"Main Thread sagrada (Quant no Worker)."**
- O histograma do Volume Profile (candles × buckets, a única parte cara) roda no WASM **dentro do quant-worker** — a main thread só faz o RPC e a derivação O(buckets) trivial (HVN/LVN sobre ≤512 números).
- O desenho do heatmap (centenas de fillRect/arc por redraw) vai para um Worker dedicado via `transferControlToOffscreen()` quando o handshake confirma contexto 2D real; a geometria preço→pixel fica na main thread por necessidade (depende do estado vivo de pan/zoom do chart, que só existe lá) e é O(amostras) leve.
- A matriz Fibonacci é O(n·k) da mesma classe do `computeSmcZones` que já rodava em `useMemo` — documentado por que não precisa de worker.

**"Zero Mock Data."**
- Todo dado novo desta fase é derivação de dado real já em produção: ticks reais do poller MEXC (antes descartados dentro do worker), L2 real da Binance (mesmo WS já exibido), candles reais do Bus (o `volume` real sempre esteve no Bus — só não saía do `getChartCandles`).
- "Trade grande" é percentil 90 real da amostra observada (nunca limiar fixo); HVN/LVN são percentis 75/25 reais da distribuição de buckets não-vazios; a janela de confluência é proporcional à perna real (2%).
- Nenhum `Math.random`, nenhum valor de exemplo, nenhum threshold inventado — travado por teste em todos os módulos novos.

**"Fail-Closed imediato."**
- `volume_profile` devolve NaN (→ `null` na cadeia inteira) para QUALQUER dado corrompido: NaN/inf, volume negativo, high<low, tamanhos inválidos.
- Matriz Fibonacci: perna inválida → `null`; score 0 é resultado honesto, não erro.
- Heatmap: amostra fora da janela visível nunca é desenhada nem extrapolada; falha/timeout do handshake OffscreenCanvas cai para o fallback main-thread comprovado.
- Verificado de ponta a ponta: com a rede bloqueada (sandbox), o app boota com todos os estados AGUARDANDO honestos e banner real de falha — captura na Seção 6.

**"Fio de Seda" (Regra de Ouro 2).**
- O traço das bolhas de trade grande é `lineWidth = 1` sólido; a primitiva compartilhada nunca chama `setLineDash` — travado por teste (mesmo padrão da suite do LiquidityZonesPlugin).

---

## 4. Decisões de escopo honestas (documentadas, não escondidas)

**Footprint — redução declarada.** Um Footprint verdadeiro (ladder buy/sell por preço por candle) exige trades reais do MESMO mercado dos candles do chart. Os candles são Binance **Futures** (exclusivo por diretriz V15.1); o único tick stream real do codebase é MEXC **Spot** — outro mercado. Além disso, os ticks não são retidos/bucketed por preço em lugar nenhum. Construir um "footprint" sobre isso seria fabricar granularidade que não existe — exatamente o que a Regra de Ouro 1 proíbe. Decisão: **não construído**; o que existe de real (trades grandes reais por percentil, CVD real por ciclo) está exposto como bolhas + série na store. Se um dia entrar um stream de trades de Futures, a fundação (orderflow-history + heatmap) já está pronta para recebê-lo.

**CVD — zero repetição.** O CVD real já existe (único, em `signal-engine.js`, worker de order flow) e desde a Fase 1.2 é historizado (`orderflowHistory`, tempo+valor por ciclo real de poll). Reimplementá-lo em Rust duplicaria matemática já validada sem ganho — o "hook" pedido é a série real na store, disponível para qualquer consumidor (linha de CVD com eixo próprio fica como consumidor futuro dessa série já real).

**SMC Engine — re-verificado, não reimplementado.** `fvg-order-block-engine.js` confirmado vivo e ligado: importado em `engine-bridge.ts:51`, chamado por `computeSmcZones`, consumido por App.tsx/`LiquidityZonesPlugin` sobre os MESMOS candles do chart. Graduação registrada em `QUARANTINE.md`. Nenhuma linha tocada.

**Volume Profile — precisão declarada.** Candles OHLCV carregam UM volume agregado; o perfil usa a aproximação padrão (volume distribuído uniformemente por [low,high], proporcional à sobreposição com cada bucket) e isso está documentado no próprio `lib.rs` e no módulo TS — nunca apresentado como perfil tick-level. Session e Fixed Range são a MESMA função com recortes de candles diferentes (sessão = desde a meia-noite UTC do dia do candle mais recente — o "hoje" do dado, não o relógio local).

---

## 5. Defeitos reais encontrados e corrigidos pela própria auditoria

1. **Duplicação de medição de FPS** (`74ea317`): App.tsx já media FPS real via `requestAnimationFrame` desde antes da Fase 0 ("FPS (UI REAL)"); o Health Monitor da Fase 0.8 tinha construído uma SEGUNDA amostragem paralela própria. Violação real de "zero repetição", encontrada ao auditar dados existentes para o heatmap. Corrigido: o Health Monitor agora espelha `store.uiFps` (mesmo padrão de `cycleLatencyMs`), amostragem própria removida.
2. **Vazamento de histórico na troca de ativo** (`b0e3ed0`): `l2History` (Fase 1.1) não era limpo ao trocar de ativo — amostras do ativo anterior ficariam desenhadas sob o novo por até ~6 minutos. Encontrado ao revisar o efeito de reset para ligar o `orderflowHistory`. Corrigido para ambos (`resetL2History`/`resetOrderflowHistory`), junto do `volumeProfile` e da matriz Fibonacci nas fases seguintes.

---

## 6. Verificação (Fase 1.5)

| Verificação | Resultado |
|---|---|
| `cargo test` (nativo, núcleo puro do volume_profile) | 7/7 |
| `tsc --noEmit` estrito | limpo |
| `vitest` suíte completa | **609/609** (40 arquivos; era 547 no fim da Fase 0) |
| Paridade escalar×SIMD | igualdade EXATA (bit-a-bit) no volume_profile entre os dois binários; 10 casas nas reduções, como antes |
| `vite build` produção | limpo (worker do heatmap vira chunk próprio de 0.67 kB) |
| Recompilação `.wasm` (build.sh) | bit-a-bit determinística (git não acusa diff ao recompilar) |
| Playwright — harness isolado do heatmap | worker-mode e main-fallback produzem a MESMA imagem (pixels idênticos contados programaticamente); harness descartado antes do commit |
| Playwright — boot do app REAL | zero erros de código; só falhas de rede do sandbox; app degrada fail-closed (todos os AGUARDANDO honestos, banner real de falha, "AGUARDANDO CANDLES…") |

Nota sobre FPS/60fps: o caminho de desenho novo é dirty-flag + rAF (nunca loop perpétuo), o trabalho pesado está fora da main thread, e o FPS real continua medido pelo contador já existente e exibido na UI — em sandbox sem dados reais não há como medir um número de FPS de produção honesto, então nenhum número é alegado aqui.

---

## 7. O que fica deliberadamente para as próximas fases

- **Conselho Multi-Agente e CPI + feedback biológico** (itens 4–5 da Fase 1 no Blueprint): fora da diretriz atual do Operador (itens 1–3); não iniciados.
- **Linha de CVD com eixo próprio no chart**: consumidor natural da série `orderflowHistory` já real; UI a definir.
- **Superfície visual do Volume Profile e da Matriz Fibonacci**: os dados estão na store com seletores prontos (`useVolumeProfileSnapshot`, `useFibonacciConfluenceSnapshot`); o desenho no chart é aditivo e pode reusar o padrão de plugin já provado duas vezes.
- **`volume_profile: null` do support-resistance-engine**: o motor de S/R aceita volume profile como insumo desde a origem (sempre recebeu `null`); ligar o perfil real a ele é uma extensão natural, mas toca um motor graduado — decisão de governança para o Operador.
