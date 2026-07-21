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
    expect(block).toContain('ctx.globalAlpha = 0.5;');
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
    expect(plugin()).toContain('if (boxY + LABEL_HEIGHT_PX < 0 || boxY > cssHeight) continue;');
  });

  it('nunca usa Math.random nem qualquer dado sintético (Regra de Ouro 1)', () => {
    expect(plugin()).not.toMatch(/Math\.random/);
  });

  it('a resolução de colisão vem da função pura real (price-label-stack.ts) — nunca uma heurística reinventada aqui', () => {
    expect(plugin()).toContain('import { resolveLabelStackPositions } from "./price-label-stack";');
    expect(plugin()).toContain('resolveLabelStackPositions(withNaturalY, MIN_GAP_PX)');
  });

  it('o gap mínimo real (MIN_GAP_PX) é MAIOR que a altura da caixa (LABEL_HEIGHT_PX) — achado real via harness Playwright: gap igual à altura deixa duas etiquetas ENCOSTADAS (zero sobreposição matemática, mas ilegível/"uma coisa só" visualmente); a folga extra garante uma fresta real e visível', () => {
    const s = plugin();
    expect(s).toContain('const MIN_GAP_PX = LABEL_HEIGHT_PX + 4;');
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

  it('Trade Plan (ENTRY/STOP/TARGET) NUNCA foi tocado — continua axisLabelVisible:true, fora do escopo desta correção (já tem seu próprio mecanismo de compactação, label-compaction.ts)', () => {
    const s = chart();
    const idx = s.indexOf('const mk = (price: number, color: string, title: string) => {');
    const block = s.slice(idx, idx + 300);
    expect(block).toContain('axisLabelVisible: true,');
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

  it('S1/R1 reaproveitam levelTitle (mesma função já usada pelas price lines nativas) — nunca uma segunda formatação', () => {
    const s = chart();
    const idx = s.indexOf('const priceAxisLabels = useMemo');
    const block = s.slice(idx, idx + 1400);
    expect(block).toContain('levelTitle("S1", supportStrength, supportBreakouts)');
    expect(block).toContain('levelTitle("R1", resistanceStrength, resistanceBreakouts)');
    expect(block).toContain('color: "rgba(0, 255, 170, 0.65)"'); // mesma cor real da price line S1
    expect(block).toContain('color: "rgba(255, 0, 85, 0.65)"'); // mesma cor real da price line R1
  });

  it('VWAP/NL reaproveitam LINE_STATE_GLYPH/VWAP_STATE_COLOR/NL_STATE_COLOR reais — mesma paleta institucional já usada pelas séries', () => {
    const s = chart();
    const idx = s.indexOf('const priceAxisLabels = useMemo');
    const block = s.slice(idx, idx + 1700);
    expect(block).toContain('VWAP ${LINE_STATE_GLYPH[s]} ${vwapLastValue.toFixed(2)}');
    expect(block).toContain('color: VWAP_STATE_COLOR[s]');
    expect(block).toContain('NL ${LINE_STATE_GLYPH[s]} ${nlLastValue.toFixed(2)}');
    expect(block).toContain('color: NL_STATE_COLOR[s]');
  });

  it('último preço usa a MESMA cor up/down real da própria série de candles (#00ffaa/#ff0055) — nunca uma cor nova', () => {
    const s = chart();
    const idx = s.indexOf('const priceAxisLabels = useMemo');
    const block = s.slice(idx, idx + 3300);
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
    const block = s.slice(idx, idx + 1300);
    expect(block).toContain('const displayPrice = typeof livePrice === "number" && Number.isFinite(livePrice) ? livePrice : lastCandle.close;');
    expect(block).toContain('price: displayPrice,');
    expect(block).toContain('text: displayPrice.toFixed(2),');
  });

  it('priceAxisLabels recalcula a cada tick real de livePrice — nunca uma etiqueta de preço congelada', () => {
    const s = chart();
    const depsIdx = s.indexOf('}, [support, resistance, supportStrength, resistanceStrength, supportBreakouts, resistanceBreakouts, vwapLastValue, vwapState, visibility.vwap, nlLastValue, nexusLineState, visibility.nexus_line, emaLastValue, activeEmaPeriod, visibility.ema, data, visibility.trend_channel, trendChannelInfo, livePrice]);');
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
    expect(s).toContain('· PRZ · fit ${(top.fitScore * 100).toFixed(0)}% (aderência, nunca probabilidade)');
  });
});
