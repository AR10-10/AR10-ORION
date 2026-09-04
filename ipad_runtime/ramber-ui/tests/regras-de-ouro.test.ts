// regras-de-ouro.test.ts — as regras que o CLAUDE.md declara "zero exceção"
// passam a ter quem as verifique.
//
// POR QUE ESTE ARQUIVO EXISTE
// Auditei as Regras de Ouro mecanicamente verificáveis e TODAS estavam sendo
// cumpridas — resultado limpo, sem um achado sequer. O problema não é o
// estado de hoje: é que nada garante o de amanhã. Uma regra declarada
// "inegociável" e verificada só por leitura humana é uma regra que quebra em
// silêncio, e este projeto já mostrou seis vezes nesta trilha como uma
// declaração e o código se separam sem ninguém notar.
//
// Só entram aqui as regras com verificação MECÂNICA honesta. "Main Thread
// sagrada" e "60 FPS em iPad" são reais e importam mais que várias daqui —
// mas não se checam com regex, e fingir que sim seria pior que não testar.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

const IPAD = resolve(__dirname, '../..');
const RAIZ_ENGINES = join(IPAD, 'src/research/engines');

/** Varre .ts/.tsx/.js reais de uma árvore, ignorando node_modules e dist. */
function fontes(dir: string): string[] {
  const out: string[] = [];
  const anda = (d: string) => {
    for (const nome of readdirSync(d)) {
      if (nome === 'node_modules' || nome === 'dist' || nome === 'wasm') continue;
      const p = join(d, nome);
      if (statSync(p).isDirectory()) anda(p);
      else if (/\.(ts|tsx|js)$/.test(nome)) out.push(p);
    }
  };
  anda(dir);
  return out;
}

/** Código sem comentários — é a diferença entre "o arquivo fala de
 *  Math.random" e "o arquivo CHAMA Math.random". Sem isto, todo comentário
 *  dizendo "nunca use X" viraria uma violação de X. */
function semComentarios(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, ''))
    .join('\n');
}

const FLUXO_REAL = [
  join(IPAD, 'ramber-ui/src'),
  join(IPAD, 'src'),
  join(IPAD, 'js'),
].filter(existsSync);

/** GUARDA ANTI-VACUIDADE — a parte mais importante deste arquivo.
 *
 *  Um teste de varredura que deixa de encontrar arquivos passa SEMPRE, e
 *  passa em silêncio. Seria a mesma classe de defeito que este arquivo
 *  existe para pegar: uma verificação que afirma estar verificando e não
 *  verifica nada. Medido hoje: 245 arquivos reais (178 + 48 + 19). O piso
 *  abaixo é folgado de propósito — ele não guarda o número, guarda o fato
 *  de a varredura estar viva. */
const MINIMO_ARQUIVOS_VARRIDOS = 150;

describe('A varredura está viva', () => {
  it('encontra o fluxo real — sem isto, todo teste abaixo passaria vazio', () => {
    const total = FLUXO_REAL.reduce((n, r) => n + fontes(r).length, 0);
    expect(FLUXO_REAL.length, 'nenhuma raiz do fluxo real encontrada').toBe(3);
    expect(total, `só ${total} arquivos varridos — caminho quebrado?`).toBeGreaterThan(
      MINIMO_ARQUIVOS_VARRIDOS,
    );
  });

  it('o detector distingue CHAMADA de MENÇÃO em comentário', () => {
    // Prova direta: sem isto, os ~5 comentários que dizem "nunca use
    // Math.random" seriam contados como violações e o teste viraria ruído.
    expect(semComentarios('const x = Math.random();')).toContain('Math.random(');
    expect(semComentarios('// nunca use Math.random() aqui')).not.toContain('Math.random(');
    expect(semComentarios('/* Math.random() é proibido */')).not.toContain('Math.random(');
  });
});

