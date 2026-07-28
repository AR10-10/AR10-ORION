// market-session.ts — Refinamento Final §1 ("Sessão Atual" no header).
//
// Derivação PURA da sessão de mercado global a partir do relógio UTC real
// (cripto negocia 24/7, mas o caráter de liquidez/volume segue as sessões
// tradicionais — é contexto real de decisão, não decoração). Zero rede,
// zero estado: função determinística de Date → rótulo.
//
// Honestidade das janelas: são janelas FIXAS em UTC, documentadas abaixo —
// uma aproximação deliberada. Os horários institucionais reais de
// Londres/Nova York deslocam ±1h com o horário de verão (DST); manter
// janelas fixas evita fingir uma precisão de calendário que este módulo
// não computa. O tooltip da UI divulga essa aproximação (nunca afirmar
// mais precisão do que existe — mesma regra do resto do sistema).
//
// Janelas (UTC), cobrindo as 24h sem buraco nem sobreposição ambígua:
//   00:00–07:00  ÁSIA         (Tóquio abre 00:00 UTC; Sydney ainda ativa)
//   07:00–12:00  LONDRES      (abertura europeia ~07:00–08:00 UTC)
//   12:00–16:00  LONDRES+NY   (o overlap real de maior volume do dia)
//   16:00–21:00  NOVA YORK    (tarde americana, Europa fechada)
//   21:00–24:00  PACÍFICO     (Sydney abre ~21:00–22:00 UTC; Ásia a seguir)
export const MARKET_SESSION_CONTRACT_VERSION = 1 as const;

export type MarketSessionId = "ASIA" | "LONDRES" | "LONDRES_NY" | "NOVA_YORK" | "PACIFICO";

export interface MarketSessionReading {
  contractVersion: typeof MARKET_SESSION_CONTRACT_VERSION;
  id: MarketSessionId;
  label: string; // rótulo curto para o header
  windowUtc: string; // janela real usada, para o tooltip verificável
}

const SESSIONS: { id: MarketSessionId; label: string; startHour: number; endHour: number }[] = [
  { id: "ASIA", label: "Ásia", startHour: 0, endHour: 7 },
  { id: "LONDRES", label: "Londres", startHour: 7, endHour: 12 },
  { id: "LONDRES_NY", label: "Londres+NY", startHour: 12, endHour: 16 },
  { id: "NOVA_YORK", label: "Nova York", startHour: 16, endHour: 21 },
  { id: "PACIFICO", label: "Pacífico", startHour: 21, endHour: 24 },
];

export function marketSessionFromUtc(date: Date): MarketSessionReading | null {
  const t = date.getTime();
  if (!Number.isFinite(t)) return null; // Date inválida => null honesto, nunca uma sessão fabricada
  const hour = date.getUTCHours();
  const s = SESSIONS.find((w) => hour >= w.startHour && hour < w.endHour);
  if (!s) return null; // inalcançável com as janelas acima (0..23 coberto), mas fail-closed por contrato
  const fmt = (h: number) => `${String(h % 24).padStart(2, "0")}:00`;
  return {
    contractVersion: MARKET_SESSION_CONTRACT_VERSION,
    id: s.id,
    label: s.label,
    windowUtc: `${fmt(s.startHour)}–${fmt(s.endHour)} UTC (janela fixa; DST real desloca ±1h)`,
  };
}

// EPC OMEGA FINAL, Etapa 10 ("Institutional Session Engine: marcar
// Ásia/Londres/Nova York E MUDANÇAS DE SESSÃO"): auditoria da Etapa 1
// encontrou marketSessionFromUtc real e já em uso (header), mas só como
// texto — nunca um marcador de ONDE a sessão mudou dentro do histórico
// carregado. Varre a série real de candles e devolve só os pontos de
// TRANSIÇÃO (sessão do candle i difere da sessão do candle i-1) — nunca
// uma sessão por candle, que seria ruído em qualquer timeframe com mais
// de uma vela por sessão. O primeiro candle nunca conta como transição
// (não há "mudança" sem um candle anterior real para comparar).
//
// Propriedade honesta emergente (não um caso especial escrito à mão):
// candles diários+ (Binance ancora o open em 00:00 UTC) caem sempre na
// mesma janela (ÁSIA) candle a candle, então esta função devolve [] em
// timeframes onde uma marca de sessão não faria sentido — sem precisar
// de um limiar de timeframe hardcoded.
export interface SessionBoundary {
  index: number; // índice do candle onde a NOVA sessão começa
  time: number; // candle.time (segundos) neste índice
  session: MarketSessionReading;
}

