// radar-scan-latency.test.ts — ORDEM DE SERVIÇO (Frente 1, §2.3,
// "conflitos de CPU/RAM entre agentes"): achado real de auditoria — o
// Radar scanner (App.tsx's runRadarScan + engine-bridge.ts's
// scanRadarCandidate) roda análise técnica síncrona real para até ~60
// ativos NÃO selecionados por ciclo, na main thread, sem NENHUMA
// instrumentação de custo até esta rodada. Execução real do novo campo
// da store (mesmo padrão de unified-snapshot-store.test.ts); o restante
// (medição real em App.tsx, throttle mais conservador, comentário
// corrigido) trava por padrão de código.
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { useUnifiedSnapshotStore } from "../src/store/unified-snapshot-store";

const app = readFileSync(resolve(__dirname, "../src/App.tsx"), "utf8");

describe("store: radarScanLatencyMs nos 4 lugares reais (mesmo padrão de radarCandidates)", () => {
  beforeEach(() => {
    useUnifiedSnapshotStore.setState({ radarScanLatencyMs: null });
  });

  it("default honesto: null antes do primeiro ciclo real (nunca 0 fabricado)", () => {
    expect(useUnifiedSnapshotStore.getState().radarScanLatencyMs).toBeNull();
  });

  it("setRadarScanLatency escreve o valor real", () => {
    useUnifiedSnapshotStore.getState().setRadarScanLatency(12345);
    expect(useUnifiedSnapshotStore.getState().radarScanLatencyMs).toBe(12345);
  });
});

describe("App.tsx: runRadarScan mede o tempo de parede REAL do ciclo inteiro", () => {
  it("marca o início com performance.now() antes de filtrar o universo de candidatos", () => {
    expect(app).toContain("const scanStartedAt = performance.now();");
  });

  it("escreve setRadarScanLatency só depois de setRadarCandidates, no MESMO bloco não-cancelado — nunca uma medição solta fora do fluxo real", () => {
    const idx = app.indexOf("useUnifiedSnapshotStore.getState().setRadarCandidates(rankRadarCandidates(qualified));");
    expect(idx).toBeGreaterThan(-1);
    const bloco = app.slice(idx, idx + 300);
    expect(bloco).toContain("useUnifiedSnapshotStore.getState().setRadarScanLatency(Math.round(performance.now() - scanStartedAt));");
  });
});

describe("App.tsx: throttle mais conservador (mitigação real, mesma matemática documentada)", () => {
  it("RADAR_SCAN_BATCH_SIZE caiu de 3 para 2 — menos trabalho síncrono concentrado por janela", () => {
    expect(app).toContain("const RADAR_SCAN_BATCH_SIZE = 2;");
  });

  it("RADAR_SCAN_BATCH_DELAY_MS subiu de 2000 para 3000 — mais respiro entre lotes", () => {
    expect(app).toContain("const RADAR_SCAN_BATCH_DELAY_MS = 3000;");
  });

  it("o comentário incorreto (\"zero cálculo síncrono pesado no Main Thread\") foi corrigido — nunca mais afirmado como verdade", () => {
    const idx = app.indexOf("const RADAR_SCAN_BATCH_SIZE = 2;");
    expect(idx).toBeGreaterThan(-1);
    const antes = app.slice(Math.max(0, idx - 2000), idx);
    expect(antes).toContain("estava ERRADA");
    expect(antes).not.toMatch(/Regra de Ouro 6: 100%\s*\n?\s*\/\/ fetch assíncrono, zero cálculo síncrono pesado no Main Thread\.\s*\n\/\/? *const RADAR_SCAN_BATCH_SIZE/);
  });

  it("a causa raiz real (scanRadarCandidate síncrono) e o adiamento honesto pra Frente de arquitetura de bots estão documentados", () => {
    const idx = app.indexOf("const RADAR_SCAN_BATCH_SIZE = 2;");
    const antes = app.slice(Math.max(0, idx - 2000), idx);
    expect(antes).toMatch(/scanRadarCandidate/);
    expect(antes).toMatch(/Frente de arquitetura de bots/);
  });
});

describe("TelemetryHealthWidget: a nova latência real chega à UI", () => {
  it("importa useRadarScanLatencySnapshot e usa no widget de telemetria", () => {
    expect(app).toContain("useRadarScanLatencySnapshot");
    expect(app).toContain('label="LATÊNCIA DO CICLO (RADAR, ~60 ATIVOS)"');
  });

  it("fail-closed: sem medição real ainda, mostra AWAIT — nunca um 0s fabricado", () => {
    const idx = app.indexOf('label="LATÊNCIA DO CICLO (RADAR, ~60 ATIVOS)"');
    expect(idx).toBeGreaterThan(-1);
    const bloco = app.slice(idx, idx + 200);
    expect(bloco).toContain("num(radarScanLatencyMs) ? `${(radarScanLatencyMs / 1000).toFixed(1)}s` : AWAIT");
  });
});
