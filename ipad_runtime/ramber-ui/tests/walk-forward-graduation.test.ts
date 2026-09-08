// walk-forward-graduation.test.ts — fiação da GRADUAÇÃO do walk-forward.
//
// Padrão-no-código-fonte: a matemática já tem execução real em
// walk-forward-calibration.test.ts. O bug provável AQUI é "esqueceram de
// ligar A com B" — ou, muito pior e silencioso, ligar na amostra ERRADA
// (uma segunda chamada a simulateTradeCostsBatch, ou uma lista fora de
// ordem cronológica, que faria o walk-forward vazar futuro no treino sem
// nenhum sintoma visível).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const app = readFileSync(resolve(here, "../src/App.tsx"), "utf8");

describe("o walk-forward está ligado ao ciclo real", () => {
  it("importa o módulo graduado", () => {
    expect(app).toContain('from "./nexus/walk-forward-calibration"');
    expect(app).toContain("evaluateWalkForwardCalibration");
  });

  it("é computado num useMemo próprio e flui pelo WidgetContext", () => {
    expect(app).toContain("const walkForwardReport: WalkForwardReport = useMemo(");
    // Três pontos legítimos, e os três são obrigatórios: o objeto do
    // contexto, as DEPS do memo do contexto (sem elas o valor congela no
    // primeiro render) e o destructure do ExpectancyCard.
    const ocorrencias = app.match(/^\s+walkForwardReport,$/gm);
    expect(ocorrencias, "contextValue + deps + destructure do card").toHaveLength(3);
  });

  it("o ExpectancyCard consome o relatório", () => {
    expect(app).toContain("walkForwardReport?: WalkForwardReport;");
  });
});

describe("a amostra é a MESMA — zero segunda fonte", () => {
  it("usa trackRecordResults, o mesmo array de expectancy e calibração", () => {
    expect(app).toContain("() => evaluateWalkForwardCalibration(trackRecordResults),");
    expect(app).toContain("[trackRecordResults],");
  });

  it("simulateTradeCostsBatch continua sendo chamado UMA vez só", () => {
    // Uma 2ª chamada seria uma segunda amostra do mesmo dado, exatamente o
    // que o comentário de calibrationResult já existia para impedir.
    // Só linhas EXECUTÁVEIS: os comentários citam a função de propósito
    // (é neles que o contrato de ordem está escrito), e casá-los seria
    // falso positivo — mesma disciplina dos outros testes de varredura.
    const chamadas = app
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("//") && !l.trimStart().startsWith("*"))
      .filter((l) => l.includes("simulateTradeCostsBatch("));
    expect(chamadas).toHaveLength(1);
  });
});

describe("o contrato de ORDEM CRONOLÓGICA está registrado no ponto de uso", () => {
  it("o porquê da ordem importar está escrito onde alguém iria quebrá-lo", () => {
    // Sem isto, uma sessão futura pode reordenar o history (ex.: "newest
    // first" para a UI) e o walk-forward passa a treinar com o futuro —
    // sem erro, sem teste vermelho, só um número inflado.
    const idx = app.indexOf("const walkForwardReport: WalkForwardReport = useMemo(");
    const bloco = app.slice(Math.max(0, idx - 1400), idx);
    expect(bloco).toContain("newest last");
    expect(bloco).toContain("pushHistory");
    expect(bloco).toContain("simulateTradeCostsBatch");
  });
});

describe("honestidade da apresentação (Regra de Ouro 2 + 3)", () => {
  it("sem amostra suficiente, a UI diz 'AINDA NÃO SEI' — nunca um número", () => {
    expect(app).toContain('"AINDA NÃO SEI"');
    // E o motivo real aparece, nunca um código cru nem silêncio.
    expect(app).toContain("{walkForwardReport.reason}");
  });

  it("o veredito negativo é EXIBIDO, não escondido", () => {
    expect(app).toContain('"SEM VALOR DEMONSTRADO"');
    expect(app).toContain("SEM_VALOR_PREDITIVO_DEMONSTRADO");
  });

  it("as métricas só são lidas quando status === OK (nunca `!` sobre null)", () => {
    const idx = app.indexOf("Validação fora-da-amostra");
    const bloco = app.slice(idx, idx + 3000);
    expect(bloco).toContain('walkForwardReport.status === "OK" ?');
  });

  it("o tooltip explica que BSS zero = não é melhor que chutar a média", () => {
    expect(app).toContain("não é melhor que chutar a média");
  });
});

describe("LEI 24 — a validação nunca vira decisão", () => {
  it("o bloco não toca engine.direction nem emite sinal", () => {
    const idx = app.indexOf("Validação fora-da-amostra");
    const bloco = app.slice(idx, idx + 3000);
    for (const proibido of ["engine.direction", "setDecision", "LONG", "SHORT"]) {
      expect(bloco).not.toContain(proibido);
    }
  });
});