export function computeSessionBoundaries(candles: { time: number }[]): SessionBoundary[] {
  const out: SessionBoundary[] = [];
  let prevId: MarketSessionId | null = null;
  for (let i = 0; i < candles.length; i++) {
    const reading = marketSessionFromUtc(new Date(candles[i].time * 1000));
    if (!reading) continue; // Date inválida — fail-closed, pula honesto (mesma regra de marketSessionFromUtc).
    if (prevId !== null && reading.id !== prevId) {
      out.push({ index: i, time: candles[i].time, session: reading });
    }
    prevId = reading.id;
  }
  return out;
}

// "Key Levels" (pedido do Operador, captura de um indicador de referência:
// máxima/mínima de cada sessão real — Ásia/Londres/Londres+NY/Nova York/
// Pacífico — como níveis horizontais de preço). Conceito ICT/SMC real:
// liquidez tende a descansar acima da máxima e abaixo da mínima de uma
// sessão já encerrada (varredura de stops), então o extremo de uma sessão
// vira uma referência de S/R para as sessões seguintes.
//
// Reaproveita a MESMA partição de sessão já real (SESSIONS acima) — nunca
// uma 3ª definição paralela de "o que é Ásia/Londres/NY" (kill-zones.ts já
// tem sua própria janela ESTREITA para um propósito diferente; esta função
// usa a partição CONTÍNUA de 24h que já serve o header). Companion function
// do mesmo arquivo, mesmo padrão de computeSessionBoundaries acima — varre
// a série real UMA vez, sem segunda passada.
export interface SessionKeyLevel {
  sessionId: MarketSessionId;
  label: string;
  startIndex: number;
  startTime: number; // candle.time real do primeiro candle desta ocorrência
  endIndex: number; // último candle real visto nesta ocorrência (fechada ou ainda em andamento)
  endTime: number;
  high: number; // máxima real (Math.max acumulado) dos candles desta ocorrência
  low: number; // mínima real (Math.min acumulado)
  // false = esta é a sessão mais recente da série, ainda em andamento —
  // high/low podem crescer/cair mais conforme novos candles chegam. true =
  // a sessão seguinte já começou; o extremo é final, vira um nível de
  // referência (Key Level) daqui pra frente.
  closed: boolean;
}

export function computeSessionKeyLevels(
  candles: { time: number; high: number; low: number }[],
): SessionKeyLevel[] {
  const out: SessionKeyLevel[] = [];
  let current: Omit<SessionKeyLevel, "closed"> | null = null;

  for (let i = 0; i < candles.length; i++) {
    const reading = marketSessionFromUtc(new Date(candles[i].time * 1000));
    if (!reading) continue; // Date inválida — fail-closed, pula honesto (mesma regra de computeSessionBoundaries).

    if (current === null || reading.id !== current.sessionId) {
      if (current !== null) out.push({ ...current, closed: true });
      current = {
        sessionId: reading.id,
        label: reading.label,
        startIndex: i,
        startTime: candles[i].time,
        endIndex: i,
        endTime: candles[i].time,
        high: candles[i].high,
        low: candles[i].low,
      };
    } else {
      current.endIndex = i;
      current.endTime = candles[i].time;
      current.high = Math.max(current.high, candles[i].high);
      current.low = Math.min(current.low, candles[i].low);
    }
  }
  if (current !== null) out.push({ ...current, closed: false });
  return out;
}
