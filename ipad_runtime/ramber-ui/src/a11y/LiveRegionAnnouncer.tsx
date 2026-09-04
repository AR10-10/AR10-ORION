// LiveRegionAnnouncer.tsx — a região aria-live real que fala pro Operador
// que usa leitor de tela quando o Núcleo muda de direção ou a conexão ao
// vivo cai/volta (ver header de nexus/a11y-live-announcements.ts para o
// achado completo e por que isso importa).
//
// Zero import de App.tsx — mesma arquitetura desacoplada já exigida para
// voice/VoiceControlWidget.tsx ("Único ponto de contato... recebe o
// snapshot real por prop"): este componente só recebe a direção JÁ
// FUNDIDA (LEI 24) e o estado LIVE já computados por App.tsx, nunca lê
// Context nem recomputa a fusão sozinho.
import { useEffect, useRef, useState } from "react";
import { buildLiveAnnouncement, type FusedDirection, type LiveAnnouncementState } from "../nexus/a11y-live-announcements";

export function LiveRegionAnnouncer({
  direction,
  wsLive,
}: {
  direction: FusedDirection;
  wsLive: boolean;
}) {
  const [announcement, setAnnouncement] = useState("");
  const previousRef = useRef<LiveAnnouncementState | null>(null);

  useEffect(() => {
    const current: LiveAnnouncementState = { direction, wsLive };
    const text = buildLiveAnnouncement(previousRef.current, current);
    if (text !== null) setAnnouncement(text);
    previousRef.current = current;
  }, [direction, wsLive]);

  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {announcement}
    </div>
  );
}
