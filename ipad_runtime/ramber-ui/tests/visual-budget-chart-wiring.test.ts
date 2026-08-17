// visual-budget-chart-wiring.test.ts — Ordem Oficial de Execução Nº 03
// ("Implementação Operacional"): trava a primeira graduação real de
// nexus/visual-budget.ts (Diretriz Nº 02, construído isolado/testado na
// rodada anterior, zero consumidor vivo até esta rodada) — teste de
// padrão no código-fonte (convenção deste repo para fiação entre
// módulos), não de execução: a matemática pura de resolveVisualBudget já
// tem sua própria suíte de execução real em visual-budget.test.ts.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');
const chart = () => read('../src/chart/EnhancedChart_110_Percent.tsx');
const institutionalZonePlugin = () => read('../src/chart/InstitutionalZonePlugin.tsx');
const tradePlanZonePlugin = () => read('../src/chart/TradePlanZonePlugin.tsx');
const structureBreakMarkersPlugin = () => read('../src/chart/StructureBreakMarkersPlugin.tsx');
const liquidityZonesPlugin = () => read('../src/chart/LiquidityZonesPlugin.tsx');

describe('InstitutionalZonePlugin.tsx: confluenceWeight exportado + visualWeights real usado com fallback fail-closed', () => {
  it('exporta confluenceWeight (mesma função, zero segunda fórmula) para o chart reusar como baseWeight', () => {
    expect(institutionalZonePlugin()).toContain('export function confluenceWeight(distinctSourceCount: number): number {');
  });

  it('aceita visualWeights (peso já resolvido pela competição cruzada), paralelo a zones por índice', () => {
    const s = institutionalZonePlugin();
    expect(s).toContain('visualWeights?: (number | undefined)[];');
    // livePrice (Ordem "Lapidação Visual Final + Nova Linguagem de
    // Gráfico" §3 — intensidade real por proximidade ao preço): 4º prop,
    // assinatura re-fixada.
    expect(s).toContain('export function InstitutionalZonePlugin({ chart, series, zones, visualWeights, livePrice }: InstitutionalZonePluginProps) {');
  });

  it('o loop de desenho usa visualWeights[i] quando real (!== undefined); cai em confluenceWeight isolado (comportamento pré-Ordem 03) quando ausente — nunca um valor fabricado', () => {
    const s = institutionalZonePlugin();
    expect(s).toContain('const resolvedWeight = currentVisualWeights?.[i];');
    // baseWeight (renomeado de weight): §3 multiplica por proximityFactor
    // — a garantia original (fallback fail-closed para confluenceWeight
    // isolado quando visualWeights não resolveu) continua idêntica, só
    // ganhou um segundo fator real e independente depois.
    expect(s).toContain('const baseWeight = resolvedWeight !== undefined ? resolvedWeight : confluenceWeight(zone.distinctSourceCount);');
    expect(s).toContain('const weight = baseWeight * proximityFactor(zone.centerPrice, livePriceRef.current);');
  });

  it('visualWeights entra no dirty-check (useEffect deps) igual a zones — uma resolução de orçamento nova redesenha', () => {
    // livePrice entrou no mesmo dirty-check (§3): um tick real de preço
    // que cruza um limiar de proximidade também precisa redesenhar.
    expect(institutionalZonePlugin()).toContain('}, [zones, visualWeights, livePrice]);');
  });
});

