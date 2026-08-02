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

describe('InstitutionalZonePlugin.tsx: confluenceWeight exportado + visualWeights real usado com fallback fail-closed', () => {
  it('exporta confluenceWeight (mesma função, zero segunda fórmula) para o chart reusar como baseWeight', () => {
    expect(institutionalZonePlugin()).toContain('export function confluenceWeight(distinctSourceCount: number): number {');
  });

  it('aceita visualWeights (peso já resolvido pela competição cruzada), paralelo a zones por índice', () => {
    const s = institutionalZonePlugin();
    expect(s).toContain('visualWeights?: (number | undefined)[];');
    expect(s).toContain('export function InstitutionalZonePlugin({ chart, series, zones, visualWeights }: InstitutionalZonePluginProps) {');
  });

  it('o loop de desenho usa visualWeights[i] quando real (!== undefined); cai em confluenceWeight isolado (comportamento pré-Ordem 03) quando ausente — nunca um valor fabricado', () => {
    const s = institutionalZonePlugin();
    expect(s).toContain('const resolvedWeight = currentVisualWeights?.[i];');
    expect(s).toContain('const weight = resolvedWeight !== undefined ? resolvedWeight : confluenceWeight(zone.distinctSourceCount);');
  });

  it('visualWeights entra no dirty-check (useEffect deps) igual a zones — uma resolução de orçamento nova redesenha', () => {
    expect(institutionalZonePlugin()).toContain('}, [zones, visualWeights]);');
  });
});

describe('EnhancedChart_110_Percent.tsx: resolveVisualBudget real — candidatos só das 2 categorias que já tinham peso próprio antes desta rodada', () => {
  it('importa resolveVisualBudget/VisualBudgetCandidate de nexus/visual-budget (zero segunda implementação)', () => {
    expect(chart()).toContain('import { resolveVisualBudget, type VisualBudgetCandidate } from "../nexus/visual-budget";');
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
