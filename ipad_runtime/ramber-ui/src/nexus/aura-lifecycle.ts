// aura-lifecycle.ts — Neural Market Aura (NMA), especificação do Operador
// ("AR10 CYBORG — Neural Market Aura", versão Ω-INFINITY). Motor puro que
// traduz o estado JÁ REAL do Trade Plan/Signal Track Record/Confluence
// Engine/Regime Engine num conjunto de parâmetros visuais — nunca gera
// leitura própria, nunca decide nada (LEI 24, mesma regra do Comitê/
// Cenários/Confluence Engine): "a Aura não toma decisões, apenas traduz
// visualmente as decisões já produzidas pelo organismo".
//
// AUDITORIA ANTES DE CONSTRUIR (achados reais, registrados por completo
// mesmo os que reduzem o escopo do pedido original):
//
//  1. "Fonte dos Dados" da especificação já existe quase por inteiro:
//     Entrada/Alvo/Stop -> nexus/trade-plan.ts (TradePlan), Convicção ->
//     nexus/confluence-engine.ts (Council + Multi-Timeframe + Ensemble,
//     já uma leitura real 0..1), Estrutura -> bos-choch-engine.js,
//     Regime/Volume -> market-regime/ + Volume Profile, Order Flow -> CVD.
//     Este motor não cria nenhuma medição nova — só COMBINA leituras já
//     reais e testadas.
//  2. A especificação fala em "alvos" (plural) e um ciclo de vida por
//     alvo. O TradePlan real desta base (`nexus/trade-plan.ts`) tem
//     `target: TradePlanLevel` — UM alvo, contrato versionado v1. Não
//     existe um segundo alvo real para desenhar. Honestamente: este
//     motor trabalha com o alvo único real que existe hoje; um segundo
//     alvo exigiria estender TRADE_PLAN_CONTRACT_VERSION e redesenhar
//     signal-track-record.ts (que fecha o rastreamento no primeiro toque
//     de QUALQUER nível) — mudança real, não fabricada aqui.
//  3. Não existe hoje nenhum "estado" per-target persistido — hit/miss é
//     recomputado a cada render em dois lugares (EnhancedChart_110_Percent
//     e TradePlanTopStrip). O único estado formal e persistido é o do
//     PLANO inteiro, em signal-track-record.ts (TrackedPlanStatus: OPEN |
//     TARGET_HIT | STOP_HIT | REPLACED) — este motor deriva a fase da
//     Aura a partir DESSE estado real, sem inventar um segundo.
//  4. "Silk Flow Dinâmico" pede que o Fio de Seda "engrosse/afine" com a
//     convicção — conflito direto com a Regra de Ouro 5 ("1px sólida...
//     zero exceção"). Resolvido usando as OUTRAS opções que a própria
//     especificação já lista (pulsar, variar intensidade luminosa): a
//     convicção real vira largura/opacidade do PREENCHIMENTO do corredor
//     (uma forma nova, não a linha de marcação em si) — mesmo princípio
//     já usado pelo Volume Profile (espessura de barra = magnitude real,
//     nunca incerteza de preço). O Fio de Seda em si (linhas de preço já
//     existentes) nunca muda de largura ou vira tracejado.
//  5. Não existe hoje nenhum overlay de canvas com clock de animação
//     perpétuo (todos os plugins são dirty-flag: redesenham só quando um
//     dado real muda). Esta v1 preserva essa arquitetura — a Aura
//     redesenha reagindo a preço/convicção/status reais, nunca um loop
//     rAF "respirando" sozinho. Uma pulsação verdadeiramente contínua é
//     uma mudança de arquitetura real (Main Thread sagrada pede
//     iniciativa própria e isolada para isso) — fast-follow documentado,
//     não fabricado aqui.
//  6. "Nova estrutura -> nova onda" / "perda de estrutura -> dissolução
//     gradual" (seção Market Pulse) não precisam de mecanismo bespoke:
//     CHOCH contra a direção do plano já reduz a concordância real do
//     Council/Multi-Timeframe, que já reduz `conviction` (Confluence
//     Engine), que já afina o corredor — propriedade emergente da cadeia
//     de dependência real já existente, não uma segunda lógica.
//  7. Achado real de auditoria (FASE Ω Priority 3, complemento honesto ao
//     item 6): essa cadeia emergente é real, mas não é instantânea nem
//     sem diluição. O BOS/CHOCH só chega até aqui via Council/Multi-
//     Timeframe, e a Matriz Multi-Timeframe só recomputa no seu próprio
//     ciclo real (efeito periódico de 60s em App.tsx) — nunca no mesmo
//     render em que o rompimento aparece no StructureBreakMarkersPlugin.
//     E quando chega, um único CHOCH é UM voto entre vários agentes do
//     Conselho e UM prazo entre vários da Matriz: a queda de `conviction`
//     é real, mas amortecida pelo pool linear (Stone/DeGroot), nunca uma
//     queda 1:1 com o evento. Honestamente: o corredor da Aura pode levar
//     segundos a ~60s para refletir qualquer afinamento depois de um
//     CHOCH real na tela — a Aura espelha a CONVICÇÃO em tempo real, que
//     por sua vez reage ao BOS/CHOCH com atraso e diluição reais, não o
//     BOS/CHOCH diretamente.
//
// HIERARQUIA INVIOLÁVEL (LEI 24): esta leitura nunca altera
// TradePlan/TrackRecordState/engine.direction — puro espelho visual.
import type { TradePlan } from "./trade-plan";
import type { TrackedPlan, TrackRecordState } from "./signal-track-record";
import { ageAlpha, type DecayConfig } from "../chart/annotation-decay";