describe('EnhancedChart_110_Percent.tsx: resolveVisualBudget real — candidatos só das 2 categorias que já tinham peso próprio antes desta rodada', () => {
  it('importa resolveVisualBudget/VisualBudgetCandidate de nexus/visual-budget (zero segunda implementação)', () => {
    expect(chart()).toContain('import { resolveVisualBudget, VISUAL_BUDGET_FLOOR_WEIGHT, type VisualBudgetCandidate } from "../nexus/visual-budget";');
  });

  it('importa confluenceWeight do InstitutionalZonePlugin e opacityMultiplierFor do TradePlanZonePlugin — zero segunda fórmula de peso', () => {
    const s = chart();
    expect(s).toContain('import { InstitutionalZonePlugin, LABEL_COLOR as INSTITUTIONAL_ZONE_LABEL_COLOR, confluenceWeight } from "./InstitutionalZonePlugin";');
    expect(s).toContain('import { TradePlanZonePlugin, opacityMultiplierFor } from "./TradePlanZonePlugin";');
  });

  it('hasTradePlanZone usa a MESMA regra de "existe zona real" já usada pelo próprio TradePlanZonePlugin (low/high finitos e distintos) — nunca uma segunda regra', () => {
    const s = chart();
    const block = s.slice(s.indexOf('const hasTradePlanZone ='), s.indexOf('const visualBudgetResults = useMemo'));
    expect(block).toContain('tradePlan != null');
    expect(block).toContain('Number.isFinite(tradePlan.entry.low)');
    expect(block).toContain('Number.isFinite(tradePlan.entry.high)');
    expect(block).toContain('tradePlan.entry.low !== tradePlan.entry.high');
  });

  it('candidatos INSTITUTIONAL_ZONE só entram quando visibility.institutional_zones — camada desligada não compete por orçamento que não desenha nada', () => {
    const s = chart();
    const block = s.slice(s.indexOf('const visualBudgetResults = useMemo'), s.indexOf('const institutionalZoneVisualWeights = useMemo'));
    expect(block).toContain('if (visibility.institutional_zones) {');
    expect(block).toContain("candidates.push({ id: `zone-${i}`, category: \"INSTITUTIONAL_ZONE\", baseWeight: confluenceWeight(zone.distinctSourceCount) });");
  });

  it('candidato TRADE_PLAN usa exatamente opacityMultiplierFor(confidenceZone ?? null) — mesma entrada real que o plugin já recebia antes desta rodada', () => {
    const s = chart();
    const block = s.slice(s.indexOf('const visualBudgetResults = useMemo'), s.indexOf('const institutionalZoneVisualWeights = useMemo'));
    expect(block).toContain('if (hasTradePlanZone) {');
    expect(block).toContain('candidates.push({ id: "trade-plan", category: "TRADE_PLAN", baseWeight: opacityMultiplierFor(confidenceZone ?? null) });');
  });

  it('resolve via resolveVisualBudget(candidates) — nunca um segundo algoritmo de competição', () => {
    const s = chart();
    const block = s.slice(s.indexOf('const visualBudgetResults = useMemo'), s.indexOf('const institutionalZoneVisualWeights = useMemo'));
    expect(block).toContain('return resolveVisualBudget(candidates);');
  });

  it('institutionalZoneVisualWeights: passthrough por id real (zone-${i}), nunca por posição bruta do resultado (resolveVisualBudget reordena por prioridade)', () => {
    const s = chart();
    const block = s.slice(s.indexOf('const institutionalZoneVisualWeights = useMemo'), s.indexOf('const tradePlanVisualWeight = useMemo'));
    expect(block).toContain('const byId = new Map(visualBudgetResults.map((r) => [r.id, r.visualWeight]));');
    expect(block).toContain('return institutionalZones.map((_, i) => byId.get(`zone-${i}`));');
  });

  it('tradePlanVisualWeight: null explícito quando não há candidato real (sem plano ativo) — nunca um peso fabricado', () => {
    const s = chart();
    expect(s).toContain('() => visualBudgetResults.find((r) => r.id === "trade-plan")?.visualWeight ?? null,');
  });
});

describe('EnhancedChart_110_Percent.tsx: props reais threaded para os 2 plugins — peso resolvido, nunca recalculado 2x', () => {
  it('InstitutionalZonePlugin recebe visualWeights={institutionalZoneVisualWeights}', () => {
    const s = chart();
    const idx = s.indexOf('<InstitutionalZonePlugin');
    const block = s.slice(idx, s.indexOf('/>', idx));
    expect(block).toContain('zones={institutionalZones}');
    expect(block).toContain('visualWeights={institutionalZoneVisualWeights}');
  });

  it('TradePlanZonePlugin recebe visualWeight={tradePlanVisualWeight}', () => {
    const s = chart();
    const idx = s.indexOf('<TradePlanZonePlugin');
    const block = s.slice(idx, s.indexOf('/>', idx));
    expect(block).toContain('confidenceZone={confidenceZone ?? null}');
    expect(block).toContain('visualWeight={tradePlanVisualWeight}');
  });
});

