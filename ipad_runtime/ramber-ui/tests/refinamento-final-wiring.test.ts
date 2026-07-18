// refinamento-final-wiring.test.ts — Diretriz "Refinamento Final" (pós-
// auditoria): trava a fiação real dos itens §1 (header), §7 (Premium/
// Discount), §8 (harmônicos) e §10 (reset temporal). A matemática pura já
// tem execução real em market-session.test.ts / premium-discount.test.ts /
// harmonic-patterns.test.ts — aqui trancam-se os pontos de conexão (mesma
// convenção mista de sempre: "esqueceram de ligar A com B" é o bug provável).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');
const app = () => read('../src/App.tsx');
const store = () => read('../src/store/unified-snapshot-store.ts');
const chart = () => read('../src/chart/EnhancedChart_110_Percent.tsx');

describe('Store: premiumDiscount + harmonicPatterns nos 4 lugares canônicos do domínio §3', () => {
  it('estado, ação, default e seletor — os 4, para os 2 campos', () => {
    const s = store();
    expect(s).toContain('premiumDiscount: PremiumDiscountReading | null;');
    expect(s).toContain('harmonicPatterns: HarmonicPatternHit[];');
    expect(s).toContain('setPremiumDiscount: (reading: PremiumDiscountReading | null) => void;');
    expect(s).toContain('setHarmonicPatterns: (hits: HarmonicPatternHit[]) => void;');
    expect(s).toContain('premiumDiscount: null,');
    expect(s).toContain('harmonicPatterns: [],');
    expect(s).toContain('export const usePremiumDiscountSnapshot = (): PremiumDiscountReading | null =>');
    expect(s).toContain('export const useHarmonicPatternsSnapshot = (): HarmonicPatternHit[] =>');
    // referência estável para a lista vazia — sem isto todo consumidor
    // re-renderizaria a cada render (mesma disciplina de EMPTY_TRAPS).
    expect(s).toContain('EMPTY_HARMONIC_HITS');
  });
});

describe('App: efeito único computa os 2 motores novos da MESMA série real do gráfico', () => {
  it('lê chartData, usa o último CLOSE real como referência do P/D (30s, nunca o tick de 1s), escreve as 2 fatias', () => {
    const a = app();
    const idx = a.indexOf('st.setPremiumDiscount(computePremiumDiscount({ candles: chartData, price: lastClose }));');
    expect(idx, 'efeito de cômputo §7/§8 não encontrado').toBeGreaterThan(-1);
    const block = a.slice(Math.max(0, idx - 700), idx + 300);
    expect(block).toContain('const lastClose = chartData[chartData.length - 1]?.close ?? null;');
    expect(block).toContain('st.setHarmonicPatterns(detectHarmonicPatterns({ candles: chartData }));');
    expect(block).toContain('}, [chartData]);');
  });

  it('fail-closed: sem candles => null/[] explícitos, nunca leitura velha retida', () => {
    const a = app();
    const idx = a.indexOf('st.setPremiumDiscount(null);');
    expect(idx).toBeGreaterThan(-1);
    expect(a.slice(idx, idx + 120)).toContain('st.setHarmonicPatterns([]);');
  });

  it('§10 Inteligência Temporal: trocar timeframe reseta a série do Score (nunca mistura regimes na tendência)', () => {
    expect(app()).toContain('useUnifiedSnapshotStore.getState().resetInstitutionalScoreHistory();\n  }, [chartTimeframe]);');
  });
});

