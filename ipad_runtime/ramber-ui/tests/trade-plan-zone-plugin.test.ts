// trade-plan-zone-plugin.test.ts — Ordem Final Autonomia Evolução §1
// ("caixas semi-transparentes... alertas visuais sutis quando o preço
// romper estrutura relevante"): locks TradePlanZonePlugin (the entry-zone
// box) and the chart-side stop/target hit-boost effect at source level —
// same technique as liquidity-zones-plugin.test.ts (node env, no real
// canvas; real visual verification via Playwright before commit).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');
const plugin = () => read('../src/chart/TradePlanZonePlugin.tsx');
const chart = () => read('../src/chart/EnhancedChart_110_Percent.tsx');

describe('TradePlanZonePlugin: "Fio de Seda" (Regra de Ouro 2) — border never dashed/dotted', () => {
  it('never calls setLineDash', () => {
    expect(plugin()).not.toMatch(/\.setLineDash\(/);
  });

  it('the border is always lineWidth = 1, never a larger value', () => {
    expect(plugin()).toContain('ctx.lineWidth = 1');
    expect(plugin()).not.toMatch(/ctx\.lineWidth = [2-9]/);
  });

  it('the fill is more translucent than the border — honest visual hierarchy, same law as LiquidityZonesPlugin', () => {
    const fillOpacity = Number(plugin().match(/ZONE_FILL = "rgba\([^)]+, ([0-9.]+)\)"/)?.[1]);
    const borderOpacity = Number(plugin().match(/ZONE_BORDER = "rgba\([^)]+, ([0-9.]+)\)"/)?.[1]);
    expect(Number.isFinite(fillOpacity)).toBe(true);
    expect(Number.isFinite(borderOpacity)).toBe(true);
    expect(fillOpacity).toBeLessThan(borderOpacity);
  });

  it('reuses the exact amber already used for the entry price lines — one color per role, never a second palette', () => {
    expect(plugin()).toContain('rgba(240, 208, 111,');
  });
});

describe('TradePlanZonePlugin: real geometry, fail-closed, never a fabricated pixel', () => {
  it('resolves price to pixel via series.priceToCoordinate — never a fixed/guessed coordinate', () => {
    expect(plugin()).toContain('series.priceToCoordinate(');
  });

  it('a missing plan or a zero-width zone (single acceptance price) is never drawn — the price line already covers it', () => {
    expect(plugin()).toMatch(/low === null \|\| high === null \|\| !Number\.isFinite\(low\) \|\| !Number\.isFinite\(high\) \|\| low === high/);
  });

  it('coordinates outside the current visible range are never extrapolated', () => {
    expect(plugin()).toMatch(/if \(y1 === null \|\| y2 === null\) return;/);
  });

  it('never uses Math.random or any synthetic data (Regra de Ouro 1)', () => {
    expect(plugin()).not.toMatch(/Math\.random/);
  });
});

describe('TradePlanZonePlugin: dirty-flag + requestAnimationFrame, never a perpetual loop', () => {
  it('schedules a redraw via requestAnimationFrame, guarded by a flag', () => {
    expect(plugin()).toContain('requestAnimationFrame(');
    expect(plugin()).toMatch(/if \(rafScheduled\) return;/);
  });

  it('reacts to visible-range changes (pan/zoom) via the real lib subscription', () => {
    expect(plugin()).toContain('subscribeVisibleLogicalRangeChange(');
  });

  it('tracks real canvas size via ResizeObserver, never a bespoke resize listener', () => {
    expect(plugin()).toContain('new ResizeObserver(');
  });

  it('unmounts clean: unsubscribes the range listener and disconnects the ResizeObserver', () => {
    expect(plugin()).toContain('unsubscribeVisibleLogicalRangeChange(');
    expect(plugin()).toContain('resizeObserver.disconnect()');
  });
});

describe('EnhancedChart_110_Percent: mounts TradePlanZonePlugin as the topmost overlay, real chart/series/plan only', () => {
  it('imports and mounts it with the real chart/series (never a fabricated default) and the real entry range', () => {
    const s = chart();
    expect(s).toContain('import { TradePlanZonePlugin } from "./TradePlanZonePlugin";');
    expect(s).toContain('<TradePlanZonePlugin');
    expect(s).toContain('chart={chartReady?.chart ?? null}');
    expect(s).toContain('series={chartReady?.series ?? null}');
    expect(s).toContain('entryLow={tradePlan?.entry.low ?? null}');
    expect(s).toContain('entryHigh={tradePlan?.entry.high ?? null}');
  });
});

describe('EnhancedChart_110_Percent: stop/target hit-boost (Ordem Final Autonomia Evolução §1 "alertas visuais sutis")', () => {
  it('updates the existing lines in place via applyOptions — never removes/recreates them on a live-price tick', () => {
    const s = chart();
    const block = s.slice(s.indexOf('const p = typeof livePrice'), s.indexOf('}, [tradePlan, livePrice]);'));
    expect(block).toContain('stopLineRef.current?.applyOptions(');
    expect(block).toContain('targetLineRef.current?.applyOptions(');
    expect(block).not.toContain('createPriceLine(');
    expect(block).not.toContain('removePriceLine(');
  });

  it('hierarchy stays color/opacity-only (Regra de Ouro 2) — lineWidth/lineStyle are never touched by the hit-boost effect', () => {
    const s = chart();
    const block = s.slice(s.indexOf('const p = typeof livePrice'), s.indexOf('}, [tradePlan, livePrice]);'));
    expect(block).not.toContain('lineWidth');
    expect(block).not.toContain('lineStyle');
  });

  it('is a separate effect from line creation — depends on [tradePlan, livePrice], not just [tradePlan]', () => {
    expect(chart()).toContain('}, [tradePlan, livePrice]);');
  });

  it('the base ENTRY/STOP/TARGET title literals stay intact for both the creation effect and the hit-boost effect', () => {
    const s = chart();
    expect(s).toContain('`ENTRY ${tradePlan.direction}');
    expect(s).toContain('`STOP · ${tradePlan.stop.basis}`');
    expect(s).toContain('`TARGET · ${tradePlan.target.basis}');
  });

  it('a non-finite or absent live price never resolves a hit (fail-closed)', () => {
    const s = chart();
    const block = s.slice(s.indexOf('const p = typeof livePrice'), s.indexOf('}, [tradePlan, livePrice]);'));
    expect(block).toMatch(/if \(p === null\) return;/);
  });
});