describe('TradePlanZonePlugin.tsx: opacityMultiplierFor exportado (Ordem Nº 03, zero segunda fórmula reusada pelo chart)', () => {
  it('exporta a função, corpo intocado', () => {
    const s = tradePlanZonePlugin();
    expect(s).toContain('export function opacityMultiplierFor(zone: InstitutionalConfidenceZone | null): number {');
    expect(s).toContain('return zone ? OPACITY_BY_TIER[zone.tier] : DEFAULT_OPACITY_MULTIPLIER;');
  });
});

// Evolução Visual (continuidade da Ordem Nº 03): 3ª categoria real do
// orçamento visual — STRUCTURE (BOS/CHOCH). Mesmo padrão exato das duas
// categorias anteriores (INSTITUTIONAL_ZONE/TRADE_PLAN): peso PRÓPRIO já
// real (ageAlpha/BREAK_DECAY) entra como baseWeight, resolveVisualBudget
// decide o resto, plugin usa o resultado com fallback fail-closed.
describe('StructureBreakMarkersPlugin.tsx: aceita visualWeight real com fallback fail-closed para ageAlpha(age, BREAK_DECAY) isolado', () => {
  it('nova prop visualWeight documentada e aceita pelo componente', () => {
    const s = structureBreakMarkersPlugin();
    expect(s).toContain('visualWeight?: number | null;');
    expect(s).toContain(
      'export function StructureBreakMarkersPlugin({ chart, series, data, structureBreak, visualWeight }: StructureBreakMarkersPluginProps) {',
    );
  });

  it('o loop de desenho usa resolvedWeight quando real (!== undefined/null); cai em ageAlpha(age, BREAK_DECAY) isolado (comportamento pré-existente) quando ausente', () => {
    const s = structureBreakMarkersPlugin();
    expect(s).toContain(
      'const alpha = resolvedWeight !== undefined && resolvedWeight !== null ? resolvedWeight : ageAlpha(age, BREAK_DECAY);',
    );
  });

  it('visualWeight entra no ref/dirty-check igual a structureBreak/data — uma resolução de orçamento nova redesenha', () => {
    const s = structureBreakMarkersPlugin();
    expect(s).toContain('const stateRef = useRef({ structureBreak, data, visualWeight });');
    expect(s).toContain('stateRef.current = { structureBreak, data, visualWeight };');
    expect(s).toContain('}, [structureBreak, data, visualWeight]);');
  });
});

describe('EnhancedChart_110_Percent.tsx: candidato STRUCTURE real — mesma fórmula do rótulo BOS/CHOCH em priceAxisLabels, zero segunda curva de decaimento', () => {
  it('structureBreakBaseWeight usa a MESMA fórmula age/ageAlpha/BREAK_DECAY já usada pelo rótulo em priceAxisLabels', () => {
    const s = chart();
    const idx = s.indexOf('const structureBreakBaseWeight = useMemo(');
    expect(idx, 'structureBreakBaseWeight não encontrado').toBeGreaterThan(-1);
    const block = s.slice(idx, s.indexOf('const visualBudgetResults = useMemo', idx));
    expect(block).toContain('if (!visibility.structure_breaks || !structureBreak) return null;');
    expect(block).toContain('const age = data.length - 1 - structureBreak.index;');
    expect(block).toContain('const alpha = ageAlpha(age, BREAK_DECAY);');
  });

  it('candidato STRUCTURE só entra no orçamento quando structureBreakBaseWeight é real (não null)', () => {
    const s = chart();
    const block = s.slice(s.indexOf('const visualBudgetResults = useMemo'), s.indexOf('const institutionalZoneVisualWeights = useMemo'));
    expect(block).toContain('if (structureBreakBaseWeight !== null) {');
    expect(block).toContain('candidates.push({ id: "structure-break", category: "STRUCTURE", baseWeight: structureBreakBaseWeight });');
  });

  it('StructureBreakMarkersPlugin recebe visualWeight={structureBreakVisualWeight}', () => {
    const s = chart();
    const idx = s.indexOf('<StructureBreakMarkersPlugin');
    const block = s.slice(idx, s.indexOf('/>', idx));
    expect(block).toContain('structureBreak={structureBreak ?? null}');
    expect(block).toContain('visualWeight={structureBreakVisualWeight}');
  });
});

