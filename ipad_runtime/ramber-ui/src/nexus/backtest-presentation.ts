// backtest-presentation.ts — como o resultado do backtest é DITO ao Operador.
//
// Este módulo existe separado do worker por um motivo específico: é aqui que
// um número honesto vira um número desonesto, se alguém escorregar. O motor
// já devolve contagens corretas; o risco está na apresentação — chamar de
// "probabilidade", esconder o tamanho da amostra, arredondar `null` para
// zero, ou omitir que a medida cobre só o subconjunto estrutural.
//
// Puro e testável: zero React, zero rede, zero estado.

/** Recorte do que este módulo lê do resultado real de runStructuralBacktest.
 *  Declarado estruturalmente para o módulo continuar puro sem arrastar o
 *  contrato inteiro do motor. */
export interface BacktestAggregate {
  samples: number;
  targetHits: number;
  stopHits: number;
  bothTouchedCountedAsStop: number;
  unresolved: number;
  resolved: number;
  taxaAlvoAmostra: number | null;
  avgMfeR: number | null;
  avgMaeR: number | null;
  farTargetEligible: number;
  farTargetHitRate: number | null;
}

export interface BacktestProvenance {
  symbol: string;
  timeframe: string;
  candles: number;
  windowSize: number;
  horizonBars: number;
  frames: number;
}

/** Amostra resolvida mínima para a fração ser DITA como número. Convenção
 *  declarada, nunca medição — e o valor não é arbitrário: é o mesmo piso
 *  que `nexus/expectancy.ts` já usa para o Track Record real
 *  (MIN_TRADES_FOR_VALID_EXPECTANCY = 30), pela mesma razão. Abaixo disso a
 *  fração oscila tanto entre amostras que exibi-la como "taxa de acerto"
 *  seria apresentar ruído como medida. */
export const BACKTEST_MIN_RESOLVED_FOR_RATE = 30;

/** Formata uma fração real como porcentagem. `null` NUNCA vira 0% — vira
 *  travessão, porque ausência de medida não é medida zero (Regra de Ouro 3). */
export function formatarFracao(v: number | null | undefined): string {
  if (typeof v !== "number" || !Number.isFinite(v)) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

/** R-múltiplo médio. Mesma disciplina: `null` é travessão. */
export function formatarR(v: number | null | undefined): string {
  if (typeof v !== "number" || !Number.isFinite(v)) return "—";
  return `${v >= 0 ? "" : "-"}${Math.abs(v).toFixed(2)}R`;
}

export type ForcaDaAmostra = "SUFICIENTE" | "FRACA" | "INSUFICIENTE";

/**
 * Quão longe a amostra está de sustentar o número exibido.
 *
 * Não é opinião sobre o mercado — é sobre a MEDIDA. Uma taxa de 70% sobre 7
 * trials resolvidos e uma taxa de 70% sobre 700 são a mesma aritmética e
 * afirmações completamente diferentes, e o Operador precisa ver essa
 * diferença sem ter que procurar.
 */
export function forcaDaAmostra(resolved: number): ForcaDaAmostra {
  if (!Number.isFinite(resolved) || resolved <= 0) return "INSUFICIENTE";
  if (resolved < BACKTEST_MIN_RESOLVED_FOR_RATE) return "FRACA";
  return "SUFICIENTE";
}

/**
 * A taxa, já julgada pela força da amostra.
 *
 * FAIL-CLOSED NA AFIRMAÇÃO, nunca na exibição: com amostra fraca o número
 * REAL continua visível (o Operador tem direito ao dado), mas vem rotulado
 * como não sustentado. Esconder o número seria tão desonesto quanto
 * apresentá-lo como se fosse sólido.
 */
export function descreverTaxa(agg: BacktestAggregate): {
  valor: string;
  forca: ForcaDaAmostra;
  ressalva: string | null;
} {
  const forca = forcaDaAmostra(agg.resolved);
  const valor = formatarFracao(agg.taxaAlvoAmostra);
  if (forca === "INSUFICIENTE") {
    return { valor: "—", forca, ressalva: "nenhum cenário se resolveu nesta amostra — não há o que medir" };
  }
  if (forca === "FRACA") {
    return {
      valor,
      forca,
      ressalva: `só ${agg.resolved} cenários resolvidos (mínimo ${BACKTEST_MIN_RESOLVED_FOR_RATE} para sustentar a fração) — número real, mas ainda instável`,
    };
  }
  return { valor, forca, ressalva: null };
}

/**
 * A frase que acompanha o número, sempre.
 *
 * Ela existe porque a diferença entre "o sistema acerta X%" e o que este
 * backtest de fato mede é enorme, e é justamente essa diferença que faz um
 * número virar argumento de venda. Nunca é opcional, nunca fica só no
 * tooltip — mesma disciplina já aplicada à supressão do Núcleo pelo
 * Profitability Engine.
 */
export function avisoObrigatorio(p: BacktestProvenance): string {
  return (
    `Contagem de desfechos reais em ${p.candles} candles de ${p.symbol} ${p.timeframe}. ` +
    `Mede o subconjunto ESTRUTURAL (estrutura + S/R sobre candles), não o sistema vivo — ` +
    `Conselho, fluxo de ordens e livro não existem numa série histórica. ` +
    `Empate no mesmo candle conta STOP. Não é probabilidade do próximo trade.`
  );
}

/** Motivos de falha em linguagem que o Operador entende, com a causa real
 *  preservada. Um "erro desconhecido" faria ele não saber se é internet,
 *  dado ou defeito — e essa distinção é a única coisa que ele pode agir. */
export function explicarFalha(motivo: string, detalhe?: string): string {
  if (motivo === "captura_incompleta") {
    if (detalhe?.includes("BLOCKED_BY_POLICY") || detalhe?.includes("bloqueada")) {
      return "esta rede não alcança a Binance (firewall, VPN ou rede corporativa). Tente de outra rede.";
    }
    if (detalhe?.startsWith("amostra_real_insuficiente")) {
      return `a exchange devolveu candles a menos do que o mínimo para medir (${detalhe.replace("amostra_real_insuficiente_", "")}). Tente outro símbolo ou timeframe.`;
    }
    return `a captura não completou: ${detalhe ?? "motivo não informado"}`;
  }
  if (motivo.startsWith("amostra_minima_")) return `peça pelo menos ${motivo.replace("amostra_minima_", "")} candles.`;
  if (motivo.startsWith("amostra_maxima_")) return `peça no máximo ${motivo.replace("amostra_maxima_", "")} candles.`;
  if (motivo === "simbolo_invalido") return "símbolo inválido.";
  if (motivo === "timeframe_invalido") return "timeframe inválido.";
  if (motivo === "falha_na_execucao") return `falhou ao executar: ${detalhe ?? "sem detalhe"}`;
  return detalhe ? `${motivo}: ${detalhe}` : motivo;
}
