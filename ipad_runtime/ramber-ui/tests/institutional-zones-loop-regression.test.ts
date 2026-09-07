// institutional-zones-loop-regression.test.ts — ORDEM 2B.1 (VALIDAR
// DEFINITIVAMENTE O FIX): prova por EXECUÇÃO REAL do store Zustand+Immer
// (mesmo espírito de unified-snapshot-store.test.ts — getState()/setState()
// direto, sem precisar montar um componente React) de que o ciclo real que
// causava "Maximum update depth exceeded" está genuinamente FECHADO, não
// só adiado.
//
// O que causava o loop (achado de auditoria real, ver comentário em
// App.tsx e em EnhancedChart_110_Percent.tsx): uma cadeia upstream
// instável em App.tsx chamava setInstitutionalZones repetidamente com o
// MESMO conteúdo real, mas sempre por uma referência NOVA — e cada
// escrita disparava um re-render do assinante ANCESTRAL (App, via
// useInstitutionalZonesSnapshot), que recomputava a cadeia de novo,
// fechando um ciclo autossustentado. `queueMicrotask` (ORDEM 2B) só
// adiava ESSE ciclo; nunca provava que ele parava de fato.
//
// Este arquivo simula exatamente esse cenário — N chamadas consecutivas
// de setInstitutionalZones, cada uma com uma referência NOVA mas
// conteúdo semanticamente idêntico ao anterior (o padrão real de
// computeInstitutionalZones sendo invocado de novo a cada "render") — e
// prova, por contagem real de notificações de assinante (o mesmo
// mecanismo que useSyncExternalStore usa para decidir se um componente
// React re-renderiza), que o número de escritas REAIS que chegam a mudar
// o state é FINITO e ESTÁVEL (exatamente 1), nunca um número que cresce
// sem limite.
import { describe, it, expect, beforeEach } from "vitest";
import { useUnifiedSnapshotStore } from "../src/store/unified-snapshot-store";
import { computeInstitutionalZones, type InstitutionalZoneInput } from "../src/nexus/institutional-zones";

const baseInput: InstitutionalZoneInput = {
  ema: { period: 21, value: 65000 },
  vwap: 65010,
  nexusLine: null,
  fairValueGaps: [{ type: "BULLISH", top: 65100, bottom: 65050 }],
  orderBlocks: [{ type: "BULLISH", top: 65090, bottom: 65040 }],
  liquidityZones: [],
  support: null,
  resistance: null,
  volumeProfilePoc: null,
  sessionKeyLevel: null,
  liquiditySweeps: [],
  lastSwingHigh: null,
  lastSwingLow: null,
};

// Reconstrói `baseInput` como literais NOVOS a cada chamada — exatamente
// o padrão real do bug (App.tsx recomputando `.filter()`/`.map()` soltos a
// cada render, sempre com conteúdo igual mas referência nova).
function freshEquivalentZones(): ReturnType<typeof computeInstitutionalZones> {
  return computeInstitutionalZones({
    ema: { period: 21, value: 65000 },
    vwap: 65010,
    nexusLine: null,
    fairValueGaps: [{ type: "BULLISH", top: 65100, bottom: 65050 }],
    orderBlocks: [{ type: "BULLISH", top: 65090, bottom: 65040 }],
    liquidityZones: [],
    support: null,
    resistance: null,
    volumeProfilePoc: null,
    sessionKeyLevel: null,
    liquiditySweeps: [],
    lastSwingHigh: null,
    lastSwingLow: null,
  });
}

beforeEach(() => {
  useUnifiedSnapshotStore.setState({ institutionalZones: [] });
});

describe("setInstitutionalZones: o loop real fica FECHADO na origem, nunca só adiado", () => {
  it("200 chamadas consecutivas com conteúdo idêntico (referência nova a cada vez) resultam em UMA única escrita real — a referência armazenada nunca muda depois da primeira", () => {
    useUnifiedSnapshotStore.getState().setInstitutionalZones(freshEquivalentZones());
    const afterFirstWrite = useUnifiedSnapshotStore.getState().institutionalZones;
    expect(afterFirstWrite.length).toBeGreaterThan(0);

    for (let i = 0; i < 200; i++) {
      useUnifiedSnapshotStore.getState().setInstitutionalZones(freshEquivalentZones());
    }

    // Referência ESTÁVEL (não só conteúdo igual) — prova que o `set()`
    // nunca tocou o state depois da primeira escrita real, exatamente o
    // que impede o assinante ancestral de re-renderizar.
    expect(useUnifiedSnapshotStore.getState().institutionalZones).toBe(afterFirstWrite);
  });

  it("contagem real de notificação de assinante (o mecanismo que useSyncExternalStore usa para re-renderizar) é FINITA e ESTÁVEL — nunca cresce a cada chamada", () => {
    let notifyCount = 0;
    const unsubscribe = useUnifiedSnapshotStore.subscribe(() => {
      notifyCount++;
    });
    try {
      for (let i = 0; i < 500; i++) {
        useUnifiedSnapshotStore.getState().setInstitutionalZones(freshEquivalentZones());
      }
      // Exatamente 1 notificação real (a primeira escrita) — as outras 499
      // chamadas foram absorvidas pela guarda de igualdade sem tocar o
      // state. Um regressão que reintroduza o loop (guarda removida, ou
      // volte a comparar por referência) faria este número crescer para
      // perto de 500.
      expect(notifyCount).toBe(1);
    } finally {
      unsubscribe();
    }
  });

  it("uma mudança REAL de valor no meio da sequência ainda notifica — a guarda nunca esconde uma atualização legítima", () => {
    let notifyCount = 0;
    const unsubscribe = useUnifiedSnapshotStore.subscribe(() => {
      notifyCount++;
    });
    try {
      for (let i = 0; i < 10; i++) {
        useUnifiedSnapshotStore.getState().setInstitutionalZones(freshEquivalentZones());
      }
      expect(notifyCount).toBe(1);

      // Preço real mudou — isto TEM que notificar.
      const changed = computeInstitutionalZones({ ...baseInput, fairValueGaps: [{ type: "BULLISH", top: 65300, bottom: 65250 }] });
      useUnifiedSnapshotStore.getState().setInstitutionalZones(changed);
      expect(notifyCount).toBe(2);

      for (let i = 0; i < 10; i++) {
        useUnifiedSnapshotStore.getState().setInstitutionalZones(computeInstitutionalZones({ ...baseInput, fairValueGaps: [{ type: "BULLISH", top: 65300, bottom: 65250 }] }));
      }
      expect(notifyCount).toBe(2);
    } finally {
      unsubscribe();
    }
  });

  it("dados insuficientes (lista vazia) nunca gera uma cadeia de escritas — DADOS_INSUFICIENTES é estável, nunca um loop", () => {
    let notifyCount = 0;
    const unsubscribe = useUnifiedSnapshotStore.subscribe(() => {
      notifyCount++;
    });
    try {
      for (let i = 0; i < 50; i++) {
        useUnifiedSnapshotStore.getState().setInstitutionalZones([]);
      }
      // Estado inicial já é [] (beforeEach) — nenhuma escrita real deveria
      // ter ocorrido.
      expect(notifyCount).toBe(0);
      expect(useUnifiedSnapshotStore.getState().institutionalZones).toEqual([]);
    } finally {
      unsubscribe();
    }
  });
});