export type AuraPhase = "BIRTH" | "ESTABLISHED" | "TARGET_HIT" | "STOP_HIT" | "REPLACED";
export type TargetProximity = "WAITING" | "APPROACHING" | "HIT";

// Duração real (ms) de uma barra por timeframe — os 14 valores reais já
// aceitos pela régua de timeframe do gráfico (nexus/types.ts's Timeframe).
// Aritmética de calendário simples, não uma medição; "1M" usa 30 dias como
// aproximação documentada (o próprio conceito de "mês" como duração fixa
// já é uma aproximação, mesma natureza de AFFECTIVE_HALF_LIFE_MS).
export const TIMEFRAME_MS: Record<string, number> = {
  "1m": 60_000, "3m": 180_000, "5m": 300_000, "15m": 900_000, "30m": 1_800_000,
  "1h": 3_600_000, "2h": 7_200_000, "4h": 14_400_000, "6h": 21_600_000,
  "8h": 28_800_000, "12h": 43_200_000,
  "1d": 86_400_000, "1w": 604_800_000, "1M": 2_592_000_000,
};

export interface AuraReading {
  status: "OK" | "DADOS_INSUFICIENTES";
  reason: string | null;
  // Geometria real do corredor (entrada/alvo/direção) — mesmo TradePlan
  // que TradePlanZonePlugin já desenha como caixa de entrada; esta leitura
  // nunca recomputa uma segunda geometria.
  plan: TradePlan | null;
  phase: AuraPhase | null;
  targetProximity: TargetProximity | null;
  // Massa de opinião real do Confluence Engine (0..1) — largura/força do
  // corredor, NUNCA probabilidade de acerto (mesma honestidade de sempre).
  corridorWidthFactor: number | null;
  // ATR% real normalizado (0..1) — intensidade do "Market Pulse" da Aura,
  // nunca uma segunda medição de volatilidade.
  pulseIntensity: number | null;
  // Alpha geral (rampa de nascimento OU decaimento de dissolução) — 0..1.
  fadeAlpha: number;
  computedAt: number;
}

function insufficient(reason: string, computedAt: number): AuraReading {
  return {
    status: "DADOS_INSUFICIENTES",
    reason,
    plan: null,
    phase: null,
    targetProximity: null,
    corridorWidthFactor: null,
    pulseIntensity: null,
    fadeAlpha: 0,
    computedAt,
  };
}

// Rampa de nascimento: 0 -> 1 linear nas primeiras BIRTH_BARS barras reais
// desde a abertura do plano — o inverso simples de ageAlpha (que decai),
// não vale a pena abstrair uma segunda função de decaimento parametrizável
// para uma rampa de subida trivial (extrair só quando um segundo
// consumidor precisar, mesmo princípio que já gerou annotation-decay.ts).
const BIRTH_BARS = 3;
function birthAlpha(ageBars: number): number {
  if (ageBars <= 0) return 0;
  if (ageBars >= BIRTH_BARS) return 1;
  return ageBars / BIRTH_BARS;
}

// Dissolução: reaproveita o MESMO ageAlpha do Ciborgue Vivo (candles, não
// relógio de parede) — zero segunda matemática de decaimento.
const DISSOLVE_CONFIG: DecayConfig = { fadeStartCandles: 2, expireCandles: 12, minAlpha: 0.08 };

// Proximidade real do alvo, escalada pelo ATR% real (Fase D) — nunca uma
// porcentagem fixa arbitrária: um ativo com ATR alto precisa de uma banda
// maior para "aproximando" significar a mesma coisa que num ativo calmo.
// Parâmetro documentado (mesma natureza do FIB_FULL_CONFLUENCE_SOURCES=3
// e dos limiares 70/30 do RSI de Wilder) — não uma medição.
const APPROACH_ATR_MULTIPLE = 0.5;

// Teto de saturação do Market Pulse: 3% de ATR já é uma leitura quente
// para USDT-M majors em timeframes baixos — acima disso a intensidade
// visual satura em 1, nunca cresce sem limite. Parâmetro documentado,
// mesma natureza dos outros limiares acima.
const PULSE_ATR_SATURATION_PERCENT = 3;

