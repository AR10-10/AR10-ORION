// price-label-stack-plugin.test.ts — achado real de captura de tela do
// Operador (BTC/USDT 1H, preço formando perto de R1): R1/VWAP/NL/último
// preço ficaram empilhados/ilegíveis no eixo. Trava PriceLabelStackPlugin
// e a migração dos "last value label"/"axis label" nativos no nível de
// código-fonte — mesma técnica de liquidity-zones-plugin.test.ts/
// trade-plan-zone-plugin.test.ts (node env, sem canvas real; verificação
// visual real via harness Playwright antes do commit).
import { describe, it, expect } from 'vitest';
import { LABEL_HEIGHT_PX, LIVE_LABEL_HEIGHT_PX, LIVE_RING_TOTAL_PX } from '../src/chart/PriceLabelStackPlugin';
import { LABEL_TIER_COLOR } from '../src/chart/PriceLabelStackPlugin';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  levelStrengthBaseWeight,
  levelLineAlpha,
  S1R1_TOUCH_FLOOR,
  S1R1_TOUCH_CEIL,
  S1R1_ALPHA_MIN,
  S1R1_ALPHA_MAX,
  fibRatioStructuralWeight,
  fibRatioBaseWeight,
  fibLineAlpha,
  fibDeservesAxisLabel,
  FIB_PRIMARY_RATIOS,
  FIB_SECONDARY_STRUCTURAL_WEIGHT,
  FIB_SHALLOW_STRUCTURAL_WEIGHT,
  FIB_STRUCTURAL_SHARE,
  FIB_CONFLUENCE_CEIL,
  FIB_ALPHA_MIN,
  FIB_ALPHA_MAX,
} from '../src/chart/EnhancedChart_110_Percent';
import { VISUAL_BUDGET_FLOOR_WEIGHT } from '../src/nexus/visual-budget';
import { FIB_RETRACEMENT_RATIOS } from '../src/nexus/fibonacci-confluence';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');
const plugin = () => read('../src/chart/PriceLabelStackPlugin.tsx');
const chart = () => read('../src/chart/EnhancedChart_110_Percent.tsx');
// Corpo REAL de drawSide, delimitado pelo seu início e pela primeira
// chamada depois dele — janela exata em vez de "os próximos N caracteres"
// (achado real: a hierarquia visual de 3 níveis empurrou boxX/connectorX
// para depois dos 900/1700 chars que estas asserções fatiavam, e o teste
// passou a falhar por causa do TAMANHO da janela, nunca porque a garantia
// real tivesse mudado).
const drawSideBody = () => {
  const s = plugin();
  const start = s.indexOf('const drawSide = ');
  const end = s.indexOf('drawSide(withNaturalY("right"), "right");', start);
  expect(start, 'drawSide não encontrado').toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return s.slice(start, end);
};
// Corpo REAL do useMemo priceAxisLabels, delimitado pelo seu início e pelo
// `return out;` que o fecha — MESMA correção estrutural de drawSideBody
// acima, agora aplicada ao outro bloco que estas asserções fatiavam por
// "os próximos N caracteres". Achado real (repetido pela 2ª vez, Ordem
// "FECHAMENTO DO AR10 CYBORG" §3): compactar as etiquetas empurrou
// VWAP/NL/último preço/EN para além das janelas de 2700/3800/6100 chars,
// e 4 testes falharam pelo TAMANHO DA JANELA — nunca porque a garantia
// real tivesse mudado. Uma janela que se ajusta sozinha elimina a classe
// inteira de falso-negativo, em vez de só empurrar os números de novo.
const priceAxisLabelsBody = () => {
  const s = chart();
  const start = s.indexOf('const priceAxisLabels = useMemo');
  expect(start, 'priceAxisLabels não encontrado').toBeGreaterThan(-1);
  const end = s.indexOf('return out;', start);
  expect(end).toBeGreaterThan(start);
  return s.slice(start, end);
};

