// kill-zones.ts — Ferramentas Institucionais (ADITIVO V-MAX / MED,
// prioridade #1 da lista mais recente): ICT Kill Zones.
//
// Pesquisa real antes de implementar (Disciplina de trabalho item 2 —
// "método com nome próprio, confirme a definição real"): Kill Zone é um
// conceito ICT (Inner Circle Trader) DIFERENTE de "sessão de mercado"
// (market-session.ts) — não é uma partição contínua das 24h, é uma janela
// ESTREITA e de ALTA PROBABILIDADE dentro de cada sessão, onde a atividade
// institucional (varredura de liquidez/stop hunt) historicamente se
// concentra. Fora dessas janelas, NENHUMA kill zone está ativa — a maior
// parte do dia fica sem nenhuma. Duas kill zones também podem se sobrepor
// de propósito (Nova York e Fechamento de Londres) — por isso este módulo
// devolve uma LISTA de zonas ativas, nunca uma classificação única como
// marketSessionFromUtc.
//
// Honestidade da fonte: múltiplas referências públicas sobre ICT Kill
// Zones DIVERGEM entre si em até ±1h por causa de horário de verão (DST)
// dos EUA/Europa não coincidirem, e alguns materiais têm inconsistências
// internas de conversão EST→GMT. Este módulo fixa UMA convenção razoável e
// documentada — mesmo princípio já usado em market-session.ts (janelas
// FIXAS em UTC, sem ajuste automático de DST) e em rr-quality.ts (um
// número de convenção documentado e ajustável, não uma medição). As 4
// janelas abaixo usam a referência de horário de verão americano (EDT,
// UTC-4) por serem os números mais redondos e mais repetidos entre as
// fontes consultadas:
//
//   Kill Zone Ásia            00:00–04:00 UTC  (Tóquio abre; 20:00–00:00 EDT)
//   Kill Zone Londres         07:00–10:00 UTC  (abertura de Londres)
//   Kill Zone Nova York       12:00–15:00 UTC  (abertura de NY; overlap Londres/NY)
//   Kill Zone Fechamento de Londres  14:00–16:00 UTC  (Londres fecha; SOBREPÕE Nova York)
//
// No horário de inverno (EST/GMT padrão), as janelas reais deslocam ~1h
// mais tarde — mesma aproximação deliberada e mesmo aviso já usado em
// market-session.ts, nunca fingindo mais precisão do que existe.
export const KILL_ZONE_CONTRACT_VERSION = 1 as const;

export type KillZoneId = "ASIA" | "LONDRES" | "NOVA_YORK" | "LONDRES_CLOSE";

export interface KillZoneWindow {
  id: KillZoneId;
  label: string;
  startHour: number; // UTC, referência de horário de verão americano (ver header)
  endHour: number; // UTC, exclusivo
}

// Ordem cronológica — usada tanto para a varredura de ativas quanto para
// "próxima kill zone" (nextKillZone).
export const KILL_ZONES: readonly KillZoneWindow[] = Object.freeze([
  { id: "ASIA", label: "Kill Zone · Ásia", startHour: 0, endHour: 4 },
  { id: "LONDRES", label: "Kill Zone · Londres", startHour: 7, endHour: 10 },
  { id: "NOVA_YORK", label: "Kill Zone · Nova York", startHour: 12, endHour: 15 },
  { id: "LONDRES_CLOSE", label: "Kill Zone · Fechamento de Londres", startHour: 14, endHour: 16 },
]);

export interface KillZoneReading {
  contractVersion: typeof KILL_ZONE_CONTRACT_VERSION;
  // 0, 1 ou 2 zonas — Nova York e Fechamento de Londres se sobrepõem de
  // propósito (14:00–15:00 UTC), nunca deduplicadas artificialmente.
  active: KillZoneWindow[];
}

/** Zonas realmente ativas agora (ou no instante de `date`). Nunca uma
 *  classificação única — fail-closed via `active: []`, nunca um valor
 *  fabricado quando nenhuma janela institucional está em curso (a maior
 *  parte do dia, por design do próprio conceito). */
export function activeKillZones(date: Date): KillZoneReading | null {
  const t = date.getTime();
  if (!Number.isFinite(t)) return null; // Date inválida => null honesto, nunca uma leitura fabricada
  const hour = date.getUTCHours();
  const active = KILL_ZONES.filter((z) => hour >= z.startHour && hour < z.endHour);
  return { contractVersion: KILL_ZONE_CONTRACT_VERSION, active };
}

/** Próxima kill zone a abrir a partir de `date` (a de início mais próximo
 *  no futuro, avançando para o dia seguinte se todas já passaram hoje) +
 *  horas restantes reais. Não conta uma janela JÁ ativa como "próxima" —
 *  para isso, `activeKillZones` já é a resposta certa. Determinística e
 *  pura: mesma entrada, mesma saída, nenhum uso de Date.now() interno. */
export function nextKillZone(date: Date): { window: KillZoneWindow; hoursUntil: number } | null {
  const t = date.getTime();
  if (!Number.isFinite(t)) return null;
  const hour = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const todayCandidates = KILL_ZONES.filter((z) => z.startHour > hour)
    .sort((a, b) => a.startHour - b.startHour);
  if (todayCandidates.length > 0) {
    const window = todayCandidates[0];
    return { window, hoursUntil: window.startHour - hour };
  }
  // Todas as janelas de hoje já começaram — a próxima é a primeira de
  // amanhã (KILL_ZONES já está em ordem cronológica).
  const window = KILL_ZONES[0];
  return { window, hoursUntil: 24 - hour + window.startHour };
}
