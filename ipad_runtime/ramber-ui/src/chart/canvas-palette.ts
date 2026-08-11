// canvas-palette.ts — Achado real da AUDITORIA TÉCNICA COMPLETA (docs/
// AUDITORIA_TECNICA_COMPLETA_PREENCHIDA.md, item B12): 25+ cores distintas
// medidas em chart/*.tsx. Investigando cada uma antes de tocar em qualquer
// coisa (CLAUDE.md, Disciplina item 1) revelou que a maior parte NÃO é
// caos — é engenharia de matiz deliberada e já comentada no próprio código:
// o magenta do POC (VolumeProfilePlugin) fica a propósito a ~30° tanto da
// família roxa (Institutional/Harmônicos) quanto do vermelho SHORT; o âmbar
// de Kill Zone reusa o mesmo tom do badge do header; o âmbar mais suave de
// DepthChartPlugin/TPO reusa o mesmo tom já usado nas classificações de
// "atenção" do sistema (FPS/latência). Forçar tudo isso para 6 hex fixos
// destruiria distinções reais que o próprio código já argumenta.
//
// O que É drift real e sem justificativa, confirmado por auditoria: apenas
// DepthChartPlugin usava um verde/vermelho DIFERENTE (Tailwind green-500/
// red-500) do par universal bullish/bearish usado em todo o resto do
// gráfico (candles, FVG/OB, structure breaks, sweep, session key levels) —
// zero comentário explicando por quê, e bid/ask é conceitualmente o MESMO
// par alta/baixa que os outros já desenham. Esta é a única correção real
// desta rodada (ver DepthChartPlugin.tsx).
//
// Este módulo existe para que o próximo plugin novo IMPORTE o par
// universal em vez de redigitar o hex de memória — a causa raiz do drift
// que este arquivo corrige. Não migra os plugins que já usam o valor
// certo (`#00ffaa`/`#ff0055` já duplicado em ~10 arquivos): trocar código
// que já está correto por uma import, sem nenhum bug a corrigir ali, seria
// refatoração sem necessidade (CLAUDE.md: não introduzir abstração além do
// que a tarefa pede).
export const CHART_BULLISH_HEX = "#00ffaa";
export const CHART_BEARISH_HEX = "#ff0055";

export function chartBullishRgba(alpha: number): string {
  return `rgba(0, 255, 170, ${alpha})`;
}

export function chartBearishRgba(alpha: number): string {
  return `rgba(255, 0, 85, ${alpha})`;
}
