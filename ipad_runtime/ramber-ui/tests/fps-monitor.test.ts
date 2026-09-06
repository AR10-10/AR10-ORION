// fps-monitor.test.ts — Ordem A1 §9-§16 (fechamento das lacunas do A1):
// instrumentação de FPS. Mesma convenção mista de sempre: `computeFpsSample`/
// `classifyFps` são matemática pura de fronteira (percentil/média/limiares) —
// o bug mais provável aqui é "a aritmética está sutilmente errada" — ganham
// teste de EXECUÇÃO REAL. `FpsRecorder` (requestAnimationFrame/
// cancelAnimationFrame) e a montagem DEV-only em App.tsx são FIAÇÃO — o bug
// mais provável é "esqueceram de conectar A com B" — ganham teste de PADRÃO
// no código-fonte (vitest roda em `environment: 'node'`, sem rAF real).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  computeFpsSample,
  classifyFps,
  FPS_HEALTHY_MIN,
  FPS_DEGRADED_MIN,
  MIN_FRAMES_FOR_VALID_SAMPLE,
  FPS_RING_BUFFER_SIZE,
} from '../src/nexus/fps-monitor';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');

// Gera N timestamps reais espaçados por `intervalMs`, começando em `start`.
function synthFrames(count: number, intervalMs: number, start = 0): number[] {
  return Array.from({ length: count }, (_, i) => start + i * intervalMs);
}

describe('classifyFps: limiares declarados (Ordem A1 §12 — HEALTHY/DEGRADED/CRITICAL, nunca score financeiro)', () => {
  it('>= 55: HEALTHY (fronteira exata inclusiva)', () => {
    expect(classifyFps(60)).toBe('HEALTHY');
    expect(classifyFps(FPS_HEALTHY_MIN)).toBe('HEALTHY');
  });

  it('[30, 55): DEGRADED', () => {
    expect(classifyFps(54.9)).toBe('DEGRADED');
    expect(classifyFps(FPS_DEGRADED_MIN)).toBe('DEGRADED');
  });

  it('< 30: CRITICAL', () => {
    expect(classifyFps(29.9)).toBe('CRITICAL');
    expect(classifyFps(1)).toBe('CRITICAL');
    expect(classifyFps(0)).toBe('CRITICAL');
  });
});

describe('computeFpsSample: fail-closed em amostra pequena/degenerada — nunca fabrica um número', () => {
  it('menos que MIN_FRAMES_FOR_VALID_SAMPLE timestamps: NOT_MEASURED, fps/avg/p95 todos null', () => {
    const s = computeFpsSample(synthFrames(MIN_FRAMES_FOR_VALID_SAMPLE - 1, 16.667));
    expect(s.status).toBe('NOT_MEASURED');
    expect(s.fps).toBeNull();
    expect(s.avgFrameTimeMs).toBeNull();
    expect(s.p95FrameTimeMs).toBeNull();
  });

  it('lista vazia: NOT_MEASURED, zero frameCount', () => {
    const s = computeFpsSample([]);
    expect(s.status).toBe('NOT_MEASURED');
    expect(s.frameCount).toBe(0);
  });

  it('todos os timestamps iguais (duração real 0): NOT_MEASURED, nunca uma divisão por zero virando Infinity', () => {
    const s = computeFpsSample(Array.from({ length: 20 }, () => 1000));
    expect(s.status).toBe('NOT_MEASURED');
    expect(s.fps).toBeNull();
    expect(Number.isFinite(s.fps as any)).toBe(false); // null, nunca Infinity/NaN escapando como número
  });

  it('timestamps não-finitos (NaN/Infinity) são filtrados antes de contar a amostra', () => {
    const frames = [...synthFrames(20, 16.667), NaN, Infinity, -Infinity];
    const s = computeFpsSample(frames);
    expect(s.status).not.toBe('NOT_MEASURED'); // os 20 válidos ainda sustentam a medida
    expect(s.fps).not.toBeNull();
  });
});

describe('computeFpsSample: matemática real sobre uma amostra sintética conhecida', () => {
  it('60fps real (16.667ms/frame): fps ~60, HEALTHY', () => {
    const s = computeFpsSample(synthFrames(120, 1000 / 60));
    expect(s.status).toBe('HEALTHY');
    expect(s.fps!).toBeGreaterThan(59);
    expect(s.fps!).toBeLessThan(61);
    expect(s.avgFrameTimeMs!).toBeCloseTo(1000 / 60, 1);
  });

  it('40fps real (25ms/frame, sem dízima — evita ruído de ponto flutuante bem na fronteira de 30): fps ~40, DEGRADED', () => {
    const s = computeFpsSample(synthFrames(90, 25));
    expect(s.status).toBe('DEGRADED');
    expect(s.fps!).toBeGreaterThan(39);
    expect(s.fps!).toBeLessThan(41);
  });

  it('15fps real (66.667ms/frame): fps ~15, CRITICAL', () => {
    const s = computeFpsSample(synthFrames(45, 1000 / 15));
    expect(s.status).toBe('CRITICAL');
    expect(s.fps!).toBeGreaterThan(14);
    expect(s.fps!).toBeLessThan(16);
  });

  it('p95FrameTimeMs reflete os picos reais da cauda, não a média (60fps estável + 5 picos de 100ms)', () => {
    const stable = synthFrames(94, 1000 / 60);
    // 5 picos reais de stutter intercalados — soma real do tempo decorrido,
    // nunca um valor sintético desconectado dos próprios timestamps.
    let t = stable[stable.length - 1];
    const spikes: number[] = [];
    for (let i = 0; i < 5; i++) {
      t += 100;
      spikes.push(t);
    }
    const frames = [...stable, ...spikes];
    const s = computeFpsSample(frames);
    expect(s.status).not.toBe('NOT_MEASURED');
    // p95 deve capturar a cauda dos picos de 100ms — bem acima da média
    // (~16.7ms), nunca igual à média (que um cálculo ingênuo devolveria).
    expect(s.p95FrameTimeMs!).toBeGreaterThan(50);
    expect(s.p95FrameTimeMs!).toBeGreaterThan(s.avgFrameTimeMs!);
  });

  it('determinístico: a mesma lista de timestamps sempre devolve o mesmo FpsSample', () => {
    const frames = synthFrames(60, 16.667);
    expect(computeFpsSample(frames)).toEqual(computeFpsSample(frames));
  });

  it('ordem dos timestamps não importa (a função ordena antes de medir) — mesmo resultado embaralhado', () => {
    const ordered = synthFrames(60, 16.667);
    const shuffled = [...ordered].reverse();
    expect(computeFpsSample(shuffled)).toEqual(computeFpsSample(ordered));
  });
});

