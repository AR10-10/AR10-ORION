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
// Fatia o corpo INTEIRO de uma function declaration (nunca uma janela de
// tamanho chutado — achado real: `slice(idx, idx+2200)` quebrou
// silenciosamente quando MarketBiasDecisionCard cresceu além disso).
const wholeFunction = (src: string, signature: string): string => {
  const idx = src.indexOf(signature);
  if (idx === -1) return '';
  const nextFnIdx = src.indexOf('\nfunction ', idx + 1);
  return nextFnIdx === -1 ? src.slice(idx) : src.slice(idx, nextFnIdx);
};

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
    expect(app()).toContain('useUnifiedSnapshotStore.getState().resetInstitutionalScoreHistory();');
  });

  it('Diretriz de Evolução Geral do Organismo §6.8 (substitui o antigo §13-K): trocar timeframe NÃO zera mais o track record — nenhum dos 2 efeitos de reset (ativo/timeframe) toca resetTrackRecord, que não existe mais como ação', () => {
    const a = app();
    const m = a.match(/useEffect\(\(\) => \{\s*useUnifiedSnapshotStore\.getState\(\)\.resetInstitutionalScoreHistory\(\);[\s\S]*?\}, \[chartTimeframe\]\);/);
    expect(m, 'efeito de reset por troca de timeframe não encontrado').not.toBeNull();
    expect(m![0]).not.toContain('resetTrackRecord');
    expect(a).not.toContain('resetTrackRecord'); // ação removida da store por inteiro, não só deste efeito
  });

  it('Diretriz de Evolução Autônoma Integral (auditoria de staleness de overlays): trocar de TIMEFRAME agora limpa realCycle/engineStatus e o throttle do Volume Profile — troca de ATIVO já era imune (desmonta o gráfico inteiro), troca de TIMEFRAME não desmonta nada e deixava S1/R1 e o histograma do timeframe ANTERIOR pendurados sobre os candles novos', () => {
    const a = app();
    const m = a.match(/useEffect\(\(\) => \{\s*useUnifiedSnapshotStore\.getState\(\)\.resetInstitutionalScoreHistory\(\);[\s\S]*?\}, \[chartTimeframe\]\);/);
    expect(m, 'efeito de reset por troca de timeframe não encontrado').not.toBeNull();
    const body = m![0];
    // S1/R1 (createPriceLine) vêm de engine.support/resistance, derivados
    // de realCycle — sem isto, um nível estrutural do timeframe anterior
    // ficava rotulado como válido no novo até o próximo ciclo assíncrono
    // resolver (achado real, não hipotético).
    expect(body).toContain('setRealCycle(null);');
    expect(body).toContain('setEngineStatus("pending");');
    // VolumeProfilePlugin: o throttle de 5s só zerava na troca de ativo —
    // trocar de timeframe dentro dessa janela mantinha o histograma/POC
    // do timeframe anterior desenhado sobre os candles novos.
    expect(body).toContain('useUnifiedSnapshotStore.getState().setVolumeProfile(null);');
    expect(body).toContain('volumeProfileLastComputeRef.current = 0;');
  });

  it('Diretriz de Evolução Geral do Organismo §6.8 (substitui o antigo §11/§13-J): trocar de ATIVO não zera mais o track record (só arquiva/restaura no efeito dedicado), mas continua limpando a Matriz Multi-Timeframe antiga', () => {
    const a = app();
    const m = a.match(/useEffect\(\(\) => \{\s*setPriceData\(null\);[\s\S]*?\}, \[selectedAsset\]\);/);
    expect(m, 'efeito de reset por troca de ativo não encontrado').not.toBeNull();
    expect(m![0]).not.toContain('resetTrackRecord');
    expect(m![0]).toContain('useUnifiedSnapshotStore.getState().setMultiTimeframeContext(null);');
  });

  it('track record: efeito PRÓPRIO arquiva o agregado (nunca o plano ativo) por symbol:timeframe ao trocar, restaura o arquivo real ao entrar de novo na mesma combinação', () => {
    const a = app();
    const idx = a.indexOf('const key = candleKey(selectedAsset, chartTimeframe as Timeframe);');
    expect(idx, 'efeito de arquivo/restauração do track record não encontrado').toBeGreaterThan(-1);
    const block = a.slice(idx, idx + 500);
    expect(block).toContain('const archived = useUnifiedSnapshotStore.getState().trackRecordArchive[key];');
    expect(block).toContain('useUnifiedSnapshotStore.getState().hydrateTrackRecord(archived ?? EMPTY_TRACK_RECORD);');
    expect(block).toContain('useUnifiedSnapshotStore.getState().archiveTrackRecord(key);');
    expect(block).toMatch(/\}, \[selectedAsset, chartTimeframe\]\);/);
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
    expect(a).toContain('import { marketSessionFromUtc, computeSessionBoundaries, computeSessionKeyLevels } from "./nexus/market-session";');
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
    expect(block).toContain('if (!premiumDiscount || !visibility.premium_discount) return;');
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
    expect(a).toContain('if (marketMode === "TRADFI" && !tradFiAsset) return { ...fallback, asset, timeframe, chartLayers, chartLayerAutoMode, emaPeriod };');
  });

  it('os 4 estados hidratam por inicializador preguiçoso e persistem num único efeito', () => {
    const a = app();
    expect(a).toContain('useState<AssetSymbol>(() => restoredSession.asset)');
    expect(a).toContain('useState(() => restoredSession.timeframe)');
    expect(a).toContain('useState<"CRYPTO" | "TRADFI">(() => restoredSession.marketMode)');
    expect(a).toContain('useState<TradFiAsset | null>(() => restoredSession.tradFiAsset)');
    const m = a.match(/persistSessionState\(\{[\s\S]*?\}\);\n  \}, \[selectedAsset, chartTimeframe, marketMode, selectedTradFiAsset, chartLayerVisibility, chartLayerAutoMode, emaPeriod\]\);/);
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

  it('tooltip do CoreSignalBadge consome a Operational Readability Layer (§7 Evolução Integrativa) — zero montagem inline', () => {
    const a = app();
    expect(a).toContain('decision?: NexusDecision | null;');
    // realocado (nunca apagado): a montagem vive no módulo nomeado; o
    // conteúdo das linhas é travado por EXECUÇÃO REAL no teste do módulo.
    expect(a).toContain('const fusedTitle = buildOperationalSummary(decision).join("\\n");');
    expect(a).not.toContain('NEXUS DECISION · Operação: ${'); // inline extinto no App
    expect(a).toContain('title={fusedTitle}');
    expect(a).toContain('decision={nexusDecision ?? null}');
    const layer = read('../src/nexus/operational-readability.ts');
    expect(layer).toContain('NEXUS DECISION · Operação: ${decision.operation} (fonte: Core Engine — LEI 24)');
    expect(layer).toContain('confluência real, nunca probabilidade');
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
    // §7: Estado/Favoráveis/Contrários agora nascem na Readability Layer
    const layer = read('../src/nexus/operational-readability.ts');
    expect(layer).toContain('· Estado: ${decision.operationalState}');
    expect(layer).toContain('`Favoráveis: ${decision.reasonsFor.join(" · ")}`');
    expect(layer).toContain('`Contrários: ${decision.reasonsAgainst.join(" · ")}`');
  });

  it('Auditoria Final de Integração: o subtítulo VISÍVEL do badge herói (nunca só o tooltip, que não aparece em toque no iPad) qualifica BIAS≠ENTRY com deriveOutcomeLabel — mesmo dado real do Estado, agora legível sem hover', () => {
    const a = app();
    expect(a).toContain('const outcome = decision ? deriveOutcomeLabel(decision) : null;');
    expect(a).toContain('{outcomeQualifier ? ` · ${outcomeQualifier}` : ""}');
    // v7: import multi-linha (ganhou os derives dos 6 eixos) — trava o bloco inteiro vindo do módulo certo
    const importMatch = a.match(/import \{([\s\S]*?)\} from "\.\/nexus\/operational-readability";/);
    expect(importMatch, 'import da Readability Layer não encontrado').not.toBeNull();
    for (const name of ['buildOperationalSummary', 'deriveOutcomeLabel', 'deriveRiskState', 'deriveConfluenceState', 'type NexusOutcomeLabel']) {
      expect(importMatch![1]).toContain(name);
    }
    const m = a.match(/const OUTCOME_QUALIFIER: Partial<Record<NexusOutcomeLabel, string>> = \{([\s\S]*?)\};/);
    expect(m, 'tabela de qualificadores visíveis não encontrada').not.toBeNull();
    expect(m![1]).toContain('LONG: "PLANO ATIVO"');
    expect(m![1]).toContain('OBSERVAR: "SEM ESTRUTURA"');
    // title continua existindo (o raciocínio completo ainda está lá para desktop/mouse) — isto é ADITIVO, nunca uma substituição do tooltip
    expect(a).toContain('title={fusedTitle}');
  });

  it('Achado real (captura do Operador, janela ~1000px lógicos): o subtítulo do badge herói NÃO carrega mais o prefixo "Confidence · " — a região central rolável cortava "CONFIDENCE · MEDIUM · AGUARDANDO ENTRADA" em "AGUARDAN"; o rótulo categórico cru agora vai direto ao ponto (o rótulo "Confiança:" já existe na linha própria do tooltip)', () => {
    const block = wholeFunction(app(), 'function CoreSignalBadge(');
    expect(block).not.toBe('');
    expect(block).toContain('{confidence ?? AWAIT}');
    expect(block).toContain('{outcomeQualifier ? ` · ${outcomeQualifier}` : ""}');
    // regressão: o prefixo decorativo não pode voltar a colidir com a borda real medida
    expect(block).not.toContain('`Confidence · ${confidence}`');
  });

  it('Continuidade (auditoria de sincronização): MarketBiasDecisionCard ("Sinal Institucional", segundo lugar dedicado a DIREÇÃO) ganha o MESMO qualificador real — reusa OUTCOME_QUALIFIER/deriveOutcomeLabel já testados, nunca uma segunda tabela/lógica', () => {
    const block = wholeFunction(app(), 'function MarketBiasDecisionCard()');
    expect(block).not.toBe('');
    expect(block).toContain('nexusDecision } = useContext(WidgetContext) || {};');
    expect(block).toContain('const biasOutcome = nexusDecision ? deriveOutcomeLabel(nexusDecision) : null;');
    expect(block).toContain('const biasOutcomeQualifier = biasOutcome ? (OUTCOME_QUALIFIER[biasOutcome] ?? null) : null;');
    expect(block).toContain('{biasOutcomeQualifier && (');
    // o texto grande continua o passthrough cru do Núcleo (LEI 24) — o qualificador é ADITIVO, nunca substitui `direction`
    expect(block).toContain('{direction ?? AWAIT}');
  });

  it('Continuidade (fecha os 3 itens deixados de fora na rodada anterior): MarketDirectionWidget ("Vetor"), SiriformCoreCard ("Sinal") e AssistantOrb expandido ("VETOR") ganham o MESMO qualificador real — 4 lugares reais agora sincronizados com o badge herói, sempre reusando OUTCOME_QUALIFIER/deriveOutcomeLabel, nunca uma quinta lógica', () => {
    const a = app();

    const mdw = wholeFunction(a, 'function MarketDirectionWidget()');
    expect(mdw).not.toBe('');
    expect(mdw).toContain('nexusDecision } = useContext(WidgetContext) || {};');
    expect(mdw).toContain('const vectorOutcome = nexusDecision ? deriveOutcomeLabel(nexusDecision) : null;');
    expect(mdw).toContain('const vectorOutcomeQualifier = vectorOutcome ? (OUTCOME_QUALIFIER[vectorOutcome] ?? null) : null;');
    expect(mdw).toContain('{vectorOutcomeQualifier && (');
    // não cresce sem motivo real: só renderiza quando existe (fail-closed)
    expect(mdw).toContain('Livro Real');

    const siriform = wholeFunction(a, 'function SiriformCoreCard()');
    expect(siriform).not.toBe('');
    expect(siriform).toContain('nexusDecision } = useContext(WidgetContext) || {};');
    expect(siriform).toContain('const sinalOutcome = nexusDecision ? deriveOutcomeLabel(nexusDecision) : null;');
    // MiniStat só aceita string — concatenado, nunca uma segunda versão do componente
    expect(siriform).toContain('const sinalValue = direction ? (sinalOutcomeQualifier ? `${direction} · ${sinalOutcomeQualifier}` : direction) : AWAIT;');
    expect(siriform).toContain('<MiniStat label="Sinal" value={sinalValue} color={dirColor} />');

    const orb = wholeFunction(a, 'function AssistantOrb(');
    expect(orb).not.toBe('');
    expect(orb).toContain('nexusDecision } =\n    useContext(WidgetContext) || {};');
    expect(orb).toContain('const orbOutcome = nexusDecision ? deriveOutcomeLabel(nexusDecision) : null;');
    expect(orb).toContain('{orbOutcomeQualifier && (');
    // VETOR {dirLabel} continua intocado (LEI 24) — o qualificador é uma 4ª linha aditiva, nunca uma substituição
    expect(orb).toContain('VETOR {dirLabel}');
  });
});

