// fps-monitor.ts — Ordem A1 §9-§14 (fechamento das 2 lacunas do A1):
// instrumentação REAL de FPS/frame time, nunca uma otimização especulativa
// sem medir primeiro (§13: "se a medição mostrar 58-60 FPS estáveis, não
// fazer uma refatoração apenas para buscar um número artificial").
//
// Puro e testável: `computeFpsSample`/`classifyFps` são matemática de
// fronteira sobre uma lista de timestamps já capturados — zero
// requestAnimationFrame aqui, zero DOM. `FpsRecorder` é o wrapper fino que
// de fato chama rAF/performance.now() (não testável por execução real
// neste projeto: vitest roda em `environment: 'node'`, sem
// requestAnimationFrame — ver tests/fps-monitor.test.ts para a fiação
// verificada por padrão-no-código-fonte, mesma convenção mista já usada
// pelo resto da suíte).
//
// LEI 24 / Ordem A1 §15: isto é EXCLUSIVAMENTE performance de interface —
// nunca lê nem produz Decision/Direction/Entry/Risk/Trade Plan. Zero
// relação com o Core Engine, display-only não se aplica sequer: este
// módulo não desenha nada, só mede quadros.
//
// "Loop permanente pesado" (Ordem A1 §9, proibido): o ring buffer abaixo
// tem tamanho fixo (FPS_RING_BUFFER_SIZE) — nunca cresce sem limite — e
// `start()` só é chamado por quem opta (Laboratory/DEV, nunca automático
// em produção).

/** Classificação diagnóstica simples (Ordem A1 §12): NUNCA um score
 *  financeiro, nunca confiança de mercado, nunca sinal de trade — só
 *  performance da interface. `NOT_MEASURED` é o resultado honesto quando a
 *  amostra é pequena/inválida demais para sustentar um número (mesma
 *  disciplina de `forcaDaAmostra` em backtest-presentation.ts: ausência de
 *  medida não vira medida zero). */
export type FpsStatus = "HEALTHY" | "DEGRADED" | "CRITICAL" | "NOT_MEASURED";

export interface FpsSample {
  /** Nº de INTERVALOS reais entre frames na amostra (sempre frames-1). */
  frameCount: number;
  /** Duração real coberta pela amostra, em ms. */
  durationMs: number;
  /** `null` quando a amostra não sustenta a métrica — nunca um 0/60 fabricado. */
  fps: number | null;
  avgFrameTimeMs: number | null;
  /** p95 do frame time — `null` só quando fps também é null (mesma amostra insuficiente). */
  p95FrameTimeMs: number | null;
  status: FpsStatus;
}

/** Convenção declarada (não medida — mesma natureza de
 *  BACKTEST_MIN_RESOLVED_FOR_RATE em backtest-presentation.ts): o alvo real
 *  do app é 60 FPS (Regra de Ouro 7, iPad Safari). HEALTHY fica perto do
 *  alvo; abaixo de 30 já é abaixo do limiar clássico de "movimento fluido"
 *  citado por qualquer guia de performance de UI real-time. */
export const FPS_HEALTHY_MIN = 55;
export const FPS_DEGRADED_MIN = 30;

/** Amostra menor que isso é ruído, não medida — mesmo espírito do piso de
 *  30 trades resolvidos em backtest-presentation.ts, adaptado à escala
 *  certa para frames (poucos segundos de rAF já passam disso). */
export const MIN_FRAMES_FOR_VALID_SAMPLE = 10;

/** Tamanho fixo do ring buffer de timestamps — ~5s de rAF a 60fps. Nunca
 *  cresce além disso (Ordem A1 §9: "não criar loop permanente pesado" —
 *  aqui, "pesado" também significa memória sem teto). */
export const FPS_RING_BUFFER_SIZE = 300;

export function classifyFps(fps: number): FpsStatus {
  if (fps >= FPS_HEALTHY_MIN) return "HEALTHY";
  if (fps >= FPS_DEGRADED_MIN) return "DEGRADED";
  return "CRITICAL";
}

function percentile(sortedAsc: number[], p: number): number {
  const idx = Math.min(sortedAsc.length - 1, Math.max(0, Math.ceil(p * sortedAsc.length) - 1));
  return sortedAsc[idx];
}

/**
 * Deriva um FpsSample real a partir de uma lista de timestamps de frame
 * (ms, mesma unidade de performance.now()/o argumento do callback de
 * requestAnimationFrame). Pura: mesma lista, sempre o mesmo resultado.
 *
 * Fail-closed: amostra pequena demais, ou timestamps degenerados (duração
 * real <= 0 — todos iguais, ou fora de ordem), devolvem NOT_MEASURED com
 * `fps`/`avgFrameTimeMs`/`p95FrameTimeMs` todos `null` — nunca um número
 * fabricado (ex.: 0 FPS, que pareceria uma medida real de travamento total
 * quando na verdade é "amostra insuficiente").
 */
export function computeFpsSample(frameTimestampsMs: number[]): FpsSample {
  const valid = frameTimestampsMs.filter((t) => Number.isFinite(t));
  const notMeasured = (frameCount: number, durationMs: number): FpsSample => ({
    frameCount,
    durationMs,
    fps: null,
    avgFrameTimeMs: null,
    p95FrameTimeMs: null,
    status: "NOT_MEASURED",
  });
  if (valid.length < MIN_FRAMES_FOR_VALID_SAMPLE) return notMeasured(valid.length, 0);

  const sorted = [...valid].sort((a, b) => a - b);
  const durationMs = sorted[sorted.length - 1] - sorted[0];
  if (!(durationMs > 0)) return notMeasured(sorted.length - 1, 0);

  const deltas: number[] = [];
  for (let i = 1; i < sorted.length; i++) deltas.push(sorted[i] - sorted[i - 1]);
  const frameCount = deltas.length;
  const fps = (frameCount / durationMs) * 1000;
  const avgFrameTimeMs = deltas.reduce((a, b) => a + b, 0) / frameCount;
  const p95FrameTimeMs = percentile([...deltas].sort((a, b) => a - b), 0.95);

  return { frameCount, durationMs, fps, avgFrameTimeMs, p95FrameTimeMs, status: classifyFps(fps) };
}

/**
 * Wrapper fino sobre requestAnimationFrame/performance-style timestamps —
 * ring buffer real, start/stop explícitos (nunca automático). `getSample()`
 * delega inteiramente a `computeFpsSample`, zero segunda matemática.
 */
export class FpsRecorder {
  private timestamps: number[] = [];
  private rafId: number | null = null;
  private running = false;

  start(): void {
    if (this.running) return;
    this.running = true;
    const tick = (t: number) => {
      if (!this.running) return;
      this.timestamps.push(t);
      if (this.timestamps.length > FPS_RING_BUFFER_SIZE) this.timestamps.shift();
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  reset(): void {
    this.timestamps = [];
  }

  getSample(): FpsSample {
    return computeFpsSample(this.timestamps);
  }
}
