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
