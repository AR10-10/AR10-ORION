// price-format.ts — FONTE ÚNICA da formatação de preço.
//
// DEFEITO RELATADO (Operador, sobre a tela real): "o ativo tem seis
// centavos, cinco centavos, aí o segundo número não aparece pra mim".
//
// CAUSA RAIZ MEDIDA: existiam SETE cópias da mesma régua. A primeira
// varredura (por nome de função) achou cinco; duas arrows inline
// `const f = (v: number) => v.toFixed(v >= 1000 ? 0 : 2)` em App.tsx só
// apareceram quando o teste de fonte única falhou. Três eram byte a byte
// idênticas:
//
//   App.tsx:4885                    v.toFixed(v >= 1000 ? 0 : 2)
//   publication/canvas-primitives   v.toFixed(v >= 1000 ? 0 : 2)   ← cópia
//   nexus/market-analysis.ts        v.toFixed(v >= 1000 ? 0 : 2)   ← cópia
//   chart/…fmtAxisLabelPrice        idem + remove ".00"
//   nexus/alert-center.ts           price >= 1 ? 2 : 6
//
// Os quatro primeiros usam DUAS casas fixas abaixo de 1000. Num ativo a
// 0,0654 isso vira "0.07": o dígito que o Operador precisa ler some no
// arredondamento. Num ativo a 0,000123 vira "0.00" — a leitura inteira
// desaparece.
//
// REGRA (convenção declarada, nunca medição — mesma natureza dos limiares
// de expectancy.ts): a precisão acompanha a MAGNITUDE, mirando ~5 dígitos
// significativos, com teto de 8 casas (o padrão de cripto).
//
// ESCOPO DELIBERADAMENTE CIRÚRGICO: de 1 para cima NADA muda — o
// comportamento atual é reproduzido exatamente, inclusive o corte de
// ".00" que o eixo já fazia. Só abaixo de 1, onde o defeito vive, a
// precisão passa a ser adaptativa. Assim nenhum preço que hoje está certo
// na tela se mexe.

/** Casas decimais por faixa de magnitude. Acima de 1 são os mesmos valores
 *  que os formatadores antigos já usavam. */
export function priceDecimals(value: number): number {
  const abs = Math.abs(value);
  if (!Number.isFinite(abs)) return 2;
  if (abs >= 1000) return 0;
  if (abs >= 1) return 2;
  // Abaixo de 1 a régua antiga colapsava tudo em 2 casas. Aqui cada faixa
  // preserva ~5 dígitos significativos.
  if (abs >= 0.1) return 4;
  if (abs >= 0.01) return 5;
  if (abs >= 0.001) return 6;
  if (abs >= 0.0001) return 7;
  return 8; // teto: além disso vira ruído, não leitura
}

/**
 * Preço formatado para leitura humana.
 *
 * @param value preço real
 * @param stripRoundZeros quando true, "500.00" vira "500" — o corte que o
 *   eixo do gráfico já fazia. Fora do eixo o padrão é false, preservando
 *   exatamente o que os painéis mostram hoje.
 */
export function formatPrice(value: number, stripRoundZeros = false): string {
  if (!Number.isFinite(value)) return "—"; // fail-closed: nunca "NaN" na tela
  const decimals = priceDecimals(value);
  const out = value.toFixed(decimals);

  // Abaixo de 1 a precisão é generosa de propósito, então zeros à direita
  // aparecem com frequência ("0.06000"). Cortá-los devolve exatamente o
  // que o Operador pediu para ver — "0.06" com os dois dígitos, sem cauda
  // inútil. Acima de 1 nada é cortado por padrão: as duas casas fixas são
  // o que os painéis já alinham hoje.
  if (Math.abs(value) < 1 && out.includes(".")) {
    const trimmed = out.replace(/0+$/, "").replace(/\.$/, "");
    return trimmed.length > 0 ? trimmed : out;
  }

  if (stripRoundZeros && out.endsWith(".00")) return value.toFixed(0);
  return out;
}
