// PriceLabelStackPlugin.tsx — desenha os rótulos de eixo REAIS (S1/R1/
// VWAP/NL/EMA/último preço) num overlay <canvas> próprio, com posição
// vertical resolvida por price-label-stack.ts para NUNCA colidir.
// Substitui os "last value label"/"axis label" nativos dessas séries/
// price lines (desligados em EnhancedChart_110_Percent.tsx —
// lastValueVisible:false / axisLabelVisible:false) porque a lib não tem
// nenhuma consciência cross-série da posição de cada rótulo, e por isso
// nunca evita colisão sozinha — achado real de captura de tela do
// Operador (BTC/USDT 1H, preço formando perto de R1: R1/VWAP/NL/último
// preço todos empilhados/ilegíveis no canto do eixo).
//
// Mesma arquitetura de overlay do resto do gráfico (canvas próprio,
// dirty-flag + rAF, ResizeObserver) — "Fio de Seda": o CONECTOR fino que
// liga um rótulo deslocado de volta ao preço real (quando precisa
// deslocar) é 1px sólido, nunca tracejado, mesma disciplina de qualquer
// outra linha de marcação deste gráfico. Nenhum preço muda — só a
// posição vertical do RÓTULO pode deslocar, e a informação nunca
// desaparece: o conector garante que o operador sempre sabe onde o
// preço real está, mesmo quando o texto precisou se mover pra não
// colidir.
//
// ── HIERARQUIA (achado real de captura de tela do Operador, iPad,
// ZECUSDT 1H ao vivo) ──────────────────────────────────────────────────
// A garantia de zero colisão acima estava sendo cumprida — e mesmo assim
// o gráfico ficou ilegível: 11 etiquetas empilhadas na lateral esquerda,
// TODAS com o mesmo peso visual (caixa sólida opaca + texto escuro),
// cobrindo o primeiro terço das velas. Relato literal do Operador: "não
// tem noção pra onde que o ativo vai". Diagnóstico real: não faltava
// anti-colisão, faltava HIERARQUIA — um sweep de 8 dias atrás gritava
// exatamente tão alto quanto o preço de agora.
// Este overlay passa a desenhar 3 níveis (live/primary/context — tipo,
// regra de default e critério de poda em price-label-stack.ts):
//   live    → caixa sólida MAIOR, negrito, com anel fino de 1px. Uma por
//             gráfico: a âncora que o olho encontra primeiro.
//   primary → caixa sólida (comportamento de sempre) — VWAP/NL/EMA e o
//             plano ativo, o que é acionável agora.
//   context → chip de CONTORNO (fundo do painel + borda 1px na cor do
//             nível + texto na cor do nível) e sujeito a teto de
//             contagem — o mapa estrutural, que deve estar lá sem
//             disputar atenção com o preço.
// Nenhum dado real some: a LINHA/faixa/marcador de cada nível continua
// desenhada pelo seu próprio plugin — só o chip de texto flutuante é
// seletivo.
import { useEffect, useRef } from "react";
import type { IChartApi, ISeriesApi } from "lightweight-charts";
import {
  resolveLabelStackPositions,
  resolveLabelTier,
  selectRelevantLabels,
  type PriceLabelTier,
} from "./price-label-stack";
// Diretriz Final de Lapidação Visual, Adendo, Parte 11 ("cantos
// suavizados"): só a constante de raio é compartilhada com
// nexus/canvas-label.ts (mesma primitiva usada pelos outros 4 plugins de
// etiqueta) — a lógica de caixa/conector/anti-colisão deste plugin já é
// própria e testada, migrar pra drawCanvasLabel exigiria reabrir essa
// lógica sem ganho real; só o roundRect com o mesmo raio foi adicionado
// aqui, com o mesmo fallback honesto para Safari sem suporte.
import { CANVAS_LABEL_RADIUS } from "../nexus/canvas-label";

