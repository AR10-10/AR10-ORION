// glass-panel.test.ts — "camada de vidro transparente, algum efeito pra ficar
// bem show" SEM atrapalhar o campo de visão (pedido do Operador).
// Teste de padrão no CSS: o bug provável aqui é "alguém volta a opacar o fundo
// e o blur vira custo invisível de novo", nunca matemática.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const css = readFileSync(resolve(__dirname, '../src/index.css'), 'utf-8');
const panelBlock = css.slice(css.indexOf('.cyber-panel {'), css.indexOf('.cyber-panel:hover'));

describe('Camada de vidro: o blur precisa ter o que borrar', () => {
  it('DEFEITO CORRIGIDO: o fundo do painel NÃO é opaco — senão o blur é custo invisível', () => {
    // A versão anterior tinha background opaco (#000000 → #050508) com
    // backdrop-filter ligado: a GPU calculava desfoque a cada frame e o
    // resultado não aparecia. Num alvo iPad Safari (Regra de Ouro 7) esse é
    // o pior tipo de desperdício.
    expect(panelBlock).toContain('backdrop-filter');
    expect(panelBlock).toMatch(/background:\s*linear-gradient\([^)]*rgba\([^)]*0\.\d+\s*\)/);
    expect(panelBlock).not.toMatch(/background:\s*linear-gradient\(165deg,\s*#000000/);
  });

  it('tem aresta especular — é ela que faz ler como VIDRO, e é barata', () => {
    expect(css).toContain('.cyber-panel::before');
    const before = css.slice(css.indexOf('.cyber-panel::before'), css.indexOf('.cyber-panel::before') + 500);
    expect(before).toContain('height: 1px');
    expect(before).toContain('pointer-events: none'); // nunca rouba clique do Operador
  });

  it('O CANVAS DO GRÁFICO nunca recebe vidro — isso seria atrapalhar o campo de visão', () => {
    // A regra que o Operador deu explicitamente: efeito no chrome, nunca sobre
    // o dado. Se algum dia um seletor de canvas ganhar backdrop-filter, quebra.
    // Extrai só o SELETOR real (última linha antes do `{`), nunca o bloco de
    // comentário que o precede — a prosa dos comentários fala de "canvas" e
    // "chart" o tempo todo. Confundir comentário com código foi exatamente o
    // erro que este próprio teste cometeu na primeira versão.
    const blurSelectors = [...css.matchAll(/([^{}]+)\{[^}]*backdrop-filter\s*:\s*blur/g)]
      .map((m) => {
        const bruto = m[1];
        const semComentario = bruto.replace(/\/\*[\s\S]*?\*\//g, '');
        return semComentario.trim().split('\n').pop()!.trim();
      })
      .filter((sel) => sel.length > 0 && !sel.startsWith('@'));
    expect(blurSelectors.length).toBeGreaterThan(0); // a extração precisa achar algo
    for (const sel of blurSelectors) {
      expect(sel).not.toMatch(/canvas/i);
      expect(sel).not.toMatch(/chart/i);
    }
  });

  it('respeita quem pediu menos transparência no sistema — e continua legível', () => {
    expect(css).toContain('prefers-reduced-transparency');
    const reduced = css.slice(css.indexOf('@media (prefers-reduced-transparency'));
    expect(reduced).toContain('backdrop-filter: none');
    expect(reduced).toMatch(/background:\s*linear-gradient\(165deg,\s*#/); // sólido, nunca transparente sem blur
  });

  it('contraste preservado: o fundo translúcido continua escuro o bastante para texto claro', () => {
    // Se alguém deixar o painel claro demais, o texto do terminal some.
    const alphas = [...panelBlock.matchAll(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/g)]
      .filter((m) => Number(m[4]) > 0.5 && Number(m[1]) < 60); // só os do background
    expect(alphas.length).toBeGreaterThan(0);
    for (const m of alphas) {
      const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])];
      expect((r + g + b) / 3).toBeLessThan(20); // fundo permanece muito escuro
    }
  });
});