// ─── Auditoria Final V-MAX — renderização ativada + persistência de prefs ───
// ─── Evolução Integrativa §6: Síntese Operacional na aba ANALYSIS ───
describe('§6: painel Síntese Operacional — 6 eixos derivados do MESMO NexusDecision, visível em toque (nunca só tooltip)', () => {
  it('painel vem PRIMEIRO no corpo da ANALYSIS (Nível 1 antes da evidência), com os 6 eixos e fallback fail-closed', () => {
    const a = app();
    const synthIdx = a.indexOf('<ModulePanel title="Síntese Operacional · 6 eixos auditáveis (mesma fonte do badge)">');
    const planIdx = a.indexOf('<ModulePanel title="Trade Plan · real structure only (advisory, read-only)">');
    expect(synthIdx).toBeGreaterThan(-1);
    expect(planIdx).toBeGreaterThan(synthIdx); // síntese antes do plano — hierarquia §3 da diretriz
    const block = a.slice(synthIdx, planIdx);
    expect(block).toContain('label="Direção (BIAS)"');
    expect(block).toContain('label="Estrutura (SETUP)"');
    expect(block).toContain('label="Timing (ENTRY)"');
    expect(block).toContain('{synthRisk && (');
    expect(block).toContain('label="Confluência"');
    expect(block).toContain('label="Decisão"');
    // deriva do contrato fundido, nunca recomputa: só chamadas derive*(nexusDecision)
    expect(block).toContain('deriveBiasLabel(nexusDecision)');
    expect(block).toContain('deriveConfluenceState(nexusDecision)');
    expect(block).toContain('AWAITING FIRST REAL CYCLE'); // fallback honesto sem decisão
  });

  it('Risco omitido quando null (nunca fabricado) e a fonte do risco vem nomeada no valor', () => {
    const a = app();
    expect(a).toContain('const synthRisk = nexusDecision ? deriveRiskState(nexusDecision) : null;');
    expect(a).toContain('value={`${synthRisk.state} — ${synthRisk.basis}`}');
  });

  it('EPC MODO ELITE ABSOLUTO §10 (Recuperação de Recursos): engine.condition — a confirmação REAL que o Core Engine exige (required_confirmation/trigger_to_reevaluate) — era computada pelo engine-bridge e nunca exibida; agora entra na Síntese, fail-closed', () => {
    const a = app();
    // passthrough puro no objeto engine (mesmo padrão dos outros campos do realCycle)
    expect(a).toContain('const condition = cycleOk ? (realCycle?.condition ?? null) : null;');
    // exibida na Síntese Operacional, só quando há string real (nunca DADOS_INSUFICIENTES/null)
    expect(a).toContain('{typeof engine?.condition === "string" && engine.condition.length > 0 && engine.condition !== "DADOS_INSUFICIENTES" && (');
    expect(a).toContain('<ModuleStat label="Confirmação exigida (Núcleo)" value={engine.condition} />');
  });

  it('engine-bridge realmente computa e expõe condition (a matriz de setup real) — a fonte que estava presente mas sem consumidor', () => {
    const bridge = read('../src/engine-bridge.ts');
    expect(bridge).toContain("condition: typeof matrix.condition === 'string' ? matrix.condition : null,");
  });
});

