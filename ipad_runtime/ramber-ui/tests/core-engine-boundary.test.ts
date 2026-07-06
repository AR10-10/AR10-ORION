// core-engine-boundary.test.ts — Fase G (V15, diretriz 4): trava ESTÁTICA
// e permanente das fronteiras do santuário. Estes testes leem o CÓDIGO-
// FONTE real e falham o CI se alguém um dia fizer o Core Engine importar a
// lógica consultiva (Ensemble/GMIL) — a LEI 04 e o isolamento da Fase F
// deixam de ser convenção verbal e viram invariante executável.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = (rel: string) => readFileSync(resolve(here, rel), 'utf8');

// Só linhas de import REAIS (estáticos ou dinâmicos) — comentários citando
// os módulos proibidos não são violação.
function importLines(code: string): string[] {
  return code
    .split('\n')
    .filter((line) => /^\s*import[\s{("']/.test(line) || /import\s*\(/.test(line))
    .filter((line) => !/^\s*\/\//.test(line) && !/^\s*\*/.test(line));
}

describe('fronteira: engine-bridge.ts (lado do Core Engine) nunca importa a camada consultiva', () => {
  const bridge = src('../src/engine-bridge.ts');
  const imports = importLines(bridge);

  it('zero imports de gmil/ (LEI 04)', () => {
    expect(imports.filter((l) => /gmil/i.test(l))).toEqual([]);
  });

  it('zero imports de src/consensus/ (isolamento da Fase F — o comitê é composto na camada de exibição)', () => {
    expect(imports.filter((l) => /consensus/i.test(l))).toEqual([]);
  });

  it('a saída direcional primária é o tipo fechado CoreSignal (envelope de tipos da Fase G)', () => {
    expect(bridge).toContain("export type CoreSignal = 'LONG' | 'SHORT' | 'WAIT'");
  });
});

describe('fronteira: os módulos puros do núcleo (js/research, js/real-data, engines graduados) não importam UI/consultivo', () => {
  const coreDirs = ['../../js/research', '../../js/real-data', '../../src/research/engines', '../../src/market-data-bus'];

  it('nenhum arquivo do núcleo importa gmil/, consensus/ ou qualquer .tsx', () => {
    const offenders: string[] = [];
    for (const dir of coreDirs) {
      const abs = resolve(here, dir);
      for (const file of readdirSync(abs).filter((f) => f.endsWith('.js'))) {
        const lines = importLines(readFileSync(join(abs, file), 'utf8'));
        for (const line of lines) {
          if (/gmil|consensus|\.tsx/i.test(line)) offenders.push(`${dir}/${file}: ${line.trim()}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('trade-setup-matrix.js importa APENAS schema.js — sem espaço para uma 4ª heurística escondida', () => {
    const imports = importLines(src('../../js/research/trade-setup-matrix.js'));
    expect(imports).toHaveLength(1);
    expect(imports[0]).toContain('../real-data/schema.js');
  });
});

describe('fronteira: o Ensemble (Fase F) depende só da matriz de regime — nunca do Core Engine', () => {
  it('ensemble-engine.js importa exclusivamente de market-regime/', () => {
    const imports = importLines(src('../../src/consensus/ensemble-engine.js'));
    expect(imports).toHaveLength(1);
    expect(imports[0]).toContain('../market-regime/weight-matrix.js');
  });
});
