// use-gmil-snapshot.ts — ponte React↔GMIL. Único arquivo do GMIL que sabe
// que React existe; o resto do diretório é runtime puro/desacoplado (LEI 11).
import { useEffect, useState } from 'react';
import { gmilBus } from './event-bus';
import { gmilOrchestrator, type GmilSnapshot } from './gmil-orchestrator';

export function useGmilSnapshot(): GmilSnapshot {
  const [snapshot, setSnapshot] = useState<GmilSnapshot>(() => gmilOrchestrator.getSnapshot());

  useEffect(() => {
    gmilOrchestrator.start();
    const refresh = () => setSnapshot(gmilOrchestrator.getSnapshot());
    const offReading = gmilBus.on('PROVIDER_READING', refresh);
    const offHealth = gmilBus.on('PROVIDER_HEALTH_CHANGED', refresh);
    const offConsensus = gmilBus.on('CONSENSUS_UPDATED', refresh);
    refresh();
    return () => {
      offReading();
      offHealth();
      offConsensus();
    };
  }, []);

  return snapshot;
}
