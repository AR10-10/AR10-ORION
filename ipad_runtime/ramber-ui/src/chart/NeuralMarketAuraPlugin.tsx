// NeuralMarketAuraPlugin.tsx — Neural Market Aura (NMA), especificação do
// Operador. Mesma arquitetura de overlay já estabelecida por
// LiquidityZonesPlugin/StructureBreakMarkersPlugin/TradePlanZonePlugin
// (Canvas 2D próprio, dirty-flag + rAF, ResizeObserver, fio de seda 1px
// sólido) — zero segunda arquitetura, só mais uma instância dela para o
// dado real do aura-lifecycle.ts. Ver o cabeçalho de aura-lifecycle.ts
// para o racional completo de escopo/honestidade.
//
// Divisão de responsabilidade com TradePlanZonePlugin (zero duplicação):
// aquele plugin já desenha a CAIXA da zona de entrada (um range real);
// este plugin NUNCA redesenha essa caixa — desenha o CORREDOR (entrada até
// o alvo) e o marcador de proximidade do alvo, um canal visual novo e
// distinto.
//
// "Largura do corredor" (Regra de Ouro honestidade): NÃO é incerteza sobre
// o preço do alvo — o alvo continua uma linha de preço exata e imutável
// (EnhancedChart_110_Percent). É a MASSA DE CONVICÇÃO real (Confluence
// Engine, 0..1) — mesmo princípio já usado pela espessura de barra do
// Volume Profile (magnitude real, nunca incerteza de preço). Convicção
// alta = corredor concentrado perto do preço atual (estreito); convicção
// baixa = corredor difuso, espalhado por mais tempo visível (amplo) — a
// mesma leitura de "cone de confiança" que estreita com mais confiança.
//
// Fio de Seda (Regra de Ouro 5, "zero exceção"): todo traço de borda deste
// plugin é lineWidth=1 sólido, nunca setLineDash, nunca uma largura
// variável — a convicção fala pelo PREENCHIMENTO/gradiente, nunca pela
// linha. As linhas de preço reais (entry/stop/target) nunca são tocadas
// aqui.
//
// "Ciclone de Convicção" (pedido direto do Operador — "não um túnel... um
// ciclone, levando até o alvo"; total liberdade de evolução visual, mas
// "previsão mais precisa" nunca vira um número fabricado — Regra de Ouro
// 2 continua absoluta): enquanto o plano está sendo PERSEGUIDO (BIRTH/
// ESTABLISHED), o corredor estático evolui para um fluxo contínuo de
// partículas espiralando e afunilando em direção ao alvo real — mesmo
// dado real (conviction/turbulence/proximidade), só uma forma visual mais
// viva. Isto é a PRIMEIRA animação verdadeiramente contínua desta base —
// tratada com o cuidado que Main Thread sagrada exige (CLAUDE.md: "mover
// pra Worker exige iniciativa própria e isolada"):
//   - O laço de animação roda inteiramente DENTRO de um Worker dedicado
//     (conviction-cyclone-worker.ts), mesmo handshake real já provado por
//     OrderFlowHeatmapPlugin (transferControlToOffscreen + postMessage
//     'ready'/ok — nunca supõe suporte).
//   - Quando esse handshake falha (achado já documentado nesta base, Fase
//     0.7: OffscreenCanvas 2D em Worker no Safari/iPad — a PLATAFORMA-ALVO
//     real deste terminal — não é confiável hoje), o main thread NUNCA
//     tenta rodar a mesma animação sozinho: cai pro corredor ESTÁTICO já
//     comprovado (dirty-flag, zero rAF perpétuo), a mesma garantia de
//     Regra de Ouro 7 (60 FPS iPad Safari) que este app já mantinha antes
//     do Ciclone existir.
//   - Fora da perseguição (TARGET_HIT/STOP_HIT/REPLACED — resolvido ou
//     dissolvendo), o Ciclone nunca aparece, mesmo com Worker disponível:
//     movimento contínuo comunica "ainda em curso"; uma vez resolvido, o
//     corredor estático (já existente, já testado) é a leitura honesta —
//     "chegou"/"parou" não deveria continuar girando.
import { useEffect, useRef } from "react";
import type { IChartApi, ISeriesApi } from "lightweight-charts";
import type { AuraReading } from "../nexus/aura-lifecycle";
import type { CycloneRealParams, CycloneWorkerOutMessage } from "../nexus/conviction-cyclone-draw";

