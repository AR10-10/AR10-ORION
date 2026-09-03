// Fronteira eixo×gráfico — testes de EXECUÇÃO REAL (convenção deste repo:
// lógica pura de fronteira ganha execução real; a fiação nos plugins ganha
// teste de padrão, mais abaixo neste mesmo arquivo).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  resolvePlotArea,
  resolveAxisWidthForLabels,
  PLOT_AXIS_GAP_PX,
  PLOT_AXIS_FALLBACK_WIDTH_PX,
  AXIS_WIDTH_STEP_PX,
  AXIS_WIDTH_MAX_PX,
} from '../src/chart/chart-plot-area';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p: string) => readFileSync(resolve(here, p), 'utf8');

describe('resolvePlotArea: a fronteira real, medida e não suposta', () => {
  // Os números vêm da medição real em Chromium (viewport iPad 834px, mesmas
  // opções de rightPriceScale da produção), documentada no cabeçalho do
  // módulo. Travar o caso medido impede que uma "simplificação" futura
  // volte a mandar o desenho até a borda do container.
  it('caso medido (iPad 834px, eixo real 72px)', () => {
    const a = resolvePlotArea(834, 72);
    expect(a.axisWidth).toBe(72);
    expect(a.axisLeft).toBe(762);
    expect(a.plotRight).toBe(762 - PLOT_AXIS_GAP_PX);
  });

  it('o eixo REAL é mais largo que o minimumWidth — medir importa', () => {
    // 72 medido vs. 65 configurado: a lib cresce o eixo pra caber os
    // dígitos. Um plugin que assumisse o minimumWidth erraria por 7px.
    expect(72).toBeGreaterThan(PLOT_AXIS_FALLBACK_WIDTH_PX);
    expect(resolvePlotArea(834, 72).axisLeft).toBeLessThan(
      resolvePlotArea(834, PLOT_AXIS_FALLBACK_WIDTH_PX).axisLeft,
    );
  });

  it('plotRight fica sempre à ESQUERDA de axisLeft — o desenho nunca alcança o eixo', () => {
    for (const [w, a] of [[834, 72], [1440, 65], [2560, 75], [390, 65]] as const) {
      const r = resolvePlotArea(w, a);
      expect(r.plotRight).toBeLessThan(r.axisLeft);
      expect(r.axisLeft + r.axisWidth).toBe(w);
    }
  });

  // Fail-closed (Regra de Ouro 3): a ausência de medição real nunca pode
  // virar "o gráfico vai até a borda", que é o defeito original.
  it('largura de eixo inválida cai no fallback, NUNCA em 0', () => {
    for (const ruim of [0, -1, NaN, Infinity, undefined as unknown as number]) {
      const r = resolvePlotArea(834, ruim);
      expect(r.axisWidth).toBe(PLOT_AXIS_FALLBACK_WIDTH_PX);
      expect(r.plotRight).toBeLessThan(834);
    }
  });

  it('container inválido não produz coordenada negativa', () => {
    for (const ruim of [0, -100, NaN]) {
      const r = resolvePlotArea(ruim, 72);
      expect(r.plotRight).toBeGreaterThanOrEqual(0);
      expect(r.axisLeft).toBeGreaterThanOrEqual(0);
    }
  });

  it('eixo mais largo que o container: área de plotagem 0, nunca negativa', () => {
    const r = resolvePlotArea(50, 200);
    expect(r.axisWidth).toBe(50);
    expect(r.axisLeft).toBe(0);
    expect(r.plotRight).toBe(0);
  });

  it('a folga padrão é real e maior que zero (a "medida padrão" pedida)', () => {
    expect(PLOT_AXIS_GAP_PX).toBeGreaterThan(0);
    const r = resolvePlotArea(834, 72);
    expect(r.axisLeft - r.plotRight).toBe(PLOT_AXIS_GAP_PX);
  });
});