describe('Regra de Ouro 1 — zero Math.random() no fluxo de mercado real', () => {
  it('nenhum arquivo de código CHAMA Math.random (comentários citando não contam)', () => {
    const violando: string[] = [];
    for (const raiz of FLUXO_REAL) {
      for (const f of fontes(raiz)) {
        if (semComentarios(readFileSync(f, 'utf-8')).includes('Math.random(')) {
          violando.push(f.replace(IPAD + '/', ''));
        }
      }
    }
    expect(violando, `chamam Math.random(): ${violando.join(', ')}`).toEqual([]);
  });
});

describe('Regra de Ouro 5 — Fio de Seda: 1px sólida, nunca tracejada', () => {
  it('nenhuma chamada real a setLineDash com traços', () => {
    // `setLineDash([])` com array VAZIO é o oposto de uma violação: é o reset
    // que GARANTE linha sólida. O que a regra proíbe é o array com números.
    const violando: string[] = [];
    for (const raiz of FLUXO_REAL) {
      for (const f of fontes(raiz)) {
        const codigo = semComentarios(readFileSync(f, 'utf-8'));
        if (/setLineDash\(\s*\[\s*[0-9]/.test(codigo)) {
          violando.push(f.replace(IPAD + '/', ''));
        }
      }
    }
    expect(violando, `desenham linha tracejada: ${violando.join(', ')}`).toEqual([]);
  });
});

describe('Restrições permanentes do CLAUDE.md', () => {
  it('golden-master.html continua existindo — nunca é apagado', () => {
    const gm = join(IPAD, 'golden-master.html');
    expect(existsSync(gm), 'golden-master.html sumiu').toBe(true);
    expect(statSync(gm).size, 'golden-master.html existe mas ficou vazio').toBeGreaterThan(1000);
  });

  it('src/orderflow/ segue MODULAR — nunca vira um arquivo monolítico de novo', () => {
    const dir = join(IPAD, 'src/orderflow');
    const arquivos = readdirSync(dir).filter((f) => f.endsWith('.js'));
    // A regra é "só extensões aditivas, nunca um monólito". Um módulo que
    // colapsa para 1 arquivo, ou um arquivo que engorda desproporcionalmente,
    // é o sinal real de que a estrutura foi desfeita.
    expect(arquivos.length, 'orderflow colapsou para um arquivo só').toBeGreaterThan(1);
    for (const f of arquivos) {
      const linhas = readFileSync(join(dir, f), 'utf-8').split('\n').length;
      expect(linhas, `${f} virou monolito (${linhas} linhas)`).toBeLessThan(1200);
    }
  });
});

describe('Fontes únicas compartilhadas — o algoritmo mora em UM lugar', () => {
  it('os 3 consumidores de agrupamento por âncora usam price-clustering.js', () => {
    // CLAUDE.md registra que este algoritmo "estava escrito três vezes, e em
    // duas unidades diferentes". A consolidação só continua valendo enquanto
    // os três seguirem importando — daí o teste.
    const consumidores = [
      'src/research/engines/fvg-order-block-engine.js',
      'ramber-ui/src/nexus/institutional-zones.ts',
      'ramber-ui/src/nexus/trap-detection.ts',
    ];
    for (const c of consumidores) {
      const src = readFileSync(join(IPAD, c), 'utf-8');
      expect(src.includes('price-clustering'), `${c} deixou de usar a fonte única`).toBe(true);
    }
  });

  it('nenhum motor reimplementa deteccao de swing — importa de fractal-swings.js', () => {
    // O mesmo algoritmo ja esteve triplicado neste repositorio. O sinal de
    // recaida e' um motor com logica propria de maximo/minimo local.
    const suspeitos: string[] = [];
    for (const nome of readdirSync(RAIZ_ENGINES).filter((f) => f.endsWith('.js'))) {
      if (nome === 'fractal-swings.js') continue;
      const codigo = semComentarios(readFileSync(join(RAIZ_ENGINES, nome), 'utf-8'));
      if (/\b(isSwingHigh|isSwingLow|localMax|localMin)\b|function\s+findSwings?\b/.test(codigo)) {
        suspeitos.push(nome);
      }
    }
    expect(suspeitos, `reimplementam swing em vez de importar: ${suspeitos.join(', ')}`).toEqual([]);
  });
});
