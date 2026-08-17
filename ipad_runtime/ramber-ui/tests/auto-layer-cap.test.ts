// auto-layer-cap.test.ts — "deixa o gráfico mais limpo possível, só com as
// ferramentas mais precisas" (Operador). Execução real: o bug provável aqui é
// "a competição está sutilmente errada", nunca fiação.
import { describe, it, expect } from 'vitest';
import {
  resolveAutoLayerVisibility,
  AUTO_LAYER_MAX_SIMULTANEOUS,
  AUTO_LAYER_PRECISION_ORDER,
} from '../src/nexus/layer-relevance';

const rel = (relevant: boolean, emphasis: 'normal' | 'highlight' = 'normal') =>
  ({ relevant, emphasis, reason: relevant ? 'leitura real' : 'sem leitura real' }) as any;

/** Todas as 25 camadas com leitura real ao mesmo tempo — o cenário de mercado
 *  ativo que produzia a poluição. */
const todasRelevantes = () =>
  Object.fromEntries(AUTO_LAYER_PRECISION_ORDER.map((id) => [id, rel(true)]));

describe('resolveAutoLayerVisibility: o teto que faltava', () => {
  it('com TODAS as 25 camadas relevantes, desenha no máximo o teto', () => {
    const out = resolveAutoLayerVisibility(todasRelevantes());
    const visiveis = Object.values(out).filter((d) => d.show);
    expect(Object.keys(out)).toHaveLength(25);
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
