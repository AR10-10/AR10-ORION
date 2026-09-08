// sample-maturity-line.test.ts — execução REAL: a pergunta é "a linha diz o
// certo, e nenhuma razão real se perde no colapso?".
import { describe, it, expect } from "vitest";
import { buildSampleMaturity, reasonStillNeeded } from "../src/nexus/sample-maturity-line";

const g = (label: string, have: number, need: number) => ({ label, have, need });

describe("a escassez vira UMA linha, não três frases", () => {
  it("degraus com a MESMA contagem dizem o número uma vez só", () => {
    // O caso real do card: 0 trades, três limiares.
    const m = buildSampleMaturity([g("expectativa", 0, 30), g("calibração", 0, 30), g("validação", 0, 60)]);
    expect(m.hasGap).toBe(true);
    expect(m.line).toBe("0 trades resolvidos · falta: expectativa ≥30 · calibração ≥30 · validação ≥60");
    // O número aparece UMA vez (o "0" inicial), nunca repetido por degrau.
    expect(m.line.match(/\b0\b/g)).toHaveLength(1);
  });

  it("contagens diferentes mostram cada degrau com o seu próprio progresso", () => {
    const m = buildSampleMaturity([g("expectativa", 12, 30), g("validação", 5, 60)]);
    expect(m.line).toContain("expectativa 12/30");
    expect(m.line).toContain("validação 5/60");
  });

  it("ordena por proximidade de destravar — a informação acionável primeiro", () => {
    const m = buildSampleMaturity([g("longe", 1, 60), g("perto", 29, 30)]);
    expect(m.pending[0].label).toBe("perto");
  });
});

describe("sem escassez, a linha não aparece — zero elemento desnecessário", () => {
  it("todos os degraus atingidos = linha vazia", () => {
    const m = buildSampleMaturity([g("expectativa", 30, 30), g("validação", 100, 60)]);
    expect(m.hasGap).toBe(false);
    expect(m.line).toBe("");
    expect(m.pending).toEqual([]);
  });

  it("a fronteira exata (have === need) já conta como atingido", () => {
    expect(buildSampleMaturity([g("x", 30, 30)]).hasGap).toBe(false);
  });

  it("só os PENDENTES entram na linha; os atingidos somem dela", () => {
    const m = buildSampleMaturity([g("pronto", 50, 30), g("falta", 5, 60)]);
    expect(m.line).toContain("falta");
    expect(m.line).not.toContain("pronto");
  });
});

describe("fail-closed: entrada inválida nunca vira linha fabricada", () => {
  it("lista vazia/nula = sem linha", () => {
    for (const e of [null, undefined, []]) {
      const m = buildSampleMaturity(e);
      expect(m.hasGap).toBe(false);
      expect(m.line).toBe("");
    }
  });

  it("degrau com números não-finitos ou need<=0 é descartado", () => {
    const m = buildSampleMaturity([
      g("ruim", Number.NaN, 30),
      g("zero", 0, 0),
      g("bom", 5, 30),
    ]);
    expect(m.pending).toHaveLength(1);
    expect(m.pending[0].label).toBe("bom");
  });

  it("não muta a entrada", () => {
    const gates = [g("b", 5, 60), g("a", 29, 30)];
    const copia = JSON.parse(JSON.stringify(gates));
    buildSampleMaturity(gates);
    expect(gates).toEqual(copia);
  });
});

describe("REGRA DE OURO 4: o colapso nunca apaga uma razão real", () => {
  it("degrau PENDENTE: a razão de escassez some (a linha única já disse)", () => {
    expect(reasonStillNeeded("Amostra real de 0 trades — mínimo 30.", g("calibração", 0, 30))).toBe(false);
  });

  it("degrau ATINGIDO: a razão é OUTRA coisa e continua visível", () => {
    // Este é o teste que impede o colapso cego. Com 40 trades (acima do
    // mínimo), uma razão presente NÃO é escassez — é "sem plano ativo" ou
    // "o ajuste não convergiu", e sumir com ela perderia informação real.
    expect(
      reasonStillNeeded("Sem plano ativo com leitura real de modelo agora — nada para calibrar.", g("calibração", 40, 30)),
    ).toBe(true);
    expect(
      reasonStillNeeded("Falha real no ajuste de calibração (Platt Scaling).", g("calibração", 40, 30)),
    ).toBe(true);
  });

  it("sem razão nenhuma, não há o que mostrar", () => {
    for (const r of [null, undefined, "", "   "]) {
      expect(reasonStillNeeded(r, g("x", 0, 30))).toBe(false);
    }
  });

  it("sem degrau conhecido, a razão SEMPRE aparece — fail-open só aqui, e de propósito", () => {
    // Não saber a contagem nunca pode virar motivo para esconder um aviso.
    expect(reasonStillNeeded("qualquer motivo real", null)).toBe(true);
    expect(reasonStillNeeded("qualquer motivo real", g("x", Number.NaN, 30))).toBe(true);
  });
});
