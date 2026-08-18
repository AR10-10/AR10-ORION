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
//   primary → VWAP/NL/EMA e o plano ativo, o que é acionável agora.
//   context → o mapa estrutural, sujeito a teto de contagem — não deve
//             disputar atenção com o preço.
// (o tratamento visual exato de primary/context mudou mais de uma vez
// desde que este parágrafo foi escrito — ver o histórico real a partir
// de FONT_COMPACT abaixo, a fonte da verdade atual)
// Nenhum dado real some: a LINHA/faixa/marcador de cada nível continua
// desenhada pelo seu próprio plugin — só o chip de texto flutuante é
// seletivo.
import { useEffect, useRef } from "react";
import { CHART_LABEL_Z_INDEX } from "./chart-layer-depth";
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
// Achado real, task #341 (auditoria "Estratégia de Evolução Elite",
// 2026-08-16): a Fase A do Ajuste ULTRA LED (EnhancedChart_110_Percent.tsx)
// já escala o fontSize NATIVO do chart (11→12→13px conforme
// window.innerWidth) num monitor grande/UltraWide/4K — mas as etiquetas
// deste overlay (S1/R1/VWAP/POC/etc., desenhadas por CIMA do tick nativo)
// ficavam com fonte fixa em qualquer resolução, uma inconsistência visual
// real entre o eixo nativo e o próprio overlay que o substitui. Reusa a
// MESMA função/mesmos 3 breakpoints já aprovados (nunca um breakpoint
// novo) — só aplica o mesmo delta às fontes/alturas deste plugin.
import { resolveChartUltraWideScale } from "./chart-ultrawide-scale";

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
  // Hierarquia visual real (live/critical/primary/context) — ver o bloco
  // de documentação em price-label-stack.ts, onde o tipo e a regra de
  // default vivem. Opcional: o default deriva do `side` que a divisão
  // esquerda/direita já estabelece (esquerda = mapa estrutural =
  // "context"; direita = acionável agora = "primary") — só o preço vivo
  // ("live") e o plano ativo Entry/Stop/Target ("critical") declaram o
  // campo explicitamente, os dois casos em que o default por `side` não
  // bastaria.
  tier?: PriceLabelTier;
  // Ordem "Lapidação das Etiquetas TP1/TP2" — achado real de captura de
  // tela do Operador (ZECUSDT 1H, "TP1 FRACA · 0.34% · 1:0.04 · REACHED"
  // ocupando uma faixa horizontal grande sobre as velas): o problema não
  // era o tamanho da fonte, era TUDO ter o MESMO peso visual dentro de
  // uma etiqueta só. `text` continua a informação PRIMÁRIA (label + valor
  // — ex.: "TP1 0.34%"); `secondaryText`, quando presente, é desenhado
  // logo em seguida, na MESMA caixa, em fonte menor + opacidade reduzida
  // (força/FRACA-FORTE, R:R, status REACHED/BREACHED, obstáculo) — nunca
  // removido, só reduzido em peso (§2/§11 da Ordem: zero dado apagado).
  // Opcional/aditivo: `undefined` preserva o comportamento de sempre
  // (uma única string, um único peso) para todo rótulo que não declara o
  // campo — S1/R1/VWAP/EMA/NL/sessões/sweeps/BOS-CHOCH/zonas/trend
  // channel continuam exatamente como eram.
  secondaryText?: string;
}

