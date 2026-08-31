// auto-layer-cap.test.ts — "deixa o gráfico mais limpo possível, só com as
// ferramentas mais precisas" (Operador). Execução real: o bug provável aqui é
// "a competição está sutilmente errada", nunca fiação.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  resolveAutoLayerVisibility,
  AUTO_LAYER_MAX_SIMULTANEOUS,
  AUTO_LAYER_PRECISION_ORDER,
  layerVisualCost,
  AUTO_LAYER_MAX_VISUAL_COST,
} from '../src/nexus/layer-relevance';

const rel = (relevant: boolean, emphasis: 'normal' | 'highlight' = 'normal') =>
  ({ relevant, emphasis, reason: relevant ? 'leitura real' : 'sem leitura real' }) as any;

/** Todas as camadas com leitura real ao mesmo tempo — o cenário de mercado
 *  ativo que produzia a poluição. */
const todasRelevantes = () =>
  Object.fromEntries(AUTO_LAYER_PRECISION_ORDER.map((id) => [id, rel(true)]));

describe('resolveAutoLayerVisibility: o teto que faltava', () => {
  it('com TODAS as camadas relevantes, desenha no máximo o teto', () => {
    const out = resolveAutoLayerVisibility(todasRelevantes());
    const visiveis = Object.values(out).filter((d) => d.show);
    // Conferido contra a própria ordem de precisão em vez de um número
    // cravado: uma camada nova entra na lista e este teste continua medindo
    // o que importa (o TETO), não a contagem.
    expect(Object.keys(out)).toHaveLength(AUTO_LAYER_PRECISION_ORDER.length);
    expect(visiveis).toHaveLength(AUTO_LAYER_MAX_SIMULTANEOUS);
  });

  it('quem passa são as MAIS PRECISAS, na ordem declarada', () => {
    const out = resolveAutoLayerVisibility(todasRelevantes());
    const visiveis = Object.entries(out).filter(([, d]) => d.show).map(([id]) => id);
    expect(visiveis.sort()).toEqual(
      AUTO_LAYER_PRECISION_ORDER.slice(0, AUTO_LAYER_MAX_SIMULTANEOUS).slice().sort(),
    );
  });

  it('highlight fura a fila: sinal no extremo vence ordem de precisão', () => {
    // neural_market_aura é a ÚLTIMA da ordem; com highlight real ela entra.
    const r: any = todasRelevantes();
    r.neural_market_aura = rel(true, 'highlight');
    const out = resolveAutoLayerVisibility(r);
    expect(out.neural_market_aura.show).toBe(true);
  });

  it('DISTINGUE "não há o que mostrar" de "há, mas perdeu a competição"', () => {
    // Os dois somem da tela, mas são estados diferentes e não podem virar um só.
    const r: any = todasRelevantes();
    r.cvd = rel(false);
    const out = resolveAutoLayerVisibility(r);
    expect(out.cvd.show).toBe(false);
    expect(out.cvd.suppressedByCap).toBe(false); // não havia leitura
    const perdeu = Object.values(out).find((d) => d.suppressedByCap);
    expect(perdeu).toBeDefined();
    expect(perdeu!.reason).toContain('mais precisas ocupam a tela');
  });

  it('toggle MANUAL do Operador manda mais que o teto — e não gasta orçamento', () => {
    // Decisão humana explícita nunca é suprimida por heurística.
    const out = resolveAutoLayerVisibility(todasRelevantes(), ['kill_zones', 'zigzag']);
    expect(out.kill_zones.show).toBe(true);
    expect(out.zigzag.show).toBe(true);
    expect(out.kill_zones.reason).toContain('manualmente');
    // e as automáticas continuam com o teto cheio, não reduzido pelas manuais
    const auto = Object.entries(out).filter(([id, d]) => d.show && !['kill_zones', 'zigzag'].includes(id));
    expect(auto).toHaveLength(AUTO_LAYER_MAX_SIMULTANEOUS);
  });

  it('poucas camadas relevantes: NADA é suprimido (o teto não inventa escassez)', () => {
    const out = resolveAutoLayerVisibility({
      trade_plan_zone: rel(true),
      vwap: rel(true),
    });
    expect(out.trade_plan_zone.show).toBe(true);
    expect(out.vwap.show).toBe(true);
    expect(Object.values(out).some((d) => d.suppressedByCap)).toBe(false);
  });

  it('camada fora da ordem declarada entra por último, nunca some por omissão', () => {
    const out = resolveAutoLayerVisibility({
      camada_nova_ainda_nao_priorizada: rel(true),
      trade_plan_zone: rel(true),
    });
    expect(out.camada_nova_ainda_nao_priorizada.show).toBe(true); // cabe: só 2 candidatas
  });

  it('fail-closed: teto inválido cai no padrão, nunca em 0 camadas na tela', () => {
    for (const bad of [0, -3, Number.NaN, Infinity]) {
      const visiveis = Object.values(resolveAutoLayerVisibility(todasRelevantes(), [], bad as number))
        .filter((d) => d.show);
      expect(visiveis).toHaveLength(AUTO_LAYER_MAX_SIMULTANEOUS);
    }
  });

  it('determinístico: mesma entrada, mesma saída', () => {
    const r = todasRelevantes();
    expect(resolveAutoLayerVisibility(r)).toEqual(resolveAutoLayerVisibility(r));
  });

  it('Regra de Ouro 4: nenhuma camada é APAGADA — todas aparecem no resultado com razão', () => {
    const out = resolveAutoLayerVisibility(todasRelevantes());
    for (const id of AUTO_LAYER_PRECISION_ORDER) {
      expect(out[id]).toBeDefined();
      expect(out[id].reason.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// ORÇAMENTO POR OBJETO — o teto passou a contar a unidade certa.
//
// ACHADO (reclamação repetida do Operador: "não ficar vários indicadores no
// mesmo lugar", "está muito pesado"): o teto contava CAMADAS, mas o custo
// visual e o peso seguem o número de OBJETOS desenhados. `vwap` são 5 séries
// reais (VWAP + 4 bandas), `trend_channel` são 3, `ema` é 1 — e as três
// ocupavam o mesmo "slot". Seis camadas podiam virar vinte objetos na tela.
// ---------------------------------------------------------------------------
describe('orçamento por objeto — o teto conta o que realmente pesa', () => {
  const rel = (ids: string[], emphasis: 'normal' | 'highlight' = 'normal') =>
    Object.fromEntries(ids.map((id) => [id, { relevant: true, reason: 'leitura real', emphasis }])) as never;

  it('o custo de vwap/trend_channel/candle_patterns é CONTADO no código, não estimado', () => {
    expect(layerVisualCost('vwap')).toBe(5); // VWAP + 4 bandas ±σ
    expect(layerVisualCost('trend_channel')).toBe(3); // mid + upper + lower
    expect(layerVisualCost('candle_patterns')).toBe(4); // MAX_PATTERN_MARKERS
    expect(layerVisualCost('ema')).toBe(1);
  });

  it('camada desconhecida custa 1 — nunca zero (nada é de graça), nunca excluída', () => {
    expect(layerVisualCost('camada_que_nao_existe')).toBe(1);
    expect(layerVisualCost('')).toBe(1);
  });

  it('a soma dos objetos desenhados NUNCA passa do orçamento', () => {
    const todas = AUTO_LAYER_PRECISION_ORDER as unknown as string[];
    const out = resolveAutoLayerVisibility(rel(todas));
    const gasto = Object.entries(out)
      .filter(([, d]) => d.show)
      .reduce((sum, [id]) => sum + layerVisualCost(id), 0);
    expect(gasto).toBeLessThanOrEqual(AUTO_LAYER_MAX_VISUAL_COST);
  });

  it('uma camada CARA que não cabe não trava a fila — uma barata entra no espaço restante', () => {
    // vwap custa 5. Com o orçamento quase cheio ele não entra, mas `ema`
    // (custo 1) ainda deve entrar depois dele.
    const out = resolveAutoLayerVisibility(rel([
      'trade_plan_zone',      // 3
      'structure_breaks',     // 2
      'institutional_zones',  // 2
      'liquidity_zones',      // 3  → 10 gastos
      'vwap',                 // 5  → não cabe (10 + 5 > 12)
      'ema',                  // 1  → cabe (10 + 1 = 11)
    ]));
    expect(out.vwap.show).toBe(false);
    expect(out.ema.show, 'a barata tinha de entrar no espaço que sobrou').toBe(true);
  });

  it('a razão da supressão diz QUAL restrição barrou — custo ou contagem', () => {
    const out = resolveAutoLayerVisibility(rel([
      'trade_plan_zone', 'structure_breaks', 'institutional_zones', 'liquidity_zones', 'vwap',
    ]));
    expect(out.vwap.show).toBe(false);
    expect(out.vwap.suppressedByCap).toBe(true);
    expect(out.vwap.reason).toContain('objetos');
    expect(out.vwap.reason).toContain('orçamento visual');
  });

  it('camada ligada na mão continua sem gastar orçamento nenhum', () => {
    // A camada forçada precisa estar no mapa de relevância — em produção
    // sempre está (o teste de 1:1 com CHART_LAYER_IDS garante isso). Passar
    // um id ausente aqui era erro do fixture, não do motor.
    const out = resolveAutoLayerVisibility(rel(['ema', 'nexus_line', 'vwap']), ['vwap']);
    expect(out.vwap.show).toBe(true);
    expect(out.vwap.suppressedByCap).toBe(false);
    // E as automáticas seguem entrando normalmente.
    expect(out.ema.show).toBe(true);
    expect(out.nexus_line.show).toBe(true);
  });

  it('o orçamento é menor que o pior caso antigo — é esse o ganho', () => {
    // Antes: 6 camadas × até 5 objetos cada = ~20 no pior caso.
    expect(AUTO_LAYER_MAX_VISUAL_COST).toBeLessThan(20);
  });
});

// ---------------------------------------------------------------------------
// FIBONACCI POR TIMEFRAME — pedido do Operador ("cada tempo gráfico que a
// gente abrir, ela tem de fazer um novo mapeamento na análise").
//
// Eu tinha AFIRMADO que já funcionava, olhando as dependências. Afirmação sem
// teste não vale — este é o teste.
// ---------------------------------------------------------------------------
describe('Fibonacci refaz o mapeamento a cada tempo gráfico', () => {
  const app = () => readFileSync(resolve(__dirname, '../src/App.tsx'), 'utf-8');

  it('o produtor da matriz depende de chartData — a série do timeframe ATUAL', () => {
    const src = app();
    const i = src.indexOf('computeRealFibonacciConfluence(chartData, sources,');
    expect(i, 'produtor da confluência Fibonacci não encontrado').toBeGreaterThan(-1);
    // O array de dependências do efeito tem de incluir chartData: é ele que
    // troca quando o Operador muda de tempo gráfico.
    const deps = src.slice(i, i + 1200);
    expect(deps).toContain('}, [chartData,');
    // REFORÇO desta rodada: depender de chartData garante que a série é a do
    // timeframe atual, mas NÃO garantia que o critério da perna mudasse com
    // ele — com FRACTAL_K = 2 fixo, a perna era a menor ondulação possível
    // em 1m e em 1W igualmente. O ATR% real do período agora entra como
    // terceiro argumento e escala o limiar do ZigZag da perna.
    expect(src).toContain('engine?.marketRegime?.atrPercent ?? null),');
    expect(deps).toContain("engine?.marketRegime?.atrPercent");
  });

  it('a matriz é zerada quando não há série real — nunca reaproveita a do timeframe anterior', () => {
    // Sem isso, trocar para um timeframe ainda sem candles mostraria a
    // Fibonacci do tempo gráfico ANTERIOR como se fosse deste.
    const src = app();
    expect(src).toContain('if (!chartData || chartData.length === 0) {');
    expect(src).toContain('setFibonacciConfluence(null);');
  });

  it('os níveis desenhados vêm da store, nunca de um segundo cálculo no chart', () => {
    const src = app();
    expect(src).toContain('const fibonacciMatrix = useFibonacciConfluenceSnapshot();');
    // O mapeamento para o formato do chart é passthrough puro (ratio/price/
    // score reais), sem recalcular nada.
    expect(src).toContain('fibonacciMatrix.levels.map((l) => ({ ratio: l.ratio, price: l.price, score: l.score }))');
  });
});