interface NeuralMarketAuraPluginProps {
  chart: IChartApi | null;
  series: ISeriesApi<"Candlestick"> | null;
  aura: AuraReading | null;
}

// Mesma paleta direcional já usada em toda a UI (BOS/CHOCH, badges de
// direção): verde real para ALTA/sucesso, vermelho real para BAIXA/stop —
// um significado por cor em todo o app, nunca uma segunda paleta.
const LONG_RGB = "8, 153, 129";
const SHORT_RGB = "242, 54, 69";
const NEUTRAL_RGB = "138, 180, 248"; // mesmo azul-acinzentado usado para "neutro/informativo" em toda a UI

// Correção real de auditoria (FASE Ω Priority 3, Finding I): a versão
// anterior coloria BIRTH/ESTABLISHED por DIREÇÃO do plano — colidia com a
// convenção JÁ ESTABELECIDA de "uma cor por papel" em todo o app
// (TradePlanZonePlugin.tsx: "one color per role across the whole chart,
// never a second palette for the same concept" — alvo SEMPRE verde, stop
// SEMPRE vermelho, independente de LONG/SHORT; ver EnhancedChart_110_
// Percent.tsx's targetLineRef/stopLineRef). Um SHORT real produzia corredor
// VERMELHO terminando numa linha de alvo nativa VERDE no MESMO gráfico —
// dois vocabulários de cor discordando sobre o mesmo nível de preço.
function phaseRgb(phase: AuraReading["phase"]): string {
  // Enquanto o plano está aberto (BIRTH/ESTABLISHED) ou foi substituído
  // (REPLACED), a cor é NEUTRA — nenhum resultado real ainda existe para
  // reportar. Só ao resolver a cor comunica RESULTADO real — um SHORT que
  // bate o alvo é um sucesso real (verde), não "vermelho porque é short".
  // PARTIAL_HIT (v2): >=1 alvo real já foi provado antes do break-even —
  // um resultado real validado, mesma cor de sucesso do TARGET_HIT.
  if (phase === "TARGET_HIT" || phase === "PARTIAL_HIT") return LONG_RGB;
  if (phase === "STOP_HIT") return SHORT_RGB;
  return NEUTRAL_RGB;
}

// Largura do corredor em pixels, do preço atual (borda direita) para trás:
// interpola entre um mínimo concentrado (convicção 1) e um máximo difuso
// (convicção 0 ou desconhecida). Parâmetros documentados — mesma natureza
// dos outros limiares visuais já escolhidos neste arquivo/sessão. Reaproveitada
// tanto pelo corredor estático quanto pela geometria real mandada pro
// Ciclone — os dois nunca podem ter uma largura diferente pro mesmo dado.
const CORRIDOR_MIN_PX = 60;
const CORRIDOR_MAX_PX = 220;
function corridorWidthPx(widthFactor: number | null): number {
  const f = widthFactor ?? 0; // convicção desconhecida => leitura mais difusa/conservadora, nunca a mais confiante
  return CORRIDOR_MAX_PX - f * (CORRIDOR_MAX_PX - CORRIDOR_MIN_PX);
}

// Colapso real do funil quando o preço real já está na banda de
// "aproximando" (ATR-escalada, aura-lifecycle.ts) — parâmetro visual
// documentado (mesma natureza de CORRIDOR_MIN_PX acima), não uma medição:
// o funil não desaparece, só se concentra mais perto do alvo real.
const APPROACH_COLLAPSE = 0.55;

