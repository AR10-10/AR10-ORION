// evidence-independence.ts — ORDEM "AUDITORIA INTEGRAL DO ORGANISMO" §43:
// "Cinco indicadores derivados da mesma candle não devem ser tratados como
// cinco fontes independentes. O sistema deve distinguir CONFLUÊNCIA de
// INDEPENDÊNCIA DE EVIDÊNCIA."
//
// ── AUDITORIA ANTES DE CONSTRUIR (Disciplina §1) ───────────────────────
//
// ACHADO 1 — o princípio JÁ É CONFIÁVEL nesta base, num lugar só.
// `institutional-zones.ts` já conta EXATAMENTE isto para zonas de preço:
//     const distinctSourceCount = new Set(group.map((m) => m.sourceKind)).size;
// com o comentário "quantas FERRAMENTAS diferentes (não instâncias)
// concordam aqui", e um piso real (MIN_DISTINCT_SOURCES_FOR_ZONE) que
// descarta a zona quando a contagem não passa. Ou seja: a §43 não é um
// conceito novo aqui — é um princípio já provado, aplicado a UM domínio.
// Este módulo o generaliza para o domínio onde ele falta, sem inventar
// taxonomia nova (§30: reutilizar a inteligência existente).
//
// ACHADO 2 — onde ele falta, e por quê (medido, não suposto).
// O pool de opinião real (`src/consensus/ensemble-engine.js`) pondera cada
// membro por `getSensitivity(regime, familia)` — peso por SENSIBILIDADE AO
// REGIME, nunca por independência. Dois membros da MESMA família entram
// os dois com peso cheio em `totalWeight`: o pool nunca pergunta se as
// duas vozes descansam sobre a mesma evidência.
// Pior, e é o ponto mais afiado do achado: `council.ts` e
// `confluence-engine.ts` passam `familia: null` DE PROPÓSITO (documentado
// em weight-matrix.js, linhas 41-42). Nesses dois pools todo membro cai em
// UNMODULATED_WEIGHT — não existe informação de família nenhuma, então a
// pergunta da §43 sequer PODE ser feita ali hoje.
//
// ACHADO 3 — a sobreposição é real, não hipotética. A família `momentum`
// da matriz de regime já embala "k-NN Lorentziano + rótulos de estrutura
// real 15m/1H" (weight-matrix.js linha 43); o Conselho tem um
// StructureAgent E um MomentumAgent votando como vozes separadas; e a
// Matriz Multi-Timeframe vota 15m e 1h de novo. Estrutura derivada das
// MESMAS velas é contada nos três pools, cada vez como uma voz cheia.
//
// ── O QUE ESTE MÓDULO É ────────────────────────────────────────────────
// Uma MEDIÇÃO estrutural, pura e determinística: dadas as vozes que
// concordam agora, sobre quantas famílias de evidência REALMENTE distintas
// elas descansam? Converte o "7 agentes concordam" que a tela mostra hoje
// no honesto "7 vozes concordando, apoiadas em N famílias distintas".
//
// ── O QUE ESTE MÓDULO NUNCA É ──────────────────────────────────────────
// Não é um segundo pool, não produz direção, score, confiança combinada
// nem probabilidade (LEI 24 + Regra de Ouro 2). Não altera peso nenhum do
// `ensemble-engine.js` — §42 manda IDENTIFICAR → DOCUMENTAR → COMPARAR →
// VALIDAR → DECIDIR, nunca remover/reponderar automaticamente, e §51
// (Learning Governor) proíbe mexer em silêncio no Decision Engine, no
// Risk e em thresholds. Mudar a matemática do pool a partir deste achado
// é uma decisão do Operador, com Shadow e validação (§53/§54) — não uma
// consequência automática de medir.
//
// ── HONESTIDADE FAIL-CLOSED (§58) ──────────────────────────────────────
// Voz sem família declarada NUNCA é assumida independente. Ela é contada
// à parte (`unknownFamilyVoices`) e mantida FORA do índice. Se nenhuma voz
// tem família — que é literalmente o estado de hoje para Conselho e
// Confluence Engine — a leitura devolve DADOS_INSUFICIENTES com a razão
// real, em vez de fabricar um índice bonito. O módulo relata o ponto cego
// do sistema; não o encobre.

