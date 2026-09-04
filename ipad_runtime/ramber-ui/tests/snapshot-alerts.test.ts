// Suíte de EXECUÇÃO REAL do produtor único de alertas
// (nexus/snapshot-alerts.ts) e do adaptador de voz.
//
// POR QUE EXECUÇÃO REAL E NÃO PADRÃO DE FONTE: esta entrega MOVEU 11 regras
// de detecção de voice-dispatcher.ts para cá. O bug mais provável não é
// "esqueceram de conectar A com B" — é "uma regra mudou de comportamento na
// mudança de casa". Nesse caso a convenção do projeto manda execução real.
//
// Cada teste abaixo prova uma TRANSIÇÃO: a regra dispara quando o estado
// muda de verdade, e fica calada quando o estado se repete.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { deriveSnapshotAlerts, type AlertSnapshot } from "../src/nexus/snapshot-alerts";
import { toVoiceAlerts } from "../src/voice/voice-dispatcher";

const NOW = 1_700_000_000_000;

const base = (over: Partial<AlertSnapshot> = {}): AlertSnapshot => ({
  direction: null,
  engineStatus: "ok",
  lorentzianOk: false,
  lorentzianClassification: null,
  recentOrderflowTypes: [],
  recentLiquidationCount: 0,
  structureBreakKey: null,
  structureBreakType: null,
  structureBreakDirection: null,
  tradePlanOpenKey: null,
  tradePlanDirection: null,
  tradePlanResolutionKey: null,
  tradePlanResolutionStatus: null,
  tradePlanTargetProgressKey: null,
  tradePlanTargetsHit: 0,
  inEntryZone: false,
  convictionVerdict: null,
  ...over,
});

const fire = (prev: AlertSnapshot | null, next: AlertSnapshot) =>
  deriveSnapshotAlerts(prev, next, NOW);

describe("snapshot-alerts — contrato de todo evento", () => {
  it("sem snapshot anterior não existe transição: lista vazia, nunca alerta de boot", () => {
    expect(fire(null, base({ direction: "LONG" }))).toEqual([]);
  });

  it("estado idêntico não gera nada (a regra anti-ruído inteira depende disso)", () => {
    const s = base({ direction: "LONG", engineStatus: "ok", recentLiquidationCount: 4 });
    expect(fire(s, s)).toEqual([]);
  });

  it("todo evento emitido carrega id, tone, priority, title, message e createdAt", () => {
    const out = fire(base(), base({ direction: "SHORT" }));
    expect(out).toHaveLength(1);
    for (const e of out) {
      expect(typeof e.id).toBe("string");
      expect(e.id.length).toBeGreaterThan(0);
      expect(["success", "info", "danger"]).toContain(e.tone);
      expect(["CRITICAL", "ALERT", "INFO"]).toContain(e.priority);
      expect(e.title.length).toBeGreaterThan(0);
      expect(e.message.length).toBeGreaterThan(0);
      expect(e.createdAt).toBe(NOW);
    }
  });
});

describe("snapshot-alerts — vetor do Núcleo", () => {
  it("direção nova é CRITICAL e fala a sentença original, palavra por palavra", () => {
    const out = fire(base(), base({ direction: "LONG" }));
    expect(out[0].priority).toBe("CRITICAL");
    expect(out[0].speech).toBe("Atenção. Vetor de alta confirmado pelo motor real.");

    const short = fire(base(), base({ direction: "SHORT" }));
    expect(short[0].speech).toBe("Atenção. Vetor de baixa confirmado pelo motor real.");
  });

  it("vetor perdido é ALERT, não CRITICAL", () => {
    const out = fire(base({ direction: "LONG" }), base({ direction: null }));
    expect(out).toHaveLength(1);
    expect(out[0].priority).toBe("ALERT");
    expect(out[0].speech).toBe("Vetor invalidado. Sistema de volta a aguardar confirmação.");
  });

  it("mesma direção mantida entre ciclos não repete o alerta", () => {
    const s = base({ direction: "LONG" });
    expect(fire(s, s)).toEqual([]);
  });
});