const CYCLONE_HANDOFF_TIMEOUT_MS = 800;
type RendererMode = "pending" | "worker" | "main";

function supportsOffscreenWorker(): boolean {
  return (
    typeof Worker !== "undefined" &&
    typeof HTMLCanvasElement !== "undefined" &&
    typeof (HTMLCanvasElement.prototype as unknown as { transferControlToOffscreen?: unknown }).transferControlToOffscreen === "function"
  );
}

// Auto-auditoria real (Ω-INFINITY, atualização "Evolução da Experiência
// Visual": "aumentar a compreensão do operador, nunca só efeito
// estético") — achado real feito nesta mesma sessão, logo depois de
// entregar o Ciclone: movimento contínuo genuíno pode ser desconfortável
// ou distrativo pra um Operador sensível a movimento, o que reduziria
// compreensão em vez de aumentar. `prefers-reduced-motion` é o sinal real
// do próprio sistema operacional/navegador pra isso — respeitado aqui
// nunca tentando o caminho do Worker quando ativo (o corredor estático,
// já sem nenhuma animação perpétua, é a leitura correta nesse caso).
function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;
}

export function NeuralMarketAuraPlugin({ chart, series, aura }: NeuralMarketAuraPluginProps) {
  const cycloneCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const staticCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef({ aura });
  const markDirtyRef = useRef<(() => void) | null>(null);
  // modeRef é lido pelo laço de desenho (draw()/decideRenderer) — de
  // propósito NUNCA promovido a estado React reativo: qual canvas fica
  // visível é decidido a cada draw() real (phase muda com frequência real
  // bem maior que o handshake worker/main, que só acontece uma vez). Se
  // `mode` disparasse um re-render, ele reescreveria `style.display` via
  // JSX bem depois de applyVisibility() já ter decidido o valor certo pro
  // frame atual — uma corrida real entre dois donos da mesma propriedade.
  // Visibilidade das duas <canvas> é 100% imperativa (applyVisibility,
  // dentro do efeito) desde o primeiro render — nunca pelo JSX.
  const modeRef = useRef<RendererMode>("pending");

  stateRef.current = { aura };

  useEffect(() => {
    markDirtyRef.current?.();
  }, [aura]);

  useEffect(() => {
    const cycloneCanvas = cycloneCanvasRef.current;
    const staticCanvas = staticCanvasRef.current;
    if (!chart || !series || !cycloneCanvas || !staticCanvas) return;

    let cancelled = false;
    let worker: Worker | null = null;
    let rafScheduled = false;
    let lastCyclonePxSize = { w: 0, h: 0 };

    // Corredor ESTÁTICO — código idêntico ao v1 já testado/verificado
    // (Fase Ω Priority 3), agora extraído pra função própria porque serve
    // DOIS papéis: (a) todo o desenho quando o Worker do Ciclone está
    // indisponível/pendente, (b) o desenho de resolução (TARGET_HIT/
    // STOP_HIT/REPLACED) mesmo quando o Worker está disponível — motion
    // contínuo só faz sentido enquanto o plano ainda está sendo
    // perseguido.
    const drawStatic = () => {
      const ctx = staticCanvas.getContext("2d");
      if (!ctx) return;
      const cssWidth = staticCanvas.clientWidth;
      const cssHeight = staticCanvas.clientHeight;
      if (cssWidth === 0 || cssHeight === 0) return;
      const dpr = window.devicePixelRatio || 1;
      const pxWidth = Math.round(cssWidth * dpr);
      const pxHeight = Math.round(cssHeight * dpr);
      if (staticCanvas.width !== pxWidth || staticCanvas.height !== pxHeight) {
        staticCanvas.width = pxWidth;
        staticCanvas.height = pxHeight;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssWidth, cssHeight);

      const { aura: reading } = stateRef.current;
      // Sem leitura real (nenhum plano rastreado, ou já dissolvida por
      // completo) => nada a desenhar, honesto — mesma regra do
      // StructureBreakMarkersPlugin.
      if (!reading || reading.status !== "OK" || !reading.plan || reading.fadeAlpha <= 0) return;

      const { plan, phase, targetIndex, targetProximity, corridorWidthFactor, pulseIntensity, fadeAlpha } = reading;
      const entryMid = (plan.entry.low + plan.entry.high) / 2;
      const yEntry = series.priceToCoordinate(entryMid);
      // v2: o corredor aponta para o alvo real ATIVO (reading.targetIndex),
      // nunca fixo no primeiro — o mesmo alvo que a escada de progressão
      // real do Track Record está perseguindo agora.
      const yTarget = series.priceToCoordinate(plan.targets[targetIndex ?? 0].price);
      if (yEntry === null || yTarget === null) return; // fora da faixa de preço visível agora — Fail-Closed, nunca extrapola.

      const rgb = phaseRgb(phase);
      const top = Math.min(yEntry, yTarget);
      const bottom = Math.max(yEntry, yTarget);
      const bandHeight = Math.max(1, bottom - top);
      const bandWidth = Math.min(cssWidth, corridorWidthPx(corridorWidthFactor));
      const bandX = cssWidth - bandWidth; // ancorado na borda direita (preço atual), o corredor se estende para trás no tempo.

      // Preenchimento em gradiente vertical (entrada -> alvo) — dois sinais
      // reais e DISTINTOS falam aqui, nunca por uma linha de marcação:
      // convicção real (Confluence Engine) fala pela LARGURA do corredor
      // (corridorWidthPx, calculada acima em bandWidth); Market Pulse (ATR%
      // real normalizado) fala pela OPACIDADE de base abaixo — mercado
      // quieto = quase transparente, volátil = mais vívido. Correção real
      // de auditoria (FASE Ω Priority 3, Finding L): o comentário anterior
      // atribuía largura E opacidade à "convicção" — baseAlpha abaixo nunca
      // lê corridorWidthFactor, só pulseIntensity/fadeAlpha.
      const pulse = pulseIntensity ?? 0.3; // sem ATR real ainda: leitura moderada, nunca a mais intensa
      const baseAlpha = (0.06 + 0.22 * pulse) * fadeAlpha;
      const gradient = ctx.createLinearGradient(0, top, 0, bottom);
      gradient.addColorStop(0, `rgba(${rgb}, ${baseAlpha})`);
      gradient.addColorStop(1, `rgba(${rgb}, ${baseAlpha * 1.6})`); // mais vívido perto do alvo — "atração" real do corredor
      ctx.fillStyle = gradient;
      ctx.fillRect(bandX, top, bandWidth, bandHeight);

      // Fio de Seda: a única linha de marcação deste plugin é a borda
      // superior do corredor (o lado "novo", o mais recente) — 1px sólida
      // real, nunca tracejada, nunca mais grossa que 1px independente da
      // convicção (a convicção já falou pela largura do preenchimento).
      ctx.globalAlpha = fadeAlpha;
      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(${rgb}, ${Math.min(1, baseAlpha * 3)})`;
      // Borda do lado do alvo — sempre o lado "novo" do corredor, independente da direção.
      ctx.beginPath();
      ctx.moveTo(bandX, Math.round(yTarget) + 0.5);
      ctx.lineTo(cssWidth, Math.round(yTarget) + 0.5);
      ctx.stroke();

      // Marcador de proximidade do alvo — 3 estados reais (Target Life
      // Cycle da especificação, comprimido para o único alvo real que o
      // TradePlan atual tem — ver cabeçalho de aura-lifecycle.ts).
      const markerX = cssWidth - 14;
      const markerY = yTarget;
      ctx.globalAlpha = fadeAlpha;
      ctx.lineWidth = 1;
      if (targetProximity === "HIT") {
        ctx.fillStyle = `rgba(${rgb}, 0.85)`;
        ctx.beginPath();
        ctx.arc(markerX, markerY, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(${rgb}, 1)`;
        ctx.beginPath();
        ctx.arc(markerX, markerY, 8, 0, Math.PI * 2);
        ctx.stroke();
      } else if (targetProximity === "APPROACHING") {
        ctx.fillStyle = `rgba(${rgb}, 0.55)`;
        ctx.beginPath();
        ctx.arc(markerX, markerY, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(${rgb}, 0.8)`;
        ctx.beginPath();
        ctx.arc(markerX, markerY, 7, 0, Math.PI * 2);
        ctx.stroke();
      } else if (targetProximity === "WAITING") {
        ctx.strokeStyle = `rgba(${rgb}, 0.4)`;
        ctx.beginPath();
        ctx.arc(markerX, markerY, 4, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Marcador de STOP_HIT — mesmo desenho do marcador "HIT" acima, só
      // na coordenada real do stop. Achado real de auditoria (FASE Ω
      // Priority 3, Finding J): antes, quando o stop real era atingido,
      // targetProximity fica null nessa fase (aura-lifecycle.ts nunca
      // atribui um valor para STOP_HIT/REPLACED) — nenhum marcador
      // aparecia, só o corredor mudando de cor por um instante já em
      // dissolução. yStop vem do MESMO plan.stop.price real que
      // EnhancedChart_110_Percent.tsx já desenha como linha de preço
      // nativa — nenhuma geometria nova é inventada aqui.
      if (phase === "STOP_HIT") {
        const yStop = series.priceToCoordinate(plan.stop.price);
        if (yStop !== null) {
          ctx.globalAlpha = fadeAlpha;
          ctx.lineWidth = 1;
          ctx.fillStyle = `rgba(${rgb}, 0.85)`;
          ctx.beginPath();
          ctx.arc(markerX, yStop, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = `rgba(${rgb}, 1)`;
          ctx.beginPath();
          ctx.arc(markerX, yStop, 8, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    };

    // Geometria/parâmetros REAIS do Ciclone — mesma leitura de
    // corridorWidthFactor/pulseIntensity/fadeAlpha do corredor estático
    // acima, nunca uma segunda fonte. `real: null` honesto quando não há
    // perseguição real em curso (fora de BIRTH/ESTABLISHED) — o worker
    // para de ticar e limpa sozinho (ver conviction-cyclone-worker.ts).
    const buildCycloneReal = (): CycloneRealParams | null => {
      const { aura: reading } = stateRef.current;
      if (!reading || reading.status !== "OK" || !reading.plan || reading.fadeAlpha <= 0) return null;
      if (reading.phase !== "BIRTH" && reading.phase !== "ESTABLISHED") return null; // resolvido/dissolvendo => corredor estático, nunca o ciclone

      const cssWidth = cycloneCanvas.clientWidth;
      const cssHeight = cycloneCanvas.clientHeight;
      if (cssWidth === 0 || cssHeight === 0) return null;
      const { plan, targetIndex, corridorWidthFactor, pulseIntensity, fadeAlpha, targetProximity } = reading;
      const entryMid = (plan.entry.low + plan.entry.high) / 2;
      const yEntry = series.priceToCoordinate(entryMid);
      const yTarget = series.priceToCoordinate(plan.targets[targetIndex ?? 0].price);
      if (yEntry === null || yTarget === null) return null; // fora da faixa visível agora — Fail-Closed, nunca extrapola.

      const top = Math.min(yEntry, yTarget);
      const bottom = Math.max(yEntry, yTarget);
      const bandWidth = Math.min(cssWidth, corridorWidthPx(corridorWidthFactor));
      const bandX = cssWidth - bandWidth;
      const collapse = targetProximity === "APPROACHING" ? APPROACH_COLLAPSE : 0;

      return {
        bandX,
        cssWidth,
        cssHeight,
        dpr: window.devicePixelRatio || 1,
        top,
        bottom,
        edgeY: yTarget,
        color: phaseRgb(reading.phase),
        conviction: corridorWidthFactor ?? 0,
        turbulence: pulseIntensity ?? 0.3,
        fadeAlpha,
        collapse,
      };
    };

    const applyVisibility = (showCyclone: boolean) => {
      cycloneCanvas.style.display = showCyclone ? "block" : "none";
      staticCanvas.style.display = showCyclone ? "none" : "block";
    };

    const draw = () => {
      // O corredor estático SEMPRE desenha (dirty-flag, barato) —
      // continua a garantia real de fallback mesmo quando escondido atrás
      // do Ciclone, então trocar de canvas nunca arrisca mostrar um frame
      // desatualizado.
      drawStatic();

      const real = modeRef.current === "worker" ? buildCycloneReal() : null;
      applyVisibility(real !== null);
      if (modeRef.current !== "worker" || !worker) return;

      const pxWidth = Math.round(cycloneCanvas.clientWidth * (window.devicePixelRatio || 1));
      const pxHeight = Math.round(cycloneCanvas.clientHeight * (window.devicePixelRatio || 1));
      if (pxWidth !== lastCyclonePxSize.w || pxHeight !== lastCyclonePxSize.h) {
        lastCyclonePxSize = { w: pxWidth, h: pxHeight };
        worker.postMessage({ type: "resize", pxWidth, pxHeight });
      }
      worker.postMessage({ type: "update", real });
    };

    const markDirty = () => {
      if (rafScheduled) return;
      rafScheduled = true;
      requestAnimationFrame(() => {
        rafScheduled = false;
        draw();
      });
    };
    markDirtyRef.current = markDirty;

    const onRangeChange = () => markDirty();
    chart.timeScale().subscribeVisibleLogicalRangeChange(onRangeChange);

    const resizeObserver = new ResizeObserver(() => markDirty());
    resizeObserver.observe(cycloneCanvas);
    resizeObserver.observe(staticCanvas);

    const decideRenderer = async () => {
      if (supportsOffscreenWorker() && !prefersReducedMotion()) {
        try {
          const candidateWorker = new Worker(new URL("../workers/conviction-cyclone-worker.ts", import.meta.url), { type: "module" });
          const offscreen = (cycloneCanvas as unknown as { transferControlToOffscreen: () => OffscreenCanvas }).transferControlToOffscreen();
          const ok = await new Promise<boolean>((resolve) => {
            const timer = setTimeout(() => resolve(false), CYCLONE_HANDOFF_TIMEOUT_MS);
            candidateWorker.onmessage = (ev: MessageEvent<CycloneWorkerOutMessage>) => {
              if (ev.data?.type === "ready") {
                clearTimeout(timer);
                resolve(!!ev.data.ok);
              }
            };
            candidateWorker.onerror = () => {
              clearTimeout(timer);
              resolve(false);
            };
            candidateWorker.postMessage({ type: "init", canvas: offscreen }, [offscreen]);
          });
          if (cancelled) {
            candidateWorker.terminate();
            return;
          }
          if (ok) {
            worker = candidateWorker;
            modeRef.current = "worker";
            markDirty();
            return;
          }
          candidateWorker.terminate();
        } catch {
          // Falha real ao tentar o caminho OffscreenCanvas (Worker
          // indisponível, construção lançou, etc.) — cai pro corredor
          // estático abaixo, nunca fica sem Aura por causa disto.
        }
      }
      if (!cancelled) {
        modeRef.current = "main";
        applyVisibility(false);
        markDirty();
      }
    };
    void decideRenderer();

    markDirty(); // primeiro desenho real (corredor estático) assim que chart/série existem, mesmo antes do handshake resolver.

    return () => {
      cancelled = true;
      markDirtyRef.current = null;
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRangeChange);
      resizeObserver.disconnect();
      worker?.terminate();
    };
  }, [chart, series]);

  return (
    <>
      <canvas
        ref={cycloneCanvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ width: "100%", height: "100%", display: "none" }}
      />
      <canvas
        ref={staticCanvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ width: "100%", height: "100%", display: "none" }}
      />
    </>
  );
}