// Ordem Nº 04 (§4/§5): 4ª categoria real — MAIN_LIQUIDITY (FVG/Order
// Blocks não-obstáculo, LiquidityZonesPlugin.tsx). Mesmo padrão das 3
// categorias anteriores, com uma regra nova: zona-obstáculo (Diretriz
// Restauração/Inteligência Visual §6 — alpha=1 GARANTIDO enquanto
// bloqueia o caminho do plano ativo) fica FORA da competição de
// propósito, nunca reduzida pelo orçamento visual.
describe('LiquidityZonesPlugin.tsx: ZONE_DECAY exportado + fvgVisualWeights/obVisualWeights com fallback fail-closed', () => {
  it('exporta ZONE_DECAY (mesma curva, zero segunda config de decaimento) para o chart reusar', () => {
    expect(liquidityZonesPlugin()).toContain(
      'export const ZONE_DECAY: DecayConfig = { fadeStartCandles: 30, expireCandles: 100, minAlpha: 0.15 };',
    );
  });

  it('aceita fvgVisualWeights/obVisualWeights (peso já resolvido pela competição cruzada), paralelo a cada array por índice', () => {
    const s = liquidityZonesPlugin();
    expect(s).toContain('fvgVisualWeights?: (number | undefined)[];');
    expect(s).toContain('obVisualWeights?: (number | undefined)[];');
    expect(s).toContain(
      'export function LiquidityZonesPlugin({ chart, series, data, fairValueGaps, orderBlocks, liquidityVoids, obstacleZones, fvgVisualWeights, obVisualWeights, voidVisualWeights }: LiquidityZonesPluginProps) {',
    );
    // Liquidity Void (liquidity-void-engine.js) ainda NÃO entra na
    // competição cruzada de orçamento visual — v1 escopado de propósito;
    // undefined cai no MESMO fallback fail-closed de ageAlpha isolado que
    // fvg/obVisualWeights já tinham antes de entrarem no orçamento.
    expect(s).toContain('voidVisualWeights?: (number | undefined)[];');
  });

  it('resolveAlpha: zona-obstáculo SEMPRE alpha=1, ignora resolvedWeight de propósito — a garantia de risco real nunca se dobra ao orçamento (Ordem de Fechamento: a lógica que era inline em drawZone virou resolveAlpha, resolvida 1x por zona bruta ANTES da fusão — mesma regra exata)', () => {
    const s = liquidityZonesPlugin();
    expect(s).toContain(
      'return isObstacleZone ? 1 : resolvedWeight !== undefined && resolvedWeight !== null ? resolvedWeight : ageAlpha(age, ZONE_DECAY);',
    );
  });

  it('drawGroup passa o peso resolvido por índice para resolveAlpha (fvgWeights?.[i] / obWeights?.[i]) ao montar cada FusableZoneInput — mesma garantia de antes, agora por zona bruta pré-fusão (Ordem de Fechamento: fuseLiquidityZones funde zonas próximas/sobrepostas do mesmo kind+type, "não ficar poluído... marca certeira")', () => {
    const s = liquidityZonesPlugin();
    expect(s).toContain(
      'fusable.push({ top: z.top, bottom: z.bottom, index: z.index, isObstacle: obstacle, alpha: resolveAlpha(z, obstacle, weights?.[i]) });',
    );
    expect(s).toContain('drawGroup(fvgs, fvgWeights, "FVG", "BULLISH");');
    expect(s).toContain('drawGroup(fvgs, fvgWeights, "FVG", "BEARISH");');
    expect(s).toContain('drawGroup(obs, obWeights, "OB", "BULLISH");');
    expect(s).toContain('drawGroup(obs, obWeights, "OB", "BEARISH");');
    // Liquidity Void reusa a MESMA maquinaria de fusão/desenho (3º kind),
    // nunca um segundo caminho de render — `voids ?? []` mantém o
    // fail-closed real quando a camada ainda não tem dado.
    expect(s).toContain('drawGroup(voids ?? [], voidWeights, "VOID", "BULLISH");');
    expect(s).toContain('drawGroup(voids ?? [], voidWeights, "VOID", "BEARISH");');
  });

  it('fvgVisualWeights/obVisualWeights/voidVisualWeights entram no ref/dirty-check igual a fairValueGaps/orderBlocks/liquidityVoids — uma resolução de orçamento nova redesenha', () => {
    const s = liquidityZonesPlugin();
    expect(s).toContain(
      'const zonesRef = useRef({ fairValueGaps, orderBlocks, liquidityVoids, data, obstacleZones, fvgVisualWeights, obVisualWeights, voidVisualWeights });',
    );
    expect(s).toContain(
      'zonesRef.current = { fairValueGaps, orderBlocks, liquidityVoids, data, obstacleZones, fvgVisualWeights, obVisualWeights, voidVisualWeights };',
    );
    expect(s).toContain('}, [fairValueGaps, orderBlocks, liquidityVoids, data, obstacleZones, fvgVisualWeights, obVisualWeights, voidVisualWeights]);');
  });
});