describe('Header §1: TF + LIVE + latência + sessão — todas leituras REAIS já existentes', () => {
  it('chip do timeframe é display-only do chartTimeframe real (controle continua único, no gráfico)', () => {
    const a = app();
    const idx = a.indexOf('{marketMode === "CRYPTO" && chartTimeframe && (');
    expect(idx, 'chip de TF não encontrado').toBeGreaterThan(-1);
    expect(a.slice(idx, idx + 700)).toContain('{chartTimeframe}');
  });

  it('LIVE vem do wsLive REAL via voiceSnapshot (zero segunda fonte), latência do cycleLatencyMs real', () => {
    const a = app();
    expect(a).toContain('const wsLiveNow: boolean = voiceSnapshot?.wsLive === true;');
    expect(a).toContain('{wsLiveNow ? "LIVE" : "OFF"}');
    expect(a).toContain('typeof cycleLatencyMs === "number" && Number.isFinite(cycleLatencyMs) ? `${Math.round(cycleLatencyMs)}ms` : DASH');
  });

  it('sessão: derivação pura do relógio UTC real (market-session.ts), tooltip divulga a janela verificável', () => {
    const a = app();
    expect(a).toContain('import { marketSessionFromUtc } from "./nexus/market-session";');
    expect(a).toContain('const marketSession = marketSessionFromUtc(new Date());');
    expect(a).toContain('{marketSession.label}');
    expect(a).toContain('${marketSession.windowUtc}');
  });
});

describe('§7 Premium/Discount: gráfico + Trade Plan strip (display-only, LEI 24)', () => {
  it('EnhancedChart: prop fail-closed + 3 linhas fio-de-seda (1px sólida, sem rótulo de eixo)', () => {
    const c = chart();
    expect(c).toContain('premiumDiscount?: PremiumDiscountReading | null;');
    const idx = c.indexOf('premiumDiscountLinesRef.current.forEach((line) => series.removePriceLine(line));');
    expect(idx).toBeGreaterThan(-1);
    const block = c.slice(idx, idx + 900);
    expect(block).toContain('if (!premiumDiscount) return;');
    expect(block).toContain('lineWidth: 1,');
    expect(block).toContain('lineStyle: LineStyle.Solid,');
    expect(block).toContain('axisLabelVisible: false,');
    expect(block).toContain('"Premium · topo do range"');
    expect(block).toContain('"Equilibrium · 50%"');
    expect(block).toContain('"Discount · fundo do range"');
    // ref limpa no unmount, mesma disciplina das outras
    const cleanupIdx = c.indexOf('chart.remove();');
    expect(c.slice(cleanupIdx, cleanupIdx + 600)).toContain('premiumDiscountLinesRef.current = [];');
  });

  it('ChartWidget passa a MESMA fatia da store ao gráfico (zero segunda leitura)', () => {
    const a = app();
    expect(a).toContain('const chartPremiumDiscount = usePremiumDiscountSnapshot();');
    expect(a).toContain('premiumDiscount={chartPremiumDiscount ?? null}');
  });

  it('TradePlanTopStrip: badge "Zona" qualifica a ENTRADA do plano — nunca escreve/bloqueia o plano', () => {
    const a = app();
    const stripStart = a.indexOf('function TradePlanTopStrip(');
    const strip = a.slice(stripStart, a.indexOf('// --- TOP BAR ---'));
    expect(strip).toContain('const premiumDiscount = usePremiumDiscountSnapshot();');
    expect(strip).toContain('const entryMid = (plan.entry.low + plan.entry.high) / 2;');
    expect(strip).toContain('const favored = (long && entryZone === "DISCOUNT") || (!long && entryZone === "PREMIUM");');
    expect(strip).not.toMatch(/setTradePlan|setPremiumDiscount/);
  });
});

