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

describe('Command bar: Trade Plan strip (critical numbers in the header, fail-closed)', () => {
  it('renders signal + entry + stop + target from the real store slice', () => {
    const s = app();
    expect(s).toContain('function TradePlanTopStrip(');
    const strip = s.slice(s.indexOf('function TradePlanTopStrip('), s.indexOf('// --- TOP BAR ---'));
    expect(strip).toContain('useTradePlanSnapshot()');
    expect(strip).not.toMatch(/fetch\(/);
    expect(strip).not.toMatch(/Math\.random/);
  });

  // Achado real de sessão (relato do Operador: "Entry/Target não aparece"):
  // o plano é travado pela leitura do CONSELHO (trade-plan.ts), não pela
  // direção própria do Core Engine — as duas podem divergir de forma real
  // e honesta. Antes, `!plan` renderizava `null` silencioso: o Operador não
  // tinha como distinguir bug de estado esperado. Agora renderiza um motivo
  // real (Conselho travado/neutro/sem estrutura), nunca fabricado, e NUNCA
  // muda qual sinal trava o plano (LEI 24 seria violada por essa troca).
  it('sem plano real: nunca um return null silencioso — sempre um motivo honesto derivado do Conselho/Núcleo reais', () => {
    const s = app();
    const strip = s.slice(s.indexOf('function TradePlanTopStrip('), s.indexOf('// --- TOP BAR ---'));
    expect(strip).toContain('const council = useCouncilSnapshot();');
    expect(strip).not.toContain('if (!plan) return null;');
    expect(strip).toMatch(/if \(!plan\) \{/);
    // EPC §5/§6: a derivação do motivo agora vive em tradePlanAbsenceReason
    // (função pura, module-scope), reaproveitada também pelo overlay do
    // CANVAS do gráfico (Regra de Ouro 4 — nunca duplicar) — a barra só
    // chama a função e exibe o resultado.
    expect(strip).toContain('const coreDir = engine?.direction ?? null;');
    expect(strip).toContain('const { reason, tooltip } = tradePlanAbsenceReason(council, coreDir);');
    expect(strip).not.toMatch(/fetch\(/);
    expect(strip).not.toMatch(/Math\.random/);

    // as 4 causas reais e mutuamente exclusivas do null, nunca uma 5ª
    // inventada — fonte única de verdade dentro da própria função.
    const fnSrc = s.slice(s.indexOf('function tradePlanAbsenceReason('), s.indexOf('function TradePlanTopStrip('));
    expect(fnSrc).toContain('if (!council) {');
    expect(fnSrc).toContain('if (council.riskGated) {');
    expect(fnSrc).toContain('if (council.stance === "NEUTRAL" || council.stance === "ABSTAIN") {');
    // a divergência Núcleo vs. Conselho (achado real) fica explícita quando existe
    expect(fnSrc).toContain('reason: `Núcleo ${coreDir}, Conselho neutro`,');
    expect(fnSrc).not.toMatch(/fetch\(/);
    expect(fnSrc).not.toMatch(/Math\.random/);
  });

  it('LEI 24: o fallback honesto nunca escreve em engine/council/plan — só lê e exibe (mesma disciplina display-only)', () => {
    const s = app();
    const strip = s.slice(s.indexOf('function TradePlanTopStrip('), s.indexOf('// --- TOP BAR ---'));
    const fallbackIdx = strip.indexOf('if (!plan) {');
    const fallbackBlock = strip.slice(fallbackIdx, strip.indexOf('\n  }', fallbackIdx));
    expect(fallbackBlock).not.toMatch(/setTradePlan|setCouncil|setEngine/);
  });

  it('structure-break alert is pure display derivation from the live price vs real plan levels', () => {
    const s = app();
    expect(s).toContain('TARGET REACHED');
    expect(s).toContain('STOP BREACHED');
    expect(s).toContain('<TradePlanTopStrip livePrice={data?.price ?? null} />');
  });
});
