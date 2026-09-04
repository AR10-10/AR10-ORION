// scenario-fingerprint.ts — Escopo Cirúrgico (Operador, Fase 1 confirmada
// em resposta a docs/historico/AUDITORIA_SINCRONIZACAO_DADOS.md §5.3, "gap 1"):
// assinatura real de um cenário, derivada inteiramente de leituras JÁ
// carimbadas em PlanOpenContext (signal-track-record.ts) na abertura do
// plano — zero segunda fonte, zero motor novo.
//
// Por quê: hoje o Track Record agrupa resultado só por symbol:timeframe
// (Entrega "Memória real", task #12). Dois trades no mesmo symbol:timeframe
// podem ter acontecido em regime/estrutura completamente diferentes e caem
// na mesma estatística de expectancy — misturando maçã com laranja. Esta
// fingerprint permite reagrupar TradeCostResult[] por família de cenário
// ANTES de chamar computeExpectancy() (expectancy.ts) — sem tocar naquele
// módulo, por restrição explícita do Operador ("NÃO tocar em
// expectancy.ts, já funciona"): computeExpectancy() já é agnóstico de
// proveniência, só soma a lista que o chamador filtrar.
//
// Só os 4 fatores com leitura REAL já capturada em PlanOpenContext (regime,
// structureLabel, vwapState, nexusLineState) — nunca sweepDirection nem
// volumeProfileShape (fatores do documento original do Operador): nenhum
// motor real deste repositório classifica isso hoje (TPO/Market Profile,
// Entrega 41, não classifica FORMA do perfil — P/b/D/normal) — incluir
// esses fatores seria inventar dado, não reaproveitar um real.
//
// String legível, tags fixas separadas por "|" — deliberadamente NÃO um
// hash opaco (SHA-256, como o documento original propunha): mesma
// filosofia de nomes reais em vez de números opacos já usada em todo o
// resto do código (operationalState, regime, scoreZone...) — o Operador
// consegue LER a fingerprint num painel futuro, não só usá-la como chave
// interna de agrupamento.
import type { PlanOpenContext } from "./signal-track-record";
import type { TradeCostResult } from "./trade-simulation";

const FINGERPRINT_ABSENT = "—";

/** null só quando NENHUM dos 4 fatores tem leitura real (contexto ausente,
 *  ou os 4 campos vazios) — mesma honestidade de ConfluenceCorridorReading
 *  (confluence-corridor.ts §components): usa o que está disponível, nunca
 *  fabrica o resto; só declara insuficiência quando não sobra nada real.
 *  Ordem das tags é sempre a mesma, por isso "regime real + resto ausente"
 *  nunca colide com "structure real + resto ausente" — cada fator carrega
 *  sua própria tag. */
export function computeScenarioFingerprint(ctx: PlanOpenContext | null | undefined): string | null {
  if (!ctx) return null;
  const regime = ctx.regime ?? null;
  const structureLabel = ctx.structureLabel ?? null;
  const vwapState = ctx.vwapState ?? null;
  const nexusLineState = ctx.nexusLineState ?? null;
  if (regime === null && structureLabel === null && vwapState === null && nexusLineState === null) return null;

  return [
    `regime:${regime ?? FINGERPRINT_ABSENT}`,
    `structure:${structureLabel ?? FINGERPRINT_ABSENT}`,
    `vwap:${vwapState ?? FINGERPRINT_ABSENT}`,
    `nl:${nexusLineState ?? FINGERPRINT_ABSENT}`,
  ].join("|");
}

/** Agrupa uma amostra JÁ simulada (trade-simulation.ts) pela fingerprint
 *  carimbada em cada resultado — zero recálculo, zero segunda fonte.
 *  Resultados com fingerprint null (contexto ausente — registros
 *  anteriores a esta entrega) nunca entram em nenhum grupo: misturá-los
 *  seria fabricar uma semelhança que não foi observada. O chamador passa
 *  cada grupo para computeExpectancy() (expectancy.ts, intocado). */
export function groupResultsByFingerprint(results: TradeCostResult[]): Map<string, TradeCostResult[]> {
  const groups = new Map<string, TradeCostResult[]>();
  for (const r of results) {
    if (r.fingerprint === null) continue;
    const bucket = groups.get(r.fingerprint);
    if (bucket) bucket.push(r);
    else groups.set(r.fingerprint, [r]);
  }
  return groups;
}