describe('§8 Harmônicos: display gated pelo fit mínimo honesto', () => {
  it('aba ANALYSIS lista os hits reais da store; título nega probabilidade; vazio honesto mostra o piso', () => {
    const a = app();
    expect(a).toContain('const harmonicHits = useHarmonicPatternsSnapshot();');
    expect(a).toContain('title="Harmonic Patterns · ratio fit, never probability"');
    expect(a).toContain('NO FRESH XABCD PATTERN ≥ {(MIN_FIT_SCORE * 100).toFixed(0)}% RATIO FIT (honest result)');
    // Consolidação Final §6: rótulo profissional PRZ no lugar do D cru (contrato novo deliberado)
    expect(a).toContain('value={`PRZ @ ${h.points.D.price.toFixed(0)} · fit ${(h.fitScore * 100).toFixed(0)}%`}');
  });

  it('LEI 24: o motor harmônico nunca alimenta engine/tradePlan — só a própria fatia de display', () => {
    const a = app();
    // detectHarmonicPatterns só aparece no import e no efeito de escrita da própria fatia
    const uses = a.split('detectHarmonicPatterns').length - 1;
    expect(uses).toBe(2); // 1 import + 1 chamada no efeito
    const harmonic = read('../src/nexus/harmonic-patterns.ts');
    expect(harmonic).not.toMatch(/setTradePlan|setCouncil|fetch\(|Math\.random/);
  });
});

// ─── Diretriz Mestra (Consolidação Final) — fiação dos gaps reais ───────────
describe('Diretriz Mestra: Heat Score + TENDÊNCIA no header, Magnet, futuro, MTF 9 prazos', () => {
  it('heatReading computada UMA vez em App (useMemo) de 3 fontes reais e exposta via contextValue', () => {
    const a = app();
    const m = a.match(/const heatReading = useMemo\(([\s\S]*?)\);/);
    expect(m, 'heatReading não encontrada').not.toBeNull();
    expect(m![1]).toContain('bandwidthPercentile: engine?.marketRegime?.bandwidthPercentile ?? null');
    expect(m![1]).toContain('deltaPct: priceData?.deltaPct ?? null');
    expect(m![1]).toContain('recentLiquidationCount: liquidations?.length ?? null');
    expect(a).toContain('import { computeHeatScore } from "./nexus/heat-score";');
    const ctx = a.match(/const contextValue = useMemo\(\s*\(\) => \(\{([\s\S]*?)\}\),/);
    expect(ctx![1]).toContain('heatReading,');
  });

  it('chip HEAT no header: DASH honesto sem 2 componentes; tooltip nega probabilidade/direção', () => {
    const a = app();
    expect(a).toContain('{heatReading?.status === "OK" ? heatReading.score : DASH}');
    expect(a).toContain('Nunca probabilidade, nunca direção.');
  });

  it('chip TENDÊNCIA: passthrough do marketStructureLabel real do Core Engine — zero segunda classificação', () => {
    const a = app();
    const idx = a.indexOf('{marketMode === "CRYPTO" && engine?.marketStructureLabel && (');
    expect(idx, 'chip TENDÊNCIA não encontrado').toBeGreaterThan(-1);
    expect(a.slice(idx, idx + 900)).toContain('{engine.marketStructureLabel}');
  });

  it('§2: crosshair Magnet (snap real da lib) + rightOffset para a região futura', () => {
    const c = chart();
    expect(c).toContain('crosshair: { mode: CrosshairMode.Magnet }');
    expect(c).not.toContain('CrosshairMode.Normal');
    expect(c).toContain('rightOffset: 8,');
  });

  it('§6: barra e painel usam a FAIXA formatEtaRange(msMin, ms) — nunca mais um único número', () => {
    const a = app();
    expect(a).toContain('formatEtaRange(activeEta.msMin ?? null, activeEta.ms)');
    expect(a).toContain('formatEtaRange(etaReading.etas[i].msMin ?? null, etaReading.etas[i].ms)');
  });

  it('§7: matriz MTF com os 9 prazos (labels completos, zero buraco no Record)', () => {
    const a = app();
    expect(a).toContain('"1m": "1M", "3m": "3M", "5m": "5M", "15m": "15M", "30m": "30M", "1h": "1H", "4h": "4H", "1d": "1D", "1w": "1W",');
  });

  it('§5: alvos do painel ANALYSIS carregam a distância % real do preço vivo', () => {
    expect(app()).toContain('` · ${(Math.abs(target.price - price.price) / price.price * 100).toFixed(2)}%`');
  });
});

// ─── Diretriz Evolução Contínua §3/§4 — restauração de sessão Local-First ───
describe('Sessão Local-First: ativo/timeframe/modo sobrevivem a refresh ("o sistema nunca foi fechado")', () => {
  it('leitura no module-load com validação estrita + fail-closed para os padrões', () => {
    const a = app();
    expect(a).toContain('const SESSION_STATE_KEY = "ar10cyborg_session_v1";');
    expect(a).toContain('const restoredSession = readRestoredSession();');
    // validação real: símbolo por regex, timeframe pela lista real, TradFi pela taxonomia
    expect(a).toContain('/^[A-Z0-9]{2,12}$/.test(parsed.asset)');
    expect(a).toContain('VALID_TIMEFRAMES.has(parsed.timeframe)');
    expect(a).toContain('TRADFI_ASSETS.find((a) => a.symbol === parsed.tradFiSymbol)');
    // TRADFI restaurado sem ativo restaurável degrada para CRYPTO
    expect(a).toContain('if (marketMode === "TRADFI" && !tradFiAsset) return { ...fallback, asset, timeframe, chartLayers, emaPeriod };');
  });

  it('os 4 estados hidratam por inicializador preguiçoso e persistem num único efeito', () => {
    const a = app();
    expect(a).toContain('useState<AssetSymbol>(() => restoredSession.asset)');
    expect(a).toContain('useState(() => restoredSession.timeframe)');
    expect(a).toContain('useState<"CRYPTO" | "TRADFI">(() => restoredSession.marketMode)');
    expect(a).toContain('useState<TradFiAsset | null>(() => restoredSession.tradFiAsset)');
    const m = a.match(/persistSessionState\(\{[\s\S]*?\}\);\n  \}, \[selectedAsset, chartTimeframe, marketMode, selectedTradFiAsset, chartLayerVisibility, emaPeriod\]\);/);
    expect(m, 'efeito único de persistência não encontrado').not.toBeNull();
  });

  it('persistência nunca quebra o boot: try/catch nos dois lados (storage cheio/corrompido)', () => {
    const a = app();
    const readIdx = a.indexOf('function readRestoredSession()');
    expect(a.slice(readIdx, readIdx + 2600)).toContain('} catch {');
    const writeIdx = a.indexOf('function persistSessionState(');
    expect(a.slice(writeIdx, writeIdx + 800)).toContain('} catch {');
  });
});

