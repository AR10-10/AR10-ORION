// ux-audit-fixes.test.ts — locks fixes from the "revisão completa de
// arquitetura" pass: 4 parallel read-only audits (Chart Engine, Layout/
// Navigation Rails, UX, Architecture) found concrete, evidence-backed
// issues; this suite locks the ones fixed at source level. Same spirit as
// the other boundary tests in this project: pattern in source, not render.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');

describe('UX audit finding: real-time depth bars never animate layout-affecting properties (60fps risk)', () => {
  it('OrderFlowWidget: buy/sell proportion bars transition color/opacity only — width (a real layout property, tied to live CVD data) is never part of the transition', () => {
    const app = read('../src/App.tsx');
    const fnMatch = app.match(/function OrderFlowWidget\(\) \{([\s\S]*?)\n\}\n/);
    expect(fnMatch, 'OrderFlowWidget não encontrada').not.toBeNull();
    const body = fnMatch![1];
    expect(body).not.toContain('transition-all duration-500');
    expect(body).toContain('border-r border-[#00ffaa] relative overflow-hidden transition-[background-color,opacity] duration-500');
    expect(body).toContain('border-l border-[#ff0055] relative overflow-hidden transition-[background-color,opacity] duration-500');
  });

  it('HeatmapWidget: ask/bid depth bars transition color/opacity only — top/height/width (real layout properties, tied to live order-book data) are never part of the transition', () => {
    const app = read('../src/App.tsx');
    const fnMatch = app.match(/function HeatmapWidget\(\{ book, data \}: any\) \{([\s\S]*?)\n\}\n/);
    expect(fnMatch, 'HeatmapWidget não encontrada').not.toBeNull();
    const body = fnMatch![1];
    expect(body).not.toContain('transition-all duration-500');
    const occurrences = body.match(/absolute right-0 mix-blend-screen transition-\[background-color,opacity\] duration-500/g) ?? [];
    expect(occurrences.length).toBe(2); // asks + bids, same fix applied to both
  });
});

describe('Layout/Navigation audit finding: Workspace Manager modal always renders above any floating widget', () => {
  it('WorkspaceManagerPanel z-index (1001) is explicitly higher than the only other hardcoded z-index in the file (floating Rnd widgets, 1000)', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('!fixed !inset-0 !z-[1001] bg-[#010308]/80 backdrop-blur-sm');
    expect(app).toContain('style={{ zIndex: 1000 }}');
    // Fail loudly if a future change raises the floating-widget z-index
    // without also raising the modal's — the modal must always win.
    expect(app).not.toMatch(/zIndex: (1001|1002|1003|\d{5,})/);
  });
});
