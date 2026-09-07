// data-freshness-banner.ts — texto real do aviso visível de "sem dado
// real" (pedido direto do Operador: "eu queria que o sistema fosse
// inteligente... ele não sente que ele não tá rodando dado real"). Módulo
// puro: só decide SE mostra e O QUÊ mostra — a apresentação (posição fixa,
// cor, montagem sempre-ativa, tick de 1s) vive em App.tsx/
// DataFreshnessBanner, mesma separação de sempre entre nexus/ (puro) e
// componente (DOM).
//
// POR QUE ISTO É NOVO E NÃO UMA EXTENSÃO do NucleoVoiceOrb/SystemStatusBadge
// (App.tsx): auditoria antes de construir (grep real, não suposição) achou
// que os dois já computam offline/isDataFresh corretamente e já mostram a
// cor certa (âmbar "DESATUALIZADO" / pill vermelha) — mas o TEXTO real só
// existe dentro de um atributo `title`, que só aparece com hover de mouse.
// Este projeto roda em iPad Safari por especificação (CLAUDE.md, "60 FPS em
// iPad Safari, zero scroll de página") — um dispositivo sem cursor, onde
// `title` nunca aparece por toque nenhum. O sinal real sempre existiu; só
// nunca alcançava o dispositivo alvo real. Este módulo não recomputa
// offline/isDataFresh/dataFreshSince — só formata o que já é real.
//
// NÃO duplica a região aria-live real (nexus/a11y-live-announcements.ts +
// a11y/LiveRegionAnnouncer.tsx), que já anuncia transição de wsLive para
// leitor de tela ("Conexão: OFF, reconectando"). Este aviso fecha a lacuna
// de quem VÊ a tela mas não tem mouse — nunca a de quem usa leitor de tela,
// que já está coberta; por isso o componente em App.tsx monta com
// aria-hidden="true" (testado abaixo).

export interface DataFreshnessState {
  offline: boolean;
  isDataFresh: boolean;
  /** Timestamp real (Date.now() no instante do último price/orderBook
   *  update, já computado por health-monitor.ts) — null quando nenhum
   *  dado real chegou ainda nesta sessão (boot). Nunca um valor estimado. */
  dataFreshSince: number | null;
}

/** offline sempre mostra o aviso, mesmo que isDataFresh ainda não tenha
 *  virado false (a rede pode cair um instante antes do limiar de 60s do
 *  Health Monitor expirar) — a conexão real já se perdeu, não faz sentido
 *  esperar o limiar de staleness pra avisar. */
export function shouldShowFreshnessBanner(state: DataFreshnessState): boolean {
  return state.offline || !state.isDataFresh;
}

/** `now` é injetado (nunca Date.now() direto) — mesma disciplina de
 *  testabilidade determinística já usada em fps-monitor.ts/trap-detection.ts.
 *  Sem dataFreshSince real (boot, nenhum dado chegou ainda), o rótulo omite
 *  o tempo decorrido em vez de fabricar um número (Regra de Ouro 3). */
export function formatFreshnessBannerLabel(state: DataFreshnessState, now: number): string {
  const elapsedMs = state.dataFreshSince !== null ? Math.max(0, now - state.dataFreshSince) : null;
  const elapsedLabel =
    elapsedMs === null
      ? null
      : elapsedMs < 60_000
        ? `${Math.floor(elapsedMs / 1000)}s`
        : `${Math.floor(elapsedMs / 60_000)}min`;

  if (state.offline) {
    return elapsedLabel ? `SEM CONEXÃO — dado real parado há ${elapsedLabel}` : "SEM CONEXÃO — dado real parado";
  }
  return elapsedLabel ? `SEM DADO REAL HÁ ${elapsedLabel} — reconectando` : "SEM DADO REAL — reconectando";
}