// ─── Diretriz Final — Nexus Decision Layer (fusão, LEI 24 preservada) ───────
describe('Nexus Decision Layer: leitura única fundida, computada 1x e exposta no elemento herói', () => {
  it('nexusDecision computada UMA vez (useMemo) das leituras reais já existentes — zero segunda matemática', () => {
    const a = app();
    const m = a.match(/const nexusDecision = useMemo\(([\s\S]*?)\);/);
    expect(m, 'nexusDecision não encontrada').not.toBeNull();
    expect(m![1]).toContain('coreDirection: engine?.direction ?? null');
    expect(m![1]).toContain('plan: trackedPlan');
    expect(m![1]).toContain('targetsHit: trackRecordSlice.active?.targetsHit ?? 0');
    expect(m![1]).toContain('etaReading,');
    expect(m![1]).toContain('councilStance: councilFromSnapshot?.stance ?? null');
    expect(a).toContain('import { buildNexusDecision, NEXUS_PLAN_GAP_LABEL, type NexusDecision } from "./nexus/decision-layer";');
    const ctx = a.match(/const contextValue = useMemo\(\s*\(\) => \(\{([\s\S]*?)\}\),/);
    expect(ctx![1]).toContain('nexusDecision,');
  });

  it('tooltip do CoreSignalBadge conta o raciocínio completo — zero pixel novo (§6: fusão nunca vira poluição)', () => {
    const a = app();
    expect(a).toContain('decision?: NexusDecision | null;');
    expect(a).toContain('NEXUS DECISION · Operação: ${decision.operation} (fonte: Core Engine — LEI 24)');
    expect(a).toContain('confluência real, nunca probabilidade');
    expect(a).toContain('title={fusedTitle}');
    expect(a).toContain('decision={nexusDecision ?? null}');
  });

  it('LEI 24 no nível do fonte: o módulo de fusão nunca escreve em motor/planos — só lê e empacota', () => {
    const layer = read('../src/nexus/decision-layer.ts');
    expect(layer).not.toMatch(/setTradePlan|setCouncil|setScenario|fetch\(|Math\.random/);
    expect(layer).toContain('operationSource: "CORE_ENGINE"');
  });
});

// ─── Nexus Decision Layer V2 — estado operacional + justificativa (§3/§4) ───
describe('Nexus V2: estado no badge herói e justificativa estruturada no tooltip — zero elemento novo', () => {
  it('App alimenta os insumos V2 reais: inEntryZone com histerese, última resolução real (nunca REPLACED), votos/membros/heat/zona', () => {
    const a = app();
    const m = a.match(/const nexusDecision = useMemo\(([\s\S]*?)\);/);
    expect(m).not.toBeNull();
    expect(m![1]).toContain('inEntryZone: inEntryZoneNow ?? null');
    expect(m![1]).toContain('if (h.status !== "REPLACED") return h.resolvedAt;');
    expect(m![1]).toContain('councilFromSnapshot?.votes?.map');
    expect(m![1]).toContain('convictionReading?.members?.map');
    expect(m![1]).toContain('heatTier: heatReading?.status === "OK" ? heatReading.tier : null');
    expect(m![1]).toContain('premiumDiscountZone: pdForDecision?.zone ?? null');
  });

  it('badge herói: estado no subtítulo existente e tooltip com Estado + Favoráveis/Contrários', () => {
    const a = app();
    expect(a).toContain('{decision?.operationalState ? ` · ${decision.operationalState}` : ""}');
    expect(a).toContain('· Estado: ${decision.operationalState}');
    expect(a).toContain('`Favoráveis: ${decision.reasonsFor.join(" · ")}`');
    expect(a).toContain('`Contrários: ${decision.reasonsAgainst.join(" · ")}`');
  });
});

// ─── Auditoria Final V-MAX — renderização ativada + persistência de prefs ───
describe('Auditoria §3: harmônicos e ETA/distância agora RENDERIZADOS no gráfico', () => {
  it('EnhancedChart: linha do ponto D do melhor padrão (fit desc) + EPA quando Wolfe — fio de seda, rótulo honesto', () => {
    const c = chart();
    expect(c).toContain('harmonicHits?: HarmonicPatternHit[] | null;');
    const idx = c.indexOf('harmonicLinesRef.current.forEach((line) => series.removePriceLine(line));');
    expect(idx).toBeGreaterThan(-1);
    const block = c.slice(idx, idx + 2200);
    expect(block).toContain('const top = harmonicHits && harmonicHits.length > 0 ? harmonicHits[0] : null;');
    expect(block).toContain('fit ${(top.fitScore * 100).toFixed(0)}% (aderência, nunca probabilidade)');
    expect(block).toContain('`WOLFE · EPA (linha 1→4 real)${etaLabel ? ` · ETA ${etaLabel} (ápice da cunha)` : ""}`'); // §6: + ETA do ápice
    expect(block).toContain('lineStyle: LineStyle.Solid,');
    const cleanupIdx = c.indexOf('chart.remove();');
    expect(c.slice(cleanupIdx, cleanupIdx + 700)).toContain('harmonicLinesRef.current = [];');
  });

  it('títulos das linhas de alvo carregam distância % ao preço VIVO + ETA em faixa do contrato fundido (guard de preço)', () => {
    const c = chart();
    expect(c).toContain('const distPct = p !== null && p > 0 ? ` · ${((Math.abs(target.price - p) * 100) / p).toFixed(2)}%` : "";');
    expect(c).toContain('const fusedTarget = decision?.plan?.targets[i];');
    expect(c).toContain('Math.abs(fusedTarget.price - target.price) < Math.max(1e-9, target.price * 1e-9)');
    expect(c).toContain('${etaLabel ? ` · ETA ${etaLabel}` : ""}');
  });

  it('ChartWidget passa harmonicHits (mesma fatia da ANALYSIS) e decision (contrato fundido) ao gráfico', () => {
    const a = app();
    expect(a).toContain('const chartHarmonics = useHarmonicPatternsSnapshot();');
    expect(a).toContain('harmonicHits={chartHarmonics}');
    expect(a).toContain('decision={nexusDecision ?? null}');
  });
});

describe('Auditoria §6: configurações do Operador (camadas + EMA) sobrevivem a refresh', () => {
  it('RestoredSession carrega chartLayers validadas por chave conhecida e emaPeriod validado pela lista real', () => {
    const a = app();
    expect(a).toContain('chartLayers: ChartLayerVisibility;');
    expect(a).toContain('if (typeof parsed.chartLayers[key] === "boolean") chartLayers[key] = parsed.chartLayers[key];');
    expect(a).toContain('(EMA_PERIODS as readonly number[]).includes(parsed?.emaPeriod)');
  });

  it('os dois estados hidratam por inicializador preguiçoso e entram no MESMO efeito único de persistência', () => {
    const a = app();
    expect(a).toContain('useState<ChartLayerVisibility>(() => restoredSession.chartLayers)');
    expect(a).toContain('useState<EmaPeriod>(() => restoredSession.emaPeriod)');
    expect(a).toContain('}, [selectedAsset, chartTimeframe, marketMode, selectedTradFiAsset, chartLayerVisibility, emaPeriod]);');
  });
});

// ─── Diretriz Consolidação Operacional §5: compactação automática da memória ───
describe('Consolidação §5: compactPersistedCandles roda uma vez por boot (envelhecimento do cache Local-First)', () => {
  it('App.tsx importa e dispara a compactação fire-and-forget no efeito de boot ([]), nunca no caminho quente', () => {
    const a = app();
    expect(a).toContain('compactPersistedCandles } from "./nexus/persistence"');
    expect(a).toContain('void compactPersistedCandles().catch(() => {});');
    // a chamada vive no MESMO efeito one-shot que hidrata o track record —
    // um único ponto de boot, nunca um segundo ciclo de vida paralelo.
    const idx = a.indexOf('void compactPersistedCandles().catch(() => {});');
    const before = a.slice(Math.max(0, idx - 700), idx);
    expect(before).toContain('hydrateTrackRecord(rehydrateTrackRecord(raw));');
  });

  it('persistence.ts documenta TTL + teto e NUNCA toca a snapshot store (track record é conhecimento real, não cache)', () => {
    const p = readFileSync(resolve(__dirname, '../src/nexus/persistence.ts'), 'utf8');
    expect(p).toContain('export const CANDLE_CACHE_MAX_AGE_MS');
    expect(p).toContain('export const CANDLE_CACHE_MAX_RECORDS');
    // a transação de remoção é aberta exclusivamente sobre a CANDLES_STORE
    expect(p).toContain('db.transaction(CANDLES_STORE, "readwrite")');
    expect(p).not.toContain('db.transaction(SNAPSHOT_STORE, "readwrite")');
  });
});

// ─── Diretriz Mestra Consolidação Final: VWAP estados + Nexus Line + confluência ───
describe('Consolidação Final §20-§25: VWAP com estados/histerese SEM tocar a matemática', () => {
  it('App computa o último VWAP com a MESMA função pura do gráfico (zero segunda implementação)', () => {
    const a = app();
    expect(a).toContain('import { computeSessionVwapSeries, latestVwap } from "./nexus/vwap";');
    expect(a).toContain('const vwapNow = useMemo(() => latestVwap(computeSessionVwapSeries(chartData)), [chartData]);');
  });

  it('histerese real (§22): transição lê o estado ANTERIOR via updater funcional — nunca useMemo', () => {
    const a = app();
    expect(a).toContain('setVwapCtx((prev) => computeVwapContext(prev?.state ?? "NEUTRAL", livePriceForZone, vwapNow, atrAbsForLines));');
    expect(a).toContain('setNlState((prev) => nexusLineState(prev, livePriceForZone, nexusLineNow, atrAbsForLines));');
  });

  it('cartão VWAP no header (§23): estado + Preço×VWAP % real, e o TopBar lê do contexto único', () => {
    const a = app();
    expect(a).toContain('tracking-[0.2em] text-[#8ab4f8]/50 font-bold uppercase">\n                VWAP'); // §5: rótulo agora carrega sufixo NL ✓/⚠
    expect(a).toContain('${vwapCtx.distancePct >= 0 ? "+" : ""}${vwapCtx.distancePct.toFixed(2)}%');
    expect(a).toContain('"VWAP aguardando volume real da sessão UTC (fail-closed, nunca um valor fabricado)."');
  });

  it('o gráfico aplica cor/etiqueta de estado via applyOptions — a série VWAP continua a mesma (§20/§21)', () => {
    const c = chart();
    expect(c).toContain('vwapSeriesRef.current.applyOptions({ color: VWAP_STATE_COLOR[s], title: `VWAP ${LINE_STATE_GLYPH[s]}` });');
    expect(c).toContain('const series = computeSessionVwapSeries(data);'); // matemática intocada
  });
});

describe('Consolidação Final §26-§30: Nexus Line + confluência informativa', () => {
  it('NL nasce no MESMO efeito da VWAP no gráfico (mesmos candles, nunca dessincroniza)', () => {
    const c = chart();
    expect(c).toContain('const nl = computeNexusLineSeries(data);');
    expect(c).toContain('nexusLineSeriesRef.current.setData(nl.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));');
    // fio de seda + título com glifo de estado
    expect(c).toContain('nexusLineSeriesRef.current.applyOptions({ color: NL_STATE_COLOR[s], title: `NL ${LINE_STATE_GLYPH[s]}` });');
  });

  it('§30: veredito de confluência VWAP×NL×Decision computado no App e exposto pelo contexto (2 listas)', () => {
    const a = app();
    expect(a).toContain('nexusConfluenceVerdict(vwapCtx?.state ?? "NEUTRAL", nlState, nexusDecision?.operation ?? null)');
    const occurrences = a.split('      vwapCtx,\n      nlState,\n      nexusConfluence,').length - 1;
    expect(occurrences).toBe(2); // objeto do contexto + array de deps
  });

  it('ANALYSIS ganha o painel VWAP × Nexus Line com o aviso LEI 24 explícito', () => {
    const a = app();
    expect(a).toContain('title="VWAP × Nexus Line (equilíbrios reais + confluência informativa)"');
    expect(a).toContain('Informativo (LEI 24): confluência nunca altera nem bloqueia a operação do Core Engine.');
  });

  it('elemento do gráfico recebe os DOIS estados (mesma fonte única do header)', () => {
    const a = app();
    expect(a).toContain('vwapState={vwapCtx?.state ?? null}');
    expect(a).toContain('nexusLineState={nlState ?? null}');
  });
});

describe('Consolidação Final §5/§6: SHARK + AB=CD no motor, PRZ/ETA na superfície', () => {
  it('motor harmônico: SHARK e ABCD no contrato + janela de convergência Wolfe CORRIGIDA (razão > 1)', () => {
    const h = readFileSync(resolve(__dirname, '../src/nexus/harmonic-patterns.ts'), 'utf8');
    expect(h).toContain('| "SHARK"');
    expect(h).toContain('| "ABCD"');
    expect(h).toContain('const WOLFE_CONVERGENCE_WINDOW = { min: 1.001, max: 50, idealMin: 1.1, idealMax: 5 };');
    expect(h).toContain('etaIndex?: number;');
  });

  it('gráfico: terminologia PRZ profissional + ETA do ápice na linha EPA da Wolfe', () => {
    const c = chart();
    expect(c).toContain('· PRZ · fit ${(top.fitScore * 100).toFixed(0)}% (aderência, nunca probabilidade)');
    expect(c).toContain('`WOLFE · EPA (linha 1→4 real)${etaLabel ? ` · ETA ${etaLabel} (ápice da cunha)` : ""}`');
    expect(c).toContain('}, [harmonicHits, data]);'); // intervalo real de barra vem de data
  });

  it('ANALYSIS usa PRZ no lugar do rótulo D cru', () => {
    const a = app();
    expect(a).toContain('value={`PRZ @ ${h.points.D.price.toFixed(0)} · fit ${(h.fitScore * 100).toFixed(0)}%`}');
  });
});

// ─── Diretriz de Continuidade §5: cartão VWAP com valor + estado nomeado ───
describe('Continuidade §5: o cartão VWAP exibe o VALOR real + estado COMPRADOR/VENDEDOR/NEUTRA', () => {
  it('valor com o MESMO formatador fmt() do header; estado nomeado; DADOS INSUFICIENTES no vazio (nunca dash mudo)', () => {
    const a = app();
    expect(a).toContain('{vwapCtx ? fmt(vwapCtx.vwap, vwapCtx.vwap >= 1000 ? 0 : 2) : "DADOS"}');
    expect(a).toContain('vwapCtx.state === "BULLISH" ? "COMPRADOR" : vwapCtx.state === "BEARISH" ? "VENDEDOR" : "NEUTRA"');
    expect(a).toContain(': "INSUFICIENTES"}');
    // a % continua vindo do fmtSignedPct compartilhado (zero segunda formatação)
    expect(a).toContain('${fmtSignedPct(vwapCtx.distancePct)} · ${');
  });

  it('confluência NL vira sufixo discreto no rótulo (✓/⚠) — detalhe completo segue no tooltip/ANALYSIS', () => {
    const a = app();
    expect(a).toContain('{nexusConfluence === "ALINHADA" ? " ✓" : " ⚠"}');
  });
});

// ─── Continuidade Final §6: rótulos compactos condicionais dos alvos ───
describe('Continuidade §6: níveis apertados => rótulos TP compactos, preço NUNCA deslocado', () => {
  it('limiar documentado + medição inclui o stop EFETIVO (ratchet pode encostar num alvo)', () => {
    const c = chart();
    expect(c).toContain('const TARGET_LABEL_COMPACT_PCT = 0.35;');
    expect(c).toContain('const levels = [effectiveStopPrice, ...tradePlan.targets.map((t) => t.price)].sort((a, b) => a - b);');
    expect(c).toContain('((price - levels[i - 1]) * 100) / ref < TARGET_LABEL_COMPACT_PCT');
  });

  it('modo compacto: label + distância + ETA (basis/R:R seguem no strip); modo cheio inalterado', () => {
    const c = chart();
    expect(c).toContain('? `${label}${distPct}${etaLabel ? ` · ${etaLabel}` : ""}`');
    expect(c).toContain(': `${label} · ${target.basis}${rr !== null ? ` · 1:${rr.toFixed(2)}` : ""}${distPct}${etaLabel ? ` · ETA ${etaLabel}` : ""}`');
    // a âncora do preço real permanece: applyOptions nunca recebe um price deslocado no título compacto
    expect(c).toContain('ancoradas no preço real: o preço matemático nunca muda para caber');
  });
});