// ---------------------------------------------------------------------------
// SEGUNDA FRONTEIRA — achado real de auditoria do pedido do Operador ("o
// livro de oferta aparecendo em cima do valor... cada item no seu canto,
// nada cobrindo nada"). Medido em harness Playwright: com as 3 lanes de
// perfil ativas (Volume Profile/TPO/Order Book Depth), SessionKeyLevelsPlugin
// desenhava de x=498 a x=837 num canvas de 900px — cobrindo por completo a
// lane do livro de ofertas (x=594-708). `reservedRightPx` é a reserva
// ADICIONAL (além do eixo) que resolve isso.
// ---------------------------------------------------------------------------
describe('resolvePlotArea(cssWidth, axisWidth, reservedRightPx): a reserva das lanes de perfil, nunca só o eixo', () => {
  it('reservedRightPx ausente (default 0) é IDÊNTICO ao comportamento antigo — aditivo, nunca uma mudança de contrato', () => {
    for (const [w, a] of [[834, 72], [1440, 65], [900, 65]] as const) {
      expect(resolvePlotArea(w, a, 0)).toEqual(resolvePlotArea(w, a));
    }
  });

  it('reservedRightPx real desconta de plotRight, além do eixo', () => {
    const semReserva = resolvePlotArea(900, 65);
    const comReserva = resolvePlotArea(900, 65, 120);
    expect(comReserva.plotRight).toBe(semReserva.plotRight - 120);
    // axisWidth/axisLeft são fronteira do EIXO — a reserva de lane nunca
    // os move, só plotRight (a fronteira de DESENHO).
    expect(comReserva.axisWidth).toBe(semReserva.axisWidth);
    expect(comReserva.axisLeft).toBe(semReserva.axisLeft);
  });

  it('caso medido no harness: 900px de canvas, eixo 65 (fallback), 3 lanes reais somando 0,34 (PROFILE_LANES_MAX_TOTAL_FRACTION) — plotRight cai o suficiente pra nunca mais cruzar a lane do livro de ofertas', () => {
    const r = resolvePlotArea(900, 65, 0.34 * 900);
    // A lane do Order Book Depth (a mais próxima do eixo) começa, no
    // pior caso medido, bem depois de plotRight — nunca mais colide.
    expect(r.plotRight).toBeLessThan(900 * (1 - 0.34));
  });

  it('reservedRightPx negativo é tratado como 0 — nunca EXPANDE plotRight além do que o eixo sozinho permite', () => {
    const semReserva = resolvePlotArea(900, 65);
    for (const ruim of [-1, -100, -Infinity]) {
      expect(resolvePlotArea(900, 65, ruim).plotRight).toBe(semReserva.plotRight);
    }
  });

  it('reservedRightPx não-finito (NaN) é tratado como 0 — fail-closed, nunca um plotRight NaN se propagando pro canvas', () => {
    const r = resolvePlotArea(900, 65, NaN);
    expect(Number.isFinite(r.plotRight)).toBe(true);
    expect(r.plotRight).toBe(resolvePlotArea(900, 65).plotRight);
  });

  it('reserva maior que a área de plotagem inteira: plotRight cai em 0, honesto, nunca negativo', () => {
    const r = resolvePlotArea(900, 65, 10000);
    expect(r.plotRight).toBe(0);
  });
});