describe('EnhancedChart_110_Percent.tsx: candidato MAIN_LIQUIDITY real — mesma ZONE_DECAY do plugin, zonas-obstáculo excluídas da competição', () => {
  it('importa ZONE_DECAY de LiquidityZonesPlugin — zero segunda curva de decaimento', () => {
    expect(chart()).toContain('import { LiquidityZonesPlugin, ZONE_DECAY, type FillableZone } from "./LiquidityZonesPlugin";');
  });

  it('mainLiquidityCandidates: gated por visibility.liquidity_zones, zona-obstáculo vira null (nunca candidato)', () => {
    const s = chart();
    const idx = s.indexOf('const mainLiquidityCandidates = useMemo(');
    expect(idx, 'mainLiquidityCandidates não encontrado').toBeGreaterThan(-1);
    const block = s.slice(idx, s.indexOf('const visualBudgetResults = useMemo', idx));
    expect(block).toContain("if (!visibility.liquidity_zones) return { fvg: [] as (number | null)[], ob: [] as (number | null)[] };");
    expect(block).toContain('const isObstacle = (zone: EnhancedChartZone) => obstacles.some((o) => o.low === zone.bottom && o.high === zone.top);');
    expect(block).toContain('if (isObstacle(zone)) return null;');
    expect(block).toContain('const alpha = ageAlpha(age, ZONE_DECAY);');
  });

  it('candidatos MAIN_LIQUIDITY (fvg/ob) só entram no orçamento quando o peso base é real (não null)', () => {
    const s = chart();
    const block = s.slice(s.indexOf('const visualBudgetResults = useMemo'), s.indexOf('const institutionalZoneVisualWeights = useMemo'));
    expect(block).toContain('mainLiquidityCandidates.fvg.forEach((w, i) => {');
    expect(block).toContain('if (w !== null) candidates.push({ id: `liquidity-fvg-${i}`, category: "MAIN_LIQUIDITY", baseWeight: w });');
    expect(block).toContain('mainLiquidityCandidates.ob.forEach((w, i) => {');
    expect(block).toContain('if (w !== null) candidates.push({ id: `liquidity-ob-${i}`, category: "MAIN_LIQUIDITY", baseWeight: w });');
  });

  it('mainLiquidityVisualWeights: passthrough por id real (liquidity-fvg-${i}/liquidity-ob-${i}), nunca por posição bruta do resultado', () => {
    const s = chart();
    const idx = s.indexOf('const mainLiquidityVisualWeights = useMemo(');
    expect(idx, 'mainLiquidityVisualWeights não encontrado').toBeGreaterThan(-1);
    const block = s.slice(idx, idx + 400);
    expect(block).toContain('const byId = new Map(visualBudgetResults.map((r) => [r.id, r.visualWeight]));');
    expect(block).toContain('fvg: (fairValueGaps ?? []).map((_, i) => byId.get(`liquidity-fvg-${i}`)),');
    expect(block).toContain('ob: (orderBlocks ?? []).map((_, i) => byId.get(`liquidity-ob-${i}`)),');
  });

  it('LiquidityZonesPlugin recebe fvgVisualWeights/obVisualWeights reais', () => {
    const s = chart();
    const idx = s.indexOf('<LiquidityZonesPlugin');
    const block = s.slice(idx, s.indexOf('/>', idx));
    expect(block).toContain('fairValueGaps={(fairValueGaps ?? []) as FillableZone[]}');
    expect(block).toContain('orderBlocks={(orderBlocks ?? []) as FillableZone[]}');
    expect(block).toContain('fvgVisualWeights={mainLiquidityVisualWeights.fvg}');
    expect(block).toContain('obVisualWeights={mainLiquidityVisualWeights.ob}');
  });
});

