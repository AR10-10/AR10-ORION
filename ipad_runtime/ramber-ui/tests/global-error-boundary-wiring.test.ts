// global-error-boundary-wiring.test.ts — Achado real da AUDITORIA TÉCNICA
// COMPLETA (docs/AUDITORIA_TECNICA_COMPLETA_PREENCHIDA.md, item A9):
// WidgetErrorBoundary (App.tsx) só protegia DENTRO de um Widget; um erro fora
// dele (shell do App, AccessGate) derrubava a tela inteira sem fallback.
// Source-level wiring lock, mesma disciplina de ciborgue-vivo-wiring.test.ts:
// não existe @testing-library/react/jsdom neste repo para montar e lançar um
// erro de render de verdade, então o bug mais provável aqui não é "a
// matemática está errada" (não há matemática) — é "esqueceram de conectar A
// com B", que é exatamente o que teste de padrão no código-fonte prova.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');

describe('global-error-boundary.tsx: error boundary real (getDerivedStateFromError), zero side effect além do catch', () => {
  const src = read('../src/global-error-boundary.tsx');

  it('é uma classe React (hooks não têm equivalente a error boundary)', () => {
    expect(src).toContain('export class GlobalErrorBoundary extends Component');
    expect(src).toContain('static getDerivedStateFromError(error: Error): GlobalErrorBoundaryState');
  });

  it('renderiza os children normalmente quando não há erro (fail-open no caminho feliz)', () => {
    expect(src).toContain('if (!error) return this.props.children;');
  });

  it('a única ação de recuperação é window.location.reload() — nunca uma tentativa de mutar estado de mercado/plano', () => {
    expect(src).toContain('window.location.reload()');
    expect(src).not.toMatch(/fetch\(|WebSocket|localStorage\.setItem/);
  });

  it('a mensagem de fallback é honesta sobre READ_ONLY (nenhuma ordem foi enviada) — nunca promete "corrigir" o estado', () => {
    expect(src).toContain('READ_ONLY');
    expect(src).toContain('Nenhuma ordem foi enviada');
  });
});

describe('main.tsx: GlobalErrorBoundary envolve AccessGate+App inteiros, não só App', () => {
  const main = read('../src/main.tsx');

  it('importa GlobalErrorBoundary', () => {
    expect(main).toContain("import { GlobalErrorBoundary } from './global-error-boundary';");
  });

  it('GlobalErrorBoundary é o wrapper MAIS externo — cobre também um erro dentro do próprio AccessGate', () => {
    const renderMatch = main.match(/createRoot\([\s\S]*?\.render\(([\s\S]*?)\);/);
    expect(renderMatch, 'createRoot(...).render(...) não encontrado').not.toBeNull();
    const tree = renderMatch![1];
    const boundaryIdx = tree.indexOf('<GlobalErrorBoundary>');
    const gateIdx = tree.indexOf('<AccessGate>');
    const appIdx = tree.indexOf('<App />');
    expect(boundaryIdx).toBeGreaterThanOrEqual(0);
    expect(gateIdx).toBeGreaterThan(boundaryIdx);
    expect(appIdx).toBeGreaterThan(gateIdx);
  });
});

describe('App.tsx: WidgetErrorBoundary por-widget continua intacto (o global é aditivo, nunca substitui)', () => {
  it('a proteção por-widget existente não foi removida nem duplicada', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('class WidgetErrorBoundary extends React.Component');
    const occurrences = app.split('<WidgetErrorBoundary title={title}>{children}</WidgetErrorBoundary>').length - 1;
    expect(occurrences).toBe(2); // floating panel + normal panel, mesmo par de antes desta entrega
  });
});