describe('Auditoria §3: harmônicos e ETA/distância agora RENDERIZADOS no gráfico', () => {
  it('EnhancedChart: linha do ponto D do melhor padrão (fit desc) + EPA quando Wolfe — fio de seda, rótulo honesto', () => {
    const c = chart();
    expect(c).toContain('harmonicHits?: HarmonicPatternHit[] | null;');
    const idx = c.indexOf('harmonicLinesRef.current.forEach((line) => series.removePriceLine(line));');
    expect(idx).toBeGreaterThan(-1);
    const block = c.slice(idx, idx + 4200);
    expect(block).toContain('const top = harmonicHits && harmonicHits.length > 0 ? harmonicHits[0] : null;');
    // EPC §4 (rótulos compactos por iniciais): PRZ com glifo ↑/↓, EPA sem
    // as descrições parentéticas — o disclaimer/significado seguem no
    // painel Harmonic Patterns e em harmonic-patterns.ts.
    expect(block).toContain('`${top.pattern} ${hDirGlyph} PRZ ${(top.fitScore * 100).toFixed(0)}%`');
    expect(block).toContain('`WOLFE EPA${etaLabel ? ` · ETA ${etaLabel}` : ""}`'); // §6: + ETA do ápice (compacto EPC §4)
    expect(block).toContain('lineStyle: LineStyle.Solid,');
    const cleanupIdx = c.indexOf('chart.remove();');
    expect(c.slice(cleanupIdx, cleanupIdx + 700)).toContain('harmonicLinesRef.current = [];');
  });

  it('Continuidade: a figura XABCD/Wolfe COMPLETA (não só o ponto D/PRZ) é uma polilinha nativa real, limpa fail-closed antes do early-return, tempo estritamente crescente na borda de renderização', () => {
    const c = chart();
    expect(c).toContain('const harmonicPolylineRef = useRef<ISeriesApi<"Line"> | null>(null);');
    const idx = c.indexOf('harmonicLinesRef.current.forEach((line) => series.removePriceLine(line));');
    const block = c.slice(idx, idx + 3600);
    // limpa a polilinha ANTES do guard de "sem padrão" — nunca deixa uma figura velha na tela
    const clearIdx = block.indexOf('harmonicPolylineRef.current?.setData([]);');
    const guardIdx = block.indexOf('if (!top || !Number.isFinite(top.points.D.price)) return;');
    expect(clearIdx).toBeGreaterThan(-1);
    expect(guardIdx).toBeGreaterThan(clearIdx);
    // os 5 pontos reais (X opcional/A/B/C/D), nunca um ponto fabricado para AB=CD
    expect(block).toContain('[top.points.X, top.points.A, top.points.B, top.points.C, top.points.D].filter(');
    expect(block).toContain('(p): p is HarmonicPoint => p !== undefined,');
    // trava defensiva real na borda (a lib exige tempo estritamente crescente)
    expect(block).toContain('.sort((a, b) => a.time - b.time)');
    expect(block).toContain('i === 0 || p.time !== arr[i - 1].time');
    expect(block).toContain('if (polylinePoints.length >= 2) {');
    expect(block).toContain('harmonicPolylineRef.current?.setData(polylinePoints);');
    // criada como série nativa (mesmo padrão de EMA/Nexus Line/Trend Channel) — zero rótulo de eixo/último valor
    const seriesIdx = c.indexOf('const harmonicPolyline = chart.addSeries(LineSeries, {');
    expect(seriesIdx).toBeGreaterThan(-1);
    const seriesBlock = c.slice(seriesIdx, seriesIdx + 300);
    expect(seriesBlock).toContain('priceLineVisible: false');
    expect(seriesBlock).toContain('lastValueVisible: false');
    expect(seriesBlock).toContain('lineStyle: LineStyle.Solid');
    // limpa no unmount, mesma disciplina de todas as outras refs
    const cleanupIdx = c.indexOf('chart.remove();');
    expect(c.slice(cleanupIdx, cleanupIdx + 900)).toContain('harmonicPolylineRef.current = null;');
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

  it('os três estados hidratam por inicializador preguiçoso e entram no MESMO efeito único de persistência', () => {
    const a = app();
    expect(a).toContain('useState<ChartLayerVisibility>(() => restoredSession.chartLayers)');
    // NÚCLEO GRAVITACIONAL AUTÔNOMO §1: campo novo e aditivo, mesma forma
    // de ChartLayerVisibility, mesmo padrão de hidratação/persistência.
    expect(a).toContain('useState<ChartLayerVisibility>(() => restoredSession.chartLayerAutoMode)');
    expect(a).toContain('useState<EmaPeriod>(() => restoredSession.emaPeriod)');
    expect(a).toContain('}, [selectedAsset, chartTimeframe, marketMode, selectedTradFiAsset, chartLayerVisibility, chartLayerAutoMode, emaPeriod]);');
  });
});

// ─── Diretriz Consolidação Operacional §5: compactação automática da memória ───
describe('Consolidação §5: compactPersistedCandles roda uma vez por boot (envelhecimento do cache Local-First)', () => {
  it('App.tsx importa e dispara a compactação fire-and-forget no efeito de boot ([]), nunca no caminho quente', () => {
    const a = app();
    expect(a).toContain('compactPersistedCandles, candleKey } from "./nexus/persistence"');
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

  it('o gráfico aplica cor de estado via applyOptions — a série VWAP continua a mesma (§20/§21)', () => {
    const c = chart();
    expect(c).toContain('vwapSeriesRef.current.applyOptions({ color: VWAP_STATE_COLOR[s] });');
    expect(c).toContain('const series = computeSessionVwapSeries(data);'); // matemática intocada
  });

  it('Diretriz de Refinamento Visual §5/§6: applyOptions NUNCA mais reescreve title — title:"" fixo na criação, glifo de estado só via priceAxisLabels', () => {
    const c = chart();
    expect(c).not.toContain('title: `VWAP ${LINE_STATE_GLYPH[s]}`');
    const idx = c.indexOf('const vwapSeries = chart.addSeries(LineSeries, {');
    const closeIdx = c.indexOf('vwapSeriesRef.current = vwapSeries;');
    expect(c.slice(idx, closeIdx)).toContain('title: "",');
  });
});

describe('VWAP Standard Deviation Bands (pedido do Operador, "ferramentas mais precisas"): 4 séries nativas, mesmo toggle da VWAP, zero segunda matemática', () => {
  it('importa computeVwapBands de nexus/vwap-bands — nunca uma fórmula própria dentro do componente do gráfico', () => {
    const c = chart();
    expect(c).toContain('import { computeVwapBands } from "../nexus/vwap-bands";');
  });

  it('cria as 4 séries nativas (upper1/lower1/upper2/lower2) com o mesmo contrato "fio de seda" da VWAP/Trend Channel (sem rótulo nativo, sem dash)', () => {
    const c = chart();
    for (const ref of ['vwapBandUpper1', 'vwapBandLower1', 'vwapBandUpper2', 'vwapBandLower2']) {
      expect(c, `${ref}Ref.current nunca atribuído`).toContain(`${ref}Ref.current = ${ref};`);
    }
    const idx = c.indexOf('const vwapBandSeriesOptions = {');
    const closeIdx = c.indexOf('vwapBandUpper2Ref.current = vwapBandUpper2;');
    const block = c.slice(idx, closeIdx);
    expect(block).toContain('title: "",');
    expect(block).toContain('lineStyle: LineStyle.Solid');
    expect(block).not.toContain('setLineDash');
  });

  it('as 4 séries são nulificadas no cleanup do chart, mesmo padrão de vwapSeriesRef/trendChannelUpperRef', () => {
    const c = chart();
    for (const ref of ['vwapBandUpper1', 'vwapBandLower1', 'vwapBandUpper2', 'vwapBandLower2']) {
      expect(c).toContain(`${ref}Ref.current = null;`);
    }
  });

  it('computeVwapBands roda no MESMO useEffect/mesmos candles que computeSessionVwapSeries — nunca dessincroniza da própria VWAP que envolve', () => {
    const c = chart();
    const idx = c.indexOf('const series = computeSessionVwapSeries(data);');
    const closeIdx = c.indexOf('// Consolidação Final §26-§28: a Nexus Line nasce do MESMO array real,');
    expect(idx).toBeGreaterThan(-1);
    expect(closeIdx).toBeGreaterThan(idx);
    const block = c.slice(idx, closeIdx);
    expect(block).toContain('const bands = computeVwapBands(data);');
  });

  it('bandas seguem o MESMO interruptor visibility.vwap — nunca uma camada própria no painel "Camadas do Gráfico"', () => {
    const c = chart();
    const idx = c.indexOf('if (!vwapBandUpper1Ref.current');
    expect(idx).toBeGreaterThan(-1);
    const block = c.slice(idx, idx + 700);
    expect(block).toContain('vwapBandUpper1Ref.current.applyOptions({ visible: visibility.vwap });');
    expect(block).toContain('vwapBandLower1Ref.current.applyOptions({ visible: visibility.vwap });');
    expect(block).toContain('vwapBandUpper2Ref.current.applyOptions({ visible: visibility.vwap });');
    expect(block).toContain('vwapBandLower2Ref.current.applyOptions({ visible: visibility.vwap });');
    expect(block).toContain('[visibility.vwap]');
  });
});

describe('Evolução do Organismo (Fase 2, "menor cálculos duplicados"): cache por referência evita recomputar spans/boundaries a cada pan/zoom (achado com evidência real de benchmark)', () => {
  it('KillZoneBandsPlugin cacheia computeKillZoneSpans por identidade de `data` — só recalcula quando a referência muda, nunca a cada redraw', () => {
    const src = read('../src/chart/KillZoneBandsPlugin.tsx');
    expect(src).toContain('const spansCacheRef = useRef<{ data: typeof data; spans: KillZoneSpan[] } | null>(null);');
    const idx = src.indexOf('const cached = spansCacheRef.current;');
    expect(idx, 'bloco de cache não encontrado antes do computeKillZoneSpans').toBeGreaterThan(-1);
    const block = src.slice(idx, idx + 400);
    expect(block).toContain('if (cached && cached.data === dataRef.current) {');
    expect(block).toContain('spans = cached.spans;');
    expect(block).toContain('spans = computeKillZoneSpans(dataRef.current);');
    expect(block).toContain('spansCacheRef.current = { data: dataRef.current, spans };');
  });

  it('MarketSessionBandsPlugin recebe o MESMO fix (achado idêntico, mesma causa raiz) — cache por identidade de `data` para computeSessionKeyLevels (pós-redesenho da faixa, ver describe abaixo)', () => {
    const src = read('../src/chart/MarketSessionBandsPlugin.tsx');
    expect(src).toContain('const levelsCacheRef = useRef<{ data: typeof data; levels: SessionKeyLevel[] } | null>(null);');
    const idx = src.indexOf('const cached = levelsCacheRef.current;');
    expect(idx, 'bloco de cache não encontrado antes do computeSessionKeyLevels').toBeGreaterThan(-1);
    const block = src.slice(idx, idx + 400);
    expect(block).toContain('if (cached && cached.data === dataRef.current) {');
    expect(block).toContain('levels = cached.levels;');
    expect(block).toContain('levels = computeSessionKeyLevels(dataRef.current);');
    expect(block).toContain('levelsCacheRef.current = { data: dataRef.current, levels };');
  });

  it('LiquidationHeatmapPlugin NÃO ganhou o mesmo cache — benchmark real confirmou custo desprezível (computeLiquidationHeatmap ~0.006ms/chamada a N=500, teto real do feed) vs. computeKillZoneSpans (~1.2ms a N=2000): adicionar cache ali seria complexidade sem benefício medido, não "consistência" pela consistência', () => {
    const src = read('../src/chart/LiquidationHeatmapPlugin.tsx');
    expect(src).not.toContain('CacheRef');
    expect(src).toContain('const heat: LiquidationHeatmapResult = computeLiquidationHeatmap(events, sym);');
  });
});

describe('Achado real do Operador ("linha amarela que eu não sei o que significa" + "etiquetas não podem ficar em cima do valor do ativo"): Liquidity Sweep migra pro eixo anti-colisão, Session Key Levels perde o rótulo flutuante', () => {
  it('Liquidity Sweep: title nativo da price line fica vazio (nunca teve efeito visual real com axisLabelVisible:false — o texto real agora vive em priceAxisLabels, um rótulo de verdade onde antes não havia nenhum)', () => {
    const c = chart();
    // v3 (decaimento por idade): a cor nativa virou template dinâmico
    // (alpha real multiplicado no desenho), não mais uma string fixa.
    const idx = c.indexOf('color: `rgba(255, 140, 0, ${(alpha * 0.85).toFixed(3)})`,');
    expect(idx, 'price line de Liquidity Sweep não encontrada').toBeGreaterThan(-1);
    const block = c.slice(idx, idx + 1300);
    expect(block).toContain('title: "",');
    expect(block).not.toContain('⚡ SWEEP');
  });

  it('Liquidity Sweep: o texto real (⚡ SWEEP ↑/↓ N%) agora vive em priceAxisLabels, dedupe por preço, side:"left" (estrutural/histórico)', () => {
    const c = chart();
    const idx = c.indexOf('if (visibility.liquidity_sweep) {', c.indexOf('const priceAxisLabels = useMemo'));
    expect(idx, 'bloco de Sweep em priceAxisLabels não encontrado').toBeGreaterThan(-1);
    const block = c.slice(idx, idx + 1300);
    expect(block).toContain('const seenSweepPrices = new Set<number>();');
    // Lapidação institucional ("agrupar SWEEPs próximos"): clusterSweptPrices
    // (trap-detection.ts) substitui o loop plano por preço — 1 evento isolado
    // mantém o texto simples, 2+ eventos próximos viram "SWEEP ZONE (Nx)".
    expect(block).toContain('for (const cluster of clusterSweptPrices(uniqueLevels, LIQUIDITY_PROXIMITY_PCT)) {');
    expect(block).toContain('`⚡ SWEEP ${arrow} ${confidencePct}%`');
    expect(block).toContain('`⚡ SWEEP ZONE ${arrow} (${cluster.count}x) ${confidencePct}%`');
    expect(block).toContain('side: "left",');
    // Achado real de captura de tela (decaimento por idade): cluster
    // expirado (>200 candles) nunca entra no eixo.
    expect(block).toContain('const alpha = ageAlpha(age, SWEEP_DECAY);');
    expect(block).toContain('if (alpha <= 0) continue;');
  });

  it('Session Key Levels: currentSessionKeyLevel (useMemo puro, sempre a última ocorrência real) alimenta 2 entradas no eixo (High/Low), side:"left"', () => {
    const c = chart();
    expect(c).toContain('import { computeSessionKeyLevels } from "../nexus/market-session";');
    const memoIdx = c.indexOf('const currentSessionKeyLevel = useMemo(() => {');
    expect(memoIdx, 'currentSessionKeyLevel não encontrado').toBeGreaterThan(-1);
    const memoBlock = c.slice(memoIdx, memoIdx + 400);
    expect(memoBlock).toContain('if (data.length === 0) return null;');
    expect(memoBlock).toContain('const levels = computeSessionKeyLevels(data);');
    expect(memoBlock).toContain('return levels.length > 0 ? levels[levels.length - 1] : null;');

    const pushIdx = c.indexOf('if (visibility.session_key_levels && currentSessionKeyLevel) {');
    expect(pushIdx, 'bloco de Session Key Levels em priceAxisLabels não encontrado').toBeGreaterThan(-1);
    const pushBlock = c.slice(pushIdx, c.indexOf('return out;', pushIdx));
    expect(pushBlock).toContain('price: currentSessionKeyLevel.high,');
    expect(pushBlock).toContain('price: currentSessionKeyLevel.low,');
    expect((pushBlock.match(/side: "left",/g) ?? []).length).toBe(2);
  });

  it('SessionKeyLevelsPlugin.tsx: NUNCA mais desenha texto flutuante no canvas (zero ctx.fillText) — só a linha real; regressão travada por teste, não só por revisão manual', () => {
    const plugin = read('../src/chart/SessionKeyLevelsPlugin.tsx');
    expect(plugin).not.toContain('ctx.fillText');
    expect(plugin).not.toContain('ctx.font');
    expect(plugin).toContain('ctx.stroke();');
  });
});

describe('Lapidação institucional (diretiva com imagem de referência): Liquidity Sweep vs. pico do Liquidation Heatmap deixam de compartilhar praticamente o mesmo tom (H45 vs H47, mesma L/S/alpha — imperceptível a olho)', () => {
  it('Liquidity Sweep (price line + priceAxisLabels): laranja H33 nas 2 ocorrências reais — priceAxisLabels mantém a cor base fixa (0.85), a price line nativa virou template dinâmico (decaimento por idade, v3)', () => {
    const c = chart();
    expect(c).toContain('color: "rgba(255, 140, 0, 0.85)", // mesmo tom laranja da price line');
    expect(c).toContain('color: `rgba(255, 140, 0, ${(alpha * 0.85).toFixed(3)})`,');
    expect(c).not.toContain('rgba(255, 191, 0');
  });

  it('LiquidationHeatmapPlugin.tsx: PEAK_LABEL_COLOR vira rgba(255, 213, 0, 0.85) — ouro puro, distinto do laranja do Sweep', () => {
    const plugin = read('../src/chart/LiquidationHeatmapPlugin.tsx');
    expect(plugin).toContain('const PEAK_LABEL_COLOR = "rgba(255, 213, 0, 0.85)";');
    expect(plugin).not.toContain('rgba(255, 200, 0');
  });

  it('Kill Zones NÃO entra nesta diferenciação (banda de fundo, geometria/alpha diferentes — sem colisão real). v3: cores viraram templates dinâmicos com decaimento por idade, mas o TOM âmbar (255,176,32) e os 3 alphas base (0.06/0.22/0.65) seguem os mesmos.', () => {
    const killZones = read('../src/chart/KillZoneBandsPlugin.tsx');
    expect(killZones).toContain('const FILL_ALPHA = 0.06;');
    expect(killZones).toContain('const BORDER_ALPHA = 0.22;');
    expect(killZones).toContain('const LABEL_ALPHA = 0.65;');
    expect(killZones).toContain('rgba(255, 176, 32, ${(alpha * FILL_ALPHA).toFixed(3)})');
    expect(killZones).toContain('rgba(255, 176, 32, ${(alpha * BORDER_ALPHA).toFixed(3)})');
    expect(killZones).toContain('rgba(255, 176, 32, ${(alpha * LABEL_ALPHA).toFixed(3)})');
  });
});

describe('ADENDO "Refinamento das Sessões e Limpeza Visual": Market Sessions troca N linhas de altura total (1 por transição) por 1 faixa fina por segmento rente à base', () => {
  it('NUNCA mais desenha linha vertical de altura total (zero ctx.moveTo(x, 0) / lineTo(x, cssHeight)) — regressão travada por teste, não só por revisão manual', () => {
    const plugin = read('../src/chart/MarketSessionBandsPlugin.tsx');
    expect(plugin).not.toContain('ctx.moveTo(xLine, 0);');
    // computeSessionBoundaries/SessionBoundary só podem aparecer em PROSA
    // (comentário explicando a migração/o consumidor que continua vivo em
    // App.tsx) — nunca em import ou chamada real dentro deste plugin.
    expect(plugin).not.toContain('import { computeSessionBoundaries');
    expect(plugin).not.toContain('computeSessionBoundaries(dataRef.current)');
    expect(plugin).not.toContain(': SessionBoundary[]');
  });

  it('consome computeSessionKeyLevels (segmentos reais), nunca uma 3ª derivação paralela de sessão', () => {
    const plugin = read('../src/chart/MarketSessionBandsPlugin.tsx');
    expect(plugin).toContain('import { computeSessionKeyLevels, marketSessionFromUtc, sessionGenerationWeight, SESSION_GENERATION_FADE, type SessionKeyLevel } from "../nexus/market-session";');
    expect(plugin).toContain('levels = computeSessionKeyLevels(dataRef.current);');
  });

  it('redesenho #2 ("chegar mais próximo" da imagem de referência): faixa no TOPO (y=0), não mais rente à base — nunca altura total como Kill Zones (papel real é oposto: sessão é partição contínua, sempre presente — teria que ser fina; Kill Zone é ocasional — pode ser alta)', () => {
    const plugin = read('../src/chart/MarketSessionBandsPlugin.tsx');
    expect(plugin).toContain('const BAND_HEIGHT_PX = 24;');
    expect(plugin).toContain('ctx.fillRect(clippedX, 0, clippedWidth, BAND_HEIGHT_PX);');
    expect(plugin).not.toContain('cssHeight - BAND_HEIGHT_PX');
    expect(plugin).not.toContain('STRIP_HEIGHT_PX');
  });

  it('sessão corrente (closed:false) recebe alpha mais alto e estende até a borda direita; TODA sessão visível tenta rótulo (nome + janela UTC real), não só a corrente — mas só desenha texto com largura real suficiente', () => {
    const plugin = read('../src/chart/MarketSessionBandsPlugin.tsx');
    expect(plugin).toContain('const BAND_COLOR_CLOSED = "rgba(148, 163, 184, 0.16)";');
    expect(plugin).toContain('const BAND_COLOR_OPEN = "rgba(148, 163, 184, 0.42)";');
    expect(plugin).toContain('const isOpen = !level.closed;');
    expect(plugin).toContain('const x2 = isOpen ? cssWidth : timeScale.timeToCoordinate(level.endTime as unknown as Time);');
    // achado real (não fica preso a "só a última"): o gate de rótulo é
    // por LARGURA do segmento, nunca por índice/posição na lista.
    expect(plugin).not.toContain('i === lastIndex');
    expect(plugin).toContain('if (clippedWidth >= MIN_LABEL_WIDTH_PX) {');
    expect(plugin).toContain('if (clippedWidth >= MIN_SUBLABEL_WIDTH_PX) {');
  });

  it('janela UTC do rótulo (2ª linha) vem de marketSessionFromUtc — mesmo dado real do header, zero segunda fonte fabricada', () => {
    const plugin = read('../src/chart/MarketSessionBandsPlugin.tsx');
    const idx = plugin.indexOf('const reading = marketSessionFromUtc(new Date(level.startTime * 1000));');
    expect(idx, 'chamada real a marketSessionFromUtc não encontrada').toBeGreaterThan(-1);
    const block = plugin.slice(idx, idx + 600);
    expect(block).toContain("const windowShort = reading.windowUtc.split(\" (\")[0];");
    expect(block).toContain('ctx.fillText(windowShort, clippedX + 4, 13);');
  });

  it('divisor real entre sessões: 1px sólida (Fio de Seda), só a borda esquerda de cada segmento (partição contígua — desenhar as duas dobraria o traço)', () => {
    const plugin = read('../src/chart/MarketSessionBandsPlugin.tsx');
    const idx = plugin.indexOf('if (i > 0) {');
    expect(idx, 'bloco de divisor não encontrado').toBeGreaterThan(-1);
    const block = plugin.slice(idx, idx + 300);
    expect(block).toContain('ctx.lineWidth = 1;');
    expect(block).not.toContain('setLineDash');
  });

  it('tradePlanAbsenceReason (overlay de texto do canto) desce de top-2 pra top-7 pra abrir espaço real pra faixa nova de 24px — nunca 2 textos reais sobrepostos', () => {
    const c = chart();
    expect(c).toContain('className="absolute left-2 top-7 pointer-events-none select-none font-mono whitespace-nowrap text-[10px] tracking-wide"');
    expect(c).not.toContain('className="absolute left-2 top-2 pointer-events-none select-none font-mono whitespace-nowrap text-[10px] tracking-wide"');
  });

  it('EnhancedChart_110_Percent.tsx: chamada continua recebendo chart/series/data sem prop nova — o redesenho é inteiramente interno ao plugin', () => {
    const c = chart();
    const idx = c.indexOf('{visibility.market_sessions && (');
    expect(idx, 'montagem condicional de MarketSessionBandsPlugin não encontrada').toBeGreaterThan(-1);
    const block = c.slice(idx, idx + 200);
    expect(block).toContain('<MarketSessionBandsPlugin');
    expect(block).toContain('chart={chartReady?.chart ?? null}');
    expect(block).toContain('series={chartReady?.series ?? null}');
    expect(block).toContain('data={data}');
  });
});

describe('Kill Zones ICT no canvas (badge do header já existia, §6.48 — este plugin fecha o desenho real): camada própria, nunca dobrada em market_sessions', () => {
  it('importa KillZoneBandsPlugin — nunca uma segunda implementação de retângulo dentro de EnhancedChart_110_Percent', () => {
    const c = chart();
    expect(c).toContain('import { KillZoneBandsPlugin } from "./KillZoneBandsPlugin";');
  });

  it('montado condicionalmente por visibility.kill_zones, recebendo chart/series/data — mesmo contrato de props de MarketSessionBandsPlugin', () => {
    const c = chart();
    const idx = c.indexOf('{visibility.kill_zones && (');
    expect(idx, 'mount point de KillZoneBandsPlugin não encontrado').toBeGreaterThan(-1);
    const block = c.slice(idx, idx + 300);
    expect(block).toContain('<KillZoneBandsPlugin');
    expect(block).toContain('chart={chartReady?.chart ?? null}');
    expect(block).toContain('series={chartReady?.series ?? null}');
    expect(block).toContain('data={data}');
  });

  it('kill_zones é uma camada PRÓPRIA em CHART_LAYER_IDS/DEFAULT_CHART_LAYER_VISIBILITY/DEFAULT_CHART_LAYER_AUTO_MODE — nunca reaproveita market_sessions (conceito distinto, ver header de kill-zones.ts)', () => {
    const c = chart();
    expect(c).toContain('"kill_zones",');
    expect(c).toContain('kill_zones: true,');
  });

  it('painel "Camadas do Gráfico" (App.tsx) ganha a linha KILL ZONES (ICT), no Modo Inteligência (leitura de mercado, nunca específica do plano ativo)', () => {
    const a = app();
    expect(a).toContain('{ id: "kill_zones", label: "KILL ZONES (ICT)" }');
    const intelMatch = a.match(/const CHART_LAYERS_INTELLIGENCE_PRESET = new Set<ChartLayerId>\(\[([\s\S]*?)\]\);/);
    expect(intelMatch, 'CHART_LAYERS_INTELLIGENCE_PRESET não encontrado').not.toBeNull();
    expect(intelMatch![1]).toContain('"kill_zones"');
  });

  it('Relevance Engine cobre kill_zones desde o nascimento da camada — nunca repete o gap retroativo do Task #93 (liquidation_heatmap/liquidity_sweep/market_sessions sem regra própria)', () => {
    const a = app();
    expect(a).toContain('import { activeKillZones } from "./nexus/kill-zones";');
    expect(a).toContain('const hasActiveKillZone = (activeKillZones(new Date())?.active.length ?? 0) > 0;');
    expect(a).toContain('hasActiveKillZone,');
  });
});

describe('Session Key Levels (pedido do Operador, captura de indicador de referência "Key Levels"): máxima/mínima real de cada sessão como nível horizontal, reaproveitando market-session.ts', () => {
  it('importa SessionKeyLevelsPlugin — nunca uma segunda geometria de retângulo/linha dentro de EnhancedChart_110_Percent', () => {
    const c = chart();
    expect(c).toContain('import { SessionKeyLevelsPlugin } from "./SessionKeyLevelsPlugin";');
  });

  it('montado condicionalmente por visibility.session_key_levels, recebendo chart/series/data — mesmo contrato de props de MarketSessionBandsPlugin/KillZoneBandsPlugin', () => {
    const c = chart();
    const idx = c.indexOf('{visibility.session_key_levels && (');
    expect(idx, 'mount point de SessionKeyLevelsPlugin não encontrado').toBeGreaterThan(-1);
    const block = c.slice(idx, idx + 300);
    expect(block).toContain('<SessionKeyLevelsPlugin');
    expect(block).toContain('chart={chartReady?.chart ?? null}');
    expect(block).toContain('series={chartReady?.series ?? null}');
    expect(block).toContain('data={data}');
  });

  it('session_key_levels é uma camada PRÓPRIA em CHART_LAYER_IDS/DEFAULT_CHART_LAYER_VISIBILITY/DEFAULT_CHART_LAYER_AUTO_MODE', () => {
    const c = chart();
    expect(c).toContain('"session_key_levels",');
    expect(c).toContain('session_key_levels: true,');
  });

  it('painel "Camadas do Gráfico" (App.tsx) ganha a linha KEY LEVELS (SESSÕES), no Modo Inteligência (mesmo papel estrutural de S1/R1, nunca específica do plano ativo)', () => {
    const a = app();
    expect(a).toContain('{ id: "session_key_levels", label: "KEY LEVELS (SESSÕES)" }');
    const intelMatch = a.match(/const CHART_LAYERS_INTELLIGENCE_PRESET = new Set<ChartLayerId>\(\[([\s\S]*?)\]\);/);
    expect(intelMatch, 'CHART_LAYERS_INTELLIGENCE_PRESET não encontrado').not.toBeNull();
    expect(intelMatch![1]).toContain('"session_key_levels"');
  });

  it('Relevance Engine cobre session_key_levels desde o nascimento da camada — mesma disciplina de kill_zones/§6.55, nunca repete o gap retroativo do Task #93', () => {
    const a = app();
    expect(a).toContain('import { MAX_KEY_LEVELS_SHOWN } from "./chart/SessionKeyLevelsPlugin";');
    expect(a).toContain('import { marketSessionFromUtc, computeSessionBoundaries, computeSessionKeyLevels } from "./nexus/market-session";');
    expect(a).toContain('const sessionKeyLevels = Array.isArray(chartData) ? computeSessionKeyLevels(chartData) : [];');
    expect(a).toContain('const recentSessionKeyLevels = sessionKeyLevels.slice(-MAX_KEY_LEVELS_SHOWN);');
    expect(a).toContain('hasSessionKeyLevelNearPrice,');
  });

  it('a janela de exibição (MAX_KEY_LEVELS_SHOWN) usada pelo plugin e pela relevância é a MESMA constante — nunca duas fontes de "quantos níveis contam"', () => {
    const plugin = read('../src/chart/SessionKeyLevelsPlugin.tsx');
    expect(plugin).toContain('export const MAX_KEY_LEVELS_SHOWN = 5;');
    expect(plugin).toContain('const recent = levels.slice(-MAX_KEY_LEVELS_SHOWN);');
  });

  it('cor reaproveitada de Suporte/Resistência (S1/R1) — máxima da sessão usa o MESMO vermelho de resistência, mínima o MESMO verde de suporte, zero tom novo na paleta', () => {
    const plugin = read('../src/chart/SessionKeyLevelsPlugin.tsx');
    expect(plugin).toContain('rgba(255, 0, 85,'); // mesmo tom de R1/SHORT_RGB
    expect(plugin).toContain('rgba(0, 255, 170,'); // mesmo tom de S1/LONG_RGB
  });

  it('cache por identidade de referência desde o NASCIMENTO do plugin (aprendizado de §6.56 aplicado, nunca uma correção retroativa)', () => {
    const plugin = read('../src/chart/SessionKeyLevelsPlugin.tsx');
    expect(plugin).toContain('const levelsCacheRef = useRef<{ data: typeof data; levels: SessionKeyLevel[] } | null>(null);');
    expect(plugin).toContain('if (cached && cached.data === dataRef.current) {');
  });
});

describe('Consolidação Final §26-§30: Nexus Line + confluência informativa', () => {
  it('NL nasce no MESMO efeito da VWAP no gráfico (mesmos candles, nunca dessincroniza)', () => {
    const c = chart();
    expect(c).toContain('const nl = computeNexusLineSeries(data);');
    expect(c).toContain('nexusLineSeriesRef.current.setData(nl.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));');
    // fio de seda — cor de estado real via applyOptions (Diretriz de
    // Refinamento Visual §5/§6: title NUNCA mais reescrito aqui, ver teste
    // dedicado abaixo — o glifo de estado chega ao Operador só via
    // priceAxisLabels/PriceLabelStackPlugin agora).
    expect(c).toContain('nexusLineSeriesRef.current.applyOptions({ color: NL_STATE_COLOR[s] });');
  });

  it('Diretriz de Refinamento Visual §5/§6: NL também nunca mais reescreve title — mesma correção da VWAP (achado real: title nativo colidia com S1/EMA na posição NATURAL, sem resolução de colisão)', () => {
    const c = chart();
    expect(c).not.toContain('title: `NL ${LINE_STATE_GLYPH[s]}`');
    const idx = c.indexOf('const nexusLineSeries = chart.addSeries(LineSeries, {');
    const closeIdx = c.indexOf('nexusLineSeriesRef.current = nexusLineSeries;');
    expect(c.slice(idx, closeIdx)).toContain('title: "",');
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

  it('gráfico: terminologia PRZ profissional + ETA do ápice na linha EPA da Wolfe (rótulos compactos EPC §4)', () => {
    const c = chart();
    expect(c).toContain('`${top.pattern} ${hDirGlyph} PRZ ${(top.fitScore * 100).toFixed(0)}%`');
    expect(c).toContain('`WOLFE EPA${etaLabel ? ` · ETA ${etaLabel}` : ""}`');
    expect(c).toContain('}, [harmonicHits, data, visibility.harmonics]);'); // intervalo real de barra vem de data
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
  it('medição inclui o stop EFETIVO (ratchet pode encostar num alvo); a decisão em si vem da função pura testada por execução real em label-compaction.test.ts (Diretriz de Evolução Profissional, Fase 10-P)', () => {
    const c = chart();
    expect(c).toContain('import { shouldCompactLabels } from "./label-compaction";');
    expect(c).toContain('const levels = [effectiveStopPrice, ...tradePlan.targets.map((t) => t.price)].sort((a, b) => a - b);');
    expect(c).toContain('const compactLabels = shouldCompactLabels(levels);');
  });

  it('modo compacto: label + distância + ETA (basis/R:R seguem no strip); modo cheio inalterado; OMEGA CORE V-MAX Fase 4 (§4.2) acrescentou o sufixo real de obstáculos aos dois modos', () => {
    const c = chart();
    expect(c).toContain('? `${label}${distPct}${etaLabel ? ` · ${etaLabel}` : ""}${obstacleSuffix(target.obstacleCount)}`');
    expect(c).toContain(': `${label} · ${target.basis}${rr !== null ? ` · 1:${rr.toFixed(2)}` : ""}${distPct}${etaLabel ? ` · ETA ${etaLabel}` : ""}${obstacleSuffix(target.obstacleCount)}`');
  });

  it('a âncora do preço real permanece documentada onde a decisão de compactar agora vive (label-compaction.ts): applyOptions nunca recebe um price deslocado no título compacto', () => {
    const lc = read('../src/chart/label-compaction.ts');
    expect(lc).toContain('ancoradas no preço real: o preço matemático nunca muda para');
    expect(lc).toContain('caber a etiqueta.');
  });
});

// ─── Cockpit de Leitura §4/§11: fiação das duas lacunas reais ───
describe('Cockpit §4: estados VWAP/NL entram como inputs do buildNexusDecision', () => {
  it('App passa os MESMOS estados do header/gráfico (fonte única) + deps atualizadas', () => {
    const a = app();
    expect(a).toContain('vwapState: vwapCtx?.state ?? null,\n        nexusLineState: nlState,');
    expect(a).toContain('pdForDecision, vwapCtx, nlState],');
  });
});

describe('Cockpit §11: carimbo do contexto de abertura + ETA previsto × realizado', () => {
  it('efeito do App carimba UMA vez (guard contextAtOpen !== undefined) com leituras reais', () => {
    const a = app();
    expect(a).toContain('if (!active || active.contextAtOpen !== undefined) return;');
    expect(a).toContain('useUnifiedSnapshotStore.getState().stampPlanOpenContext({');
    expect(a).toContain('etaMsAtOpen: nextEta?.ms ?? null,');
  });

  it('store expõe a ação stampPlanOpenContext ligada ao stampOpenContext puro', () => {
    const s = store();
    expect(s).toContain('stampPlanOpenContext: (ctx: PlanOpenContext) => void;');
    expect(s).toContain('s.trackRecord = stampOpenContext(s.trackRecord as TrackRecordState, ctx);');
  });

  it('painel Track Record exibe previsto × realizado do último plano resolvido (dash honesto sem ambos)', () => {
    const a = app();
    expect(a).toContain('label="ETA previsto × realizado (último resolvido)"');
    expect(a).toContain('formatEtaDuration(h.resolvedAt - h.openedAt)');
    expect(a).toContain('h.contextAtOpen ? formatEtaRange(h.contextAtOpen.etaMsMinAtOpen, h.contextAtOpen.etaMsAtOpen) : null');
  });
});

// ─── Foto ao vivo do Operador: colisão orb×cartão VWAP no header ───
describe('Header ancorado (colisão da 1ª foto com dados reais): região central rolável + âncoras fixas', () => {
  it('região central: overflow-x-auto + scrollbar oculta + NENHUM filho encolhe (nada vaza sobre vizinho)', () => {
    const a = app();
    expect(a).toContain('flex-1 min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*]:shrink-0');
  });

  it('omnibox fica FORA da região rolável (dropdown absoluto seria clipado) e o cluster do ativo é shrink-0', () => {
    const a = app();
    expect(a).toContain('border-r border-[#00f0ff20] h-[70%] shrink-0');
    // a região rolável abre DEPOIS do fechamento do cluster do ativo
    const cluster = a.indexOf('h-[70%] shrink-0');
    const region = a.indexOf('[&>*]:shrink-0');
    expect(cluster).toBeGreaterThan(-1);
    expect(region).toBeGreaterThan(cluster);
  });

  it('âncora direita (estado + orbs + power) vive num cluster shrink-0 fora da região rolável', () => {
    const a = app();
    const anchorIdx = a.indexOf('{/* Âncora direita fixa (§5 do header)');
    expect(anchorIdx).toBeGreaterThan(a.indexOf('[&>*]:shrink-0'));
    const anchorBlock = a.slice(anchorIdx, anchorIdx + 700);
    expect(anchorBlock).toContain('<div className="flex items-center gap-2 md:gap-3 h-full shrink-0">');
    expect(anchorBlock).toContain('<SystemStatusBadge />');
  });
});