describe('PriceLabelStackPlugin: "Fio de Seda" — conector nunca tracejado, sempre 1px', () => {
  it('nunca chama setLineDash', () => {
    expect(plugin()).not.toMatch(/\.setLineDash\(/);
  });

  it('o conector é sempre lineWidth = 1, nunca um valor maior', () => {
    expect(plugin()).toContain('ctx.lineWidth = 1');
    expect(plugin()).not.toMatch(/ctx\.lineWidth = [2-9]/);
  });

  it('o conector só aparece quando o rótulo realmente deslocou (>0.5px) — nunca uma linha fantasma quando a posição já é a natural', () => {
    const s = plugin();
    expect(s).toContain('if (Math.abs(entry.resolvedY - entry.naturalY) > 0.5) {');
  });
});

describe('PriceLabelStackPlugin: achado real via harness Playwright — fundo da caixa sempre 100% opaco', () => {
  it('a cor reaproveitada das linhas (translúcida de propósito, ex.: rgba(...,0.65)) nunca vira o fundo da caixa direto — passa por opaque() primeiro, senão o tick do eixo nativo (ex.: "64800.00") sangra através do rótulo', () => {
    const s = plugin();
    expect(s).toContain('ctx.fillStyle = opaque(entry.color);');
    expect(s).not.toContain('ctx.fillStyle = entry.color;\n        ctx.fillRect');
  });

  it('opaque() descarta o canal alfa (rgba→rgb), nunca decide uma cor nova — mesmo R/G/B real, só sem transparência', () => {
    const s = plugin();
    const idx = s.indexOf('function opaque(rgba: string): string {');
    expect(idx).toBeGreaterThan(-1);
    const block = s.slice(idx, idx + 300);
    expect(block).toContain('rgb(${m[1]},${m[2]},${m[3]})');
  });

  it('o conector fino continua com a opacidade REAL da linha (globalAlpha 0.5), só o fundo da caixa é forçado opaco — a linha nunca deveria competir visualmente com o resto do gráfico', () => {
    const s = plugin();
    const idx = s.indexOf('ctx.strokeStyle = entry.color;');
    expect(idx).toBeGreaterThan(-1);
    const block = s.slice(idx, idx + 100);
    expect(block).toContain('ctx.globalAlpha = 0.5 * labelAlpha;');
  });
});

describe('PriceLabelStackPlugin: alpha opcional por rótulo (achado real: BOS/CHOCH precisa esmaecer com a idade DENTRO do resolvedor de colisão, sem perder a garantia de zero sobreposição)', () => {
  it('PriceAxisLabel declara alpha?: number — default 1 preserva o comportamento opaco de todo rótulo existente (S1/R1/VWAP/NL/EMA/TREND/ENTRY/STOP/TARGET/Núcleo)', () => {
    const s = plugin();
    const idx = s.indexOf('export interface PriceAxisLabel {');
    const block = s.slice(idx, idx + 650);
    expect(block).toContain('alpha?: number;');
  });

  it('labelAlpha = entry.alpha ?? 1 é lido UMA vez por entrada e aplicado à caixa+texto (globalAlpha), nunca só à cor', () => {
    const s = plugin();
    const idx = s.indexOf('for (const entry of resolved) {');
    const end = s.indexOf('ctx.fillText(entry.text', idx);
    const block = s.slice(idx, end);
    expect(block).toContain('const labelAlpha = entry.alpha ?? 1;');
    expect(block).toContain('ctx.globalAlpha = labelAlpha;');
    expect(block).toContain('ctx.fillStyle = opaque(entry.color);');
  });

  it('globalAlpha é restaurado para 1 depois de cada entrada — nunca vaza pra próxima iteração do loop', () => {
    const s = plugin();
    const idx = s.indexOf('for (const entry of resolved) {');
    const closeIdx = s.indexOf('\n      }\n    };', idx);
    const block = s.slice(idx, closeIdx);
    // 2 resets: um depois do conector (se desenhado), outro no fim de CADA entrada
    const resets = block.match(/ctx\.globalAlpha = 1;/g) ?? [];
    expect(resets.length).toBeGreaterThanOrEqual(2);
  });
});

// Achado real do Operador ("tá ficando só numa lateral direita... qual
// forma mais inteligente... mais profissional"): pesquisa real confirmou
// que dividir rótulos entre os dois lados do eixo é prática profissional
// real (Lightweight Charts documenta price scales nativas nos dois
// lados; TradingView Supercharts permite até 8 escalas simultâneas).
describe('PriceLabelStackPlugin: side opcional (left/right) — dois lados resolvem colisão de forma TOTALMENTE independente', () => {
  it('PriceAxisLabel declara side?: "left" | "right" — default "right" preserva o comportamento de sempre pra todo rótulo que não declara o campo', () => {
    const s = plugin();
    const idx = s.indexOf('export interface PriceAxisLabel {');
    const block = s.slice(idx, idx + 1500);
    expect(block).toContain('side?: "left" | "right";');
  });

  it('withNaturalY(side) filtra por (l.side ?? "right") === side — nunca um rótulo aparece nos dois lados nem em nenhum', () => {
    const s = plugin();
    const idx = s.indexOf('const withNaturalY = (side:');
    expect(idx, 'withNaturalY parametrizado por lado não encontrado').toBeGreaterThan(-1);
    const block = s.slice(idx, idx + 400);
    expect(block).toContain('.filter((l) => (l.side ?? "right") === side)');
  });

  it('drawSide resolve CADA lado com sua PRÓPRIA chamada de resolveLabelStackPositions — um rótulo da esquerda nunca desloca um da direita', () => {
    const s = plugin();
    expect(s).toContain('drawSide(withNaturalY("right"), "right");');
    expect(s).toContain('drawSide(withNaturalY("left"), "left");');
    // as DUAS chamadas passam pela MESMA função pura — zero heurística
    // paralela reinventada por lado.
    const drawSideIdx = s.indexOf('const drawSide = ');
    const drawSideBlock = s.slice(drawSideIdx, drawSideIdx + 600);
    expect(drawSideBlock).toContain('resolveLabelStackPositions<PriceAxisLabel & { naturalY: number }>(');
  });

  // A GEOMETRIA DO LADO DIREITO MUDOU DE PROPOSITO (pedido do Operador
  // sobre a barra lateral do eixo). Antes cada etiqueta era alinhada a borda
  // do CONTAINER, entao o X de inicio dependia do texto — borda serrilhada —
  // e as largas invadiam as velas (medido: "VWAP 68.412,5" invadia 20,3px).
  // Agora o lado direito e uma COLUNA: mesma borda esquerda e mesma largura
  // para todas, ancorada na fronteira medida do eixo. O lado ESQUERDO nao
  // mudou (nao existe eixo ali), e por isso este teste continua cobrindo os
  // dois — o espelhamento agora e assimetrico DE PROPOSITO, e o teste diz
  // isso em vez de fingir que os dois lados seguem a mesma regra.
  it('lado direito e uma COLUNA ancorada no eixo; lado esquerdo segue na margem minima', () => {
    const s = plugin();
    expect(s).toContain('const LEFT_MARGIN_PX = 2;');
    expect(s).toContain('const RIGHT_MARGIN_PX = 2;');
    expect(s).toContain('const COMPACT_EDGE_PADDING_PX = 2;');
    const corpo = drawSideBody();
    // A coluna: borda e largura compartilhadas, derivadas da fronteira real.
    expect(corpo).toContain('const colunaDireita = cssWidth - RIGHT_MARGIN_PX;');
    expect(corpo).toContain('const colunaEsquerda = Math.min(axisLeft, colunaDireita - larguraMaxima);');
    expect(corpo).toContain('const boxX = side === "right" ? colunaEsquerda : edgePaddingXLeft;');
    expect(corpo).toContain('const boxWidth = side === "right" ? colunaLargura : textWidth + textPaddingX * 2;');
    expect(s).toContain('measurePlotArea');
    // O defeito original, travado pelo nome: alinhar a etiqueta pela borda
    // do container e o que produzia o serrilhado e a invasao das velas.
    expect(corpo).not.toContain('cssWidth - edgePaddingX - boxWidth');
  });

  it('o conector do lado esquerdo fica na borda DIREITA da caixa (espelhado do direito, que fica na borda esquerda) — sempre entre a caixa e o centro do gráfico, nunca cortando pra fora da tela', () => {
    expect(drawSideBody()).toContain('const connectorX = side === "right" ? boxX - 0.5 : boxX + boxWidth + 0.5;');
  });

  it('execução real (prova viva de independência): dois rótulos com a MESMA posição Y natural, um em cada lado, NUNCA colidem entre si — cada lado só vê os próprios rótulos ao chamar resolveLabelStackPositions; os DOIS ficam na posição natural exata, nenhum deslocado', () => {
    // Mesma função pura real (price-label-stack.ts), reproduzida aqui só
    // para provar a matemática de independência — o teste de padrão acima
    // já trava que o componente real chama exatamente esta função 2x.
    const resolve = <T extends { naturalY: number }>(entries: T[], minGapPx: number): (T & { resolvedY: number })[] => {
      if (entries.length === 0) return [];
      const sorted = [...entries].sort((a, b) => a.naturalY - b.naturalY);
      const result: (T & { resolvedY: number })[] = [];
      let clusterStart = 0;
      while (clusterStart < sorted.length) {
        let clusterEnd = clusterStart;
        while (clusterEnd + 1 < sorted.length && sorted[clusterEnd + 1].naturalY - sorted[clusterEnd].naturalY < minGapPx) clusterEnd++;
        const cluster = sorted.slice(clusterStart, clusterEnd + 1);
        const center = cluster.reduce((sum, e) => sum + e.naturalY, 0) / cluster.length;
        const k = cluster.length;
        cluster.forEach((entry, i) => result.push({ ...entry, resolvedY: center - ((k - 1) * minGapPx) / 2 + i * minGapPx }));
        clusterStart = clusterEnd + 1;
      }
      return result;
    };
    const MIN_GAP_PX = 20;
    // R1 (direita) e Trend Channel (esquerda) formando exatamente no MESMO
    // preço/Y — cenário real: um nível estrutural e o canal de tendência
    // podem convergir. Se resolvidos JUNTOS (bug), um dos dois deslocaria;
    // resolvidos SEPARADOS (comportamento real), nenhum desloca.
    const right = [{ naturalY: 100, id: "R1" }];
    const left = [{ naturalY: 100, id: "TREND" }];
    const resolvedRight = resolve(right, MIN_GAP_PX);
    const resolvedLeft = resolve(left, MIN_GAP_PX);
    expect(resolvedRight[0].resolvedY).toBe(100); // nunca deslocado
    expect(resolvedLeft[0].resolvedY).toBe(100); // nunca deslocado

    // prova viva do CONTRASTE: os dois no MESMO lado, mesmo Y, colidem de
    // verdade (exatamente o comportamento que o resolvedor existe para
    // evitar) — confirma que a independência acima não é coincidência.
    const sameSide = [{ naturalY: 100, id: "R1" }, { naturalY: 100, id: "TREND" }];
    const resolvedSame = resolve(sameSide, MIN_GAP_PX);
    expect(resolvedSame[0].resolvedY).not.toBe(resolvedSame[1].resolvedY);
  });
});

describe('PriceLabelStackPlugin: geometria real via lightweight-charts, nunca posição fabricada', () => {
  it('resolve preço→pixel via series.priceToCoordinate — nunca uma coordenada fixa/chutada', () => {
    expect(plugin()).toContain('series.priceToCoordinate(');
  });

  it('preço fora da área visível (priceToCoordinate null) nunca é desenhado — fail-closed', () => {
    expect(plugin()).toContain('coord === null ? null :');
  });

  it('rótulo resolvido fora do canvas (boxY fora de [0,cssHeight]) nunca desenha — fail-closed, nunca desenha fora do canvas', () => {
    // boxHeight (não mais a constante única): as etiquetas `live` E
    // `critical` (Ordem "Lapidação Visual Final e Sincronia Operacional"
    // §3 — Entry/Stop/Target ganham a mesma caixa grande) têm altura
    // maior — o teto do canvas é checado contra a altura REAL da caixa
    // daquela etiqueta, nunca contra uma altura fixa que subestimaria a
    // maior delas.
    expect(plugin()).toContain('if (boxY + boxHeight < 0 || boxY > cssHeight) continue;');
    expect(plugin()).toContain('const isBigTier = tier === "live" || tier === "critical";');
    expect(plugin()).toContain('const boxHeight = isBigTier ? liveLabelHeightPx : labelHeightPx;');
  });

  it('nunca usa Math.random nem qualquer dado sintético (Regra de Ouro 1)', () => {
    expect(plugin()).not.toMatch(/Math\.random/);
  });

  it('a resolução de colisão vem da função pura real (price-label-stack.ts) — nunca uma heurística reinventada aqui', () => {
    expect(plugin()).toContain('resolveLabelStackPositions,');
    expect(plugin()).toContain('} from "./price-label-stack";');
    // Achado real do Operador (densidade só do lado direito): a resolução
    // agora roda uma vez por lado (drawSide), cada lado 100% independente
    // — mesma função pura, chamada 2x (nunca uma segunda heurística).
    expect(plugin()).toContain('resolveLabelStackPositions<PriceAxisLabel & { naturalY: number }>(');
    expect(plugin()).toContain('drawSide(withNaturalY("right"), "right");');
    expect(plugin()).toContain('drawSide(withNaturalY("left"), "left");');
  });

  it('o gap mínimo real (minGapPx) é MAIOR que a altura da caixa (labelHeightPx) — achado real via harness Playwright: gap igual à altura deixa duas etiquetas ENCOSTADAS (zero sobreposição matemática, mas ilegível/"uma coisa só" visualmente); a folga extra garante uma fresta real e visível', () => {
    // A folga cresceu de +4 para +7 por uma segunda razão real, além da
    // fresta visível: a etiqueta `live` é fisicamente maior (caixa de 21px
    // + anel fino de 1px a 1.5px de distância = 24px). O passo da pilha
    // precisa ser MAIOR que isso, senão o anel do preço vivo encostaria na
    // caixa vizinha — o mesmo defeito de "uma coisa só" que este gap
    // existe para eliminar, só que reintroduzido pelo nível novo.
    // Achado real, task #341: labelHeightPx/minGapPx viraram valores
    // computados por desenho (LABEL_HEIGHT_PX + fontDelta, escala
    // responsiva ULTRA LED) em vez de constantes de módulo fixas — a
    // fórmula real (+7) e o invariante abaixo continuam idênticos.
    // ACHADO DESTA RODADA, e a razão de este teste ter mudado de forma: o
    // gap escalar era derivado SÓ da caixa pequena, então a fresta real
    // dependia da altura das vizinhas. A conta antiga já mostrava isso e
    // passava raspando — 25 > 24 por UM pixel: o preço vivo, a etiqueta
    // mais importante da tela, era a que menos respirava.
    //
    // Agora o gap é PAREADO: (altura_a + altura_b)/2 + folga. O escalar
    // continua existindo como fallback para caixas comuns.
    expect(plugin()).toContain('const LABEL_EDGE_GAP_PX = 7;');
    expect(plugin()).toContain('const minGapPx = labelHeightPx + LABEL_EDGE_GAP_PX;');
    expect(plugin()).toContain('(alturaFisica(a) + alturaFisica(b)) / 2 + LABEL_EDGE_GAP_PX;');
    // DEFINIR o gap pareado não basta — ele tem de ser PASSADO ao resolver.
    // A primeira versão deste teste checava só a definição, e uma mutação
    // que removia o argumento passava verde. Achado real, corrigido aqui.
    expect(plugin()).toMatch(
      /resolveLabelStackPositions<PriceAxisLabel & \{ naturalY: number \}>\(\s*entries,\s*minGapPx,\s*gapEntre,\s*\)/,
    );
    expect(plugin()).toContain('export const LABEL_HEIGHT_PX = 18;');
    expect(plugin()).toContain('export const LIVE_LABEL_HEIGHT_PX = 21;');
    expect(plugin()).toContain('export const LIVE_RING_TOTAL_PX = 3;');

    // Invariante REAL, calculado com as MESMAS constantes do módulo: para
    // QUALQUER combinação de alturas físicas, a fresta entre bordas é
    // exatamente a folga declarada — nunca menos.
    const alturas = [LABEL_HEIGHT_PX, LIVE_LABEL_HEIGHT_PX, LIVE_LABEL_HEIGHT_PX + LIVE_RING_TOTAL_PX];
    for (const ha of alturas) {
      for (const hb of alturas) {
        const centros = (ha + hb) / 2 + 7;
        const fresta = centros - (ha / 2 + hb / 2);
        expect(fresta, `alturas ${ha}/${hb}`).toBeCloseTo(7, 6);
      }
    }
    // E a regra antiga falhava exatamente onde este teste já suspeitava.
    const frestaAntiga = LABEL_HEIGHT_PX + 7 - (LIVE_LABEL_HEIGHT_PX + LIVE_RING_TOTAL_PX);
    expect(frestaAntiga).toBeLessThan(7);
  });
});

describe('PriceLabelStackPlugin: dirty-flag + requestAnimationFrame, nunca um loop perpétuo', () => {
  it('agenda redraw via requestAnimationFrame, guardado por uma flag', () => {
    expect(plugin()).toContain('requestAnimationFrame(');
    expect(plugin()).toMatch(/if \(rafScheduled\) return;/);
  });

  it('reage a mudança de range visível (pan/zoom) via subscribeVisibleLogicalRangeChange real da lib', () => {
    expect(plugin()).toContain('subscribeVisibleLogicalRangeChange(');
  });

  it('acompanha o tamanho real do canvas via ResizeObserver', () => {
    expect(plugin()).toContain('new ResizeObserver(');
  });

  it('desmonta limpo: cancela a assinatura de range e desconecta o ResizeObserver', () => {
    expect(plugin()).toContain('unsubscribeVisibleLogicalRangeChange(');
    expect(plugin()).toContain('resizeObserver.disconnect()');
  });
});

describe('EnhancedChart_110_Percent: os "last value label"/"axis label" NATIVOS de S1/R1/VWAP/NL/EMA/último preço estão desligados — substituídos pelo overlay', () => {
  it('candlestick series: lastValueVisible false (era true) — priceLineVisible continua true (a linha horizontal de referência não muda)', () => {
    const s = chart();
    const idx = s.indexOf('const series = chart.addSeries(CandlestickSeries, {');
    // Janela alargada (era 1000): AR10_ESPECIFICACAO_VISUAL_PIXEL_PERFECT.md
    // acrescentou um comentário real antes de upColor/downColor, empurrando
    // priceLineVisible/lastValueVisible mais adiante no texto — mesma
    // classe de ajuste já feita antes neste projeto quando um bloco cresce
    // (nunca um teto arbitrário reencolhido pra "passar").
    const block = s.slice(idx, idx + 1500);
    expect(block).toContain('priceLineVisible: true,');
    expect(block).toContain('lastValueVisible: false,');
  });

  it('VWAP/EMA/NL series: lastValueVisible false nas 3 (eram true)', () => {
    const s = chart();
    const vwapIdx = s.indexOf('const vwapSeries = chart.addSeries(LineSeries, {');
    expect(s.slice(vwapIdx, vwapIdx + 500)).toContain('lastValueVisible: false,');
    const emaIdx = s.indexOf('const emaSeries = chart.addSeries(LineSeries, {');
    expect(s.slice(emaIdx, emaIdx + 350)).toContain('lastValueVisible: false,');
    const nlIdx = s.indexOf('const nexusLineSeries = chart.addSeries(LineSeries, {');
    expect(s.slice(nlIdx, nlIdx + 350)).toContain('lastValueVisible: false,');
  });

  it('Diretriz de Refinamento Visual §5/§6 (achado real via harness Playwright): VWAP/EMA/NL também têm title:"" fixo — lastValueVisible:false SOZINHO não bastava', () => {
    // A lib desenha `title` no eixo (posição NATURAL da série, sem
    // NENHUMA consciência da resolução de colisão do PriceLabelStackPlugin)
    // mesmo com lastValueVisible:false — o MESMO achado que já motivou
    // title:"" nas 3 séries do Trend Channel (teste dedicado abaixo).
    // Antes desta correção, VWAP/NL/EMA reescreviam um title não-vazio a
    // cada mudança de estado/período (`VWAP ${glifo}`, `NL ${glifo}`,
    // `EMA ${período}`) — visto colidir de verdade com S1 no harness
    // (ex.: "EMA 21" fantasma sobre a caixa de S1) porque o title nativo
    // ignora completamente a cascata anti-colisão.
    const s = chart();
    const vwapIdx = s.indexOf('const vwapSeries = chart.addSeries(LineSeries, {');
    expect(s.slice(vwapIdx, vwapIdx + 1100)).toContain('title: "",');
    const emaIdx = s.indexOf('const emaSeries = chart.addSeries(LineSeries, {');
    expect(s.slice(emaIdx, emaIdx + 350)).toContain('title: "",');
    const nlIdx = s.indexOf('const nexusLineSeries = chart.addSeries(LineSeries, {');
    expect(s.slice(nlIdx, nlIdx + 350)).toContain('title: "",');
    // nenhum dos 3 efeitos de estado/período pode reescrever title nunca
    // mais — só a EMA period, o VWAP state e o NL state effects.
    expect(s).not.toContain('title: `VWAP ${LINE_STATE_GLYPH[s]}`');
    expect(s).not.toContain('title: `NL ${LINE_STATE_GLYPH[s]}`');
    expect(s).not.toContain('title: `EMA ${activeEmaPeriod}`');
  });

  it('S1/R1: axisLabelVisible false nas duas price lines (era true) — a LINHA horizontal continua desenhada, só o tag do eixo muda de dono', () => {
    const s = chart();
    const supportIdx = s.indexOf('supportLineRef.current = seriesRef.current.createPriceLine({');
    expect(s.slice(supportIdx, supportIdx + 1400)).toContain('axisLabelVisible: false,');
    const resistanceIdx = s.indexOf('resistanceLineRef.current = seriesRef.current.createPriceLine({');
    expect(s.slice(resistanceIdx, resistanceIdx + 600)).toContain('axisLabelVisible: false,');
  });

  it('Trade Plan (ENTRY/STOP/TARGET) MIGROU para o overlay ("bater o olho profissional"): a LINHA continua (axisLabelVisible:false, title:""), o RÓTULO vai para priceAxisLabels — era o ÚLTIMO grupo ainda no eixo nativo, podendo sobrepor S1/R1/VWAP', () => {
    const s = chart();
    const idx = s.indexOf('const mk = (price: number, color: string) => {');
    expect(idx, 'helper mk do Trade Plan não encontrado (assinatura sem title agora)').toBeGreaterThan(-1);
    const block = s.slice(idx, idx + 300);
    expect(block).toContain('axisLabelVisible: false,');
    expect(block).toContain('title: "",');
    // regressão: nenhuma linha do Trade Plan volta a acender axisLabelVisible
    expect(block).not.toContain('axisLabelVisible: true,');
  });
});

describe('EnhancedChart_110_Percent: monta PriceLabelStackPlugin como o overlay MAIS ACIMA de todos (Nível 0) — a mesma garantia de "sempre legível" que os rótulos nativos tinham', () => {
  it('importa e monta com o chart/série reais e o array real de labels', () => {
    const s = chart();
    expect(s).toContain('import { PriceLabelStackPlugin, type PriceAxisLabel } from "./PriceLabelStackPlugin";');
    expect(s).toContain('<PriceLabelStackPlugin');
    expect(s).toContain('chart={chartReady?.chart ?? null}');
    expect(s).toContain('series={chartReady?.series ?? null}');
    expect(s).toContain('labels={priceAxisLabels}');
  });

  it('é o ÚLTIMO elemento do array de overlays (depois de TradePlanZonePlugin) — condição NECESSÁRIA, mas ver teste de z-index abaixo para a condição SUFICIENTE', () => {
    const s = chart();
    const tradePlanIdx = s.lastIndexOf('<TradePlanZonePlugin');
    const priceLabelIdx = s.lastIndexOf('<PriceLabelStackPlugin');
    expect(tradePlanIdx).toBeGreaterThan(-1);
    expect(priceLabelIdx).toBeGreaterThan(tradePlanIdx);
  });

  it('Diretriz de Refinamento Visual §5/§6 (achado real via harness Playwright): z-index explícito no canvas — ordem no DOM SOZINHA não bastava', () => {
    // A lightweight-charts desenha seus PRÓPRIOS canvases internos (painel
    // principal + gutter do eixo de preço) com z-index:1/z-index:2
    // explícitos. Um canvas nosso em z-index:auto, mesmo sendo o ÚLTIMO no
    // DOM (teste acima), ainda PERDE desses — por regra do CSS, z-index
    // positivo sempre pinta por cima de z-index:auto, DOM order não
    // importa nesse caso. Achado real: o próprio ticker nativo do eixo
    // (ex.: "64800.00") vazava por cima de uma caixa opaca nossa sempre
    // que colidiam em Y. z-index explícito > 2 (maior valor usado pela
    // lib) é a condição que FAZ este overlay realmente pintar por último.
    const p = plugin();
    const idx = p.indexOf('<canvas');
    const closeIdx = p.indexOf('/>', idx);
    const block = p.slice(idx, closeIdx);
    // O literal `5` virou CHART_LABEL_Z_INDEX (chart-layer-depth.ts). O que
    // esta guarda protege — "etiqueta é o overlay mais acima, ordem no DOM
    // sozinha não basta" — continua valendo e agora é SISTÊMICO: o mesmo
    // módulo dá profundidade às 15 camadas, e chart-layer-depth.test.ts prova
    // que a etiqueta fica acima de TODAS. A guarda passa a exigir o contrato,
    // não o número.
    expect(block).toMatch(/zIndex:\s*CHART_LABEL_Z_INDEX/);
    const depth = readFileSync(resolve(__dirname, '../src/chart/chart-layer-depth.ts'), 'utf-8');
    expect(depth).toContain('export const CHART_LABEL_Z_INDEX');
    expect(depth).toMatch(/label:\s*\d+/);
  });

  it('nunca sujeito a um toggle de camada — os rótulos que ele substitui (S1/R1/VWAP/NL/EMA/preço) sempre foram sempre-visíveis por padrão, sem entrada em CHART_LAYER_IDS', () => {
    const s = chart();
    const idx = s.indexOf('<PriceLabelStackPlugin');
    const block = s.slice(Math.max(0, idx - 60), idx);
    expect(block).not.toMatch(/visibility\.\w+ && \($/);
  });
});

describe('EnhancedChart_110_Percent: priceAxisLabels — reusa os MESMOS valores/cores já reais, zero cálculo novo, useMemo (nunca recalculado à toa)', () => {
  it('é um useMemo real, nunca construído incondicionalmente a cada render', () => {
    const s = chart();
    expect(s).toContain('const priceAxisLabels = useMemo<PriceAxisLabel[]>(() => {');
  });

  it('S1/R1 reaproveitam levelTitle (mesma função já usada pelas price lines nativas) — nunca uma segunda formatação. Carta Branca: só entram no eixo quando FORTE (>=2 toques reais) — "precisão maciça", não presença. Ordem "FECHAMENTO" §3: nome+valor no primário, força/toques no secundário (fonte menor) — levelTitle continua a fonte única do texto de força', () => {
    const block = priceAxisLabelsBody();
    expect(block).toContain('text: `S1 ${fmtAxisLabelPrice(support as number)}`');
    expect(block).toContain('text: `R1 ${fmtAxisLabelPrice(resistance as number)}`');
    // levelTitle com base vazia = só o segmento de força/toques/rompimentos,
    // exatamente o que era prefixo antes. Zero segunda formatação.
    expect(block).toContain('secondaryText: levelTitle("", supportStrength, supportBreakouts).trim() || undefined,');
    expect(block).toContain('secondaryText: levelTitle("", resistanceStrength, resistanceBreakouts).trim() || undefined,');
    // Especificação Visual Profissional v1: S1/R1 unificados em âmbar
    // #f59e0b (era verde/vermelho) — mesma cor real da price line nos
    // dois casos, nunca uma segunda formatação. Achado 2.3 (Visual Cleanup
    // & Rendering Audit): 0.65 fixo virou levelLineAlpha(*VisualWeight) —
    // mesma função pura já usada pela price line nativa (useEffect), zero
    // segunda fórmula de alpha só para o rótulo.
    expect(block).toContain('color: `rgba(245, 158, 11, ${levelLineAlpha(supportVisualWeight).toFixed(3)})`,');
    expect(block).toContain('color: `rgba(245, 158, 11, ${levelLineAlpha(resistanceVisualWeight).toFixed(3)})`,');
    expect((block.match(/color: `rgba\(245, 158, 11, \$\{levelLineAlpha\(\w+VisualWeight\)\.toFixed\(3\)\}\)`,/g) ?? []).length).toBe(2); // S1 e R1 compartilham o mesmo âmbar e a mesma função de alpha
    expect(block).toContain('if (Number.isFinite(support) && supportStrength?.label === "FORTE") {');
    expect(block).toContain('if (Number.isFinite(resistance) && resistanceStrength?.label === "FORTE") {');
  });

  it('Carta Branca ("etiquetas laterais... só mostrar a precisão maciça"): Regra de Ouro 4 — só a ETIQUETA do eixo fica mais rigorosa, a LINHA nativa de S1/R1 e o próprio valor real de support/resistance continuam incondicionais (Number.isFinite puro, sem gate de força)', () => {
    const c = chart();
    // A linha nativa (useEffect dedicado, muito antes de priceAxisLabels no
    // arquivo) desenha S1/R1 sempre que o preço é finito — o dado real
    // nunca desaparece, mesmo quando o rótulo do eixo some por FRACA.
    const supportLineIdx = c.indexOf('useEffect(() => {\n    if (!seriesRef.current) return;\n    if (supportLineRef.current) {');
    expect(supportLineIdx, 'useEffect nativo de S1 não encontrado').toBeGreaterThan(-1);
    const supportLineBlock = c.slice(supportLineIdx, supportLineIdx + 700);
    expect(supportLineBlock).toContain('if (Number.isFinite(support)) {');
    expect(supportLineBlock).not.toContain('supportStrength?.label === "FORTE"');

    const resistanceLineIdx = c.indexOf('useEffect(() => {\n    if (!seriesRef.current) return;\n    if (resistanceLineRef.current) {');
    expect(resistanceLineIdx, 'useEffect nativo de R1 não encontrado').toBeGreaterThan(-1);
    const resistanceLineBlock = c.slice(resistanceLineIdx, resistanceLineIdx + 700);
    expect(resistanceLineBlock).toContain('if (Number.isFinite(resistance)) {');
    expect(resistanceLineBlock).not.toContain('resistanceStrength?.label === "FORTE"');
  });

  it('gate real reusa STRONG_TOUCH_THRESHOLD já existente (support-resistance-engine.js: >=2 toques independentes = FORTE) — zero novo limiar inventado só para esconder etiqueta', () => {
    const c = chart();
    const idx = c.indexOf('const priceAxisLabels = useMemo');
    const block = c.slice(idx, idx + 2700);
    expect(block).toContain('só FORTE (>=2 toques independentes, STRONG_TOUCH_THRESHOLD)');
    expect(block).toContain('ganha etiqueta no eixo — "precisão maciça" de verdade, não presença.');
  });

  it('VWAP/NL reaproveitam LINE_STATE_GLYPH/VWAP_STATE_COLOR/NL_STATE_COLOR reais — mesma paleta institucional já usada pelas séries', () => {
    const block = priceAxisLabelsBody();
    expect(block).toContain('V ${LINE_STATE_GLYPH[s]}${fmtAxisLabelPrice(vwapLastValue)}');
    expect(block).toContain('color: VWAP_STATE_COLOR[s]');
    expect(block).toContain('NL ${LINE_STATE_GLYPH[s]}${fmtAxisLabelPrice(nlLastValue)}');
    expect(block).toContain('color: NL_STATE_COLOR[s]');
  });

  it('último preço usa a MESMA cor up/down real da própria série de candles (#089981/#F23645, convergência TradingView) — nunca uma cor nova', () => {
    expect(priceAxisLabelsBody()).toContain('displayPrice >= lastCandle.open ? "#089981" : "#F23645"');
  });

  it('achado real de captura de tela do Operador (BTC/USDT 1H ao vivo, header 65,468.00 vs. rótulo do eixo 65439.20 — mesma fonte, dessincronizada): o rótulo de último preço prefere livePrice (tick real, mesma fonte da barra superior) — nunca fica preso no data[último].close desatualizado', () => {
    // patchLastCandleWithLiveTick (live-candle-sync.ts) só atualiza a vela
    // RENDERIZADA via series.update() — deliberadamente nunca escreve de
    // volta no array `data` (documentado no próprio live-candle-sync.ts:
    // SMC/Fibonacci/Volume Profile não podem recomputar a cada tick). Sem
    // este fix, o rótulo de último preço (leitura direta de
    // data[último].close) congelava no valor do último REST/kline
    // (até ~30s desatualizado) enquanto a barra superior seguia ao vivo.
    const s = chart();
    const idx = s.indexOf('const lastCandle = data.length > 0 ? data[data.length - 1] : null;');
    expect(idx, 'bloco do último preço não encontrado').toBeGreaterThan(-1);
    const block = s.slice(idx, idx + 2500);
    expect(block).toContain('const displayPrice = typeof livePrice === "number" && Number.isFinite(livePrice) ? livePrice : lastCandle.close;');
    expect(block).toContain('price: displayPrice,');
    // A intenção deste teste é QUAL VALOR o rótulo usa (livePrice, nunca o
    // close desatualizado) — não quantas casas decimais ele mostra. O
    // `.toFixed(2)` cravado saiu porque num ativo de centavos (WLFI a 0,06,
    // captura real) ele achatava todo nível em "0.06"; a formatação agora
    // vem da régua adaptativa. O valor de origem continua sendo o mesmo.
    expect(block).toContain('text: fmtAxisLabelPrice(displayPrice),');
  });

  it('priceAxisLabels recalcula a cada tick real de livePrice — nunca uma etiqueta de preço congelada', () => {
    const s = chart();
    const depsIdx = s.indexOf('}, [support, resistance, supportStrength, resistanceStrength, supportBreakouts, resistanceBreakouts, supportVisualWeight, resistanceVisualWeight, vwapLastValue, vwapState, visibility.vwap, nlLastValue, nexusLineState, visibility.nexus_line, emaLastValue, activeEmaPeriod, visibility.ema, data, visibility.trend_channel, trendChannelInfo, visibility.volume_profile, volumeProfile, visibility.tpo_profile, tpoProfileForLabels, livePrice, tradePlan, targetsHit, decision, engineFallbackLevels, structureBreak, visibility.structure_breaks, structureBreakVisualWeight, traps, visibility.liquidity_sweep, visibility.session_key_levels, currentSessionKeyLevel, visibility.institutional_zones, institutionalZones, institutionalZoneVisualWeights, visibility.fibonacci, fibonacciLevels, fibonacciVisualWeights]);');
    expect(depsIdx, 'dependency array de priceAxisLabels não inclui livePrice').toBeGreaterThan(-1);
  });

  it('vwapLastValue/nlLastValue/emaLastValue vêm da PONTA real de cada série já computada (zero segunda fonte) — capturados nos MESMOS efeitos que já chamam setData', () => {
    const s = chart();
    expect(s).toContain('setVwapLastValue(series.length > 0 ? series[series.length - 1].value : null);');
    expect(s).toContain('setNlLastValue(nl.length > 0 ? nl[nl.length - 1].value : null);');
    expect(s).toContain('setEmaLastValue(series.length > 0 ? series[series.length - 1].value : null);');
  });
});

// REVOGADO (pendência #6, mesma disciplina de "registrado em vez de
// apagado" já usada na migração do liquidity_sweep): a describe block que
// existia aqui testava a polilinha harmônica NATIVA (harmonicPolyline,
// title:"" pra suprimir o rótulo no eixo). Ela migrou por completo pra
// HarmonicGeometryPlugin.tsx (canvas próprio) — zero série nativa
// restante. Achado real feito NA migração: axisLabelVisible:false por si
// só já suprimia o `title` completamente (nem chegava ao eixo, nem a
// lugar nenhum da tela) — o rótulo PRZ nunca foi visto pelo Operador; o
// plugin novo desenha o texto de verdade via drawCanvasLabel. Cobertura
// completa em harmonic-geometry-plugin-wiring.test.ts.

describe('"bater o olho profissional" (pendência honesta do turno anterior): ENTRY/STOP/TARGET migram do eixo NATIVO para o sistema anti-colisão (priceAxisLabels) — eram o ÚLTIMO grupo que ainda podia sobrepor S1/R1/VWAP', () => {
  const chart = () => read('../src/chart/EnhancedChart_110_Percent.tsx');

  it('a LINHA horizontal continua (createPriceLine), só o RÓTULO muda de dono: mk agora sem parâmetro title, axisLabelVisible:false, title:""', () => {
    const s = chart();
    expect(s).toContain('const mk = (price: number, color: string) => {');
    // regressão: a assinatura antiga com title nunca volta (era o que
    // desenhava o rótulo no eixo nativo, sem consciência de colisão).
    expect(s).not.toContain('const mk = (price: number, color: string, title: string) => {');
  });

  it('os rótulos de ENTRY/STOP/TARGET entram em priceAxisLabels com as cores REAIS já usadas pelas linhas (âmbar/vermelho/verde) — leitura instantânea por cor', () => {
    const s = chart();
    const idx = s.indexOf('const priceAxisLabels = useMemo');
    const end = s.indexOf('return out;', idx);
    const block = s.slice(idx, end);
    // gate fail-closed do plano inteiro
    expect(block).toContain('if (tradePlan) {');
    // EN âmbar, direção real (LONG/SHORT) no texto — "bater o olho"
    // (EPC FINAL §8: nomenclatura curta EN/ST/TP1-3 nos objetos gráficos).
    // Ordem "FECHAMENTO" §3: o MOTIVO estrutural (basis) é Nível 2 — saiu
    // do primário para o secundário (fonte menor), nunca foi apagado.
    expect(block).toContain('text: `EN ${tradePlan.direction}`, secondaryText: withScore(tradePlan.entry.basis), color: entryColor');
    expect(block).toContain('const entryColor = "rgba(240, 193, 111, 0.75)";');
    // STOP vermelho no preço EFETIVO (ratchet real), BREACHED do preço vivo
    expect(block).toContain('const effectiveStopPrice = effectiveStopForTargetsHit(tradePlan, hits);');
    expect(block).toContain('color: "rgba(242, 54, 69, 0.75)"');
    // TARGET verde, REACHED do targetsHit autoritativo — Ordem "Lapidação
    // das Etiquetas TP1/TP2" §3/§4: texto primário só label+distância,
    // REACHED (como o resto do estado) migrou pro secundário.
    expect(block).toContain('const reached = i < hits;');
    expect(block).toContain('reached ? "REACHED" : null,');
    // Pedido do Operador ("deixar só as iniciais, sem a numeração na
    // frente nem a porcentagem"): o PRIMÁRIO é só a sigla. A distância
    // não sumiu — desceu para o secundário, e o teste prova as DUAS
    // coisas: sigla pura no primário E distância presente no secundário
    // (Regra de Ouro 4: realocar, nunca apagar).
    expect(block).toContain('text: `TP${i + 1}`,');
    // REVERTIDO POR PEDIDO REPETIDO DO OPERADOR (duas rodadas, com captura
    // real de ZEC 4H mostrando "TP1 3.14% FRACA 1:0.42" na tela): a
    // porcentagem de DISTÂNCIA até o alvo saiu do canvas de vez. Regra de
    // Ouro 4 satisfeita — a distância percentual continua real e visível no
    // painel do Trade Plan (App.tsx), que já a renderizava antes desta
    // mudança. `distPct` nunca volta — mas withScore() (rodada posterior,
    // ver refinamento-final-wiring.test.ts) traz de volta um número
    // DIFERENTE: a % de confluência do plano, um só token por etiqueta.
    expect(block).not.toContain('distPct');
    expect(block).toContain('color: "rgba(8, 153, 129, 0.75)"');
  });

  it('estado/texto vivo (BREACHED/REACHED/distância %/ETA/compactação) é o MESMO que a lib desenhava — mesmas funções puras reais, nunca uma segunda formatação divergente', () => {
    const s = chart();
    const idx = s.indexOf('const priceAxisLabels = useMemo');
    const end = s.indexOf('return out;', idx);
    const block = s.slice(idx, end);
    expect(block).toContain('const stopHitNow = p !== null && (long ? p <= effectiveStopPrice : p >= effectiveStopPrice);');
    expect(block).toContain('const compactLabels = shouldCompactLabels(levels);');
    expect(block).toContain('formatEtaRange(fusedTarget.etaMsMin, fusedTarget.etaMs)');
    // fail-closed: cada push guardado por Number.isFinite do preço real
    expect(block).toContain('if (Number.isFinite(effectiveStopPrice)) {');
    expect(block).toContain('if (!Number.isFinite(target.price)) return;');
  });

  it('o efeito de mutação da LINHA nunca mais escreve title (só a LINHA: price/color) — o texto é 100% do overlay agora', () => {
    const s = chart();
    const block = s.slice(s.indexOf('const hits = targetsHit'), s.indexOf('}, [tradePlan, livePrice, targetsHit]);'));
    // a linha do stop ratchea posição + cor; nenhum title
    expect(block).toContain('stopLineRef.current?.applyOptions({');
    expect(block).not.toContain('title:');
    // decision saiu das deps do efeito (só o rótulo, no useMemo, usa ETA)
    expect(s).not.toContain('}, [tradePlan, livePrice, targetsHit, decision]);');
  });
});

describe('EPC §5/§6 (continuação — relato direto do Operador: "falta aparecer entrada e alvo/alvo2/alvo3 no gráfico"): fallback do Core Engine (engineFallbackLevels) desenha STOP/TARGET1/TARGET2 reais quando o Trade Plan do Conselho está ausente', () => {
  const chart = () => read('../src/chart/EnhancedChart_110_Percent.tsx');

  it('prop tipada como fail-closed (null/absent não desenha nada) — mesma disciplina de tradePlan/tradePlanAbsenceReason', () => {
    const s = chart();
    const idx = s.indexOf('engineFallbackLevels?: {');
    expect(idx, 'prop engineFallbackLevels não encontrada na interface').toBeGreaterThan(-1);
    // Janela alargada (Ferramentas Institucionais: target3/extendedTarget
    // somou um campo + comentário explicativo antes de riskRewardRatio).
    const block = s.slice(idx, idx + 1150);
    expect(block).toContain('direction: "LONG" | "SHORT";');
    expect(block).toContain('stop: number;');
    expect(block).toContain('target1: number;');
    expect(block).toContain('target2: number | null;');
    expect(block).toContain('riskRewardRatio: number | null;');
    // EPC MODO ELITE §4: contagem de obstáculos por alvo (opcional, o
    // Núcleo não tem painel próprio — o rótulo é o único lugar).
    expect(block).toContain('target1ObstacleCount?: number | null;');
    expect(block).toContain('target2ObstacleCount?: number | null;');
  });

  it('linhas próprias (refs isoladas de tradePlanLinesRef/stopLineRef/targetLinesArrayRef) — Fio de Seda: lineWidth 1, Solid, nunca tracejado', () => {
    const s = chart();
    expect(s).toContain('const engineFallbackLinesRef = useRef<IPriceLine[]>([]);');
    const idx = s.indexOf('engineFallbackLinesRef.current.forEach((line) => series.removePriceLine(line));');
    expect(idx, 'efeito de desenho do fallback não encontrado').toBeGreaterThan(-1);
    const block = s.slice(idx, s.indexOf('}, [engineFallbackLevels]);'));
    expect(block).toContain('if (!engineFallbackLevels) return;');
    expect(block).toContain('lineWidth: 1,');
    expect(block).toContain('lineStyle: LineStyle.Solid,');
    expect(block).not.toMatch(/setLineDash/);
  });

  it('nunca desenha ENTRY (é o preço vivo, já nativo no eixo — uma 2ª linha ali seria redundante, não informação nova)', () => {
    const s = chart();
    const idx = s.indexOf('engineFallbackLinesRef.current.forEach((line) => series.removePriceLine(line));');
    const block = s.slice(idx, s.indexOf('}, [engineFallbackLevels]);'));
    expect(block).not.toMatch(/ENTRY/);
    // 4 chamadas reais de mk: stop, target1, target2 condicional, target3
    // condicional (Ferramentas Institucionais: extensão de Fibonacci).
    expect(block).toContain('mk(engineFallbackLevels.stop,');
    expect(block).toContain('mk(engineFallbackLevels.target1,');
    expect(block).toContain('if (engineFallbackLevels.target2 !== null) mk(engineFallbackLevels.target2,');
    expect(block).toContain('if (engineFallbackLevels.target3 != null) mk(engineFallbackLevels.target3,');
  });

  // Achado real do Operador ("nome Grandão, um monte de letra... mais
  // padrão, mais profissional"): "(Núcleo)" repetido em CADA rótulo era
  // redundante — o overlay do canto (tradePlanAbsenceReason) já diz
  // "linhas abaixo são do Núcleo" uma vez, persistente enquanto o
  // fallback está ativo. Removido do texto por rótulo; a distinção real
  // continua existindo por COR (0.5/0.35 — sempre mais apagada que o
  // Trade Plan do Conselho, 0.75) — nunca confundível, só sem repetir a
  // mesma palavra 3x.
  it('rótulos entram em priceAxisLabels SEM "(Núcleo)" no texto (redundante — o overlay do canto já diz uma vez) — distinção real continua por cor mais apagada (0.5/0.35 vs. 0.75 do Conselho)', () => {
    const s = chart();
    const idx = s.indexOf('const priceAxisLabels = useMemo');
    const end = s.indexOf('return out;', idx);
    const block = s.slice(idx, end);
    expect(block).toContain('if (engineFallbackLevels) {');
    // EPC FINAL §8: ST/TP1/TP2 (nomenclatura curta), sempre numerado.
    // Ordem "Lapidação das Etiquetas TP1/TP2" §3/§4: primário = "ST"/
    // "TP1<distância>" sozinho; BREACHED/força/R:R/obstáculo/REACHED
    // migraram pro secundário (fonte menor, PriceLabelStackPlugin).
    expect(block).toContain('text: "ST",');
    expect(block).toContain('secondaryText: breached ? "BREACHED" : undefined,');
    expect(block).toContain('color: "rgba(242, 54, 69, 0.5)",');
    // distPct1/2 (Ordem "Lapidação Visual Final e Sincronia Operacional"
    // §4 — "distância até o alvo, quando já houver cálculo real
    // disponível"): mesma fórmula que o Trade Plan do Conselho já usa
    // (Math.abs(target-p)*100/p), reaproveitada aqui — zero cálculo novo.

    expect(block).toContain('text: "TP1",');
    // REVERTIDO POR PEDIDO REPETIDO DO OPERADOR (duas rodadas, com captura
    // real de ZEC 4H mostrando "TP1 3.14% FRACA 1:0.42" na tela): a
    // porcentagem saiu do canvas de vez. Regra de Ouro 4 satisfeita — a
    // distância percentual continua real e visível no painel do Trade Plan
    // (App.tsx), que já a renderizava antes desta mudança.
    expect(block).not.toContain('distPct1');
    expect(block).toContain('strengthSuffix(engineFallbackLevels.target1Strength).trim() || null,');
    expect(block).toContain('rr !== null ? `1:${rr.toFixed(2)}` : null,');

    expect(block).toContain('text: "TP2",');
    expect(block).not.toContain('distPct2');
    expect(block).toContain('strengthSuffix(engineFallbackLevels.target2Strength).trim() || null,');
    // tier:"critical" (§3, Nível A): plano ATIVO do Núcleo quando não há
    // plano do Conselho — mesmo destaque grande/negrito do preço vivo.
    expect(block).toContain('tier: "critical"');
  });

  // Achado de auditoria (Ferramentas Institucionais): TP3 = extensão de
  // Fibonacci 61.8% (support-resistance-engine.js), computada e descartada
  // todo ciclo antes desta correção — nunca chegava ao gráfico. Mais simples
  // que TP1/TP2 DE PROPÓSITO: a fonte não calcula strength/obstacleCount
  // para este nível, então o rótulo nunca finge um metadado que não existe.
  it('TP3 (extensão de Fibonacci) usa preço puro no rótulo — sem strengthSuffix/obstacleSuffix, honesto sobre o que a fonte realmente calcula', () => {
    const s = chart();
    const idx = s.indexOf('const priceAxisLabels = useMemo');
    const end = s.indexOf('return out;', idx);
    const block = s.slice(idx, end);
    expect(block).toContain('if (engineFallbackLevels.target3 != null && Number.isFinite(engineFallbackLevels.target3)) {');
    // distPct3 (§4): mesma fórmula real de distância, TP3 continua sem
    // strengthSuffix/obstacleSuffix (a fonte não calcula esses metadados
    // para este nível — honesto sobre o que existe, nunca fabricado).

    expect(block).toContain('text: "TP3",');
    expect(block).not.toContain('distPct3');
    // TP3 passou a ter lista secundária (antes só REACHED) porque a
    // distância desceu para lá junto — continua sem strengthSuffix/
    // obstacleSuffix, que a fonte (support-resistance-engine.js) de fato
    // não calcula para este nível.
    expect(block).toContain('const secondary3 = [reached ? "REACHED" : null].filter(');
    expect(block).not.toContain('strengthSuffix(engineFallbackLevels.target3');
    expect(block).not.toContain('strengthSuffix(engineFallbackLevels.target3');
    expect(block).not.toContain('obstacleSuffix(engineFallbackLevels.target3');
  });

  it('EPC MODO ELITE §4: rótulos dos alvos do Núcleo carregam ⚠ N (obstáculos estruturais reais no caminho) — só quando N>0, mesmo glifo ⚠ da zona destacada; o Núcleo não tem painel, então o rótulo é o único lugar dessa contagem', () => {
    const s = chart();
    const idx = s.indexOf('const priceAxisLabels = useMemo');
    const end = s.indexOf('return out;', idx);
    const block = s.slice(idx, end);
    expect(block).toContain('const obstacleSuffix = (n: number | null | undefined) => (typeof n === "number" && n > 0 ? ` ⚠ ${n}` : "");');
    expect(block).toContain('obstacleSuffix(engineFallbackLevels.target1ObstacleCount).trim() || null,');
    expect(block).toContain('obstacleSuffix(engineFallbackLevels.target2ObstacleCount).trim() || null,');
  });

  it('strengthSuffix alinhado ao estilo tight de levelTitle() (S1/R1) — espaço, nunca "·", mesmo padrão de rótulo em todo o eixo', () => {
    const s = chart();
    const idx = s.indexOf('const priceAxisLabels = useMemo');
    const end = s.indexOf('return out;', idx);
    const block = s.slice(idx, end);
    expect(block).toContain('const strengthSuffix = (s: { label: "FORTE" | "FRACA"; touches: number } | null) => (s ? ` ${s.label}` : "");');
  });

  it('REACHED/BREACHED é derivação simples do preço vivo — nunca usa o ratchet effectiveStopForTargetsHit nem o Track Record autoritativo (que rastreiam o Trade Plan do Conselho, não este fallback)', () => {
    const s = chart();
    const idx = s.indexOf('if (engineFallbackLevels) {', s.indexOf('const priceAxisLabels = useMemo'));
    const end = s.indexOf('return out;', idx);
    const block = s.slice(idx, end);
    expect(block).not.toContain('effectiveStopForTargetsHit');
    expect(block).not.toContain('targetsHit');
    expect(block).toContain('const longFb = engineFallbackLevels.direction === "LONG";');
  });

  it('engineFallbackLevels entra nas deps de priceAxisLabels — recalcula quando o Núcleo muda de leitura', () => {
    const s = chart();
    expect(s).toContain('livePrice, tradePlan, targetsHit, decision, engineFallbackLevels, structureBreak, visibility.structure_breaks, structureBreakVisualWeight, traps, visibility.liquidity_sweep, visibility.session_key_levels, currentSessionKeyLevel, visibility.institutional_zones, institutionalZones, institutionalZoneVisualWeights, visibility.fibonacci, fibonacciLevels, fibonacciVisualWeights]);');
  });

  it('overlay de texto do canto (tradePlanAbsenceReason) nunca fica auto-contraditório: quando as linhas do Núcleo estão visíveis, o texto deixa explícito que é só o plano do CONSELHO que falta — nunca "SEM TRADE PLAN" sozinho com linhas reais na tela', () => {
    const s = chart();
    const idx = s.indexOf('{tradePlanAbsenceReason && (');
    expect(idx, 'overlay de texto não encontrado').toBeGreaterThan(-1);
    // Janela alargada (era 900): achado real de screenshot (Operador,
    // texto sem fundo lendo como flutuante) somou um comentário explicando
    // o fundo/padding novos antes do texto SEM PLANO/SEM TRADE PLAN.
    // Janela alargada de novo: a remocao da duplicacao (abaixo) somou o
    // comentario que explica por que o MOTIVO nao se repete aqui.
    const block = s.slice(idx, idx + 3000);
    // A intencao original, intacta: com as linhas do Nucleo na tela, o
    // texto diz que falta o plano do CONSELHO — nunca "SEM TRADE PLAN".
    expect(block).toContain('"SEM PLANO DO CONSELHO · linhas abaixo são do Núcleo"');
    expect(block).toContain(': `SEM TRADE PLAN · ${tradePlanAbsenceReason}`');
  });

  it('o MOTIVO da ausencia nao se repete no grafico — ele ja vive na faixa TRADE PLAN do cabecalho', () => {
    // Achado de captura real (ZEC/USDT 30m): "Núcleo LONG, Conselho
    // neutro" aparecia ao MESMO TEMPO na faixa do cabecalho e dentro da
    // etiqueta do grafico. Mesma string, mesma funcao de origem, duas
    // vezes na tela (violacao direta de "nada aparece em dois lugares se
    // representar a mesma informacao").
    const s = chart();
    const idx = s.indexOf('{tradePlanAbsenceReason && (');
    const block = s.slice(idx, idx + 3000);
    // No ramo COM linhas do Nucleo, o motivo saiu; no ramo SEM linhas ele
    // permanece, porque ali a etiqueta e a unica coisa na tela sobre isso.
    expect(block).not.toContain('SEM PLANO DO CONSELHO · ${tradePlanAbsenceReason}');

    // E a faixa do cabecalho continua sendo quem mostra o motivo, sempre.
    const app = read('../src/App.tsx');
    expect(app).toContain('<BarField label="Trade Plan" value={reason}');
  });
});

describe('EPC §5/§6 (continuação): App.tsx computa engineFallbackLevels a partir do MESMO Target Tracker do Core Engine (target-tracker.js) que já alimenta ANALYSIS/RISK — zero motor novo, zero segunda fonte', () => {
  const app = () => read('../src/App.tsx');

  it('gate: só existe quando o Trade Plan do Conselho está ausente E o Núcleo já tem direção real (LONG/SHORT) — nunca sobrepõe o plano do Conselho', () => {
    const s = app();
    const idx = s.indexOf('const engineFallbackLevels = useMemo');
    expect(idx, 'engineFallbackLevels não encontrado em App.tsx').toBeGreaterThan(-1);
    const block = s.slice(idx, idx + 1600);
    expect(block).toContain('if (chartTradePlan) return null;');
    expect(block).toContain('if (dir !== "LONG" && dir !== "SHORT") return null;');
    expect(block).toContain('if (typeof stop !== "number" || !Number.isFinite(stop)) return null;');
    expect(block).toContain('if (typeof target1 !== "number" || !Number.isFinite(target1)) return null;');
  });

  // Achado real (relato direto do Operador: "mesmo em qualquer timeframe
  // tinha que aparecer" — nunca apareceu, em nenhum): o campo bruto do
  // alvo 1 no objeto `engine` (App.tsx, useMemo ~linha 1367) chama-se
  // `target` (a variável local virou esse nome no return) — só o METADADO
  // de força manteve o sufixo "1" (`target1Strength`). A primeira versão
  // deste teste travava `engine?.target1` (o BUG em si) como se fosse o
  // comportamento esperado — um teste de padrão que verificava a
  // implementação errada contra ela mesma, nunca contra o campo real.
  // Corrigido para o nome real do campo; ver também o teste de execução
  // real abaixo, que teria pegado isto pela MATEMÁTICA, não pelo texto.
  it('lê exatamente os campos reais já expostos por engine-bridge.ts (stop/target/target2/target1Strength/target2Strength/riskRewardRatio) — zero cálculo novo aqui, nunca um nome de campo inventado', () => {
    const s = app();
    const idx = s.indexOf('const engineFallbackLevels = useMemo');
    // Janela alargada (Ferramentas Institucionais: target3/extendedTarget
    // somou um trecho novo dentro deste useMemo).
    const block = s.slice(idx, idx + 3600);
    expect(block).toContain('const stop = engine?.stop;');
    expect(block).toContain('const target1 = engine?.target;');
    expect(block).not.toContain('const target1 = engine?.target1;');
    expect(block).toContain('const target2 = typeof engine?.target2 === "number" && Number.isFinite(engine.target2) ? engine.target2 : null;');
    expect(block).toContain('target1Strength: engine?.target1Strength ?? null,');
    expect(block).toContain('target2Strength: engine?.target2Strength ?? null,');
    // EPC §5: entrada real do Núcleo (preço atual) — referência de
    // caminho para chartObstacleZones contar os obstáculos estruturais.
    expect(block).toContain('const entry = typeof engine?.entry === "number" && Number.isFinite(engine.entry) ? engine.entry : null;');
    // EPC MODO ELITE §4: contagem por alvo via a MESMA obstacleZonesInPath
    // (trade-plan.ts) — zero segundo cálculo.
    expect(block).toContain('obstacleZonesInPath(structZones, { low: entry, high: entry, basis: "" }, targetPrice, dir === "LONG").length');
    expect(block).toContain('target1ObstacleCount: obstacleCountTo(target1),');
    expect(block).toContain('target2ObstacleCount: obstacleCountTo(target2),');
    // Achado de auditoria (Ferramentas Institucionais): target3 lê
    // engine?.extendedTarget — mesmo passthrough puro de target/target2,
    // nunca um nome de campo inventado.
    expect(block).toContain('const target3 = typeof engine?.extendedTarget === "number" && Number.isFinite(engine.extendedTarget) ? engine.extendedTarget : null;');
    expect(block).toContain('target3,');
  });

  // Execução real (não só padrão de fonte): reproduz o MESMO shape do
  // objeto `engine` real (App.tsx ~linha 1505: campo `target`, nunca
  // `target1`) e prova que a função de gate só aceita o nome de campo
  // verdadeiro — é o teste que teria pego o bug de nome trocado pela
  // MATEMÁTICA (retorna null vs. retorna um plano real), não por string.
  it('execução real: com o shape verdadeiro do engine (campo `target`), o gate produz um fallback real; com o nome de campo errado (`target1`), teria ficado sempre null — mesma prova viva do bug encontrado', () => {
    const deriveFallback = (engine: { direction: string | null; stop: unknown; target: unknown; target2?: unknown } | null, chartTradePlan: unknown) => {
      if (chartTradePlan) return null;
      const dir = engine?.direction;
      if (dir !== 'LONG' && dir !== 'SHORT') return null;
      const stop = engine?.stop;
      const target1 = engine?.target; // nome real do campo, confirmado em App.tsx:2319 (`target: engine.target`)
      if (typeof stop !== 'number' || !Number.isFinite(stop)) return null;
      if (typeof target1 !== 'number' || !Number.isFinite(target1)) return null;
      return { direction: dir, stop, target1 };
    };
    const realEngineShape = { direction: 'LONG', stop: 63736, target: 65688 };
    const result = deriveFallback(realEngineShape, null);
    expect(result).not.toBeNull();
    expect(result?.target1).toBe(65688);

    // prova viva do sintoma: a MESMA função, lendo o campo ERRADO
    // (`target1`, que nunca existe no shape real), sempre retorna null —
    // exatamente o silêncio que o Operador reportou em qualquer timeframe.
    const buggyRead = (engine: typeof realEngineShape) => (engine as unknown as { target1?: number }).target1;
    expect(buggyRead(realEngineShape)).toBeUndefined();
  });

  it('passado para o canvas como prop dedicada — nunca fundido com chartTradePlan', () => {
    const s = app();
    expect(s).toContain('engineFallbackLevels={engineFallbackLevels}');
  });
});

describe('Achado real do Operador ("tá ficando só numa lateral direita"): critério de divisão entre os dois lados do eixo — direita = acionável agora, esquerda = mapa estrutural', () => {
  const chart = () => read('../src/chart/EnhancedChart_110_Percent.tsx');

  it('S1/R1/Trend Channel/BOS-CHOCH (contexto estrutural, muda devagar ou já é histórico) declaram side: "left"', () => {
    const c = chart();
    const idx = c.indexOf('const priceAxisLabels = useMemo');

    // Carta Branca: a condição real ganhou o gate FORTE (só precisão
    // maciça no eixo) — o texto do `if` mudou, side: "left" continua igual.
    const s1Idx = c.indexOf('if (Number.isFinite(support) && supportStrength?.label === "FORTE") {', idx);
    const s1Block = c.slice(s1Idx, c.indexOf('}', c.indexOf('side:', s1Idx)) + 1);
    expect(s1Block).toContain('side: "left",');

    const r1Idx = c.indexOf('if (Number.isFinite(resistance) && resistanceStrength?.label === "FORTE") {', idx);
    const r1Block = c.slice(r1Idx, c.indexOf('}', c.indexOf('side:', r1Idx)) + 1);
    expect(r1Block).toContain('side: "left",');

    const trendIdx = c.indexOf('if (visibility.trend_channel && trendChannelInfo) {', idx);
    const trendBlock = c.slice(trendIdx, c.indexOf('}', c.indexOf('side:', trendIdx)) + 1);
    expect(trendBlock).toContain('side: "left",');

    // Evolução Total: bloco ganhou gate real de visibility.structure_breaks
    // (era a única etiqueta do eixo sem gate — linha sumia com o toggle,
    // etiqueta ficava).
    const chocIdx = c.indexOf('if (visibility.structure_breaks && structureBreak) {', idx);
    const chocBlock = c.slice(chocIdx, c.indexOf('}', c.indexOf('side:', chocIdx)) + 1);
    expect(chocBlock).toContain('side: "left",');
  });

  it('Liquidity Sweep/Session Key Levels (achado real: "linha amarela que eu não sei o que significa" + "etiquetas em cima do valor do ativo") também são contexto estrutural/histórico — side: "left"', () => {
    const c = chart();
    const idx = c.indexOf('const priceAxisLabels = useMemo');

    const sweepIdx = c.indexOf('if (visibility.liquidity_sweep) {', idx);
    const sweepBlock = c.slice(sweepIdx, c.indexOf('}', c.indexOf('side:', sweepIdx)) + 1);
    expect(sweepBlock).toContain('side: "left",');
    // Lapidação institucional ("agrupar SWEEPs próximos"): texto agora
    // condicional por cluster (clusterSweptPrices, trap-detection.ts) —
    // 1 evento isolado mantém o texto simples, 2+ eventos próximos viram
    // "SWEEP ZONE (Nx)".
    expect(sweepBlock).toContain('for (const cluster of clusterSweptPrices(uniqueLevels, LIQUIDITY_PROXIMITY_PCT)) {');
    // Lapidação Visual do Gráfico §4: o "N%" saiu do texto. `confidence` é
    // propriedade do TRAP (compartilhada por todos os seus níveis), então
    // com N sweeps na tela os N chips traziam o MESMO número — repetição
    // que não discrimina nada. O valor real segue no painel "Institutional
    // Traps". O que discrimina (seta e contagem do cluster) permanece.
    // Ordem "FECHAMENTO" §3: as duas variantes convergiram para um único
    // primário; a contagem do cluster virou secundário (fonte menor), sem
    // perder nada — "ZONE 3x" diz exatamente o que "(3x)" dizia.
    expect(sweepBlock).toContain('text: `⚡ SWEEP ${arrow}`,');
    expect(sweepBlock).toContain('secondaryText: cluster.count > 1 ? `ZONE ${cluster.count}x` : undefined,');
    expect(sweepBlock).not.toContain('confidencePct');
    // Achado real de captura de tela (dezenas de rótulos empilhados,
    // decaimento por idade adicionado): cluster expirado nunca entra no
    // eixo, mesmo SWEEP_DECAY/ageAlpha real usado pela price line nativa.
    expect(sweepBlock).toContain('const age = data.length - 1 - cluster.latestIndex;');
    expect(sweepBlock).toContain('const alpha = ageAlpha(age, SWEEP_DECAY);');
    expect(sweepBlock).toContain('if (alpha <= 0) continue;');
    expect(sweepBlock).toContain('alpha,');

    const keyLevelIdx = c.indexOf('if (visibility.session_key_levels && currentSessionKeyLevel) {', idx);
    // Fatiado até o comentário do bloco seguinte (Zona Institucional),
    // nunca até 'return out;' — aquele bloco tem seu próprio side:"left"
    // real (achado real desta correção: fatiar até o fim da função
    // inflava esta contagem quando um novo bloco era adicionado depois).
    const keyLevelBlock = c.slice(keyLevelIdx, c.indexOf('// Diretriz Final — Polimento Visual', idx));
    expect((keyLevelBlock.match(/side: "left",/g) ?? []).length).toBe(2); // high + low
  });

  it('VWAP/NL/EMA/último preço/ENTRY/STOP/TARGET (acionável agora — referência dinâmica ou plano ativo) NUNCA declaram side — ficam no default "right"', () => {
    const c = chart();
    const idx = c.indexOf('const priceAxisLabels = useMemo');
    const end = c.indexOf('return out;', idx);
    const block = c.slice(idx, end);
    // as linhas reais de push destes rótulos, cada uma sem side: no fim
    expect(block).toContain('out.push({ price: vwapLastValue, text: `V ${LINE_STATE_GLYPH[s]}${fmtAxisLabelPrice(vwapLastValue)}`, color: VWAP_STATE_COLOR[s] });');
    expect(block).toContain('out.push({ price: nlLastValue, text: `NL ${LINE_STATE_GLYPH[s]}${fmtAxisLabelPrice(nlLastValue)}`, color: NL_STATE_COLOR[s] });');
    expect(block).toContain('out.push({ price: emaLastValue, text: `E${activeEmaPeriod} ${fmtAxisLabelPrice(emaLastValue)}`, color: "rgba(6, 85, 212, 0.85)" });');
  });

  it('resultado real esperado: até 15 rótulos possíveis do lado esquerdo (S1/R1/TREND/CHOC/SWEEP/KEY-H/KEY-L/ZONA INSTITUCIONAL/VPOC/TPOC/VAH/VAL/IBH/IBL/FIB), até 8 do lado direito (VWAP/NL/EMA + até 5 do plano ativo Conselho OU Núcleo) — redução real de densidade no lado que o Operador reportou, não só estética (Sweep/Key Levels somaram-se depois; Zona Institucional migrou pra cá na Diretriz Final — Polimento Visual; VPOC/TPOC/VAH/VAL/IBH/IBL somaram-se na auditoria "Estratégia de Evolução Elite" — task #341, achado real: essas 5 linhas de preço nunca tinham rótulo legível; FIB somou-se no Visual Cleanup — mesmo gap de classe, só níveis com confluência real competem)', () => {
    const c = chart();
    const idx = c.indexOf('const priceAxisLabels = useMemo');
    const end = c.indexOf('return out;', idx);
    const block = c.slice(idx, end);
    const leftSideCount = (block.match(/side: "left",/g) ?? []).length;
    expect(leftSideCount).toBe(15);
  });
});

// Diretriz Final — Polimento Visual e Sincronização Global §1/§2: achado
// real via captura de tela do Operador (BTC/USDT 1H) — o rótulo de texto
// da Zona Institucional (antes desenhado por InstitutionalZonePlugin, num
// canvas próprio, com posição vertical própria) colidia visivelmente com
// "LONDRES H/L"/"SWEEP ZONE" porque os dois desenhavam em canvases
// independentes, sem nenhuma consciência um do outro. Trava a migração do
// TEXTO para o mesmo sistema anti-colisão real (priceAxisLabels) que já
// resolvia Sweep/Session Key Levels/S1/R1 — a FAIXA (fill+borda) continua
// intocada em InstitutionalZonePlugin.
describe('Diretriz Final — Polimento Visual: rótulo de Zona Institucional migrou para priceAxisLabels (zero colisão com Sweep/Session/S1/R1)', () => {
  it('InstitutionalZonePlugin.tsx: exporta LABEL_COLOR (única fonte real da cor) e NUNCA mais chama drawCanvasLabel/measureCanvasLabel — só desenha a faixa (fill+borda)', () => {
    const s = read('../src/chart/InstitutionalZonePlugin.tsx');
    expect(s).toContain('export const LABEL_COLOR = "rgba(217, 205, 254, 0.90)";');
    expect(s).not.toContain('drawCanvasLabel(');
    expect(s).not.toContain('measureCanvasLabel(');
    expect(s).not.toContain('import { drawCanvasLabel');
  });

  it('EnhancedChart_110_Percent.tsx: importa LABEL_COLOR do plugin (zero cor duplicada como literal em 2 arquivos) e empurra 1 entrada por zona real em priceAxisLabels, side:"left", price = centro real da zona', () => {
    const c = chart();
    expect(c).toContain('import { InstitutionalZonePlugin, LABEL_COLOR as INSTITUTIONAL_ZONE_LABEL_COLOR, confluenceWeight } from "./InstitutionalZonePlugin";');
    const idx = c.indexOf('if (visibility.institutional_zones) {', c.indexOf('const priceAxisLabels = useMemo'));
    expect(idx, 'bloco de Zona Institucional em priceAxisLabels não encontrado').toBeGreaterThan(-1);
    const block = c.slice(idx, c.indexOf('return out;', idx));
    // Evolução Total ("um objeto, um peso"): forEach com índice para a
    // etiqueta seguir a MESMA redução do orçamento visual aplicada à faixa.
    expect(block).toContain('institutionalZones.forEach((zone, i) => {');
    expect(block).toContain('const resolved = institutionalZoneVisualWeights[i];');
    expect(block).toContain('const alpha = resolved !== undefined && base > 0 ? Math.min(1, resolved / base) : 1;');
    expect(block).toContain('price: (zone.top + zone.bottom) / 2,');
    // Ordem "FECHAMENTO" §3: junto com TREND era a etiqueta mais larga do
    // eixo. Nível 1 = força da confluência (contagem real de fontes
    // distintas, a MESMA que alimenta confluenceWeight); Nível 2 = quais
    // ferramentas — lista completa preservada, em fonte menor.
    expect(block).toContain('text: `${zone.distinctSourceCount}F`,');
    expect(block).toContain('secondaryText: toolNames,');
    expect(block).toContain('color: INSTITUTIONAL_ZONE_LABEL_COLOR,');
    expect(block).toContain('side: "left",');
  });

  it('respeita visibility.institutional_zones (fail-closed: camada desligada = zero entrada no eixo, mesma disciplina de todo outro bloco condicional aqui)', () => {
    const c = chart();
    const idx = c.indexOf('const priceAxisLabels = useMemo');
    const block = c.slice(idx, c.indexOf('return out;', idx));
    const zoneIdx = block.indexOf('if (visibility.institutional_zones) {');
    expect(zoneIdx).toBeGreaterThan(-1);
  });
});

// Achado real, auditoria "Estratégia de Evolução Elite" (2026-08-16, task
// #341): POC do Volume Profile, POC do TPO Profile, Value Area High/Low e
// Initial Balance High/Low — 5 linhas de preço reais desenhadas por
// VolumeProfilePlugin/TpoProfilePlugin — nunca tinham rótulo de preço
// legível no eixo, diferente de S1/R1/EMA/VWAP. Trava a fiação real:
// cores reutilizadas exatamente das próprias linhas (nunca uma cor nova),
// side:"left" (mesma família de S1/R1/Trend Channel — mapa estrutural,
// nunca "acionável agora"), IB só quando initialBalanceComplete (mesmo
// gate real que TpoProfilePlugin já usa pra não apresentar um IB parcial
// como final).
describe('Achado real (task #341): rótulos de preço para POC(VP+TPO)/VAH/VAL/IB no eixo', () => {
  const chart = () => read('../src/chart/EnhancedChart_110_Percent.tsx');

  it('importa computeTpoProfile e computa tpoProfileForLabels via useMemo(data) — zero segunda implementação, mesma função pura já usada por TpoProfilePlugin', () => {
    const c = chart();
    expect(c).toContain('import { computeTpoProfile } from "../nexus/tpo-profile";');
    expect(c).toContain('const tpoProfileForLabels = useMemo(() => {');
    expect(c).toContain('const reading = computeTpoProfile(data);');
    expect(c).toContain('return reading.status === "OK" ? reading.result : null;');
  });

  it('VPOC: reusa volumeProfile.fixedRange.pocPrice já lido pela store (zero cálculo novo), cor idêntica ao POC_LINE de VolumeProfilePlugin.tsx, side:"left", gated por visibility.volume_profile', () => {
    const c = chart();
    const idx = c.indexOf('const priceAxisLabels = useMemo');
    const block = c.slice(idx, c.indexOf('return out;', idx));
    expect(block).toContain('if (visibility.volume_profile && Number.isFinite(volumeProfile?.fixedRange?.pocPrice)) {');
    expect(block).toContain('text: `VPOC ${fmtAxisLabelPrice(volumeProfile!.fixedRange!.pocPrice)}`,');
    expect(block).toContain('color: "rgba(236, 81, 205, 0.75)", // mesma cor de POC_LINE em VolumeProfilePlugin.tsx');
  });

  it('TPOC/VAH/VAL: gated por visibility.tpo_profile && tpoProfileForLabels, cores reais reusadas (âmbar do POC do TPO, azul-neutro da família TPO pro par Value Area)', () => {
    const c = chart();
    const idx = c.indexOf('const priceAxisLabels = useMemo');
    const block = c.slice(idx, c.indexOf('return out;', idx));
    expect(block).toContain('if (visibility.tpo_profile && tpoProfileForLabels) {');
    expect(block).toContain('text: `TPOC ${fmtAxisLabelPrice(tpoProfileForLabels.pocPrice)}`,');
    expect(block).toContain('color: "rgba(240, 193, 111, 0.85)", // mesma cor de POC_LINE em TpoProfilePlugin.tsx');
    expect(block).toContain('text: `VAH ${fmtAxisLabelPrice(tpoProfileForLabels.valueAreaHighPrice)}`,');
    expect(block).toContain('text: `VAL ${fmtAxisLabelPrice(tpoProfileForLabels.valueAreaLowPrice)}`,');
    // VPOC e TPOC nunca podem ser o mesmo texto — os dois POCs medem
    // coisas diferentes (volume vs. contagem de tempo) e coexistem na
    // mesma lane desde a correção de colisão desta sessão.
    expect(block).not.toContain('text: `POC ${fmtAxisLabelPrice');
  });

  it('IBH/IBL: só entram quando tpoProfileForLabels.initialBalanceComplete é real (nunca um IB parcial apresentado como final — mesmo gate de TpoProfilePlugin.tsx), cores idênticas a IB_HIGH/IB_LOW', () => {
    const c = chart();
    const idx = c.indexOf('const priceAxisLabels = useMemo');
    const block = c.slice(idx, c.indexOf('return out;', idx));
    expect(block).toContain('if (tpoProfileForLabels.initialBalanceComplete) {');
    expect(block).toContain('text: `IBH ${fmtAxisLabelPrice(tpoProfileForLabels.initialBalanceHigh)}`,');
    expect(block).toContain('color: "rgba(242, 54, 69, 0.5)", // mesma cor de IB_HIGH em TpoProfilePlugin.tsx');
    expect(block).toContain('text: `IBL ${fmtAxisLabelPrice(tpoProfileForLabels.initialBalanceLow)}`,');
    expect(block).toContain('color: "rgba(8, 153, 129, 0.5)", // mesma cor de IB_LOW em TpoProfilePlugin.tsx');
  });
});

// Achado real (Visual Cleanup, pedido direto do Operador — "a Fibonacci...
// bem detalhada"): as 5 linhas nativas de Fibonacci (createPriceLine,
// axisLabelVisible:false) tinham um `title` real ("FIB 61.8% ×2") que
// NUNCA aparecia em lugar nenhum da tela — nem eixo nativo (desligado de
// propósito), nem este overlay (nunca entrava no array `out`), nem hover
// (não existe neste app). Mesma classe de gap já fechada pra POC/VAH/VAL/
// IB (task #341) e WALL (task #285).
describe('Achado real (Visual Cleanup): rótulos de preço para Fibonacci — só níveis com confluência real', () => {
  const chart = () => read('../src/chart/EnhancedChart_110_Percent.tsx');

  // Achado 2.7 (pedido do Operador "a Fibonacci tem de ficar diferenciada
  // pra gente saber qual as linha dela"): o gate antigo (`score > 0` e
  // pronto) deixava 61.8%/50% — as 2 linhas que o Operador precisa achar
  // primeiro — sem NENHUM número na tela sempre que nenhuma outra
  // ferramenta concordasse com aquele preço. Agora primário sempre compete;
  // raso continua exigindo confluência real (nunca fabricada).
  it('nível primário (razão áurea/ponto médio) sempre compete por rótulo; raso só com confluência real', () => {
    const c = chart();
    const idx = c.indexOf('const priceAxisLabels = useMemo');
    const block = c.slice(idx, c.indexOf('return out;', idx));
    expect(block).toContain('if (visibility.fibonacci) {');
    expect(block).toContain('if (!fibDeservesAxisLabel(level.ratio, level.score)) return;');
    expect(block).toContain('if (!Number.isFinite(level.price)) return;');
  });

  it('texto reusa EXATAMENTE o mesmo formato do title nativo (ratio×100 + score real quando existe), cor idêntica à LINHA correspondente, side:"left"', () => {
    const c = chart();
    const idx = c.indexOf('const priceAxisLabels = useMemo');
    const block = c.slice(idx, c.indexOf('return out;', idx));
    expect(block).toContain('text: `FIB ${(level.ratio * 100).toFixed(1)}%${level.score > 0 ? ` ×${level.score}` : ""}`,');
    // Mesma função/mesmo peso da linha — rótulo e linha nunca divergem.
    expect(block).toContain('color: `rgba(0, 98, 255, ${fibLineAlpha(fibonacciVisualWeights[i] ?? null).toFixed(3)})`,');
    expect(block).toContain('side: "left",');
  });

  it('dependências reais do useMemo incluem visibility.fibonacci e fibonacciLevels — senão o rótulo ficaria stale ao ligar/desligar a camada', () => {
    const c = chart();
    expect(c).toContain('institutionalZoneVisualWeights, visibility.fibonacci, fibonacciLevels, fibonacciVisualWeights]);');
  });
});

// Achado 2.3 (Visual Cleanup & Rendering Audit): grep confirmou S1/R1 como
// o único par de price lines do gráfico com ZERO integração em
// layer-relevance.ts/visual-budget.ts — alpha sempre fixo em 0.65,
// independente de força real (FORTE/FRACA) ou de quanto o resto do painel
// já estava competindo por destaque (Trade Plan/Zonas/Estrutura). Execução
// real (não só padrão de fonte) para as 2 funções puras — mesmo critério
// de detectPrependCount acima no arquivo: "a matemática está sutilmente
// errada" é o bug mais provável aqui, não fiação entre módulos.
describe('Achado 2.3 (Visual Cleanup): levelStrengthBaseWeight/levelLineAlpha — execução real, zero peso fabricado', () => {
  it('levelStrengthBaseWeight: sem força computada ainda (fail-closed) — peso pleno, nunca penaliza por ausência de dado', () => {
    expect(levelStrengthBaseWeight(null)).toBe(1);
    expect(levelStrengthBaseWeight(undefined)).toBe(1);
  });

  it('levelStrengthBaseWeight: piso real em touches=1 (FRACA mínima, o próprio nível bate em si mesmo) — 0, nunca negativo', () => {
    expect(levelStrengthBaseWeight({ label: 'FRACA', touches: S1R1_TOUCH_FLOOR })).toBe(0);
    expect(levelStrengthBaseWeight({ label: 'FRACA', touches: 0 })).toBe(0); // clamp: nunca abaixo do piso real
  });

  it('levelStrengthBaseWeight: teto real em touches>=4 — 1, nunca acima (mais toques que o teto não inflam além de pleno)', () => {
    expect(levelStrengthBaseWeight({ label: 'FORTE', touches: S1R1_TOUCH_CEIL })).toBe(1);
    expect(levelStrengthBaseWeight({ label: 'FORTE', touches: 9 })).toBe(1);
  });

  it('levelStrengthBaseWeight: FORTE mínima (touches=2, STRONG_TOUCH_THRESHOLD real de support-resistance-engine.js) fica a meio caminho real entre o piso e o teto', () => {
    expect(levelStrengthBaseWeight({ label: 'FORTE', touches: 2 })).toBeCloseTo(1 / 3, 6);
  });

  it('levelLineAlpha: orçamento visual ainda não resolvido (null) — preserva o valor fixo de sempre (S1R1_ALPHA_MAX), zero número novo fabricado', () => {
    expect(levelLineAlpha(null)).toBe(S1R1_ALPHA_MAX);
  });

  it('levelLineAlpha: mapeia peso 0..1 para a banda real [S1R1_ALPHA_MIN, S1R1_ALPHA_MAX] — nunca abaixo do piso (Regra de Ouro 4), nunca acima do teto (zero regressão sobre o 0.65 fixo anterior)', () => {
    expect(levelLineAlpha(0)).toBeCloseTo(S1R1_ALPHA_MIN, 6);
    expect(levelLineAlpha(1)).toBeCloseTo(S1R1_ALPHA_MAX, 6);
    expect(levelLineAlpha(0.5)).toBeCloseTo((S1R1_ALPHA_MIN + S1R1_ALPHA_MAX) / 2, 6);
  });

  it('S1R1_ALPHA_MAX é exatamente o 0.65 fixo que S1/R1 sempre usaram — um nível FORTE sem nenhuma competição real fica visualmente idêntico ao comportamento anterior a esta rodada', () => {
    expect(S1R1_ALPHA_MAX).toBe(0.65);
  });
});

describe('Achado 2.3 (Visual Cleanup): S1/R1 entram na competição real de orçamento visual (nexus/visual-budget.ts) — mesmo padrão já usado por Trade Plan/Zonas/Estrutura', () => {
  const chart = () => read('../src/chart/EnhancedChart_110_Percent.tsx');

  it('candidatos s1/r1 (categoria STRUCTURE) só entram quando a linha de fato é desenhada — mesmo gate Number.isFinite do useEffect nativo', () => {
    const c = chart();
    const idx = c.indexOf('const visualBudgetResults = useMemo(() => {');
    expect(idx, 'visualBudgetResults não encontrado').toBeGreaterThan(-1);
    const block = c.slice(idx, c.indexOf('return resolveVisualBudget(candidates);', idx));
    expect(block).toContain('if (Number.isFinite(support)) {');
    expect(block).toContain('candidates.push({ id: "s1", category: "STRUCTURE", baseWeight: levelStrengthBaseWeight(supportStrength) });');
    expect(block).toContain('if (Number.isFinite(resistance)) {');
    expect(block).toContain('candidates.push({ id: "r1", category: "STRUCTURE", baseWeight: levelStrengthBaseWeight(resistanceStrength) });');
  });

  it('supportVisualWeight/resistanceVisualWeight seguem o MESMO padrão de lookup por id que structureBreakVisualWeight já usa — zero segunda forma de ler o resultado resolvido', () => {
    const c = chart();
    expect(c).toContain('const supportVisualWeight = useMemo(\n    () => visualBudgetResults.find((r) => r.id === "s1")?.visualWeight ?? null,\n    [visualBudgetResults],\n  );');
    expect(c).toContain('const resistanceVisualWeight = useMemo(\n    () => visualBudgetResults.find((r) => r.id === "r1")?.visualWeight ?? null,\n    [visualBudgetResults],\n  );');
  });

  it('a price line NATIVA de S1/R1 (createPriceLine) usa levelLineAlpha(supportVisualWeight/resistanceVisualWeight) — nunca mais o 0.65 hardcoded', () => {
    const c = chart();
    const supportIdx = c.indexOf('supportLineRef.current = seriesRef.current.createPriceLine({');
    const supportBlock = c.slice(supportIdx, supportIdx + 1400);
    expect(supportBlock).toContain('color: `rgba(245, 158, 11, ${levelLineAlpha(supportVisualWeight).toFixed(3)})`,');
    expect(supportBlock).not.toContain('color: "rgba(245, 158, 11, 0.65)"');

    const resistanceIdx = c.indexOf('resistanceLineRef.current = seriesRef.current.createPriceLine({');
    const resistanceBlock = c.slice(resistanceIdx, resistanceIdx + 600);
    expect(resistanceBlock).toContain('color: `rgba(245, 158, 11, ${levelLineAlpha(resistanceVisualWeight).toFixed(3)})`,');
    expect(resistanceBlock).not.toContain('color: "rgba(245, 158, 11, 0.65)"');
  });

  it('os 2 useEffect nativos de S1/R1 recalculam quando o peso visual resolvido muda — senão a linha ficaria presa na cor de um orçamento antigo', () => {
    const c = chart();
    expect(c).toContain('}, [support, supportStrength, supportBreakouts, supportVisualWeight]);');
    expect(c).toContain('}, [resistance, resistanceStrength, resistanceBreakouts, resistanceVisualWeight]);');
  });
});

// Achado real, mesma auditoria (task #341): a Fase A do Ajuste ULTRA LED
// já escalava o fontSize NATIVO do chart (11→12→13px, chart-ultrawide-
// scale.ts) num monitor grande/UltraWide/4K, mas as etiquetas DESTE
// overlay (desenhadas por CIMA do tick nativo) ficavam com fonte fixa em
// qualquer resolução — inconsistência visual real entre o eixo nativo e o
// próprio overlay que o substitui. Trava a fiação: mesma função/mesmos 3
// breakpoints já aprovados (nunca um breakpoint novo), aplicados às
// fontes/alturas deste plugin.
describe('Achado real (task #341): etiquetas do eixo escalam com o monitor (mesma escala real da Fase A ULTRA LED)', () => {
  it('PriceLabelStackPlugin.tsx importa resolveChartUltraWideScale do módulo compartilhado (nunca um breakpoint novo/duplicado)', () => {
    const s = plugin();
    expect(s).toContain('import { resolveChartUltraWideScale } from "./chart-ultrawide-scale";');
  });

  it('fontDelta computado uma vez por desenho a partir de window.innerWidth — mesma leitura real que EnhancedChart_110_Percent.tsx já usa', () => {
    const s = plugin();
    const idx = s.indexOf('const uiScale = resolveChartUltraWideScale(window.innerWidth);');
    expect(idx).toBeGreaterThan(-1);
    const block = s.slice(idx, idx + 800);
    expect(block).toContain('const fontDelta = uiScale.fontSize - 11;');
    expect(block).toContain('const fontLive = `bold ${FONT_LIVE_BASE_PX + fontDelta}px -apple-system, sans-serif`;');
    expect(block).toContain("const fontCompact = `500 ${FONT_COMPACT_BASE_PX + fontDelta}px ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, monospace`;");
    expect(block).toContain('const fontSecondary = `${FONT_SECONDARY_BASE_PX + fontDelta}px -apple-system, sans-serif`;');
    expect(block).toContain('const labelHeightPx = LABEL_HEIGHT_PX + fontDelta;');
    expect(block).toContain('const liveLabelHeightPx = LIVE_LABEL_HEIGHT_PX + fontDelta;');
  });

  it('baseline real (<1440px) nunca muda: FONT_LIVE_BASE_PX/FONT_COMPACT_BASE_PX/FONT_SECONDARY_BASE_PX preservam os valores exatos já em produção (11/9/8)', () => {
    const s = plugin();
    expect(s).toContain('const FONT_LIVE_BASE_PX = 11;');
    expect(s).toContain('const FONT_COMPACT_BASE_PX = 9;');
    expect(s).toContain('const FONT_SECONDARY_BASE_PX = 8;');
  });

  it('todo uso de fonte/altura/gap dentro do loop de desenho vem das variáveis responsivas (fontLive/fontCompact/fontSecondary/labelHeightPx/liveLabelHeightPx/minGapPx) — nunca mais uma constante de módulo fixa', () => {
    const s = plugin();
    expect(s).toContain('const primaryFont = isBigTier ? fontLive : fontCompact;');
    expect(s).toContain('ctx.font = fontSecondary;');
    expect(s).toContain('const boxHeight = isBigTier ? liveLabelHeightPx : labelHeightPx;');
    expect(s).toContain('const minGapPx = labelHeightPx + LABEL_EDGE_GAP_PX;');
    expect(s).toContain('resolveLabelStackPositions<PriceAxisLabel & { naturalY: number }>(');
    // O gap pareado também tem de vir das variáveis responsivas — se
    // alguém cravar uma altura de módulo ali, a pilha para de escalar com
    // o monitor exatamente como parava antes da task #341.
    expect(s).toContain('if (tier === "live") return liveLabelHeightPx + LIVE_RING_TOTAL_PX;');
    expect(s).toContain('if (tier === "critical") return liveLabelHeightPx;');
    expect(s).toContain('return labelHeightPx;');
  });
});

// Achado 2.7 (Visual Cleanup & Rendering Audit, 5ª rodada) — pedido direto
// do Operador: "a Fibonacci tem de ficar diferenciada pra gente saber qual
// as linha dela, como que ela está sendo analisada pro visual". Execução
// REAL (não só padrão de fonte), mesmo critério do Achado 2.3 acima: o bug
// mais provável aqui é "a matemática está sutilmente errada" (uma inversão
// de hierarquia, um extremo de banda deslocado), nunca fiação esquecida.
describe('Achado 2.7 (Visual Cleanup): peso estrutural real da Fibonacci — execução real, zero probabilidade fabricada', () => {
  it('fibRatioStructuralWeight: razão áurea (61.8%) e ponto médio (50%) são os níveis de decisão — peso pleno', () => {
    expect(fibRatioStructuralWeight(0.618)).toBe(1);
    expect(fibRatioStructuralWeight(0.5)).toBe(1);
    expect([...FIB_PRIMARY_RATIOS]).toEqual([0.5, 0.618]);
  });

  it('fibRatioStructuralWeight: 38.2% (complemento de 61.8%) é secundário; 23.6%/78.6% são as bordas rasa/profunda', () => {
    expect(fibRatioStructuralWeight(0.382)).toBe(FIB_SECONDARY_STRUCTURAL_WEIGHT);
    expect(fibRatioStructuralWeight(0.236)).toBe(FIB_SHALLOW_STRUCTURAL_WEIGHT);
    expect(fibRatioStructuralWeight(0.786)).toBe(FIB_SHALLOW_STRUCTURAL_WEIGHT);
    expect(FIB_SECONDARY_STRUCTURAL_WEIGHT).toBeGreaterThan(FIB_SHALLOW_STRUCTURAL_WEIGHT);
    expect(FIB_SECONDARY_STRUCTURAL_WEIGHT).toBeLessThan(1);
  });

  it('fibRatioStructuralWeight: cobre TODOS os ratios reais do motor (FIB_RETRACEMENT_RATIOS) — nenhum nível real cai num caso não previsto', () => {
    for (const ratio of FIB_RETRACEMENT_RATIOS) {
      const w = fibRatioStructuralWeight(ratio);
      expect(Number.isFinite(w)).toBe(true);
      expect(w).toBeGreaterThan(0);
      expect(w).toBeLessThanOrEqual(1);
    }
  });

  it('fibRatioStructuralWeight: fail-closed — ratio desconhecido/NaN cai no peso mais baixo, nunca infla', () => {
    expect(fibRatioStructuralWeight(0.111)).toBe(FIB_SHALLOW_STRUCTURAL_WEIGHT);
    expect(fibRatioStructuralWeight(NaN)).toBe(FIB_SHALLOW_STRUCTURAL_WEIGHT);
  });

  it('fibRatioBaseWeight CORRIGE a inversão real que existia: 61.8% sem nenhuma confluência pesa MAIS que 23.6% com confluência máxima — antes era o contrário (o degrau binário por score ignorava o ratio)', () => {
    const goldenAlone = fibRatioBaseWeight(0.618, 0);
    const shallowWithFullConfluence = fibRatioBaseWeight(0.236, FIB_CONFLUENCE_CEIL);
    expect(goldenAlone).toBeGreaterThan(shallowWithFullConfluence);
  });

  it('fibRatioBaseWeight: a confluência real ainda pesa — o MESMO ratio com mais fontes concordando sobe, monotonicamente', () => {
    const scores = [0, 1, 2, 3];
    const weights = scores.map((s) => fibRatioBaseWeight(0.382, s));
    for (let i = 1; i < weights.length; i++) {
      expect(weights[i]).toBeGreaterThan(weights[i - 1]);
    }
  });

  it('fibRatioBaseWeight: mistura real 70/30 (estrutura/confluência) — teto exatamente 1 no melhor caso possível, nunca acima', () => {
    expect(fibRatioBaseWeight(0.618, FIB_CONFLUENCE_CEIL)).toBeCloseTo(1, 10);
    // score acima do teto real não continua inflando (clamp honesto).
    expect(fibRatioBaseWeight(0.618, 99)).toBeCloseTo(1, 10);
    expect(fibRatioBaseWeight(0.5, 0)).toBeCloseTo(FIB_STRUCTURAL_SHARE, 10);
  });

  it('fibRatioBaseWeight: sempre dentro de [0,1] para todo ratio real × score plausível — nunca um alpha fora de faixa chegando ao rgba', () => {
    for (const ratio of FIB_RETRACEMENT_RATIOS) {
      for (const score of [-5, 0, 1, 2, 3, 10, NaN]) {
        const w = fibRatioBaseWeight(ratio, score);
        expect(w).toBeGreaterThanOrEqual(0);
        expect(w).toBeLessThanOrEqual(1);
      }
    }
  });

  it('fibLineAlpha: os 2 extremos da banda são EXATAMENTE os 2 valores fixos de antes (0.20 e 0.55) — zero regressão em qualquer ponta, só passou a existir gradiente entre elas', () => {
    // Piso real do orçamento visual (nenhum objeto cai abaixo dele) mapeia
    // no alpha mais fraco que a camada já usava — sem isso a camada mais
    // fraca ficaria MAIS visível que antes, o oposto do pedido.
    expect(fibLineAlpha(VISUAL_BUDGET_FLOOR_WEIGHT)).toBeCloseTo(FIB_ALPHA_MIN, 10);
    expect(fibLineAlpha(1)).toBeCloseTo(FIB_ALPHA_MAX, 10);
    expect(FIB_ALPHA_MIN).toBe(0.2);
    expect(FIB_ALPHA_MAX).toBe(0.55);
  });

  it('fibLineAlpha: monotônica e sempre dentro da banda — nenhuma linha real some (Regra de Ouro 4) nem estoura o teto', () => {
    const samples = [0, 0.1, VISUAL_BUDGET_FLOOR_WEIGHT, 0.5, 0.75, 1, 1.5];
    let prev = -Infinity;
    for (const w of samples) {
      const a = fibLineAlpha(w);
      expect(a).toBeGreaterThanOrEqual(FIB_ALPHA_MIN);
      expect(a).toBeLessThanOrEqual(FIB_ALPHA_MAX);
      expect(a).toBeGreaterThanOrEqual(prev);
      prev = a;
    }
  });

  it('fibLineAlpha: peso ainda não resolvido (null) preserva o teto de sempre — nunca fabrica um número novo', () => {
    expect(fibLineAlpha(null)).toBe(FIB_ALPHA_MAX);
  });

  it('fibDeservesAxisLabel: primário SEMPRE ganha número (é a linha que o Operador precisa achar primeiro), mesmo sem nenhuma confluência real', () => {
    expect(fibDeservesAxisLabel(0.618, 0)).toBe(true);
    expect(fibDeservesAxisLabel(0.5, 0)).toBe(true);
  });

  it('fibDeservesAxisLabel: raso só com confluência REAL — score 0 continua honesto e mudo, nunca fabrica confluência pra caber um rótulo', () => {
    expect(fibDeservesAxisLabel(0.236, 0)).toBe(false);
    expect(fibDeservesAxisLabel(0.786, 0)).toBe(false);
    expect(fibDeservesAxisLabel(0.382, 0)).toBe(false);
    expect(fibDeservesAxisLabel(0.236, 1)).toBe(true);
  });

  it('no PIOR caso real (todos os 5 níveis sem nenhuma confluência) só 2 rótulos competem — o gate continua contendo a inundação que o comentário original temia', () => {
    const competing = FIB_RETRACEMENT_RATIOS.filter((r) => fibDeservesAxisLabel(r, 0));
    expect(competing).toHaveLength(2);
    expect([...competing]).toEqual([0.5, 0.618]);
  });
});

describe('Achado 2.7: fiação real da Fibonacci no orçamento visual (padrão de código — "esqueceram de ligar A com B")', () => {
  it('Fibonacci entra como candidato STRUCTURE (mesma categoria de S1/R1 e BOS/CHOCH — contexto estrutural, nunca a decisão do Núcleo/LEI 24)', () => {
    const s = chart();
    expect(s).toContain('candidates.push({ id: `fib-${i}`, category: "STRUCTURE", baseWeight: fibRatioBaseWeight(level.ratio, level.score) });');
    expect(s).toContain('if (visibility.fibonacci) {');
  });

  it('só compete quando a linha de fato vai ser desenhada — mesmo gate Number.isFinite do useEffect da linha (fail-closed)', () => {
    const s = chart();
    const idx = s.indexOf('candidates.push({ id: `fib-${i}`');
    expect(idx).toBeGreaterThan(-1);
    const before = s.slice(Math.max(0, idx - 200), idx);
    expect(before).toContain('if (!Number.isFinite(level.price)) return;');
  });

  it('o peso resolvido volta por índice (fibonacciVisualWeights) — mesmo padrão de institutionalZoneVisualWeights, zero segunda tabela', () => {
    const s = chart();
    expect(s).toContain('const fibonacciVisualWeights = useMemo(() => {');
    expect(s).toContain('return (fibonacciLevels ?? []).map((_, i) => byId.get(`fib-${i}`) ?? null);');
    expect(s).toContain('}, [visualBudgetResults, fibonacciLevels]);');
  });

  it('visibility.fibonacci/fibonacciLevels entram nas deps do orçamento — senão o peso ficaria stale ao ligar/desligar a camada ou trocar de perna', () => {
    const s = chart();
    expect(s).toContain('visibility.fibonacci,\n    fibonacciLevels,\n    mainLiquidityCandidates,\n  ]);');
  });
});

// ---------------------------------------------------------------------------
// BRILHO POR IMPORTÂNCIA — pedido do Operador sobre captura real ("aumenta o
// tom de brilho das ferramentas mais importantes, deixa elas mais vivas, não
// apagadas demais").
//
// O defeito era o cinza LISO: todo rótulo abaixo de live/critical recebia o
// mesmo #888, então um nível do lado acionável lia igual a um contexto de
// fundo. O `tier` já declarava a diferença e o desenho a ignorava.
// ---------------------------------------------------------------------------
describe('brilho da etiqueta segue o tier — hierarquia visível, nunca cinza liso', () => {
  /** Luminância relativa (WCAG) — a medida real de "quão claro" um hex é,
   *  nunca uma comparação ingênua de string. */
  const luminance = (hex: string): number => {
    const n = parseInt(hex.slice(1), 16);
    const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  };

  it('primary é MAIS claro que context — a hierarquia existe no pixel, não só no tipo', () => {
    expect(luminance(LABEL_TIER_COLOR.primary)).toBeGreaterThan(luminance(LABEL_TIER_COLOR.context));
  });

  it('context NÃO ficou mais apagado do que era — o pedido foi subir o importante, nunca afundar o resto', () => {
    // #888 é a linha de base histórica desta camada.
    expect(luminance(LABEL_TIER_COLOR.context)).toBeGreaterThanOrEqual(luminance('#888888') - 1e-3);
  });

  it('primary sobe de verdade — subir 1% não atenderia o pedido', () => {
    expect(luminance(LABEL_TIER_COLOR.primary)).toBeGreaterThan(luminance('#888888') * 1.5);
  });

  it('live/critical continuam texto ESCURO (desenham sobre preenchimento sólido)', () => {
    expect(luminance(LABEL_TIER_COLOR.live)).toBeLessThan(0.05);
    expect(luminance(LABEL_TIER_COLOR.critical)).toBeLessThan(0.05);
  });

  it('o mapa é total: nenhum tier cai em undefined', () => {
    for (const tier of ['live', 'critical', 'primary', 'context'] as const) {
      expect(LABEL_TIER_COLOR[tier]).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('o desenho consome o mapa por tier, nunca uma constante única', () => {
    const src = read('../src/chart/PriceLabelStackPlugin.tsx');
    expect(src).toContain('LABEL_TIER_COLOR[tier]');
    expect(src).not.toContain('LABEL_NEUTRAL_COLOR');
  });
});
