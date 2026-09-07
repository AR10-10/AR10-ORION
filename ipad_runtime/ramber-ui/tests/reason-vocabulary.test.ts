// reason-vocabulary.test.ts — ORDEM DE SERVIÇO (Frente 1, §2.2): execução
// real de humanizeReasonCode. Lógica pura de fronteira (tradução de texto)
// — mesma disciplina de teste de execução real já usada para outros
// motores puros deste repositório.
import { describe, it, expect } from "vitest";
import { humanizeReasonCode } from "../src/nexus/reason-vocabulary";

describe("humanizeReasonCode: entradas vazias/ausentes nunca fabricam frase", () => {
  it("null/undefined/string vazia devolvem null", () => {
    expect(humanizeReasonCode(null)).toBeNull();
    expect(humanizeReasonCode(undefined)).toBeNull();
    expect(humanizeReasonCode("")).toBeNull();
  });
});

describe("humanizeReasonCode: tabela exaustiva de códigos reais conhecidos", () => {
  const cases: [string, string][] = [
    // risk-engine.js
    ["sem_sinal_direcional_do_core_engine_nesta_leitura", "Núcleo sem direção ativa (WAIT) nesta leitura"],
    ["insumo_nao_finito_ou_ausente_fail_closed", "um insumo real do cálculo ainda não chegou (fail-closed)"],
    ["insumo_degenerado_fail_closed", "um insumo real do cálculo está fora da faixa válida (fail-closed)"],
    ["comite_sem_direcao_ou_contrario_ao_sinal_do_core", "Conselho neutro ou contrário ao Núcleo — sem base para dimensionar"],
    ["unidade_de_risco_degenerada_fail_closed", "distância entrada→invalidação real é zero ou inválida"],
    ["rr_sem_assimetria_de_payoff_kelly_nao_positivo", "R:R real não justifica posição (Kelly não-positivo)"],
    ["comite_sem_forca_direcional_suficiente", "Conselho concorda com o Núcleo, mas sem força direcional suficiente"],
    // confluence-engine.ts
    ["core_engine_sem_direcao_ativa_no_momento_(WAIT)", "Núcleo sem direção ativa (WAIT)"],
    ["nenhum_subsistema_com_leitura_real_nesta_janela", "nenhum dos 3 subsistemas tem leitura real nesta janela"],
    ["pool_sem_leitura_real", "pool de opinião sem leitura real para comparar"],
    // lorentzian-classifier.js (não-paramétrico)
    ["feature_atual_invalida_apos_warmup", "features do candle atual inválidas após o aquecimento"],
  ];
  for (const [raw, expected] of cases) {
    it(`"${raw}" -> "${expected}"`, () => {
      expect(humanizeReasonCode(raw)).toBe(expected);
    });
  }
});

describe("humanizeReasonCode: padrões paramétricos reais (lorentzian-classifier.js)", () => {
  it("apenas_N_candles_abaixo_do_minimo_M — números reais preservados", () => {
    expect(humanizeReasonCode("apenas_12_candles_abaixo_do_minimo_15")).toBe(
      "apenas 12 candles reais — mínimo de 15 ainda não atingido",
    );
    expect(humanizeReasonCode("apenas_0_candles_abaixo_do_minimo_50")).toBe(
      "apenas 0 candles reais — mínimo de 50 ainda não atingido",
    );
  });

  it("treino_insuficiente_N_pontos_abaixo_de_k=K — números reais preservados", () => {
    expect(humanizeReasonCode("treino_insuficiente_3_pontos_abaixo_de_k=8")).toBe(
      "apenas 3 pontos de treino reais — mínimo de k=8 ainda não atingido",
    );
  });
});

describe("humanizeReasonCode: fallback honesto para código desconhecido — nunca esconde o dado real", () => {
  it("código não catalogado vira underscores->espaço, nunca some nem vira genérico", () => {
    expect(humanizeReasonCode("motivo_futuro_ainda_nao_catalogado")).toBe("motivo futuro ainda nao catalogado");
  });

  it("um código real com formato quase-paramétrico mas fora do regex exato não quebra (fallback simples)", () => {
    expect(humanizeReasonCode("apenas_candles_sem_numero")).toBe("apenas candles sem numero");
  });
});
