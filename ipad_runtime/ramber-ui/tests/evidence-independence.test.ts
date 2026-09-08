// evidence-independence.test.ts — §43 da ordem "AUDITORIA INTEGRAL DO
// ORGANISMO": "Cinco indicadores derivados da mesma candle não devem ser
// tratados como cinco fontes independentes."
//
// Convenção mista (CLAUDE.md): aqui o bug provável é "a matemática está
// sutilmente errada" (contagem de distintos, denominador do índice,
// tratamento do desconhecido), então é execução REAL de ponta a ponta —
// nunca padrão de código.
import { describe, it, expect } from "vitest";
import {
  measureEvidenceIndependence,
  evidenceIndependenceLabel,
  MIN_DISTINCT_EVIDENCE_FAMILIES,
  type EvidenceVoice,
} from "../src/nexus/evidence-independence";

const NOW = 1_760_000_000_000;
const voz = (id: string, family: string | null, agrees = true): EvidenceVoice => ({ id, family, agrees });

describe("§43: o cenário exato do pedido — 5 vozes, 1 evidência", () => {
  it("cinco indicadores da MESMA família contam como UMA fonte distinta, nunca cinco", () => {
    const r = measureEvidenceIndependence(
      [
        voz("knn", "momentum"),
        voz("estrutura_15m", "momentum"),
        voz("estrutura_1h", "momentum"),
        voz("rsi", "momentum"),
        voz("macd", "momentum"),
      ],
      NOW,
    );
    expect(r.status).toBe("OK");
    // O número que a tela mostra hoje...
    expect(r.agreeingVoices).toBe(5);
    // ...e a verdade estrutural por trás dele.
    expect(r.distinctFamilies).toBe(1);
    expect(r.independenceRatio).toBeCloseTo(0.2, 10);
    expect(r.largestClusterFamily).toBe("momentum");
    expect(r.largestClusterSize).toBe(5);
    expect(evidenceIndependenceLabel(r)).toBe("FONTE ÚNICA");
  });

  it("cinco vozes em cinco famílias distintas = independência integral", () => {
    const r = measureEvidenceIndependence(
      [
        voz("a", "momentum"),
        voz("b", "fluxo_ordens"),
        voz("c", "rompimento"),
        voz("d", "reversao_media"),
        voz("e", "filtros_estatisticos"),
      ],
      NOW,
    );
    expect(r.distinctFamilies).toBe(5);
    expect(r.independenceRatio).toBe(1);
    expect(r.largestClusterSize).toBe(1);
    expect(evidenceIndependenceLabel(r)).toBe("DIVERSA");
  });

  it("distingue CONFLUÊNCIA de INDEPENDÊNCIA: mesma contagem de vozes, leituras opostas", () => {
    const concentrada = measureEvidenceIndependence(
      [voz("a", "momentum"), voz("b", "momentum"), voz("c", "momentum"), voz("d", "fluxo_ordens")],
      NOW,
    );
    const diversa = measureEvidenceIndependence(
      [voz("a", "momentum"), voz("b", "fluxo_ordens"), voz("c", "rompimento"), voz("d", "reversao_media")],
      NOW,
    );
    // As duas mostram "4 concordam" — o que a tela diria hoje.
    expect(concentrada.agreeingVoices).toBe(diversa.agreeingVoices);
    // Mas a evidência por trás não é a mesma coisa.
    expect(concentrada.distinctFamilies).toBe(2);
    expect(diversa.distinctFamilies).toBe(4);
    expect(concentrada.independenceRatio!).toBeLessThan(diversa.independenceRatio!);
    // 4 vozes sobre 2 famílias = 0.5: metade da diversidade possível.
    expect(concentrada.independenceRatio).toBe(0.5);
    expect(evidenceIndependenceLabel(concentrada)).toBe("PARCIALMENTE REDUNDANTE");
    expect(evidenceIndependenceLabel(diversa)).toBe("DIVERSA");
  });

  it("abaixo de metade da diversidade possível a leitura vira CONCENTRADA", () => {
    // 5 vozes, 2 famílias (4 em momentum) = 0.4 — pior que metade.
    const r = measureEvidenceIndependence(
      [
        voz("a", "momentum"),
        voz("b", "momentum"),
        voz("c", "momentum"),
        voz("d", "momentum"),
        voz("e", "fluxo_ordens"),
      ],
      NOW,
    );
    expect(r.independenceRatio).toBeCloseTo(0.4, 10);
    expect(r.largestClusterFamily).toBe("momentum");
    expect(r.largestClusterSize).toBe(4);
    expect(evidenceIndependenceLabel(r)).toBe("CONCENTRADA");
  });
});

describe("discordância nunca vira confluência", () => {
  it("só vozes que concordam entram na contagem", () => {
    const r = measureEvidenceIndependence(
      [
        voz("a", "momentum", true),
        voz("b", "fluxo_ordens", false),
        voz("c", "rompimento", false),
      ],
      NOW,
    );
    expect(r.agreeingVoices).toBe(1);
    expect(r.distinctFamilies).toBe(1);
  });

  it("zero vozes concordantes é DADOS_INSUFICIENTES com razão real, nunca um índice fabricado", () => {
    const r = measureEvidenceIndependence([voz("a", "momentum", false)], NOW);
    expect(r.status).toBe("DADOS_INSUFICIENTES");
    expect(r.reason).toContain("nenhuma voz concordante");
    expect(r.independenceRatio).toBeNull();
  });
});

