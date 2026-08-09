// volume-profile.ts — V-MAX Fase 1.3: camada pura de análise do Volume
// Profile computado pelo WASM Quant Core (lib.rs::volume_profile, no
// quant-worker). O histograma pesado (candles × buckets) vem PRONTO do
// worker; aqui só rodam derivações O(buckets) triviais (≤512 números,
// microssegundos) — HVN/LVN/preço-por-bucket — documentadamente leves
// demais para justificar uma viagem extra de postMessage.
//
// HVN/LVN nunca usam limiar fixo (Regra de Ouro 1): o corte é um percentil
// real da distribuição de volumes efetivamente observada nos buckets
// não-vazios — mesmo princípio do "trade grande" de orderflow-history.ts
// (percentil real da amostra, valor sempre presente na própria amostra,
// nunca interpolado). Parâmetros documentados abaixo.
//
// Nota de escopo honesta (auditoria Fase 1.3): o perfil é uma aproximação
// OHLCV declarada (volume do candle distribuído uniformemente por
// [low,high] — ver lib.rs) porque tick stream real para o mercado Futures
// do chart não existe neste codebase; o único tick stream real é MEXC
// Spot, outro mercado. Nunca é apresentado como perfil tick-level.
//
// Footprint (RECUSADO, auditoria ADITIVO V-MAX Etapa 18, mesma raiz): um
// Footprint real precisa de volume-por-preço-por-candle (compra vs. venda
// no mesmo candle), granularidade que exige tick/trade stream do PRÓPRIO
// mercado do candle. Como não existe tick stream real de Binance Futures
// neste codebase (só klines, liquidations via forceOrder, e probes REST
// de premium-index — nenhum dá trade-a-trade), a única fonte de tick real
// disponível é de novo MEXC Spot. Bucketar ticks de MEXC Spot dentro das
// colunas de candles de Binance Futures não seria uma aproximação honesta
// como a deste arquivo (mesmo instrumento, granularidade menor) — seria
// atribuir fluxo de ordens de UM mercado a candles de OUTRO mercado,
// apresentado como se fosse do próprio candle. Isso viola a Regra de Ouro 1
// (zero dado fabricado/mal-atribuído no fluxo real) mais diretamente do
// que a aproximação OHLCV acima, que ao menos preserva o mesmo instrumento
// e mesmo período. Decisão: não construir Footprint sobre o gráfico
// principal até existir um tick stream real de Binance Futures neste
// codebase. Registrado honestamente em vez de construído — ver
// SYSTEM_HANDBOOK.md §6.92.
import { realPercentile } from "./percentile";

export interface VolumeProfileResult {
  histogram: number[]; // volume real por bucket, preço ascendente
  rangeMin: number;
  rangeMax: number;
  bucketCount: number;
  pocIndex: number;
  pocPrice: number; // centro do bucket POC
  hvnIndices: number[];
  lvnIndices: number[];
  candleCount: number;
  computedAt: number; // ms real
  engineVersion: number; // 1000 escalar / 1001 simd — telemetria honesta
}

export interface VolumeProfileSnapshot {
  // Janela completa de candles reais do chart (Fixed Range).
  fixedRange: VolumeProfileResult | null;
  // Só os candles desde a abertura da sessão UTC corrente (Session).
  session: VolumeProfileResult | null;
}

// Top/bottom quartil da distribuição real de buckets não-vazios — um nó
// só é "high/low volume node" se além de máximo/mínimo LOCAL também for
// globalmente relevante na distribuição observada.
const HVN_PERCENTILE = 0.75;
const LVN_PERCENTILE = 0.25;

/** HVN = máximo local do histograma com volume ≥ percentil 75 real dos
 *  buckets não-vazios; LVN = mínimo local com volume ≤ percentil 25 real
 *  (buckets vazios não contam — vazio não é "nó de baixo volume", é
 *  ausência de negociação naquela faixa). Histograma curto demais (<3
 *  buckets, sem vizinhança para "local") devolve listas vazias honestas. */
export function detectHvnLvn(histogram: number[]): { hvn: number[]; lvn: number[] } {
  if (histogram.length < 3) return { hvn: [], lvn: [] };
  const nonZero = histogram.filter((v) => v > 0);
  if (nonZero.length === 0) return { hvn: [], lvn: [] };
  const sorted = [...nonZero].sort((a, b) => a - b);
  const hvnThreshold = realPercentile(sorted, HVN_PERCENTILE);
  const lvnThreshold = realPercentile(sorted, LVN_PERCENTILE);

  const hvn: number[] = [];
  const lvn: number[] = [];
  for (let i = 1; i < histogram.length - 1; i++) {
    const v = histogram[i];
    const left = histogram[i - 1];
    const right = histogram[i + 1];
    if (v > 0 && v >= left && v >= right && (v > left || v > right) && v >= hvnThreshold) {
      hvn.push(i);
    }
    if (v > 0 && v <= left && v <= right && (v < left || v < right) && v <= lvnThreshold) {
      lvn.push(i);
    }
  }
  return { hvn, lvn };
}

/** Centro de preço real de um bucket. */
export function bucketMidPrice(index: number, rangeMin: number, rangeMax: number, bucketCount: number): number {
  const width = (rangeMax - rangeMin) / bucketCount;
  return rangeMin + (index + 0.5) * width;
}

/** Session = candles desde a meia-noite UTC do dia do candle MAIS RECENTE
 *  (o "hoje" real do dado, não o relógio local do dispositivo — um iPad em
 *  UTC-3 às 22h já está no dia UTC seguinte). `time` em segundos Unix,
 *  mesmo formato real dos candles do chart (Binance kline `t`). */
export function filterSessionCandles<T extends { time: number }>(candles: T[]): T[] {
  if (candles.length === 0) return candles;
  const lastMs = candles[candles.length - 1].time * 1000;
  const d = new Date(lastMs);
  const sessionStartSec = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 1000;
  return candles.filter((c) => c.time >= sessionStartSec);
}