// Evolução Total ("um objeto, um peso"): as ETIQUETAS do eixo seguem o
// mesmo peso resolvido pelo orçamento visual que os objetos que elas
// nomeiam — antes, orçamento reduzia o marcador/faixa mas a etiqueta
// continuava na curva/opacidade isolada própria (um objeto, dois pesos).
describe('priceAxisLabels: etiquetas seguem o peso resolvido do orçamento visual (nunca um segundo peso para o mesmo objeto)', () => {
  it('BOS/CHOCH: etiqueta usa structureBreakVisualWeight (fallback ageAlpha isolado) — mesmo peso do marcador', () => {
    const s = chart();
    const idx = s.indexOf('const priceAxisLabels = useMemo');
    const block = s.slice(idx, s.indexOf('return out;', idx));
    expect(block).toContain('const alpha = structureBreakVisualWeight ?? ageAlpha(age, BREAK_DECAY);');
  });

  it('BOS/CHOCH: bloco da etiqueta ganhou gate real de visibility.structure_breaks (era o ÚNICO bloco do eixo sem gate — linha sumia com o toggle, etiqueta ficava)', () => {
    const s = chart();
    const idx = s.indexOf('const priceAxisLabels = useMemo');
    const block = s.slice(idx, s.indexOf('return out;', idx));
    expect(block).toContain('if (visibility.structure_breaks && structureBreak) {');
    expect(block).not.toContain('\n    if (structureBreak) {');
  });

  it('Zona Institucional: etiqueta segue a REDUÇÃO da faixa — razão peso resolvido/peso próprio (1 sem competição, nunca zero: piso real 0.35 no motor)', () => {
    const s = chart();
    const idx = s.indexOf('const priceAxisLabels = useMemo');
    const block = s.slice(idx, s.indexOf('return out;', idx));
    expect(block).toContain('institutionalZones.forEach((zone, i) => {');
    expect(block).toContain('const base = confluenceWeight(zone.distinctSourceCount);');
    expect(block).toContain('const resolved = institutionalZoneVisualWeights[i];');
    expect(block).toContain('const alpha = resolved !== undefined && base > 0 ? Math.min(1, resolved / base) : 1;');
  });

  it('deps reais do useMemo incluem os pesos resolvidos e o gate novo — etiqueta nunca fica stale quando o orçamento re-resolve', () => {
    const s = chart();
    const idx = s.indexOf('const priceAxisLabels = useMemo');
    const depsIdx = s.indexOf('}, [support, resistance,', idx);
    const deps = s.slice(depsIdx, s.indexOf(']);', depsIdx));
    expect(deps).toContain('structureBreakVisualWeight');
    expect(deps).toContain('visibility.structure_breaks');
    expect(deps).toContain('institutionalZoneVisualWeights');
  });
});
