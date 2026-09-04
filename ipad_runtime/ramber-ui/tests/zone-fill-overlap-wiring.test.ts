// zone-fill-overlap-wiring.test.ts — achado real (captura de tela do
// Operador, BTC/USDT 30m: "o jeito que tá o gráfico agora não tá legal"),
// confirmado via AskUserQuestion antes de construir a correção. Trava a
// fiação real de LiquidityZonesPlugin.tsx com o módulo puro
// zone-fill-overlap.ts — a matemática de decomposição em si já tem sua
// própria suíte de execução real em zone-fill-overlap.test.ts; aqui o bug
// mais provável é "esqueceram de conectar A com B" (o padrão-no-código-
// fonte de sempre para fiação).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const plugin = readFileSync(resolve(here, '../src/chart/LiquidityZonesPlugin.tsx'), 'utf8');

describe('LiquidityZonesPlugin.tsx importa e usa zone-fill-overlap.ts de verdade — zero segunda matemática', () => {
  it('importa capOverlappingFillAlpha/rgbaWithAlpha/parseRgbaAlpha do módulo puro, nunca reimplementa', () => {
    expect(plugin).toContain(
      'import { capOverlappingFillAlpha, rgbaWithAlpha, parseRgbaAlpha, type FillRectInput } from "../nexus/zone-fill-overlap";',
    );
  });

  it('drawSharedFillGroup colige FVG+OB+Breaker+Mitigation do MESMO type numa lista só antes de capar — as 4, nunca só 2 ou 3', () => {
    const idx = plugin.indexOf('const drawSharedFillGroup = (type: "BULLISH" | "BEARISH") => {');
    const endIdx = plugin.indexOf('drawSharedFillGroup("BULLISH");', idx);
    expect(idx, 'drawSharedFillGroup não encontrada').toBeGreaterThan(-1);
    const block = plugin.slice(idx, endIdx);
    expect(block).toContain('const fvgGroups = collectFusedGroups(fvgs, fvgWeights, type);');
    expect(block).toContain('const obGroups = collectFusedGroups(obs, obWeights, type);');
    expect(block).toContain('const brkGroups = collectFusedGroups(breakers ?? [], undefined, type);');
    expect(block).toContain('const mitGroups = collectFusedGroups(mitigations ?? [], undefined, type);');
    expect(block).toContain('collect(fvgGroups,');
    expect(block).toContain('collect(obGroups,');
    expect(block).toContain('collect(brkGroups,');
    expect(block).toContain('collect(mitGroups,');
    expect(block).toContain('capOverlappingFillAlpha(fillInputs)');
  });

  it('o alpha PRÓPRIO de cada kind vem de parseRgbaAlpha sobre a MESMA paleta já declarada (FVG_BULLISH/OB_BEARISH/etc.) — nunca um número redigitado à parte', () => {
    const idx = plugin.indexOf('const drawSharedFillGroup = (type: "BULLISH" | "BEARISH") => {');
    const endIdx = plugin.indexOf('drawSharedFillGroup("BULLISH");', idx);
    expect(idx, 'drawSharedFillGroup não encontrada').toBeGreaterThan(-1);
    expect(endIdx, 'fim de drawSharedFillGroup (chamada real) não encontrado').toBeGreaterThan(idx);
    const block = plugin.slice(idx, endIdx);
    expect(block).toContain('parseRgbaAlpha((type === "BULLISH" ? FVG_BULLISH : FVG_BEARISH).fill)');
    expect(block).toContain('parseRgbaAlpha((type === "BULLISH" ? OB_BULLISH : OB_BEARISH).fill)');
    expect(block).toContain('parseRgbaAlpha((type === "BULLISH" ? BREAKER_BULLISH : BREAKER_BEARISH).fill)');
    expect(block).toContain('parseRgbaAlpha((type === "BULLISH" ? MITIGATION_BULLISH : MITIGATION_BEARISH).fill)');
  });

  it('a cor de referência do preenchimento capado reusa a MESMA tripla RGB de OB_BULLISH/OB_BEARISH (todas as 4 kinds já compartilham a mesma tripla) — nunca uma cor nova redigitada', () => {
    expect(plugin).toContain('const referenceFill = (type === "BULLISH" ? OB_BULLISH : OB_BEARISH).fill;');
    expect(plugin).toContain('ctx.fillStyle = rgbaWithAlpha(referenceFill, capped.alpha);');
  });

  it('globalAlpha volta pra 1 antes do preenchimento capado — o alpha já vem embutido na cor via rgbaWithAlpha, nunca multiplicado 2x por um globalAlpha residual', () => {
    const idx = plugin.indexOf('const referenceFill = (type === "BULLISH" ? OB_BULLISH : OB_BEARISH).fill;');
    const block = plugin.slice(idx, idx + 300);
    const resetIdx = block.indexOf('ctx.globalAlpha = 1;');
    const drawIdx = block.indexOf('for (const capped of capOverlappingFillAlpha(fillInputs))');
    expect(resetIdx, 'reset de globalAlpha não encontrado antes do loop de preenchimento').toBeGreaterThan(-1);
    expect(drawIdx).toBeGreaterThan(resetIdx);
  });

  it('borda e etiqueta de cada kind continuam desenhando por conta própria (drawZoneBorderAndLabel), uma vez por grupo fundido de cada kind — identidade estrutural nunca se perde', () => {
    const idx = plugin.indexOf('const drawSharedFillGroup = (type: "BULLISH" | "BEARISH") => {');
    const endIdx = plugin.indexOf('drawSharedFillGroup("BULLISH");', idx);
    expect(idx, 'drawSharedFillGroup não encontrada').toBeGreaterThan(-1);
    expect(endIdx, 'fim de drawSharedFillGroup (chamada real) não encontrado').toBeGreaterThan(idx);
    const block = plugin.slice(idx, endIdx);
    expect(block).toContain('for (const group of fvgGroups) drawZoneBorderAndLabel(group, paletteFor("FVG", type, group.isObstacle), labelFor("FVG", type, group));');
    expect(block).toContain('for (const group of obGroups) drawZoneBorderAndLabel(group, paletteFor("OB", type, group.isObstacle), labelFor("OB", type, group));');
    expect(block).toContain('for (const group of brkGroups) drawZoneBorderAndLabel(group, paletteFor("BREAKER", type, group.isObstacle), labelFor("BREAKER", type, group));');
    expect(block).toContain('for (const group of mitGroups) drawZoneBorderAndLabel(group, paletteFor("MITIGATION", type, group.isObstacle), labelFor("MITIGATION", type, group));');
  });

  it('Liquidity Void fica FORA do grupo compartilhado, de propósito (cor própria já evita a parede por design) — continua no caminho antigo fill+borda+etiqueta juntos (drawZoneWithFill via drawGroup)', () => {
    expect(plugin).toContain('drawGroup(voids ?? [], voidWeights, "VOID", "BULLISH");');
    expect(plugin).toContain('drawGroup(voids ?? [], voidWeights, "VOID", "BEARISH");');
    expect(plugin).not.toContain('collectFusedGroups(voids');
  });

  it('drawSharedFillGroup("BULLISH")/drawSharedFillGroup("BEARISH") são chamadas reais no corpo do draw() — nunca só definidas e nunca invocadas', () => {
    expect(plugin).toContain('drawSharedFillGroup("BULLISH");');
    expect(plugin).toContain('drawSharedFillGroup("BEARISH");');
  });
});
