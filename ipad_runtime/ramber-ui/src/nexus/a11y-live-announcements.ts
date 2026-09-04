// a11y-live-announcements.ts — o texto que uma região aria-live real fala
// pro Operador que usa leitor de tela, quando o Núcleo muda de direção ou
// a conexão ao vivo cai/volta.
//
// Pedido do Operador ("acessibilidade... 110%... sincronizado contigo em
// tempo real"): auditando o app (grep real por aria-/role/focus/prefers-
// reduced-motion em todo src/), a direção do Núcleo e o estado LIVE já são
// texto real na tela (CoreSignalBadge/TopBar, App.tsx) — mas nenhuma das
// duas mudanças é ANUNCIADA. Um Operador cego ou com baixa visão só sabe
// que o Núcleo virou LONG/SHORT ou que a conexão caiu se estiver com o
// foco do leitor de tela bem naquele elemento no instante exato da
// mudança — para o dado mais crítico da tela inteira, isso é real demais
// pra ficar sem cobertura.
//
// Módulo puro, sem DOM: só decide O QUÊ falar. A região real (aria-live/
// aria-atomic/sr-only) vive em a11y/LiveRegionAnnouncer.tsx — este arquivo
// nunca soube de React nem de elemento algum, mesma separação de sempre
// entre motor puro (research/engines/, nexus/) e camada de apresentação.

/** A MESMA leitura já fundida (LEI 24, effectiveDirection em
 *  CoreSignalBadge / confidenceDirection em ChartWidget) — nunca o
 *  engine.direction bruto: quem ouve o anúncio tem que ouvir exatamente o
 *  que o badge mostra, nunca uma segunda opinião de direção. */
export type FusedDirection = "LONG" | "SHORT" | null;

export interface LiveAnnouncementState {
  direction: FusedDirection;
  /** true só quando AMBAS as conexões (ticker+depth, migração Spot→Futures)
   *  estão LIVE — o mesmo wsLive já usado no resto do app (TopBar, badge
   *  "LIVE"/"OFF"), nunca uma leitura própria. */
  wsLive: boolean;
}

/** Constrói o texto a falar nesta transição, ou `null` quando não há nada
 *  de real pra anunciar. `previous: null` é o boot — ainda não existe uma
 *  transição real, então nunca anuncia o estado inicial como se fosse um
 *  evento (mesmo fail-closed de sempre: silêncio é a resposta honesta
 *  quando não há mudança real, nunca um anúncio fabricado). Quando as duas
 *  coisas mudam na mesma atualização, as duas entram no mesmo anúncio —
 *  nunca um substitui o outro em silêncio. */
export function buildLiveAnnouncement(
  previous: LiveAnnouncementState | null,
  current: LiveAnnouncementState,
): string | null {
  if (previous === null) return null;

  const parts: string[] = [];

  if (previous.wsLive !== current.wsLive) {
    parts.push(current.wsLive ? "Conexão: LIVE" : "Conexão: OFF, reconectando");
  }

  if (previous.direction !== current.direction) {
    parts.push(`Núcleo: ${current.direction ?? "AWAITING"}`);
  }

  return parts.length > 0 ? parts.join(". ") : null;
}
