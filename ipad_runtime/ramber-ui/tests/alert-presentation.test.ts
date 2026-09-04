// Suíte da sensibilidade visual do alerta (nexus/alert-presentation.ts).
//
// O gap que motivou o módulo: a unificação deu `priority` a todo
// AlertEvent, mas o toast estilizava só por `tone` — um CRITICAL
// "VETOR CONFIRMADO" e um INFO "PLANO SUBSTITUÍDO" são ambos
// `tone: "info"` e ficavam idênticos na tela. A urgência existia no dado e
// não existia no olho.
//
// A asserção mais importante deste arquivo é a que prova que urgência
// NUNCA vira cor: colapsar os dois eixos mentiria sobre o primeiro, porque
// um CRITICAL pode ser boa notícia.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  alertEmphasis,
  sortAlertsByUrgency,
  ALERT_PRIORITY_WEIGHT,
} from "../src/nexus/alert-presentation";
import type { AlertEvent, AlertPriority } from "../src/nexus/alert-center";

const ev = (id: string, priority: AlertPriority, createdAt: number): AlertEvent => ({
  id,
  tone: "info",
  priority,
  title: id,
  message: id,
  createdAt,
});

describe("alertEmphasis — urgência codificada em forma", () => {
  it("a espessura do trilho cresce monotonicamente com a urgência", () => {
    expect(alertEmphasis("CRITICAL").railPx).toBeGreaterThan(alertEmphasis("ALERT").railPx);
    expect(alertEmphasis("ALERT").railPx).toBeGreaterThan(alertEmphasis("INFO").railPx);
  });

  it("só o CRITICAL ganha anel — se tudo tivesse, o anel não diria nada", () => {
    expect(alertEmphasis("CRITICAL").ring).toBe(true);
    expect(alertEmphasis("ALERT").ring).toBe(false);
    expect(alertEmphasis("INFO").ring).toBe(false);
  });

  it("INFO recua sem sumir — continua legível, só para de competir", () => {
    const info = alertEmphasis("INFO");
    expect(info.opacity).toBeLessThan(1);
    expect(info.opacity).toBeGreaterThanOrEqual(0.7);
    expect(alertEmphasis("CRITICAL").opacity).toBe(1);
  });

  it("marcador textual é redundância deliberada com a forma (sol no iPad)", () => {
    expect(alertEmphasis("CRITICAL").marker.length).toBeGreaterThan(
      alertEmphasis("ALERT").marker.length,
    );
    expect(alertEmphasis("INFO").marker).toBe("");
  });

  it("NUNCA devolve cor — cor pertence ao tone", () => {
    // Um CRITICAL pode ser boa notícia ("vetor de alta confirmado").
    // Pintá-lo de vermelho mentiria sobre o que aconteceu.
    for (const p of ["CRITICAL", "ALERT", "INFO"] as AlertPriority[]) {
      const keys = Object.keys(alertEmphasis(p));
      expect(keys).not.toContain("color");
      expect(keys).not.toContain("hex");
      expect(JSON.stringify(alertEmphasis(p))).not.toMatch(/#[0-9a-f]{3,6}/i);
    }
  });

  it("prioridade desconhecida cai no mais discreto, nunca no mais chamativo", () => {
    const desconhecida = alertEmphasis("QUALQUER" as AlertPriority);
    expect(desconhecida).toEqual(alertEmphasis("INFO"));
  });
});

describe("sortAlertsByUrgency — a posição é informação", () => {
  it("o mais urgente vai para o topo, independente da ordem de chegada", () => {
    const entrada = [ev("info", "INFO", 1), ev("crit", "CRITICAL", 2), ev("alert", "ALERT", 3)];
    expect(sortAlertsByUrgency(entrada).map((a) => a.id)).toEqual(["crit", "alert", "info"]);
  });

  it("entre iguais, o mais RECENTE primeiro — o segundo CRITICAL é a notícia nova", () => {
    const entrada = [ev("velho", "CRITICAL", 100), ev("novo", "CRITICAL", 200)];
    expect(sortAlertsByUrgency(entrada).map((a) => a.id)).toEqual(["novo", "velho"]);
  });

  it("não reordena o array de quem chamou — o auto-dismiss depende da ordem de chegada", () => {
    const entrada = [ev("info", "INFO", 1), ev("crit", "CRITICAL", 2)];
    const copia = [...entrada];
    sortAlertsByUrgency(entrada);
    expect(entrada).toEqual(copia);
  });

  it("lista vazia continua vazia", () => {
    expect(sortAlertsByUrgency([])).toEqual([]);
  });

  it("os pesos são estritamente ordenados", () => {
    expect(ALERT_PRIORITY_WEIGHT.CRITICAL).toBeGreaterThan(ALERT_PRIORITY_WEIGHT.ALERT);
    expect(ALERT_PRIORITY_WEIGHT.ALERT).toBeGreaterThan(ALERT_PRIORITY_WEIGHT.INFO);
  });
});

describe("fiação — a tela realmente consome a urgência", () => {
  const app = readFileSync(resolve(__dirname, "../src/App.tsx"), "utf-8");

  it("AlertToastStack ordena por urgência antes de renderizar", () => {
    expect(app).toContain("sortAlertsByUrgency(alerts).map");
  });

  it("o trilho e a opacidade vêm dos tokens, não de números soltos no JSX", () => {
    expect(app).toContain("alertEmphasis(a.priority)");
    expect(app).toContain("emphasis.railPx");
    expect(app).toContain("emphasis.opacity");
    // A largura fixa antiga não pode ter sobrado junto com a dinâmica.
    expect(app).not.toContain("border-l-2 ${tone.border}");
  });
});
