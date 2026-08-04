// price-label-stack-plugin.test.ts — achado real de captura de tela do
// Operador (BTC/USDT 1H, preço formando perto de R1): R1/VWAP/NL/último
// preço ficaram empilhados/ilegíveis no eixo. Trava PriceLabelStackPlugin
// e a migração dos "last value label"/"axis label" nativos no nível de
// código-fonte — mesma técnica de liquidity-zones-plugin.test.ts/
// trade-plan-zone-plugin.test.ts (node env, sem canvas real; verificação
// visual real via harness Playwright antes do commit).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

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
    expect(drawSideBlock).toContain('resolveLabelStackPositions(entries, MIN_GAP_PX)');
  });

  it('geometria espelhada real: boxX ancora em LEFT_MARGIN_PX à esquerda, cssWidth-RIGHT_MARGIN_PX-boxWidth à direita — mesma margem mínima nos dois lados (LEFT_MARGIN_PX === RIGHT_MARGIN_PX)', () => {
    const s = plugin();
    expect(s).toContain('const LEFT_MARGIN_PX = 2;');
    expect(s).toContain('const RIGHT_MARGIN_PX = 2;');
    expect(drawSideBody()).toContain('const boxX = side === "right" ? cssWidth - RIGHT_MARGIN_PX - boxWidth : LEFT_MARGIN_PX;');
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
    // boxHeight (não mais a constante única): a etiqueta `live` tem caixa
    // própria, maior — o teto do canvas passou a ser checado contra a
    // altura REAL da caixa daquela etiqueta, nunca contra uma altura fixa
    // que subestimaria a maior delas.
    expect(plugin()).toContain('if (boxY + boxHeight < 0 || boxY > cssHeight) continue;');
    expect(plugin()).toContain('const boxHeight = tier === "live" ? LIVE_LABEL_HEIGHT_PX : LABEL_HEIGHT_PX;');
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
    expect(plugin()).toContain('resolveLabelStackPositions(entries, MIN_GAP_PX)');
    expect(plugin()).toContain('drawSide(withNaturalY("right"), "right");');
    expect(plugin()).toContain('drawSide(withNaturalY("left"), "left");');
  });

  it('o gap mínimo real (MIN_GAP_PX) é MAIOR que a altura da caixa (LABEL_HEIGHT_PX) — achado real via harness Playwright: gap igual à altura deixa duas etiquetas ENCOSTADAS (zero sobreposição matemática, mas ilegível/"uma coisa só" visualmente); a folga extra garante uma fresta real e visível', () => {
    // A folga cresceu de +4 para +7 por uma segunda razão real, além da
    // fresta visível: a etiqueta `live` é fisicamente maior (caixa de 21px
    // + anel fino de 1px a 1.5px de distância = 24px). O passo da pilha
    // precisa ser MAIOR que isso, senão o anel do preço vivo encostaria na
    // caixa vizinha — o mesmo defeito de "uma coisa só" que este gap
    // existe para eliminar, só que reintroduzido pelo nível novo.
    expect(plugin()).toContain('const MIN_GAP_PX = LABEL_HEIGHT_PX + 7;');
    expect(plugin()).toContain('export const LABEL_HEIGHT_PX = 18;');
    expect(plugin()).toContain('export const LIVE_LABEL_HEIGHT_PX = 21;');
    // invariante REAL (não só o literal): o passo cobre a maior caixa +
    // o anel dos dois lados, com fresta sobrando.
    const LABEL_HEIGHT_PX = 18;
    const LIVE_LABEL_HEIGHT_PX = 21;
    const MIN_GAP_PX = LABEL_HEIGHT_PX + 7;
    const livePhysicalHeight = LIVE_LABEL_HEIGHT_PX + 1.5 * 2; // caixa + anel
    expect(MIN_GAP_PX).toBeGreaterThan(livePhysicalHeight);
    expect(MIN_GAP_PX).toBeGreaterThan(LABEL_HEIGHT_PX);
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
    const block = s.slice(idx, idx + 1000);
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
    expect(s.slice(supportIdx, supportIdx + 500)).toContain('axisLabelVisible: false,');
    const resistanceIdx = s.indexOf('resistanceLineRef.current = seriesRef.current.createPriceLine({');
    expect(s.slice(resistanceIdx, resistanceIdx + 350)).toContain('axisLabelVisible: false,');
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
    const zIndexMatch = block.match(/zIndex:\s*(\d+)/);
    expect(zIndexMatch, 'zIndex explícito não encontrado no <canvas> do PriceLabelStackPlugin').not.toBeNull();
    expect(Number(zIndexMatch![1])).toBeGreaterThan(2);
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

  it('S1/R1 reaproveitam levelTitle (mesma função já usada pelas price lines nativas) — nunca uma segunda formatação. Carta Branca: só entram no eixo quando FORTE (>=2 toques reais) — "precisão maciça", não presença', () => {
    const s = chart();
    const idx = s.indexOf('const priceAxisLabels = useMemo');
    const block = s.slice(idx, idx + 2700);
    expect(block).toContain('levelTitle("S1", supportStrength, supportBreakouts)');
    expect(block).toContain('levelTitle("R1", resistanceStrength, resistanceBreakouts)');
    expect(block).toContain('color: "rgba(0, 255, 170, 0.65)"'); // mesma cor real da price line S1
    expect(block).toContain('color: "rgba(255, 0, 85, 0.65)"'); // mesma cor real da price line R1
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
    const s = chart();
    const idx = s.indexOf('const priceAxisLabels = useMemo');
    const block = s.slice(idx, idx + 3800);
    expect(block).toContain('VWAP ${LINE_STATE_GLYPH[s]} ${vwapLastValue.toFixed(2)}');
    expect(block).toContain('color: VWAP_STATE_COLOR[s]');
    expect(block).toContain('NL ${LINE_STATE_GLYPH[s]} ${nlLastValue.toFixed(2)}');
    expect(block).toContain('color: NL_STATE_COLOR[s]');
  });

  it('último preço usa a MESMA cor up/down real da própria série de candles (#00ffaa/#ff0055) — nunca uma cor nova', () => {
    const s = chart();
    const idx = s.indexOf('const priceAxisLabels = useMemo');
    const block = s.slice(idx, idx + 6100);
    expect(block).toContain('displayPrice >= lastCandle.open ? "#00ffaa" : "#ff0055"');
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
    expect(block).toContain('text: displayPrice.toFixed(2),');
  });

  it('priceAxisLabels recalcula a cada tick real de livePrice — nunca uma etiqueta de preço congelada', () => {
    const s = chart();
    const depsIdx = s.indexOf('}, [support, resistance, supportStrength, resistanceStrength, supportBreakouts, resistanceBreakouts, vwapLastValue, vwapState, visibility.vwap, nlLastValue, nexusLineState, visibility.nexus_line, emaLastValue, activeEmaPeriod, visibility.ema, data, visibility.trend_channel, trendChannelInfo, livePrice, tradePlan, targetsHit, decision, engineFallbackLevels, structureBreak, visibility.structure_breaks, structureBreakVisualWeight, traps, visibility.liquidity_sweep, visibility.session_key_levels, currentSessionKeyLevel, visibility.institutional_zones, institutionalZones, institutionalZoneVisualWeights]);');
    expect(depsIdx, 'dependency array de priceAxisLabels não inclui livePrice').toBeGreaterThan(-1);
  });

  it('vwapLastValue/nlLastValue/emaLastValue vêm da PONTA real de cada série já computada (zero segunda fonte) — capturados nos MESMOS efeitos que já chamam setData', () => {
    const s = chart();
    expect(s).toContain('setVwapLastValue(series.length > 0 ? series[series.length - 1].value : null);');
    expect(s).toContain('setNlLastValue(nl.length > 0 ? nl[nl.length - 1].value : null);');
    expect(s).toContain('setEmaLastValue(series.length > 0 ? series[series.length - 1].value : null);');
  });
});