describe("snapshot-alerts — divergência com o classificador independente", () => {
  const diverging = base({ direction: "LONG", lorentzianOk: true, lorentzianClassification: "SHORT" });

  it("dispara ao SURGIR a divergência", () => {
    const out = fire(base({ direction: "LONG", lorentzianOk: true, lorentzianClassification: "LONG" }), diverging);
    expect(out.map((e) => e.title)).toContain("DIVERGÊNCIA");
    expect(out[0].tone).toBe("danger");
  });

  it("não repete enquanto a divergência continua a mesma", () => {
    expect(fire(diverging, diverging)).toEqual([]);
  });

  it("NEUTRAL nunca conta como divergência", () => {
    const neutral = base({ direction: "LONG", lorentzianOk: true, lorentzianClassification: "NEUTRAL" });
    expect(fire(base({ direction: "LONG" }), neutral)).toEqual([]);
  });

  it("classificador indisponível (lorentzianOk=false) nunca diverge", () => {
    const off = base({ direction: "LONG", lorentzianOk: false, lorentzianClassification: "SHORT" });
    expect(fire(base({ direction: "LONG" }), off)).toEqual([]);
  });
});

describe("snapshot-alerts — fluxo institucional real", () => {
  it("liquidação nova dispara; contagem estável não", () => {
    expect(fire(base({ recentLiquidationCount: 2 }), base({ recentLiquidationCount: 3 }))).toHaveLength(1);
    expect(fire(base({ recentLiquidationCount: 3 }), base({ recentLiquidationCount: 3 }))).toEqual([]);
  });

  it("absorção dispara ao surgir e não repete enquanto persiste", () => {
    const withAbs = base({ recentOrderflowTypes: ["ABSORPTION"] });
    const out = fire(base(), withAbs);
    expect(out[0].speech).toBe("Absorção institucional detectada no fluxo real.");
    expect(fire(withAbs, withAbs)).toEqual([]);
  });
});

describe("snapshot-alerts — saúde do motor", () => {
  it("queda é CRITICAL e tom danger", () => {
    const out = fire(base({ engineStatus: "ok" }), base({ engineStatus: "error" }));
    expect(out[0].priority).toBe("CRITICAL");
    expect(out[0].tone).toBe("danger");
  });

  it("recuperação é INFO e tom success", () => {
    const out = fire(base({ engineStatus: "error" }), base({ engineStatus: "ok" }));
    expect(out[0].priority).toBe("INFO");
    expect(out[0].tone).toBe("success");
  });
});

describe("snapshot-alerts — estrutura (BOS/CHOCH)", () => {
  const choch = base({ structureBreakKey: "CHOCH:64", structureBreakType: "CHOCH", structureBreakDirection: "ALTA" });
  const bos = base({ structureBreakKey: "BOS:70", structureBreakType: "BOS", structureBreakDirection: "BAIXA" });

  it("CHOCH é ALERT; BOS é INFO — CHOCH é o evento mais significativo", () => {
    expect(fire(base(), choch)[0].priority).toBe("ALERT");
    expect(fire(base(), bos)[0].priority).toBe("INFO");
  });

  it("o id vem da CHAVE real, então o mesmo rompimento nunca vira dois toasts", () => {
    expect(fire(base(), choch)[0].id).toBe("structure-CHOCH:64");
    expect(fire(choch, choch)).toEqual([]);
  });

  it("sentença falada preservada palavra por palavra", () => {
    expect(fire(base(), choch)[0].speech).toBe("Mudança de caráter de alta. Estrutura pode estar revertendo.");
    expect(fire(base(), bos)[0].speech).toBe("Rompimento de estrutura de baixa confirma continuação.");
  });
});

describe("snapshot-alerts — ciclo de vida do Trade Plan", () => {
  it("abertura de plano dispara uma vez, com a direção certa", () => {
    const open = base({ tradePlanOpenKey: "p1", tradePlanDirection: "SHORT" });
    const out = fire(base(), open);
    expect(out[0].speech).toBe("Entrada de venda identificada pelo Trade Plan real.");
    expect(fire(open, open)).toEqual([]);
  });

  it("entrada na zona dispara só na borda de subida", () => {
    expect(fire(base({ inEntryZone: false }), base({ inEntryZone: true }))).toHaveLength(1);
    expect(fire(base({ inEntryZone: true }), base({ inEntryZone: true }))).toEqual([]);
    expect(fire(base({ inEntryZone: true }), base({ inEntryZone: false }))).toEqual([]);
  });

  it("progresso de alvo exige targetsHit > 0 — nunca dispara na abertura do plano", () => {
    const semAlvo = base({ tradePlanTargetProgressKey: "k1", tradePlanTargetsHit: 0 });
    expect(fire(base(), semAlvo)).toEqual([]);

    const comAlvo = base({ tradePlanTargetProgressKey: "k1", tradePlanTargetsHit: 1 });
    const out = fire(base(), comAlvo);
    expect(out[0].tone).toBe("success");
    expect(out[0].speech).toBe("Alvo 1 do Trade Plan alcançado. Stop movido para break-even.");
  });
});

