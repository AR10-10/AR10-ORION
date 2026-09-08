// sample-maturity-line.ts — UMA linha no lugar de três frases redundantes.
//
// ── O DEFEITO, VISTO EM TELA (verificação visual, rodada anterior) ──────
// O rodapé do Motor de Lucratividade mostrava TRÊS frases seguidas, todas
// dizendo a mesma coisa com números diferentes:
//
//   "Amostra real de 0 trades com leitura de modelo — mínimo 30 para
//    calibração válida."
//   "Validação fora-da-amostra exige 60 trades resolvidos com leitura de
//    modelo (30 para treinar + 30 para testar). Há 0."
//   "Amostra real de 0 trades — mínimo 30 para uma leitura de expectativa
//    válida."
//
// Três parágrafos para comunicar um fato só ("o histórico ainda é curto") e
// três limiares. É exatamente o "zero elementos desnecessários" que o
// Operador pediu, violado no componente mais denso do terminal.
//
// ── POR QUE NÃO BASTA APAGAR DUAS ──────────────────────────────────────
// Regra de Ouro 4: as três frases NEM SEMPRE falam de amostra. A razão da
// calibração pode ser "Sem plano ativo com leitura real de modelo agora"
// ou "Falha real no ajuste de calibração (Platt Scaling)" — motivos reais
// e distintos, que sumiriam num colapso cego. O walk-forward tem o mesmo
// caso ("apenas N previsões convergiram").
//
// ── O QUE ESTE MÓDULO FAZ ──────────────────────────────────────────────
// Separa as duas coisas:
//   1. A ESCASSEZ, que é uma só, vira UMA linha com os limiares lado a
//      lado — construída dos CONTADORES reais, nunca de texto reprocessado.
//   2. Qualquer razão que NÃO seja explicada pela contagem continua
//      aparecendo, intacta. Nada de informação real se perde.
//
// LEI 24: composição de apresentação. Zero decisão, zero cálculo de
// mercado, zero acesso a dado real além dos contadores que recebe.

/** Um degrau de maturidade: o que ele destrava e quanto exige. */
export interface MaturityGate {
  /** Rótulo curto — o que este limiar destrava. */
  label: string;
  /** Trades reais que ESTA capacidade tem disponíveis. */
  have: number;
  /** Mínimo declarado pela capacidade. */
  need: number;
}

export interface SampleMaturity {
  /** A linha única. Vazia quando todos os degraus já foram atingidos —
   *  aí não há escassez a comunicar e a linha simplesmente não aparece. */
  line: string;
  /** true quando ao menos um degrau ainda falta. */
  hasGap: boolean;
  /** Degraus ainda não atingidos, em ordem de proximidade. */
  pending: MaturityGate[];
}

/**
 * Constrói a linha única de maturidade a partir dos CONTADORES reais.
 * Função pura.
 */
export function buildSampleMaturity(gates: readonly MaturityGate[] | null | undefined): SampleMaturity {
  const reais = Array.isArray(gates)
    ? gates.filter(
        (g) =>
          g &&
          typeof g.label === "string" &&
          Number.isFinite(g.have) &&
          Number.isFinite(g.need) &&
          g.need > 0,
      )
    : [];
  if (reais.length === 0) return { line: "", hasGap: false, pending: [] };

  const pending = reais
    .filter((g) => g.have < g.need)
    // Mais perto de destravar primeiro: é a informação acionável.
    .sort((a, b) => b.have / b.need - a.have / a.need);

  if (pending.length === 0) return { line: "", hasGap: false, pending: [] };

  // Todos os degraus pendentes têm a mesma contagem? Então a escassez é
  // uma só e a frase fica no singular, sem repetir o número 3 vezes.
  const contagens = new Set(pending.map((g) => g.have));
  const detalhe = pending.map((g) => `${g.label} ≥${g.need}`).join(" · ");
  const line =
    contagens.size === 1
      ? `${pending[0].have} trades resolvidos · falta: ${detalhe}`
      : pending.map((g) => `${g.label} ${g.have}/${g.need}`).join(" · ");

  return { line, hasGap: true, pending };
}

/**
 * A razão em prosa de um módulo AINDA precisa aparecer? Só quando ela NÃO
 * é explicada pela contagem — ou seja, quando o degrau já foi atingido e
 * mesmo assim há um motivo (plano ausente, ajuste que não convergiu).
 *
 * É esta função que impede o colapso cego: com o degrau ainda pendente, a
 * linha única já disse tudo; com o degrau atingido, a razão é outra coisa
 * e continua visível.
 */
export function reasonStillNeeded(
  reason: string | null | undefined,
  gate: MaturityGate | null | undefined,
): boolean {
  if (typeof reason !== "string" || reason.trim() === "") return false;
  if (!gate || !Number.isFinite(gate.have) || !Number.isFinite(gate.need)) return true;
  // Degrau pendente => a linha única já comunica a escassez.
  return gate.have >= gate.need;
}