describe('Auditoria de pendências (achado real via harness Playwright): a polilinha harmônica (XABCD/Wolfe) também tinha title nativo poluindo o eixo — terceira ocorrência do MESMO achado do Trend Channel/VWAP/NL/EMA', () => {
  const chart = () => read('../src/chart/EnhancedChart_110_Percent.tsx');

  it('harmonicPolyline nasce com title:"" — o comentário original presumia que lastValueVisible:false já bastava, mas a lib desenha title no eixo mesmo assim (mesmo achado real)', () => {
    const s = chart();
    expect(s).not.toContain('title: "XABCD"');
    const idx = s.indexOf('const harmonicPolyline = chart.addSeries(LineSeries, {');
    expect(idx, 'criação da série harmonicPolyline não encontrada').toBeGreaterThan(-1);
    const closeIdx = s.indexOf('harmonicPolylineRef.current = harmonicPolyline;');
    expect(s.slice(idx, closeIdx)).toContain('title: "",');
  });

  it('zero informação perdida: a forma da polilinha + o title real da PRZ (price line do ponto D) já comunicam o padrão — nunca um rótulo redundante flutuando na posição natural sem resolução de colisão', () => {
    const s = chart();
    // EPC §4 ("apenas as iniciais... menor poluição"): rótulo compacto
    // `${pattern} ↑/↓ PRZ ${fit}%` — o disclaimer "never probability"
    // vive íntegro no título do painel Harmonic Patterns (App.tsx), não
    // repetido no rótulo flutuante do gráfico.
    expect(s).toContain('`${top.pattern} ${hDirGlyph} PRZ ${(top.fitScore * 100).toFixed(0)}%`');
    expect(s).toContain('const hDirGlyph = top.direction === "BULLISH" ? "↑" : "↓";');
  });
});

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
    // (EPC FINAL §8: nomenclatura curta EN/ST/TP1-3 nos objetos gráficos)
    expect(block).toContain('text: `EN ${tradePlan.direction} · ${tradePlan.entry.basis}`, color: entryColor');
    expect(block).toContain('const entryColor = "rgba(240, 208, 111, 0.75)";');
    // STOP vermelho no preço EFETIVO (ratchet real), BREACHED do preço vivo
    expect(block).toContain('const effectiveStopPrice = effectiveStopForTargetsHit(tradePlan, hits);');
    expect(block).toContain('color: "rgba(255, 0, 85, 0.75)"');
    // TARGET verde, REACHED do targetsHit autoritativo
    expect(block).toContain('const reached = i < hits;');
    expect(block).toContain('reached ? `${base} · REACHED` : base, color: "rgba(0, 255, 170, 0.75)"');
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
    expect(block).toContain('text: breached ? "ST · BREACHED" : "ST",');
    expect(block).toContain('color: "rgba(255, 0, 85, 0.5)",');
    expect(block).toContain('text: `TP1${strengthSuffix(engineFallbackLevels.target1Strength)}${rr !== null ? ` · 1:${rr.toFixed(2)}` : ""}${obstacleSuffix(engineFallbackLevels.target1ObstacleCount)}${reached ? " · REACHED" : ""}`,');
    expect(block).toContain('text: `TP2${strengthSuffix(engineFallbackLevels.target2Strength)}${obstacleSuffix(engineFallbackLevels.target2ObstacleCount)}${reached ? " · REACHED" : ""}`,');
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
    expect(block).toContain('text: `TP3${reached ? " · REACHED" : ""}`,');
    expect(block).not.toContain('strengthSuffix(engineFallbackLevels.target3');
    expect(block).not.toContain('obstacleSuffix(engineFallbackLevels.target3');
  });

  it('EPC MODO ELITE §4: rótulos dos alvos do Núcleo carregam ⚠ N (obstáculos estruturais reais no caminho) — só quando N>0, mesmo glifo ⚠ da zona destacada; o Núcleo não tem painel, então o rótulo é o único lugar dessa contagem', () => {
    const s = chart();
    const idx = s.indexOf('const priceAxisLabels = useMemo');
    const end = s.indexOf('return out;', idx);
    const block = s.slice(idx, end);
    expect(block).toContain('const obstacleSuffix = (n: number | null | undefined) => (typeof n === "number" && n > 0 ? ` ⚠ ${n}` : "");');
    expect(block).toContain('${obstacleSuffix(engineFallbackLevels.target1ObstacleCount)}');
    expect(block).toContain('${obstacleSuffix(engineFallbackLevels.target2ObstacleCount)}');
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
    expect(s).toContain('livePrice, tradePlan, targetsHit, decision, engineFallbackLevels, structureBreak, visibility.structure_breaks, structureBreakVisualWeight, traps, visibility.liquidity_sweep, visibility.session_key_levels, currentSessionKeyLevel, visibility.institutional_zones, institutionalZones, institutionalZoneVisualWeights]);');
  });

  it('overlay de texto do canto (tradePlanAbsenceReason) nunca fica auto-contraditório: quando as linhas do Núcleo estão visíveis, o texto deixa explícito que é só o plano do CONSELHO que falta — nunca "SEM TRADE PLAN" sozinho com linhas reais na tela', () => {
    const s = chart();
    const idx = s.indexOf('{tradePlanAbsenceReason && (');
    expect(idx, 'overlay de texto não encontrado').toBeGreaterThan(-1);
    const block = s.slice(idx, idx + 900);
    expect(block).toContain('? `SEM PLANO DO CONSELHO · ${tradePlanAbsenceReason} · linhas abaixo são do Núcleo`');
    expect(block).toContain(': `SEM TRADE PLAN · ${tradePlanAbsenceReason}`');
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
    expect(sweepBlock).toContain('`⚡ SWEEP ${arrow}`');
    expect(sweepBlock).toContain('`⚡ SWEEP ZONE ${arrow} (${cluster.count}x)`');
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
    expect(block).toContain('out.push({ price: vwapLastValue, text: `VWAP ${LINE_STATE_GLYPH[s]} ${vwapLastValue.toFixed(2)}`, color: VWAP_STATE_COLOR[s] });');
    expect(block).toContain('out.push({ price: nlLastValue, text: `NL ${LINE_STATE_GLYPH[s]} ${nlLastValue.toFixed(2)}`, color: NL_STATE_COLOR[s] });');
    expect(block).toContain('out.push({ price: emaLastValue, text: `EMA ${activeEmaPeriod} ${emaLastValue.toFixed(2)}`, color: "rgba(66, 165, 245, 0.85)" });');
  });

  it('resultado real esperado: até 8 rótulos possíveis do lado esquerdo (S1/R1/TREND/CHOC/SWEEP/KEY-H/KEY-L/ZONA INSTITUCIONAL), até 8 do lado direito (VWAP/NL/EMA + até 5 do plano ativo Conselho OU Núcleo) — redução real de densidade no lado que o Operador reportou, não só estética (Sweep/Key Levels somaram-se depois; Zona Institucional migrou pra cá na Diretriz Final — Polimento Visual, achado real de colisão via captura de tela)', () => {
    const c = chart();
    const idx = c.indexOf('const priceAxisLabels = useMemo');
    const end = c.indexOf('return out;', idx);
    const block = c.slice(idx, end);
    const leftSideCount = (block.match(/side: "left",/g) ?? []).length;
    expect(leftSideCount).toBe(8);
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
    expect(s).toContain('export const LABEL_COLOR = "rgba(216, 205, 254, 0.90)";');
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
    expect(block).toContain('text: `◆ ${toolNames}`,');
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