describe("snapshot-alerts — a reconciliação do produtor único", () => {
  // O ponto inteiro da unificação: a resolução real do plano
  // (TARGET_HIT/PARTIAL_HIT/STOP_HIT) é produzida SÓ por
  // alert-center.deriveTrackRecordAlert, que tem preço real e contagem de
  // alvos. Derivar aqui também faria o MESMO resultado virar dois toasts e
  // duas falas.
  it("NÃO deriva TARGET_HIT, PARTIAL_HIT nem STOP_HIT — quem produz é o alert-center", () => {
    for (const status of ["TARGET_HIT", "PARTIAL_HIT", "STOP_HIT"] as const) {
      const out = fire(base(), base({ tradePlanResolutionKey: "r1", tradePlanResolutionStatus: status }));
      expect(out).toEqual([]);
    }
  });

  it("deriva REPLACED — que o alert-center exclui por decisão, e que a voz sempre narrou", () => {
    const out = fire(base(), base({ tradePlanResolutionKey: "r1", tradePlanResolutionStatus: "REPLACED" }));
    expect(out).toHaveLength(1);
    expect(out[0].speech).toBe("Plano substituído por uma leitura de estrutura mais recente.");
  });
});

describe("snapshot-alerts — convicção", () => {
  it("queda real entre duas leituras dispara", () => {
    const out = fire(base({ convictionVerdict: "CONFIRMS" }), base({ convictionVerdict: "MIXED" }));
    expect(out[0].title).toBe("CONVICÇÃO REDUZIDA");
  });

  it("subida nunca dispara", () => {
    expect(fire(base({ convictionVerdict: "CONTRADICTS" }), base({ convictionVerdict: "CONFIRMS" }))).toEqual([]);
  });

  it("null → leitura NÃO é queda: 'indisponível' nunca vira 'reduzida'", () => {
    expect(fire(base({ convictionVerdict: null }), base({ convictionVerdict: "CONTRADICTS" }))).toEqual([]);
    expect(fire(base({ convictionVerdict: "CONFIRMS" }), base({ convictionVerdict: null }))).toEqual([]);
  });
});

describe("toVoiceAlerts — o adaptador", () => {
  it("converte speech em fala e preserva a prioridade do evento", () => {
    const events = fire(base(), base({ direction: "LONG" }));
    const spoken = toVoiceAlerts(events);
    expect(spoken).toEqual([
      { text: "Atenção. Vetor de alta confirmado pelo motor real.", priority: "CRITICAL" },
    ]);
  });

  it("evento sem speech é real e vira toast, mas NUNCA é falado", () => {
    const mudo = { id: "x", tone: "info" as const, priority: "INFO" as const, title: "T", message: "M", createdAt: NOW };
    expect(toVoiceAlerts([mudo])).toEqual([]);
  });
});

describe("unificação — não pode existir um segundo produtor", () => {
  const dispatcher = readFileSync(resolve(__dirname, "../src/voice/voice-dispatcher.ts"), "utf-8");

  it("voice-dispatcher.ts não detecta mais nada: só consome e adapta", () => {
    expect(dispatcher).toContain("deriveSnapshotAlerts");
    // Nenhuma comparação prev/next sobrou no adaptador — detecção é do produtor.
    expect(dispatcher).not.toMatch(/prev\.\w+\s*!==\s*next\.\w+/);
    expect(dispatcher).not.toMatch(/next\.\w+\s*!==\s*prev\.\w+/);
    expect(dispatcher).not.toContain("recentLiquidationCount");
    expect(dispatcher).not.toContain("convictionVerdict");
  });

  it("nexus/ continua sem importar nada de voice/ (regra arquitetural existente)", () => {
    const produtor = readFileSync(resolve(__dirname, "../src/nexus/snapshot-alerts.ts"), "utf-8");
    expect(produtor).not.toMatch(/from ["'].*voice\//);
  });
});