export interface PriceAxisLabel {
  price: number;
  text: string;
  // Mesma cor real já usada pela linha/série que este rótulo representa
  // — nunca uma cor nova (S1/R1 = verde/vermelho de sempre, VWAP/NL =
  // cor de estado real, EMA = azul-material, último preço = up/down da
  // própria vela).
  color: string;
  // Opcional (default 1 — opaco, comportamento de sempre para todo rótulo
  // existente): decaimento real por idade (ex.: BOS/CHOCH via ageAlpha/
  // BREAK_DECAY, StructureBreakMarkersPlugin) — "o sistema pensa e depois
  // esquece" sem perder a garantia de zero colisão deste plugin.
  alpha?: number;
  // Achado real do Operador ("tá ficando só numa lateral direita... qual
  // forma mais inteligente... mais profissional"): pesquisa real (Lightweight
  // Charts documenta suporte nativo a múltiplas price scales; TradingView
  // Supercharts permite até 8) confirma que dividir rótulos entre os dois
  // lados é prática profissional real, não um desenho inventado. Opcional
  // (default "right" — zero mudança de comportamento pra todo rótulo
  // existente que não declara o campo): cada lado resolve colisão de forma
  // TOTALMENTE independente (nunca um rótulo da esquerda desloca um da
  // direita) — ver EnhancedChart_110_Percent.tsx para o critério real de
  // qual lado cada tipo de rótulo usa (contexto estrutural estático vs.
  // leitura acionável agora).
  side?: "left" | "right";
  // Hierarquia visual real (live/primary/context) — ver o bloco de
  // documentação em price-label-stack.ts, onde o tipo e a regra de default
  // vivem. Opcional: o default deriva do `side` que a divisão esquerda/
  // direita já estabelece (esquerda = mapa estrutural = "context";
  // direita = acionável agora = "primary"), então nenhum dos ~20 pontos
  // de push precisou declarar o campo — só o preço vivo, que declara
  // "live" por ser a única etiqueta-âncora do gráfico.
  tier?: PriceLabelTier;
}

// Altura real de uma etiqueta (px). Achado real de captura de tela do
// Operador ("os tom de cor, o tamanho das etiquetas... não tá legal"): o
// texto era 9px numa caixa de 16px — abaixo do que qualquer terminal
// profissional usa no eixo, e no iPad (a superfície real deste app) fica
// no limite do legível. Subiu para 10px de texto numa caixa de 18px; a
// etiqueta `live` (o preço agora) tem caixa própria, maior, abaixo.
export const LABEL_HEIGHT_PX = 18;
// A âncora de leitura do gráfico inteiro — deliberadamente maior e em
// negrito, o único elemento do eixo que nunca compete com nada.
export const LIVE_LABEL_HEIGHT_PX = 21;
const FONT_LIVE = "bold 11px -apple-system, sans-serif";
const FONT_BASE = "10px -apple-system, sans-serif";
// Teto real de etiquetas de CONTEXTO simultâneas (ver selectRelevantLabels
// em price-label-stack.ts para o critério de poda e por que nenhum dado
// real se perde). 5 é o mesmo número que este repositório já tinha
// convergido de forma independente em MAX_KEY_LEVELS_SHOWN e
// MAX_INSTITUTIONAL_ZONES para a mesma pergunta ("quantas referências
// estruturais um operador rastreia de uma vez") — zero limiar novo
// inventado. Na captura real do Operador havia 11.
export const MAX_CONTEXT_LABELS = 5;
// Fundo dos chips de contexto: quase a cor de fundo real do painel, opaco
// o bastante para o tick nativo do eixo nunca sangrar através (a MESMA
// razão pela qual opaque() existe, abaixo) e discreto o bastante para o
// chip ler como anotação sobre o gráfico, nunca como um bloco sólido
// disputando atenção com o preço.
const CONTEXT_FILL = "rgba(6, 10, 20, 0.88)";
// Achado real via harness Playwright (verificação desta correção):
// alimentar o resolvedor com minGapPx = LABEL_HEIGHT_PX faz duas
// etiquetas colidindo ficarem exatamente ENCOSTADAS (gap zero) — nunca
// sobrepostas de fato, mas visualmente lidas como "uma coisa só" quando
// as cores/larguras são bem diferentes (ex.: "VWAP ↓ 64854.83" ao lado
// de um número solto sem prefixo). MIN_GAP_PX folgado garante uma fresta
// real e visível entre duas etiquetas mesmo no pior caso — "cada desenho
// no lugar preciso, nunca um em cima do outro" de verdade, não só
// matematicamente.
// A folga extra agora tem uma segunda razão real, além da fresta visível:
// a etiqueta `live` é fisicamente maior (LIVE_LABEL_HEIGHT_PX=21 + o anel
// fino de 1px a 1.5px de distância = 24px reais). O passo da pilha
// precisa ser maior que isso, senão o anel do preço vivo encostaria na
// caixa vizinha — o mesmo defeito de "uma coisa só" que este gap existe
// para eliminar.
const MIN_GAP_PX = LABEL_HEIGHT_PX + 7;
const LABEL_PADDING_X = 6;
const RIGHT_MARGIN_PX = 2;
// Achado real do Operador (densidade de rótulos só no lado direito): o
// lado esquerdo usa a mesma margem mínima real do direito — nenhuma
// assimetria arbitrária entre os dois.
const LEFT_MARGIN_PX = 2;