export type EvidenceIndependenceStatus = "OK" | "DADOS_INSUFICIENTES";

/** Uma voz real de evidência. Tipo declarado ESTRUTURALMENTE (mesmo padrão
 *  de `PlanMarkerSource` em chart/plan-markers.ts) para o módulo continuar
 *  puro e testável sem arrastar o contrato inteiro do Conselho/pool. */
export interface EvidenceVoice {
  /** Identidade real da voz (id do membro/agente). Só serve para
   *  rastreabilidade (§44) — nunca entra na matemática. */
  id: string;
  /** Família REAL de evidência sobre a qual esta voz descansa. As famílias
   *  reais desta base vivem em `MODULE_FAMILIES` (market-regime/
   *  weight-matrix.js); zonas usam `sourceKind` (institutional-zones.ts).
   *  `null` = não declarada — jamais tratada como independente. */
  family: string | null;
  /** Só voz que CONCORDA com a leitura entra na contagem: discordância não
   *  é confluência, e contá-la infla o índice sem evidência real. */
  agrees: boolean;
}

export interface EvidenceIndependenceReading {
  status: EvidenceIndependenceStatus;
  /** Razão real quando `DADOS_INSUFICIENTES` — nunca null nesse estado. */
  reason: string | null;
  /** Quantas vozes concordam — o número que a tela já mostra hoje. */
  agreeingVoices: number;
  /** Vozes concordantes COM família declarada (as únicas avaliáveis). */
  assessedVoices: number;
  /** Vozes concordantes SEM família — ponto cego real, nunca independente
   *  por omissão. */
  unknownFamilyVoices: number;
  /** A resposta da §43: sobre quantas famílias distintas as vozes
   *  avaliáveis realmente descansam. */
  distinctFamilies: number;
  /** distinctFamilies / assessedVoices. 1 = cada voz traz evidência nova;
   *  →0 = muitas vozes repetindo a mesma evidência. `null` quando não há
   *  voz avaliável (nunca 0, que leria como "totalmente redundante" em vez
   *  de "não medido"). */
  independenceRatio: number | null;
  /** A família que concentra mais vozes — o risco de concentração real. */
  largestClusterFamily: string | null;
  largestClusterSize: number;
  computedAt: number;
}

/** Piso de famílias distintas para uma confluência ser considerada
 *  estruturalmente diversa. Reusa deliberadamente o MESMO número que
 *  `MIN_DISTINCT_SOURCES_FOR_ZONE` (institutional-zones.ts) já usa para a
 *  mesma pergunta em zonas de preço — nunca um limiar novo inventado. */
export const MIN_DISTINCT_EVIDENCE_FAMILIES = 2;

function insufficient(reason: string, now: number): EvidenceIndependenceReading {
  return {
    status: "DADOS_INSUFICIENTES",
    reason,
    agreeingVoices: 0,
    assessedVoices: 0,
    unknownFamilyVoices: 0,
    distinctFamilies: 0,
    independenceRatio: null,
    largestClusterFamily: null,
    largestClusterSize: 0,
    computedAt: now,
  };
}

/**
 * Mede a independência real das vozes que concordam. Função PURA: mesma
 * entrada + mesmo `now` devolvem sempre a mesma saída, zero rede/estado.
 *
 * @param voices vozes reais (concordantes ou não — o filtro é interno)
 * @param now timestamp real do chamador (injetado, nunca Date.now() aqui —
 *   determinismo é o que torna o teste de execução real possível)
 */
