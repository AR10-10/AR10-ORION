// terminal-event-log-graduation-wiring.test.ts — Ordem 3 §17 (Terminal
// Event Log), graduação: fiação real entre nexus/terminal-event-log.ts e o
// painel EVENT TELEMETRY em App.tsx (EventsWidget). Teste de PADRÃO NO
// CÓDIGO-FONTE — EventsWidget não é exportável isoladamente, mesmo espírito
// de organism-health-wiring.test.ts/chart-integrity-wiring.test.ts.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');

describe('App.tsx: EVENT TELEMETRY assina o bus real do organismo inteiro, zero segunda formatação', () => {
  it('importa formatTerminalLogEntry de nexus/terminal-event-log, nunca uma 2ª implementação inline', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('import { formatTerminalLogEntry } from "./nexus/terminal-event-log";');
  });

  it('EventsWidget assina core.bus.onAny — os 27 tipos do organismo, não só os 2 de provedor GMIL', () => {
    const app = read('../src/App.tsx');
    const idx = app.indexOf('function EventsWidget()');
    expect(idx, 'EventsWidget não encontrado').toBeGreaterThan(-1);
    const body = app.slice(idx, idx + 4000);
    expect(body).toContain('const core = getNexusCore();');
    expect(body).toContain('const offNexus = core.bus.onAny((event) => {');
  });

  it('cada linha usa formatTerminalLogEntry() — zero recálculo de categoria/mensagem dentro do componente', () => {
    const app = read('../src/App.tsx');
    const idx = app.indexOf('const offNexus = core.bus.onAny((event) => {');
    expect(idx).toBeGreaterThan(-1);
    const call = app.slice(idx, idx + 400);
    expect(call).toContain('const formatted = formatTerminalLogEntry(event, Date.now());');
    expect(call).toContain('text: `[${formatted.category}] ${formatted.message}`');
  });

  it('tom das linhas do Nexus Core é sempre "info", nunca ok/warn/error fabricado (achado da graduação: severidade não é responsabilidade deste log)', () => {
    const app = read('../src/App.tsx');
    const idx = app.indexOf('const offNexus = core.bus.onAny((event) => {');
    const call = app.slice(idx, idx + 400);
    expect(call).toContain('tone: "info",');
  });

  it('a limpeza do efeito cancela as 3 assinaturas (GMIL leitura + GMIL saúde + Nexus Core), nenhuma vaza', () => {
    const app = read('../src/App.tsx');
    const idx = app.indexOf('function EventsWidget()');
    const body = app.slice(idx, idx + 4200);
    const cleanupIdx = body.indexOf('return () => {');
    expect(cleanupIdx, 'cleanup do useEffect não encontrado').toBeGreaterThan(-1);
    const cleanup = body.slice(cleanupIdx, cleanupIdx + 150);
    expect(cleanup).toContain('offReading();');
    expect(cleanup).toContain('offHealth();');
    expect(cleanup).toContain('offNexus();');
  });

  it('o piso de linhas visíveis é uma constante nomeada (EVENTS_WIDGET_MAX_ROWS), nunca um número mágico redigitado', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('const EVENTS_WIDGET_MAX_ROWS = 20;');
    expect(app).toContain('setLog((prev) => [entry, ...prev].slice(0, EVENTS_WIDGET_MAX_ROWS));');
  });

  it('GmilLogEntry ganhou o 4º tom "info" aditivamente — os 2 usos GMIL pré-existentes continuam ok/warn/error intactos', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('tone: "ok" | "warn" | "error" | "info";');
    // Os 2 publicadores GMIL pré-existentes nunca foram tocados por esta graduação.
    expect(app).toContain('tone: result.ok ? "ok" : "warn",');
    expect(app).toContain('tone: to === "OPEN" ? "error" : "ok",');
  });

  it('o dot de cor cobre os 4 tons, incluindo "info" (cor neutra, nunca reusa ok/warn/error por engano)', () => {
    const app = read('../src/App.tsx');
    const idx = app.indexOf('entry.tone === "ok"');
    expect(idx, 'expressão de cor do dot não encontrada').toBeGreaterThan(-1);
    const expr = app.slice(idx, idx + 350);
    expect(expr).toContain('"bg-[#00ffaa]"');
    expect(expr).toContain('"bg-[#f0d06f]"');
    expect(expr).toContain('"bg-[#ff0055]"');
    expect(expr).toContain('"bg-[#8ab4f8]"');
  });

  it('o painel continua o mesmo id/título "EVENT TELEMETRY" — graduação amplia o CONTEÚDO, nunca cria um painel/ícone novo', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('<Widget id="events" title="EVENT TELEMETRY" flex="flex-[0.8] min-h-[110px]">');
  });
});
