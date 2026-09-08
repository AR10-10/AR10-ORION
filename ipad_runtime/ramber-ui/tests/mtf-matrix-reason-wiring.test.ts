// mtf-matrix-reason-wiring.test.ts — ORDEM DE SERVIÇO FINAL (auditoria de
// auto-cura/estados vazios): o tooltip de cada linha insuficiente da
// Multi-Timeframe Matrix mostrava ctx.reason cru (snake_case,
// "sem_candles_reais_para_este_timeframe") em vez de passar por
// humanizeReasonCode(), como toda outra razão real já traduzida na Frente 1.
// Trava por padrão de código (App.tsx não é montável neste repo).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const app = readFileSync(resolve(__dirname, "../src/App.tsx"), "utf8");

describe("MultiTimeframeMatrixWidget: tooltip de linha insuficiente usa humanizeReasonCode, nunca o código cru", () => {
  it("chama humanizeReasonCode(ctx?.reason) em vez de interpolar ctx?.reason direto", () => {
    expect(app).toContain('? `${MTF_ROW_LABEL[tf]}: ${humanizeReasonCode(ctx?.reason) ?? "sem dados reais"}`');
    expect(app).not.toContain('? `${MTF_ROW_LABEL[tf]}: ${ctx?.reason ?? "sem_dados_reais"}`');
  });
});