// Achado real via harness Playwright (verificação desta correção): as
// cores reaproveitadas (rgba(...), 0.65/0.75/0.85) são translúcidas de
// propósito para as LINHAS do gráfico — mas usadas como fundo de uma
// CAIXA de rótulo, deixam o tick do eixo de preço nativo (sempre
// desenhado pela própria lib atrás, ex.: "64800.00") sangrar através.
// Os "last value label" nativos que este overlay substitui SEMPRE foram
// blocos 100% opacos — mesma convenção aqui, só na cor de FUNDO da caixa
// (o conector fino continua com a opacidade real da linha, abaixo).
function opaque(rgba: string): string {
  const m = rgba.match(/rgba?\(([^,]+),([^,]+),([^,]+)(?:,[^)]+)?\)/);
  return m ? `rgb(${m[1]},${m[2]},${m[3]})` : rgba;
}

interface PriceLabelStackPluginProps {
  chart: IChartApi | null;
  series: ISeriesApi<"Candlestick"> | null;
  labels: PriceAxisLabel[];
}

export function PriceLabelStackPlugin({ chart, series, labels }: PriceLabelStackPluginProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const labelsRef = useRef(labels);
  const markDirtyRef = useRef<(() => void) | null>(null);

  // Sempre a versão mais recente dos rótulos para o loop de desenho ler
  // — nunca dispara o efeito de setup abaixo de novo (mesmo padrão de
  // LiquidityZonesPlugin/StructureBreakMarkersPlugin).
  labelsRef.current = labels;

  useEffect(() => {
    markDirtyRef.current?.();
  }, [labels]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!chart || !series || !canvas) return;

    let rafScheduled = false;
    const draw = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const cssWidth = canvas.clientWidth;
      const cssHeight = canvas.clientHeight;
      if (cssWidth === 0 || cssHeight === 0) return;
      const dpr = window.devicePixelRatio || 1;
      const pxWidth = Math.round(cssWidth * dpr);
      const pxHeight = Math.round(cssHeight * dpr);
      if (canvas.width !== pxWidth || canvas.height !== pxHeight) {
        canvas.width = pxWidth;
        canvas.height = pxHeight;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssWidth, cssHeight);
      ctx.font = FONT_BASE;

      // Uma só primitiva de caixa para os 3 níveis (Regra de Ouro 4: zero
      // lógica duplicada) — o que muda entre eles é só preenchimento vs.
      // contorno, nunca a geometria. Fallback honesto para motor sem
      // roundRect (Safari antigo): mesma caixa, só com canto reto.
      const boxPath = (x: number, y: number, w: number, h: number) => {
        ctx.beginPath();
        if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, w, h, CANVAS_LABEL_RADIUS);
        else ctx.rect(x, y, w, h);
      };

      // Poda de densidade ANTES de qualquer geometria (achado real de
      // captura de tela do Operador: 11 chips de contexto empilhados na
      // lateral esquerda, cobrindo o primeiro terço das velas). A regra
      // real e o porquê de nenhum dado se perder vivem em
      // selectRelevantLabels (price-label-stack.ts) — aqui só a fiação.
      // A referência de proximidade é a PRÓPRIA etiqueta `live` (o preço
      // agora), nunca uma segunda fonte de preço: se ela ainda não
      // existe, a função é fail-closed e mantém uma ordem determinística
      // em vez de inventar uma distância.
      const liveEntry = labelsRef.current.find((l) => resolveLabelTier(l.side, l.tier) === "live");
      const visible = selectRelevantLabels(
        labelsRef.current,
        liveEntry ? liveEntry.price : null,
        MAX_CONTEXT_LABELS,
      );

      // Achado real do Operador ("tá ficando só numa lateral direita"):
      // cada lado resolve colisão de forma TOTALMENTE independente — um
      // rótulo da esquerda nunca desloca um da direita e vice-versa (são
      // duas pilhas físicas separadas, cada uma com sua própria garantia
      // de "nunca um em cima do outro"). side ausente = "right", mesmo
      // comportamento de sempre pra todo rótulo que não declara o campo.
      const withNaturalY = (side: "left" | "right") =>
        visible
          .filter((l) => (l.side ?? "right") === side)
          .map((l) => {
            const coord = series.priceToCoordinate(l.price);
            // Coordinate é um tipo nominal da própria lib (branded number) —
            // convertido pra number puro aqui, na fronteira: price-label-
            // stack.ts é matemática de posicionamento genérica, nunca deve
            // depender de um tipo específico da lightweight-charts.
            return coord === null ? null : { ...l, naturalY: coord as unknown as number };
          })
          .filter((e): e is PriceAxisLabel & { naturalY: number } => e !== null);

      // Desenha UMA pilha já resolvida (esquerda OU direita) — caixa+texto+
      // conector idênticos nos dois lados, só o ponto de ancoragem espelha
      // (boxX/direção do conector). Zero duplicação de lógica (Regra de
      // Ouro 4): a única diferença real entre os dois lados é geométrica.
      const drawSide = (entries: (PriceAxisLabel & { naturalY: number })[], side: "left" | "right") => {
        if (entries.length === 0) return;
        const resolved = resolveLabelStackPositions(entries, MIN_GAP_PX);

        for (const entry of resolved) {
          // Decaimento real por idade (BOS/CHOCH) — default 1 preserva o
          // comportamento de sempre (opaco) para todo rótulo que não declara
          // alpha (S1/R1/VWAP/NL/EMA/TREND/ENTRY/STOP/TARGET/etc).
          const labelAlpha = entry.alpha ?? 1;
          const tier = resolveLabelTier(entry.side, entry.tier);
          ctx.font = tier === "live" ? FONT_LIVE : FONT_BASE;
          const textWidth = ctx.measureText(entry.text).width;
          const boxHeight = tier === "live" ? LIVE_LABEL_HEIGHT_PX : LABEL_HEIGHT_PX;
          const boxWidth = textWidth + LABEL_PADDING_X * 2;
          const boxX = side === "right" ? cssWidth - RIGHT_MARGIN_PX - boxWidth : LEFT_MARGIN_PX;
          const boxY = entry.resolvedY - boxHeight / 2;
          if (boxY + boxHeight < 0 || boxY > cssHeight) continue; // fora da área visível — Fail-Closed, nunca desenha fora do canvas

          // Conector fino de volta ao preço real quando o rótulo deslocou
          // — Fio de Seda (1px sólida, nunca tracejada). Nunca aparece
          // quando o rótulo já está na própria posição natural. Do lado
          // direito o conector fica na borda ESQUERDA da caixa (entre a
          // caixa e o gráfico); do lado esquerdo, espelhado, na borda
          // DIREITA da caixa — mesma direção real: sempre entre a caixa e
          // o centro do gráfico, nunca cortando pra fora da tela.
          if (Math.abs(entry.resolvedY - entry.naturalY) > 0.5) {
            const connectorX = side === "right" ? boxX - 0.5 : boxX + boxWidth + 0.5;
            ctx.strokeStyle = entry.color;
            ctx.globalAlpha = 0.5 * labelAlpha;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(connectorX, entry.naturalY);
            ctx.lineTo(connectorX, entry.resolvedY);
            ctx.stroke();
            ctx.globalAlpha = 1;
          }

          ctx.globalAlpha = labelAlpha;
          // NÍVEL "context" (mapa estrutural: S1/R1, sessões, sweeps,
          // BOS/CHOCH, zonas institucionais, trend channel). Achado real da
          // captura do Operador: como caixa SÓLIDA, cada um destes gritava
          // tão alto quanto o preço vivo — 11 blocos coloridos cobrindo o
          // primeiro terço das velas. Como chip de CONTORNO (fundo quase
          // igual ao do painel + borda de 1px na cor real do nível + texto
          // NA COR do nível), a informação é exatamente a mesma e a
          // identidade por cor fica até mais legível — mas o peso visual cai
          // para o de uma anotação, que é o que ele sempre foi. A borda é
          // 1px sólida: "Fio de Seda", igual a qualquer outra marcação deste
          // gráfico. Meio-pixel de recuo só para o traço cair inteiro dentro
          // de uma coluna de pixels (borda nítida, nunca borrada em 2px).
          if (tier === "context") {
            boxPath(boxX + 0.5, boxY + 0.5, boxWidth - 1, boxHeight - 1);
            ctx.fillStyle = CONTEXT_FILL;
            ctx.fill();
            ctx.strokeStyle = opaque(entry.color);
            ctx.lineWidth = 1;
            ctx.stroke();
          } else {
            // NÍVEL "live" — a âncora de leitura do gráfico. Anel fino de
            // 1px em volta da caixa (Fio de Seda, nunca tracejado), a
            // única etiqueta do eixo que o ganha: é o que faz o olho
            // encontrar "onde o preço está AGORA" antes de qualquer outra
            // coisa, sem precisar ler nenhum texto.
            if (tier === "live") {
              boxPath(boxX - 1.5, boxY - 1.5, boxWidth + 3, boxHeight + 3);
              ctx.strokeStyle = opaque(entry.color);
              ctx.globalAlpha = 0.4 * labelAlpha;
              ctx.lineWidth = 1;
              ctx.stroke();
              ctx.globalAlpha = labelAlpha;
            }
            // NÍVEL "live" e "primary" (preço agora + VWAP/NL/EMA + EN/ST/TP
            // do plano ativo): caixa sólida na cor real da própria linha,
            // exatamente o comportamento que os "last value label" nativos
            // que este overlay substitui sempre tiveram.
            boxPath(boxX, boxY, boxWidth, boxHeight);
            ctx.fillStyle = opaque(entry.color);
            ctx.fill();
          }

          // Texto escuro sobre fundo colorido nos níveis sólidos (mesmo
          // contraste dos tags nativos); nos chips de contexto, a PRÓPRIA
          // cor do nível sobre fundo escuro — a identidade por cor é a
          // mesma nos dois casos, só o que é figura e o que é fundo troca.
          ctx.fillStyle = tier === "context" ? opaque(entry.color) : "#050810";
          ctx.textBaseline = "middle";
          ctx.textAlign = "left";
          ctx.fillText(entry.text, boxX + LABEL_PADDING_X, entry.resolvedY + 0.5);
          ctx.globalAlpha = 1;
        }
      };

      drawSide(withNaturalY("right"), "right");
      drawSide(withNaturalY("left"), "left");
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
    resizeObserver.observe(canvas);

    markDirty(); // primeiro desenho real assim que o chart/série existem.

    return () => {
      markDirtyRef.current = null;
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRangeChange);
      resizeObserver.disconnect();
    };
  }, [chart, series]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      // Achado real via harness Playwright (Diretriz de Refinamento Visual
      // §5/§6): a lightweight-charts desenha seus PRÓPRIOS canvases
      // internos (painel principal + gutter do eixo de preço) com
      // z-index:1/z-index:2 explícitos. Sem um z-index explícito aqui, ESTE
      // canvas cai no z-index:auto — e por regra do CSS (stacking context),
      // z-index positivo SEMPRE pinta por cima de z-index:auto, não importa
      // a ordem no DOM. Resultado real observado: o próprio ticker nativo
      // do eixo (ex.: "64800.00", desenhado pela lib em intervalos
      // "redondos" independente de qualquer série) vazava por cima da
      // caixa opaca de um rótulo nosso sempre que os dois calhavam perto
      // (ex.: R1 ~64807 vs. tick nativo 64800.00) — exatamente a colisão
      // visual que este plugin existe para eliminar. z-index bem acima do
      // maior valor usado pela lib (2) garante que este overlay SEMPRE
      // pinta por último, cobrindo o tick nativo por completo.
      style={{ width: "100%", height: "100%", zIndex: 5 }}
    />
  );
}