export interface AuraLifecycleInput {
  trackRecord: TrackRecordState;
  livePrice: number | null;
  // ConvictionReading.convictionAdjusted ?? conviction (Confluence Engine,
  // Phase Ω Priority 2) — já real, já testado, nunca recomputado aqui.
  conviction: number | null;
  atrPercent: number | null;
  // Duração real (ms) de uma barra no timeframe ativo do gráfico — idade
  // em "barras decorridas" é aproximada por tempo-decorrido/timeframeMs
  // (TrackedPlan guarda timestamps reais, não índice de candle; dividir
  // pelo timeframe ativo é a mesma unidade honesta "idade em candles" que
  // annotation-decay.ts já usa, só derivada do relógio real em vez de um
  // índice de array).
  timeframeMs: number;
  now?: number;
}

/** Qual TrackedPlan a Aura deve espelhar agora: o plano aberto real, ou —
 *  se acabou de resolver/ser substituído — a última entrada real do
 *  histórico, só enquanto ainda está dentro da janela de dissolução.
 *  Nunca mistura dois planos distintos numa mesma leitura. */
function selectTrackedPlan(trackRecord: TrackRecordState): TrackedPlan | null {
  if (trackRecord.active) return trackRecord.active;
  const last = trackRecord.history[trackRecord.history.length - 1];
  return last ?? null;
}

function phaseFromStatus(tracked: TrackedPlan, ageBars: number): AuraPhase {
  if (tracked.status === "OPEN") return ageBars < BIRTH_BARS ? "BIRTH" : "ESTABLISHED";
  if (tracked.status === "TARGET_HIT") return "TARGET_HIT";
  if (tracked.status === "STOP_HIT") return "STOP_HIT";
  return "REPLACED";
}

/** Motor de Confluência Visual da Neural Market Aura. Fail-closed: sem
 *  plano real rastreado (nunca houve LONG/SHORT do Core Engine, ou o
 *  último já dissolveu por completo) => DADOS_INSUFICIENTES honesto —
 *  nunca uma aura fabricada sem operação real por trás. */
export function computeAuraReading(input: AuraLifecycleInput): AuraReading {
  const computedAt = input.now ?? Date.now();
  const tracked = selectTrackedPlan(input.trackRecord);
  if (!tracked) return insufficient("nenhum_trade_plan_real_rastreado_nesta_janela", computedAt);
  if (!Number.isFinite(input.timeframeMs) || input.timeframeMs <= 0) {
    return insufficient("timeframe_real_indisponivel_para_medir_idade_em_barras", computedAt);
  }

  const referenceAt = tracked.status === "OPEN" ? tracked.openedAt : (tracked.resolvedAt ?? tracked.openedAt);
  const ageBars = Math.max(0, (computedAt - referenceAt) / input.timeframeMs);
  const phase = phaseFromStatus(tracked, ageBars);

  const fadeAlpha = phase === "BIRTH"
    ? birthAlpha(ageBars)
    : phase === "ESTABLISHED"
      ? 1
      : ageAlpha(ageBars, DISSOLVE_CONFIG);

  // Só a fase de dissolução vira "sem leitura": um plano recém-nascido
  // (fadeAlpha 0 no primeiro instante, subindo a seguir) ainda É uma
  // operação real em curso — diferente de "nada para mostrar". A rampa de
  // nascimento é honesta em desenhar quase nada por um instante; a
  // dissolução completa é honesta em parar de desenhar de vez.
  const isDissolvePhase = phase === "TARGET_HIT" || phase === "STOP_HIT" || phase === "REPLACED";
  if (isDissolvePhase && fadeAlpha <= 0) {
    return insufficient("aura_dissolvida_apos_resolucao_real", computedAt);
  }

  const plan = tracked.plan;
  let targetProximity: TargetProximity | null = null;
  if (phase === "TARGET_HIT") {
    targetProximity = "HIT";
  } else if ((phase === "BIRTH" || phase === "ESTABLISHED") && Number.isFinite(input.livePrice) && Number.isFinite(input.atrPercent)) {
    const price = input.livePrice as number;
    const atr = input.atrPercent as number;
    const distancePercent = (Math.abs(price - plan.target.price) / plan.target.price) * 100;
    targetProximity = distancePercent <= atr * APPROACH_ATR_MULTIPLE ? "APPROACHING" : "WAITING";
  } else if (phase === "BIRTH" || phase === "ESTABLISHED") {
    // Sem ATR real ainda medido: não há banda honesta para "aproximando" —
    // WAITING é a leitura correta, nunca um palpite de proximidade.
    targetProximity = "WAITING";
  }

  const corridorWidthFactor = Number.isFinite(input.conviction) ? Math.max(0, Math.min(1, input.conviction as number)) : null;
  const pulseIntensity = Number.isFinite(input.atrPercent)
    ? Math.max(0, Math.min(1, (input.atrPercent as number) / PULSE_ATR_SATURATION_PERCENT))
    : null;

  return {
    status: "OK",
    reason: null,
    plan,
    phase,
    targetProximity,
    corridorWidthFactor,
    pulseIntensity,
    fadeAlpha,
    computedAt,
  };
}