export function measureEvidenceIndependence(
  voices: readonly EvidenceVoice[] | null | undefined,
  now: number,
): EvidenceIndependenceReading {
  const stamp = Number.isFinite(now) ? now : 0;
  if (!Array.isArray(voices) || voices.length === 0) {
    return insufficient("sem vozes de evidência reais nesta leitura", stamp);
  }

  const agreeing = voices.filter((v) => v && v.agrees === true);
  if (agreeing.length === 0) {
    return insufficient("nenhuma voz concordante — confluência zero, nada a medir", stamp);
  }

  // Família vazia/em branco conta como NÃO declarada: uma string vazia não
  // é uma família real, e aceitá-la criaria um cluster fantasma.
  const declared = agreeing.filter(
    (v) => typeof v.family === "string" && v.family.trim().length > 0,
  );
  const unknownFamilyVoices = agreeing.length - declared.length;

  if (declared.length === 0) {
    return {
      status: "DADOS_INSUFICIENTES",
      // Este é o estado REAL de hoje para o Conselho e o Confluence Engine
      // (os dois passam `familia: null`): o sistema não consegue afirmar
      // independência nenhuma sobre as próprias vozes que exibe.
      reason: "nenhuma voz concordante declara família de evidência — independência não avaliável",
      agreeingVoices: agreeing.length,
      assessedVoices: 0,
      unknownFamilyVoices,
      distinctFamilies: 0,
      independenceRatio: null,
      largestClusterFamily: null,
      largestClusterSize: 0,
      computedAt: stamp,
    };
  }

  // Mesma primitiva do precedente já confiável (institutional-zones.ts):
  // contar FERRAMENTAS distintas, nunca instâncias.
  const porFamilia = new Map<string, number>();
  for (const v of declared) {
    const f = (v.family as string).trim();
    porFamilia.set(f, (porFamilia.get(f) ?? 0) + 1);
  }

  let largestClusterFamily: string | null = null;
  let largestClusterSize = 0;
  for (const [familia, tamanho] of porFamilia) {
    // Empate resolvido pela ordem alfabética — determinismo real: sem isto
    // a mesma entrada poderia relatar clusters diferentes conforme a ordem
    // de inserção, e o teste viraria sorte.
    if (
      tamanho > largestClusterSize ||
      (tamanho === largestClusterSize && largestClusterFamily !== null && familia < largestClusterFamily)
    ) {
      largestClusterFamily = familia;
      largestClusterSize = tamanho;
    }
  }

  return {
    status: "OK",
    reason: null,
    agreeingVoices: agreeing.length,
    assessedVoices: declared.length,
    unknownFamilyVoices,
    distinctFamilies: porFamilia.size,
    // Índice sobre as AVALIÁVEIS: incluir as desconhecidas no denominador
    // puniria o índice por um dado ausente, e no numerador o inflaria por
    // uma independência nunca comprovada. As duas seriam desonestas.
    independenceRatio: porFamilia.size / declared.length,
    largestClusterFamily,
    largestClusterSize,
    computedAt: stamp,
  };
}

/**
 * Rótulo qualitativo honesto da leitura — NUNCA uma probabilidade nem uma
 * promessa (Regra de Ouro 2 / §47 / §58). Descreve só a ESTRUTURA da
 * evidência: quantas vozes distintas sustentam a concordância.
 */
export function evidenceIndependenceLabel(reading: EvidenceIndependenceReading): string {
  if (reading.status !== "OK") return "DADOS_INSUFICIENTES";
  if (reading.distinctFamilies < MIN_DISTINCT_EVIDENCE_FAMILIES) {
    return "FONTE ÚNICA";
  }
  const ratio = reading.independenceRatio;
  if (ratio === null) return "DADOS_INSUFICIENTES";
  // Limiares declarados (mesma natureza dos 70/30 do RSI), não medições:
  // 1 voz por família = diversidade integral; metade das vozes repetindo
  // família = concentração real que o Operador precisa enxergar.
  if (ratio >= 1) return "DIVERSA";
  if (ratio >= 0.5) return "PARCIALMENTE REDUNDANTE";
  return "CONCENTRADA";
}