describe('FpsRecorder: ring buffer real via requestAnimationFrame/performance timestamps, teto fixo (Ordem A1 §9: zero loop pesado sem limite)', () => {
  const src = () => read('../src/nexus/fps-monitor.ts');

  it('start(): agenda via requestAnimationFrame, nunca setInterval/setTimeout como substituto de rAF', () => {
    const s = src();
    const block = s.slice(s.indexOf('start(): void {'), s.indexOf('stop(): void {'));
    expect(block).toContain('requestAnimationFrame(tick)');
    expect(block).not.toContain('setInterval(');
  });

  it('stop(): cancela via cancelAnimationFrame e derruba a flag `running` — o loop para de verdade, não só de reagendar', () => {
    const s = src();
    const block = s.slice(s.indexOf('stop(): void {'), s.indexOf('reset(): void {'));
    expect(block).toContain('this.running = false;');
    expect(block).toContain('cancelAnimationFrame(this.rafId);');
  });

  it('ring buffer com teto real (FPS_RING_BUFFER_SIZE) — nunca cresce sem limite', () => {
    const s = src();
    expect(s).toContain('if (this.timestamps.length > FPS_RING_BUFFER_SIZE) this.timestamps.shift();');
    expect(FPS_RING_BUFFER_SIZE).toBeGreaterThan(MIN_FRAMES_FOR_VALID_SAMPLE); // o teto tem que caber uma amostra válida
  });

  it('getSample() delega inteiramente a computeFpsSample — zero segunda matemática dentro da classe', () => {
    const s = src();
    const block = s.slice(s.indexOf('getSample(): FpsSample {'), s.indexOf('getSample(): FpsSample {') + 120);
    expect(block).toContain('return computeFpsSample(this.timestamps);');
  });
});

describe('App.tsx: PerformanceMonitorPanel é Laboratory-only por construção (Ordem A1 §10 — "não deve aparecer no Terminal normal, não deve poluir produção")', () => {
  const app = () => read('../src/App.tsx');

  it('montado atrás de um toggle explícito (performanceMonitorOpen), nunca ligado por padrão — achado real: import.meta.env.DEV mede false num `vite` dev server quando NODE_ENV=production já está no ambiente (medido ao vivo), o que esconderia o painel do Operador até em produção; um toggle funciona em qualquer build', () => {
    const a = app();
    expect(a).toContain('const [performanceMonitorOpen, setPerformanceMonitorOpen] = useState(false);');
    expect(a).toContain('{performanceMonitorOpen && <PerformanceMonitorPanel />}');
    // o gate condicional real precisa ser o toggle, não import.meta.env.DEV
    // — a menção em prosa (explicando por que DEV foi rejeitado) é esperada
    // e fica só no comentário logo acima do ponto de montagem.
    expect(a).not.toContain('{import.meta.env.DEV && <PerformanceMonitorPanel />}');
  });

  it('botão dedicado na régua "mais gavetas" (mesmo padrão dos outros 4 painéis da mesma família — Workspace Manager/Camadas do Gráfico/Análise de Mercado/Paper Trading)', () => {
    const a = app();
    const idx = a.indexOf('onClick={() => setPerformanceMonitorOpen?.((v: boolean) => !v)}');
    expect(idx).toBeGreaterThan(-1);
    const block = a.slice(Math.max(0, idx - 200), idx + 500);
    expect(block).toContain('<Gauge size={17} className="relative z-10" />');
  });

  it('o painel usa FpsRecorder real (start/stop no ciclo de vida do efeito) — nunca lê nem produz Decision/Direction/Entry/Risk/Trade Plan (Ordem A1 §15)', () => {
    const a = app();
    const idx = a.indexOf('function PerformanceMonitorPanel()');
    expect(idx).toBeGreaterThan(-1);
    const block = a.slice(idx, a.indexOf('\n}', idx + 400) + 5);
    expect(block).toContain('const recorder = new FpsRecorder();');
    expect(block).toContain('recorder.start();');
    expect(block).toContain('recorder.stop();');
    for (const forbidden of ['engine.direction', 'tradePlan', 'decision.', 'riskGated']) {
      expect(block).not.toContain(forbidden);
    }
  });

  it('NOT_MEASURED renderiza o rótulo honesto exigido (Ordem A1 §14) — nunca "60 FPS" sem medir', () => {
    const a = app();
    expect(a).toContain('sample.status === "NOT_MEASURED" ? "NOT MEASURED — ENVIRONMENT LIMITATION" : sample.status');
  });
});
