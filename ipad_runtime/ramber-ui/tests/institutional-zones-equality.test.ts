// institutional-zones-equality.test.ts — ORDEM 2B.1 (VALIDAR
// DEFINITIVAMENTE O FIX DO "Maximum update depth exceeded"): execução
// real de institutionalZonesEqual, a guarda que setInstitutionalZones
// (unified-snapshot-store.ts) usa para nunca aceitar uma referência nova
// sem verificar se o CONTEÚDO mudou de verdade — mesma disciplina de
// "lógica pura de fronteira ganha teste de execução real" já usada em
// nexus-institutional-zones.test.ts para computeInstitutionalZones.
//
// O cenário real que motivou esta guarda (achado de auditoria desta
// rodada, ver comentário em App.tsx): computeInstitutionalZones é pura
// POR VALOR mas devolve um array NOVO por referência a cada chamada — o
// comportamento normal de qualquer função que constrói sua saída. Uma
// cadeia upstream instável podia chamá-la repetidamente com entradas
// semanticamente idênticas (mesmo conteúdo, referência nova), produzindo
// uma saída sempre "nova" que nunca deveria ter disparado uma escrita na
// store. Este arquivo prova que institutionalZonesEqual reconhece esse
// caso EXATO.
import { describe, it, expect } from "vitest";
import {
  computeInstitutionalZones,
  institutionalZonesEqual,
  type InstitutionalZoneInput,
} from "../src/nexus/institutional-zones";

const baseInput: InstitutionalZoneInput = {
  ema: { period: 21, value: 65000 },
  vwap: 65010,
  nexusLine: null,
  fairValueGaps: [],
  orderBlocks: [],
  liquidityZones: [],
  support: null,
  resistance: null,
  volumeProfilePoc: null,
  sessionKeyLevel: null,
  liquiditySweeps: [],
  lastSwingHigh: null,
  lastSwingLow: null,
};

describe("institutionalZonesEqual: casos triviais", () => {
  it("mesma referência é sempre igual (fast path, zero iteração)", () => {
    const zones = computeInstitutionalZones(baseInput);
    expect(institutionalZonesEqual(zones, zones)).toBe(true);
  });

  it("duas listas vazias são iguais", () => {
    expect(institutionalZonesEqual([], [])).toBe(true);
  });

  it("comprimentos diferentes nunca são iguais", () => {
    const a = computeInstitutionalZones(baseInput);
    expect(institutionalZonesEqual(a, [])).toBe(false);
  });
});

describe("institutionalZonesEqual: o cenário real que motivou a guarda — entrada equivalente, saída por referência NOVA", () => {
  it("duas chamadas de computeInstitutionalZones com o MESMO conteúdo real (objetos/arrays reconstruídos, nunca a mesma referência) produzem saídas diferentes por referência mas iguais por institutionalZonesEqual", () => {
    // `fairValueGaps`/`ema` reconstruídos como literais NOVOS — exatamente
    // o padrão de um `.filter()`/`.map()` solto (o bug real encontrado em
    // App.tsx) que nunca preserva referência entre renders mesmo com o
    // mesmo conteúdo.
    const inputRun1: InstitutionalZoneInput = {
      ...baseInput,
      ema: { period: 21, value: 65000 },
      fairValueGaps: [{ type: "BULLISH", top: 65100, bottom: 65050 }],
    };
    const inputRun2: InstitutionalZoneInput = {
      ...baseInput,
      ema: { period: 21, value: 65000 },
      fairValueGaps: [{ type: "BULLISH", top: 65100, bottom: 65050 }],
    };
    const zonesRun1 = computeInstitutionalZones(inputRun1);
    const zonesRun2 = computeInstitutionalZones(inputRun2);

    // A função pura NUNCA reaproveita referência entre chamadas — isto é
    // esperado e correto, não é o bug.
    expect(zonesRun1).not.toBe(zonesRun2);
    expect(zonesRun1[0]).not.toBe(zonesRun2[0]);
    expect(zonesRun1[0]?.members).not.toBe(zonesRun2[0]?.members);

    // A guarda reconhece que o CONTEÚDO é idêntico — é isto que
    // setInstitutionalZones usa para pular o `set()` (zero re-render de
    // assinante) mesmo diante de uma referência nova.
    expect(institutionalZonesEqual(zonesRun1, zonesRun2)).toBe(true);
  });

  it("uma mudança real de preço em qualquer membro é detectada (a guarda nunca esconde uma atualização real)", () => {
    const a = computeInstitutionalZones({
      ...baseInput,
      fairValueGaps: [{ type: "BULLISH", top: 65100, bottom: 65050 }],
    });
    const b = computeInstitutionalZones({
      ...baseInput,
      fairValueGaps: [{ type: "BULLISH", top: 65200, bottom: 65150 }],
    });
    expect(institutionalZonesEqual(a, b)).toBe(false);
  });

  it("uma mudança real de distinctSourceCount (uma ferramenta a mais/menos concordando) é detectada", () => {
    const a = computeInstitutionalZones({
      ...baseInput,
      fairValueGaps: [{ type: "BULLISH", top: 65100, bottom: 65050 }],
    });
    const b = computeInstitutionalZones({
      ...baseInput,
      fairValueGaps: [{ type: "BULLISH", top: 65100, bottom: 65050 }],
      orderBlocks: [{ type: "BULLISH", top: 65090, bottom: 65040 }],
    });
    expect(institutionalZonesEqual(a, b)).toBe(false);
  });
});