describe("fail-closed (§58): família desconhecida NUNCA é assumida independente", () => {
  it("o estado REAL de hoje (Conselho/Confluence passam familia: null) devolve não-avaliável, não um índice bonito", () => {
    const r = measureEvidenceIndependence(
      [voz("liquidez", null), voz("estrutura", null), voz("orderflow", null)],
      NOW,
    );
    expect(r.status).toBe("DADOS_INSUFICIENTES");
    expect(r.reason).toContain("não avaliável");
    // As vozes existem e são contadas — o que falta é a família delas.
    expect(r.agreeingVoices).toBe(3);
    expect(r.unknownFamilyVoices).toBe(3);
    expect(r.assessedVoices).toBe(0);
    expect(r.independenceRatio).toBeNull();
  });

  it("voz desconhecida fica FORA do índice — nem infla o numerador nem pune o denominador", () => {
    const r = measureEvidenceIndependence(
      [voz("a", "momentum"), voz("b", "fluxo_ordens"), voz("c", null), voz("d", null)],
      NOW,
    );
    expect(r.agreeingVoices).toBe(4);
    expect(r.assessedVoices).toBe(2);
    expect(r.unknownFamilyVoices).toBe(2);
    expect(r.distinctFamilies).toBe(2);
    // 2 distintas / 2 avaliáveis — as 2 desconhecidas não entram em lado nenhum.
    expect(r.independenceRatio).toBe(1);
  });

  it("família em branco/espaços conta como NÃO declarada — nunca um cluster fantasma", () => {
    const r = measureEvidenceIndependence([voz("a", "   "), voz("b", ""), voz("c", "momentum")], NOW);
    expect(r.unknownFamilyVoices).toBe(2);
    expect(r.assessedVoices).toBe(1);
    expect(r.distinctFamilies).toBe(1);
  });

  it("entrada vazia/inválida devolve DADOS_INSUFICIENTES, nunca NaN", () => {
    for (const bad of [null, undefined, []] as const) {
      const r = measureEvidenceIndependence(bad, NOW);
      expect(r.status).toBe("DADOS_INSUFICIENTES");
      expect(r.independenceRatio).toBeNull();
      expect(Number.isFinite(r.computedAt)).toBe(true);
    }
  });

  it("`now` não-finito nunca vaza NaN para o timestamp", () => {
    const r = measureEvidenceIndependence([voz("a", "momentum")], Number.NaN);
    expect(Number.isFinite(r.computedAt)).toBe(true);
  });
});

describe("pureza e determinismo (a razão de o teste poder ser de execução real)", () => {
  it("mesma entrada + mesmo now => saída idêntica, sempre", () => {
    const entrada = [voz("a", "momentum"), voz("b", "fluxo_ordens"), voz("c", "momentum")];
    expect(measureEvidenceIndependence(entrada, NOW)).toEqual(measureEvidenceIndependence(entrada, NOW));
  });

  it("empate de cluster é resolvido deterministicamente (alfabético), nunca pela ordem de inserção", () => {
    const a = measureEvidenceIndependence([voz("1", "momentum"), voz("2", "fluxo_ordens")], NOW);
    const b = measureEvidenceIndependence([voz("1", "fluxo_ordens"), voz("2", "momentum")], NOW);
    expect(a.largestClusterFamily).toBe(b.largestClusterFamily);
    expect(a.largestClusterFamily).toBe("fluxo_ordens"); // alfabeticamente antes de "momentum"
  });

  it("não muta a entrada", () => {
    const entrada = [voz("a", "momentum"), voz("b", null)];
    const copia = JSON.parse(JSON.stringify(entrada));
    measureEvidenceIndependence(entrada, NOW);
    expect(entrada).toEqual(copia);
  });
});

describe("LEI 24 / Regra de Ouro 2: mede estrutura, nunca direção nem probabilidade", () => {
  it("a leitura não expõe campo nenhum de direção, score combinado ou probabilidade", () => {
    const r = measureEvidenceIndependence([voz("a", "momentum"), voz("b", "fluxo_ordens")], NOW);
    const chaves = Object.keys(r);
    for (const proibida of ["direction", "stance", "score", "confidence", "probability", "probabilidade"]) {
      expect(chaves).not.toContain(proibida);
    }
  });

  it("o rótulo é qualitativo e estrutural — nunca uma % nem uma promessa", () => {
    for (const r of [
      measureEvidenceIndependence([voz("a", "momentum")], NOW),
      measureEvidenceIndependence([voz("a", "momentum"), voz("b", "fluxo_ordens")], NOW),
      measureEvidenceIndependence([voz("a", null)], NOW),
    ]) {
      expect(evidenceIndependenceLabel(r)).not.toMatch(/%|chance|probabil/i);
    }
  });

  it("o piso reusa o MESMO número já provado em institutional-zones (nunca um limiar novo)", () => {
    expect(MIN_DISTINCT_EVIDENCE_FAMILIES).toBe(2);
    const umaSo = measureEvidenceIndependence([voz("a", "momentum"), voz("b", "momentum")], NOW);
    expect(umaSo.distinctFamilies).toBeLessThan(MIN_DISTINCT_EVIDENCE_FAMILIES);
    expect(evidenceIndependenceLabel(umaSo)).toBe("FONTE ÚNICA");
  });
});