// Altura real de uma etiqueta (px). Achado real de captura de tela do
// Operador ("os tom de cor, o tamanho das etiquetas... não tá legal"): o
// texto era 9px numa caixa de 16px — abaixo do que qualquer terminal
// profissional usa no eixo, e no iPad (a superfície real deste app) fica
// no limite do legível. Subiu para 10px de texto numa caixa de 18px; a
// etiqueta `live` (o preço agora) tem caixa própria, maior, abaixo.
export const LABEL_HEIGHT_PX = 18;
// A âncora de leitura do gráfico inteiro — deliberadamente maior e em
// negrito. Ordem "Lapidação Visual Final e Sincronia Operacional" §3
// (Nível A — "AGORA"): o plano ATIVO (Entry/Stop/Target) reusa a MESMA
// altura/peso de fonte — é a segunda informação que o operador precisa
// achar sem procurar, só sem o anel (exclusivo do preço, a única âncora
// de "o instante agora"; ver isBigTier abaixo).
export const LIVE_LABEL_HEIGHT_PX = 21;
const FONT_BASE = "10px -apple-system, sans-serif";
// Tamanhos-base real das 3 fontes deste plugin (px, <1440px — mesma
// baseline real de LABEL_HEIGHT_PX/LIVE_LABEL_HEIGHT_PX acima). A string
// de fonte REAL (peso+px+família) é montada dentro de draw() somando
// fontDelta (escala responsiva ULTRA LED, chart-ultrawide-scale.ts) —
// achado real, task #341: estas fontes ficavam fixas em qualquer
// resolução mesmo depois do fontSize NATIVO do chart (11→12→13px) já
// escalar num monitor 4K/UltraWide, uma inconsistência visual real entre
// o tick nativo e o overlay que o substitui.
const FONT_LIVE_BASE_PX = 11;
// Especificação Visual Profissional v1 (pedido direto do Operador):
// labels primary/context (VWAP/NL/EMA/S1/R1/estrutura) compactam pra 9px
// neutro, sem caixa — só live/critical mantêm o tratamento sólido acima
// (motivo: são os dois números que o Operador precisa achar mais rápido
// — preço agora e plano ativo — e os exemplos do próprio pedido citavam
// VWAP/EMA21/NL, nunca esses dois). "JetBrains Mono" pedido: Local-First
// (Regra de Ouro 8) proíbe fonte via CDN externa — mesma pilha de
// fallback já declarada em index.css (degrada pra SF Mono, nativa no
// iPad/macOS, visualmente quase idêntica, zero rede).
const FONT_COMPACT_BASE_PX = 9;
// Cinza neutro pedido para TODO label primary/context — a identidade por
// indicador continua no próprio TEXTO ("E21"/"VWAP"/"S1"/"CHOCH") e no
// conector fino de volta ao preço real (ainda na cor real, abaixo):
// remover a cor do texto não apaga nenhum dado real (Regra de Ouro 4),
// só para de repetir a mesma informação num segundo canal visual.
// BRILHO POR IMPORTÂNCIA — pedido direto do Operador sobre captura real:
// "aumenta o tom de brilho das ferramentas mais importantes, deixa elas
// mais vivas, não apagadas demais".
//
// O defeito não era o cinza em si: era ele ser LISO. Todo rótulo que não
// fosse live/critical recebia exatamente o mesmo #888, então um nível
// estrutural do lado acionável lia igual a um rótulo de contexto de fundo.
// O `tier` já declarava a diferença de importância (resolveLabelTier:
// direita → "primary", esquerda → "context") e o desenho a ignorava.
//
// Agora o brilho segue essa hierarquia que já existia. Nada ficou mais
// apagado do que estava — `context` mantém o mesmo peso visual de antes,
// só ganhou o viés azulado da paleta do app em vez do cinza puro; quem
// SOBE é o lado que o Operador usa para decidir agora.
//
// Deliberadamente NÃO é um aumento geral de brilho: subir todo mundo
// junto devolveria a "parede" que outras rodadas passaram removendo, e
// destruiria a própria leitura de hierarquia que ele está pedindo.
export const LABEL_TIER_COLOR: Record<PriceLabelTier, string> = {
  // live/critical desenham texto escuro sobre preenchimento sólido — a
  // cor deles não vem daqui (ver isBigTier abaixo). Declarados mesmo
  // assim para o Record ser total: um tier novo nunca cai em undefined.
  live: "#050810",
  critical: "#050810",
  // O lado acionável agora: nível estrutural, plano, alvo.
  primary: "#C3D0DC",
  // Contexto de fundo: mesma discrição de antes, com o viés azulado da
  // paleta em vez do cinza puro.
  context: "#8A94A0",
};
// "2px do edge" pedido — distinto do padding interno das caixas sólidas
// (LABEL_PADDING_X abaixo), que continua servindo só live/critical.
const COMPACT_EDGE_PADDING_PX = 2;
// Retorno real do Operador após a Especificação Visual v1 ("as etiqueta
// tá num nível amador"): texto flutuando sem nenhum fundo/borda lê como
// rascunho/debug, não como elemento desenhado — o mesmo defeito de
// legibilidade que a caixa 100% opaca original tinha, só no extremo
// oposto (invisível em vez de barulhenta). Ajuste cirúrgico, não uma
// reversão de v1: o TEXTO continua neutro sem cor por indicador (motivo
// documentado acima não muda — zero repetição de canal visual) e o teto
// de contagem/densidade também não muda. Só ganha de volta um chip de
// CONTENÇÃO baixa-opacidade, na cor real do próprio nível (a mesma já
// usada pelo conector, nunca uma cor nova) — contraste bem abaixo de
// live/critical, que continuam os únicos com preenchimento 100% opaco.
const COMPACT_CHIP_FILL_ALPHA = 0.14;
const COMPACT_CHIP_BORDER_ALPHA = 0.55;
// Padding interno real agora que o chip existe — 0 fazia sentido só
// enquanto não havia nenhum fundo/borda pra respirar contra.
const COMPACT_PADDING_X = 4;
// Ordem "Lapidação das Etiquetas TP1/TP2" §3/§4/§11: o texto SECUNDÁRIO
// (força/FRACA-FORTE, R:R, REACHED/BREACHED, obstáculo — ver
// secondaryText acima) desenha visivelmente menor que o primário em
// QUALQUER tier — a mesma informação ocupa menos largura só por ser
// renderizada num degrau de fonte abaixo, sem precisar abreviar a
// palavra em si (§2: "não apagar dado real").
const FONT_SECONDARY_BASE_PX = 8;
// Peso visual reduzido (§4: "REACHED = estado secundário") — a MESMA
// cor/fundo do primário, só mais transparente, nunca uma cor nova.
const SECONDARY_ALPHA_MULT = 0.62;
// Respiro real entre o segmento primário e o secundário — pequeno o
// bastante para ler como "uma etiqueta só", grande o bastante pra nunca
// grudar visualmente nas letras (achado real via harness Playwright desta
// correção).
const SECONDARY_GAP_PX = 4;
// Teto real de etiquetas de CONTEXTO simultâneas (ver selectRelevantLabels
// em price-label-stack.ts para o critério de poda e por que nenhum dado
// real se perde). 5 é o mesmo número que este repositório já tinha
// convergido de forma independente em MAX_KEY_LEVELS_SHOWN e
// MAX_INSTITUTIONAL_ZONES para a mesma pergunta ("quantas referências
// estruturais um operador rastreia de uma vez") — zero limiar novo
// inventado. Na captura real do Operador havia 11.
// Especificação Visual Profissional v1: pedido do Operador reduz pra 3
// ("só mostrar 3 labels por vez... as outras aparecem no hover"). O
// hover não é implementado — a superfície real deste app é iPad Safari
// (CLAUDE.md, Regra de Ouro 7), touch-primeiro, sem cursor/estado
// :hover alcançável; construir um equivalente de toque (tap-to-reveal)
// é uma decisão de interação nova, não um ajuste de pixel, e fica
// deliberadamente fora desta rodada (documentado, não fabricado — ver
// resposta ao Operador). O teto em si (3, mais apertado) é aplicado.
export const MAX_CONTEXT_LABELS = 3;
// Razão real do "+7" de folga (antes MIN_GAP_PX, agora minGapPx computado
// por desenho dentro de draw() — ver comentário lá — mesma fórmula, só
// responsiva): alimentar o resolvedor com gap = altura da caixa faz duas
// etiquetas colidindo ficarem exatamente ENCOSTADAS (gap zero) — nunca
// sobrepostas de fato, mas visualmente lidas como "uma coisa só" quando
// as cores/larguras são bem diferentes (ex.: "VWAP ↓ 64854.83" ao lado de
// um número solto sem prefixo). A folga extra tem uma segunda razão real,
// além da fresta visível: a etiqueta `live` é fisicamente maior (caixa +
// o anel fino de 1px a 1.5px de distância = +3px reais). O passo da
// pilha precisa ser maior que isso, senão o anel do preço vivo encostaria
// na caixa vizinha — o mesmo defeito de "uma coisa só" que este gap
// existe para eliminar.
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

      // Mesma escala responsiva da Fase A (chart-ultrawide-scale.ts) —
      // baseline (fontSize 11, <1440px) devolve delta 0, then o mesmo
      // +1/+2 já usado pelo tick nativo do chart. Recomputado a cada
      // desenho (mesmo padrão de cssWidth/cssHeight acima) — nunca precisa
      // de listener de resize próprio, o ResizeObserver do próprio canvas
      // já dispara markDirty em qualquer mudança de layout.
      const uiScale = resolveChartUltraWideScale(window.innerWidth);
      const fontDelta = uiScale.fontSize - 11;
      const fontLive = `bold ${FONT_LIVE_BASE_PX + fontDelta}px -apple-system, sans-serif`;
      const fontCompact = `500 ${FONT_COMPACT_BASE_PX + fontDelta}px ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, monospace`;
      const fontSecondary = `${FONT_SECONDARY_BASE_PX + fontDelta}px -apple-system, sans-serif`;
      const labelHeightPx = LABEL_HEIGHT_PX + fontDelta;
      const liveLabelHeightPx = LIVE_LABEL_HEIGHT_PX + fontDelta;
      const minGapPx = labelHeightPx + 7; // mesma folga real de MIN_GAP_PX, escalada junto

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
        const resolved = resolveLabelStackPositions(entries, minGapPx);

        for (const entry of resolved) {
          // Decaimento real por idade (BOS/CHOCH) — default 1 preserva o
          // comportamento de sempre (opaco) para todo rótulo que não declara
          // alpha (S1/R1/VWAP/NL/EMA/TREND/ENTRY/STOP/TARGET/etc).
          const labelAlpha = entry.alpha ?? 1;
          const tier = resolveLabelTier(entry.side, entry.tier);
          // Nível A ("AGORA" — Ordem "Lapidação Visual Final e Sincronia
          // Operacional" §3): preço vivo E o plano ativo (Entry/Stop/
          // Target) compartilham a caixa grande/negrito — só o anel
          // (abaixo) continua exclusivo do preço.
          const isBigTier = tier === "live" || tier === "critical";
          const primaryFont = isBigTier ? fontLive : fontCompact;
          ctx.font = primaryFont;
          const primaryWidth = ctx.measureText(entry.text).width;
          // Ordem "Lapidação das Etiquetas TP1/TP2": largura real da caixa
          // já soma o segmento secundário (medido na fonte MENOR) — nunca
          // um chute; a caixa sempre cabe exatamente o que será desenhado.
          let secondaryWidth = 0;
          if (entry.secondaryText) {
            ctx.font = fontSecondary;
            secondaryWidth = ctx.measureText(entry.secondaryText).width;
          }
          const secondaryGap = entry.secondaryText ? SECONDARY_GAP_PX : 0;
          const textWidth = primaryWidth + secondaryGap + secondaryWidth;
          const boxHeight = isBigTier ? liveLabelHeightPx : labelHeightPx;
          // primary/context: chip de contenção baixa-opacidade (ver
          // COMPACT_CHIP_FILL_ALPHA acima) — padding menor que live/
          // critical, só o suficiente pro texto não tocar a borda.
          const textPaddingX = isBigTier ? LABEL_PADDING_X : COMPACT_PADDING_X;
          const edgePaddingX = isBigTier ? RIGHT_MARGIN_PX : COMPACT_EDGE_PADDING_PX;
          const edgePaddingXLeft = isBigTier ? LEFT_MARGIN_PX : COMPACT_EDGE_PADDING_PX;
          const boxWidth = textWidth + textPaddingX * 2;
          const boxX = side === "right" ? cssWidth - edgePaddingX - boxWidth : edgePaddingXLeft;
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
          // NÍVEIS "primary"/"context" (VWAP/NL/EMA/S1/R1/estrutura/
          // confluência/BOS-CHOCH): chip de contenção baixa-opacidade
          // (fundo + borda 1px, cor real do nível via opaque() — mesma
          // normalização que live/critical usam, senão S1/R1 em rgba(...,
          // 0.65) ficariam mais fracos que NL/EMA em hex sólido pro MESMO
          // COMPACT_CHIP_FILL_ALPHA). A hierarquia visual entre os dois
          // continua real (context ainda é o único sujeito a
          // MAX_CONTEXT_LABELS acima) — o chip é igual pros dois, só a
          // densidade de quantos aparecem muda.
          if (!isBigTier) {
            const chipColor = opaque(entry.color);
            boxPath(boxX, boxY, boxWidth, boxHeight);
            ctx.fillStyle = chipColor;
            ctx.globalAlpha = COMPACT_CHIP_FILL_ALPHA * labelAlpha;
            ctx.fill();
            ctx.strokeStyle = chipColor;
            ctx.globalAlpha = COMPACT_CHIP_BORDER_ALPHA * labelAlpha;
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.globalAlpha = labelAlpha;
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
            // NÍVEL "live"/"critical" (preço agora, plano ativo Entry/
            // Stop/Target): caixa sólida na cor real da própria linha,
            // exatamente o comportamento que os "last value label"
            // nativos que este overlay substitui sempre tiveram.
            boxPath(boxX, boxY, boxWidth, boxHeight);
            ctx.fillStyle = opaque(entry.color);
            ctx.fill();
          }

          // Texto escuro sobre fundo colorido em live/critical (mesmo
          // contraste dos tags nativos); primary/context continua cinza
          // neutro mesmo com o chip de fundo (acima) — a identidade por
          // indicador continua no PRÓPRIO texto ("E21"/"VWAP"/"CHOCH") e
          // agora também na cor do chip, nunca reconstruída via COR DO
          // TEXTO (Regra de Ouro 4: nenhum dado real some, só para de
          // repetir a mesma informação num terceiro canal visual).
          const textColor = isBigTier ? "#050810" : LABEL_TIER_COLOR[tier];
          ctx.fillStyle = textColor;
          ctx.textBaseline = "middle";
          ctx.textAlign = "left";
          ctx.font = primaryFont;
          ctx.fillText(entry.text, boxX + textPaddingX, entry.resolvedY + 0.5);
          // Ordem "Lapidação das Etiquetas TP1/TP2" §4/§11: segmento
          // SECUNDÁRIO (força/R:R/status/obstáculo) na MESMA linha, fonte
          // menor + opacidade reduzida — mesma cor do primário, só menos
          // peso visual. Nunca desenhado se a chamada não declarou
          // secondaryText (zero mudança pro resto do eixo).
          if (entry.secondaryText) {
            ctx.font = fontSecondary;
            ctx.fillStyle = textColor;
            ctx.globalAlpha = labelAlpha * SECONDARY_ALPHA_MULT;
            ctx.fillText(entry.secondaryText, boxX + textPaddingX + primaryWidth + secondaryGap, entry.resolvedY + 0.5);
          }
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
      style={{ width: "100%", height: "100%", zIndex: CHART_LABEL_Z_INDEX }}
    />
  );
}