describe('resolveAxisWidthForLabels: o eixo ganha a largura do próprio conteúdo', () => {
  // O caso real medido: a etiqueta mais larga do conjunto ("VWAP 68.412,5")
  // tem 90,3px e o eixo mede 72 — 20,3px de invasão nas velas. Alinhar a
  // coluna não resolvia isso; só alargar o eixo resolve.
  it('caso medido: 90,3px de etiqueta num eixo de 72px pede um eixo maior', () => {
    const alvo = resolveAxisWidthForLabels(90.3, 72, 2);
    expect(alvo).not.toBeNull();
    expect(alvo!).toBeGreaterThanOrEqual(90.3 + 2);
    // e o resultado é um degrau inteiro, nunca um número quebrado
    expect(alvo! % AXIS_WIDTH_STEP_PX).toBe(0);
  });

  it('null quando já cabe — o caso comum, e o que evita um applyOptions por frame', () => {
    expect(resolveAxisWidthForLabels(40, 72, 2)).toBeNull();
  });

  // Sem histerese, uma etiqueta oscilando em volta de um degrau faria o eixo
  // (e portanto o gráfico inteiro) alternar de largura sem parar.
  it('histerese: só encolhe quando sobra um degrau INTEIRO', () => {
    // Sobra 4px (76 atual, 72 necessário) — MENOS de um degrau => não mexe.
    // (A primeira versão deste teste usava 80 como largura atual e afirmava
    //  o mesmo; 80-72 é exatamente UM degrau, então o código encolhia e
    //  estava certo. Erro de aritmética meu, não do código.)
    expect(resolveAxisWidthForLabels(70, 76, 2)).toBeNull();
    // Sobra um degrau inteiro ou mais => encolhe.
    expect(resolveAxisWidthForLabels(70, 80, 2)).toBe(72);
    const alvo = resolveAxisWidthForLabels(40, 96, 2);
    expect(alvo).not.toBeNull();
    expect(alvo!).toBeLessThan(96);
  });

  it('teto real: etiqueta patológica não come o gráfico', () => {
    expect(resolveAxisWidthForLabels(5000, 72, 2)).toBe(AXIS_WIDTH_MAX_PX);
  });

  it('piso real: nunca abaixo da largura mínima já configurada em produção', () => {
    const alvo = resolveAxisWidthForLabels(10, 200, 2);
    expect(alvo).toBe(PLOT_AXIS_FALLBACK_WIDTH_PX);
  });

  it('fail-closed: entrada inválida nunca mexe no eixo', () => {
    for (const ruim of [0, -5, NaN, Infinity]) {
      expect(resolveAxisWidthForLabels(ruim, 72, 2)).toBeNull();
    }
    // Margem: só NEGATIVA/não-finita é inválida. Zero é uma margem legítima
    // (colar no canto é uma escolha, não um erro) — e por isso produz um
    // alvo real, nunca null.
    for (const ruim of [-5, NaN, Infinity]) {
      expect(resolveAxisWidthForLabels(90, 72, ruim as number)).toBeNull();
    }
    expect(resolveAxisWidthForLabels(90, 72, 0)).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// FIAÇÃO — teste de padrão. O bug provável aqui não é "a conta está errada"
// (a conta está travada acima), é "esqueceram de ligar um plugin".
// ---------------------------------------------------------------------------
const PLUGINS_QUE_DESENHAM_ATE_A_BORDA = [
  'InstitutionalZonePlugin.tsx',
  'LiquidityZonesPlugin.tsx',
  'NeuralMarketAuraPlugin.tsx',
  'SessionKeyLevelsPlugin.tsx',
  'StructureBreakMarkersPlugin.tsx',
  'TradePlanZonePlugin.tsx',
  'PriceLabelStackPlugin.tsx',
  // 3 achados reais de auditoria (rodada de acessibilidade da navegação/
  // gráfico): estes três plugins já chamavam measurePlotArea/plotRight
  // desde que foram graduados, mas nunca entraram nesta lista curada —
  // exatamente a classe "declaração ≠ realidade" que este arquivo inteiro
  // existe pra prevenir, só que na própria lista de verificação.
  'HarmonicGeometryPlugin.tsx',
  'LiquiditySweepLinesPlugin.tsx',
  'AndrewsPitchforkPlugin.tsx',
];

// Achado real (auditoria do pedido do Operador "cada item no seu canto,
// nada cobrindo nada", medido em harness Playwright — ver header da
// segunda descrição de resolvePlotArea acima): destes, todos MENOS
// PriceLabelStackPlugin (que não usa plotRight — só axisLeft/axisWidth
// pra ancorar rótulos, ver seu próprio import) competem pela MESMA faixa
// que Volume Profile/TPO/Order Book Depth reservam à direita — então
// precisam de activeLanes pra measurePlotArea descontar essa reserva.
const PLUGINS_QUE_COMPETEM_PELA_LANE_DE_PERFIL = PLUGINS_QUE_DESENHAM_ATE_A_BORDA.filter(
  (f) => f !== 'PriceLabelStackPlugin.tsx',
);

describe('todo plugin que desenha até a borda direita usa a fronteira medida', () => {
  it.each(PLUGINS_QUE_DESENHAM_ATE_A_BORDA)('%s importa e usa measurePlotArea', (arquivo) => {
    const src = read(`../src/chart/${arquivo}`);
    expect(src, `${arquivo} não importa chart-plot-area`).toContain('chart-plot-area');
    expect(src, `${arquivo} não chama measurePlotArea`).toContain('measurePlotArea');
  });

  // Guarda anti-vacuidade: se alguém renomear os arquivos, a lista acima
  // vira uma varredura que não acha nada e passaria calada.
  it('a lista acima aponta para arquivos que existem de verdade', () => {
    expect(PLUGINS_QUE_DESENHAM_ATE_A_BORDA.length).toBeGreaterThanOrEqual(7);
    for (const arquivo of PLUGINS_QUE_DESENHAM_ATE_A_BORDA) {
      expect(read(`../src/chart/${arquivo}`).length).toBeGreaterThan(500);
    }
  });

  // O defeito original, travado pelo nome: desenhar até `cssWidth` é
  // exatamente correr por baixo dos números do eixo.
  it('nenhum deles ainda desenha uma borda direita em cssWidth cru', () => {
    for (const arquivo of PLUGINS_QUE_DESENHAM_ATE_A_BORDA) {
      const src = read(`../src/chart/${arquivo}`);
      for (const padrao of [/lineTo\(cssWidth[,)]/, /fillRect\(0,[^)]*cssWidth[,)]/, /=\s*cssWidth\s*-\s*rectX/]) {
        expect(padrao.test(src), `${arquivo} ainda usa ${padrao} — volta a vazar sob o eixo`).toBe(false);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Achado real de auditoria (harness Playwright, pedido do Operador "o
// livro de oferta aparecendo em cima do valor... cada item no seu canto"):
// medindo os DOIS canvases reais (DepthChartPlugin + SessionKeyLevelsPlugin)
// com as 3 lanes de perfil ativas, SessionKeyLevelsPlugin desenhava de
// x=498 a x=837 num canvas de 900px — cobrindo por completo a lane real do
// livro de ofertas (x=594-708, medida no MESMO canvas). Só
// OrderFlowHeatmapPlugin (getChartBodyBounds) respeitava a reserva das
// lanes; os outros 9 consumidores de measurePlotArea iam até plotRight
// puro (só o eixo). Depois da correção, medido de novo: SessionKeyLevelsPlugin
// cai pra x=498-531 — nunca mais alcança a lane do livro de ofertas.
// ---------------------------------------------------------------------------
describe('cada plugin que compete pela lane de perfil agora passa activeLanes pra measurePlotArea', () => {
  it.each(PLUGINS_QUE_COMPETEM_PELA_LANE_DE_PERFIL)('%s declara activeLanes na prop e nunca chama measurePlotArea sem ele', (arquivo) => {
    const src = read(`../src/chart/${arquivo}`);
    expect(src, `${arquivo} não declara activeLanes na interface de props`).toContain(
      'activeLanes?: readonly ChartProfileLaneId[];',
    );
    expect(src, `${arquivo} não importa ChartProfileLaneId`).toContain(
      'import type { ChartProfileLaneId } from "./chart-profile-lanes";',
    );
    // Nenhuma chamada bare — todas as ocorrências de measurePlotArea(chart,
    // cssWidth) reais deste arquivo devem ter um 3º argumento.
    const chamadasBare = src.match(/measurePlotArea\(chart,\s*cssWidth\)/g) ?? [];
    expect(chamadasBare, `${arquivo} ainda tem measurePlotArea(chart, cssWidth) sem activeLanes`).toEqual([]);
  });
});

describe('EnhancedChart_110_Percent.tsx: os 9 plugins recebem activeProfileLanes de verdade, nunca só a prop declarada', () => {
  const enhancedChart = () => read('../src/chart/EnhancedChart_110_Percent.tsx');

  it.each([
    'SessionKeyLevelsPlugin',
    'LiquidityZonesPlugin',
    'StructureBreakMarkersPlugin',
    'LiquiditySweepLinesPlugin',
    'HarmonicGeometryPlugin',
    'InstitutionalZonePlugin',
    'AndrewsPitchforkPlugin',
    'NeuralMarketAuraPlugin',
    'TradePlanZonePlugin',
  ])('<%s ... /> é montado com activeLanes={activeProfileLanes}', (componente) => {
    const src = enhancedChart();
    const idx = src.indexOf(`<${componente}\n`);
    expect(idx, `<${componente} não encontrado`).toBeGreaterThan(-1);
    const fimTag = src.indexOf('/>', idx);
    expect(fimTag, `fechamento de <${componente} não encontrado`).toBeGreaterThan(idx);
    const bloco = src.slice(idx, fimTag);
    expect(bloco, `<${componente} não recebe activeLanes`).toContain('activeLanes={activeProfileLanes}');
  });
});
