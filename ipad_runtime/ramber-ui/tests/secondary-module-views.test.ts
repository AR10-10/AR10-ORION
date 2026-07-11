// secondary-module-views.test.ts — Multi-Source Order, deliverable 3: locks
// the dedicated secondary-module views (MARKETS/ANALYSIS/RISK/SCANNER/NEWS/
// ALERTS/EXECUTION) at source level — same technique as the other App-wiring
// suites (node env, no DOM; real rendering is verified via Playwright).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const app = () => readFileSync(resolve(here, '../src/App.tsx'), 'utf8');

describe('Secondary module views: real data routing, English labels, fail-closed honesty', () => {
  it('the old shared generic placeholder is gone — every non-cockpit tab routes to SecondaryModuleView', () => {
    const s = app();
    expect(s).not.toContain('AGUARDANDO FONTE DE DADOS REAL');
    expect(s).toContain('<SecondaryModuleView tab={activeTab} />');
  });

  it('nav ids/labels migrated to English trading terminology', () => {
    const s = app();
    for (const id of ['"MARKETS"', '"ANALYSIS"', '"RISK"', '"EXECUTION"', '"SCANNER"', '"NEWS"', '"ALERTS"']) {
      expect(s).toContain(`id: ${id}`);
    }
    expect(s).not.toContain('id: "MERCADOS"');
  });

  it('views read REAL state only: store selectors + WidgetContext — zero fetch() of their own', () => {
    const s = app();
    const view = s.slice(s.indexOf('function SecondaryModuleView'), s.indexOf('function ChartWidget'));
    expect(view).toContain('useConnectionsSnapshot()');
    expect(view).toContain('useCouncilSnapshot()');
    expect(view).toContain('useTrustScoreSnapshot()');
    expect(view).not.toMatch(/fetch\(/);
    expect(view).not.toMatch(/Math\.random/);
  });

  it('MARKETS lists all four real exchanges of the ingestion layer (MEXC included)', () => {
    expect(app()).toContain('["BINANCE", "BYBIT", "OKX", "MEXC"]');
  });

  it('scenario weights keep the honesty label (opinion mass, never market probability) in English', () => {
    expect(app()).toContain('council opinion mass, never market probability');
  });

  it('NEWS is fail-closed honest (no fabricated headlines) and EXECUTION states the permanent read-only design', () => {
    const s = app();
    expect(s).toContain('NO REAL NEWS FEED CONNECTED');
    expect(s).toContain('ORDER EXECUTION IS PERMANENTLY DISABLED');
  });

  it('empty states are honest text, never a fabricated number', () => {
    expect(app()).toContain('const MODULE_EMPTY = "AWAITING REAL DATA"');
  });
});
