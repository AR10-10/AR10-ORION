// quarantine-registry.test.ts — o registro de graduação tem de bater com o
// disco e com a fiação real.
//
// POR QUE ESTE TESTE EXISTE
// `CLAUDE.md` manda toda sessão ler `QUARANTINE.md` para saber quais motores
// existem e quais estão ligados. Esse arquivo tinha uma árvore-resumo no topo
// e seções detalhadas embaixo — e as duas discordavam:
//
//   árvore (topo) ....... supertrend-engine.js  LABORATÓRIO (não graduado)
//   seção (mesmo arquivo) ## supertrend-engine.js — GRADUADO (2026-08-23)
//
// E o `engine-bridge.ts` já o importava, com camada própria no gráfico. A
// árvore também listava 11 motores quando existiam 14. Quem lesse só o resumo
// — que é o que um resumo existe para permitir — concluiria que o SuperTrend
// não estava ligado, e poderia "graduar" de novo algo já graduado.
//
// É o mesmo defeito que já apareceu quatro vezes nesta trilha: uma declaração
// afirmando o que o código não faz. A diferença é que aqui a declaração é o
// mapa que orienta as próximas sessões, então o custo do erro é maior.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const RAIZ_ENGINES = resolve(__dirname, '../../src/research/engines');
const quarantine = readFileSync(resolve(__dirname, '../../src/research/QUARANTINE.md'), 'utf-8');
const bridge = readFileSync(resolve(__dirname, '../src/engine-bridge.ts'), 'utf-8');

/** A árvore-resumo: o bloco de código logo abaixo de "Estado atual do diretório". */
function arvore(): string {
  const i = quarantine.indexOf('## Estado atual do diretório');
  expect(i, 'seção "Estado atual do diretório" não encontrada').toBeGreaterThan(-1);
  const abre = quarantine.indexOf('```', i);
  const fecha = quarantine.indexOf('```', abre + 3);
  expect(fecha).toBeGreaterThan(abre);
  return quarantine.slice(abre, fecha);
}

const arquivosReais = readdirSync(RAIZ_ENGINES).filter((f) => f.endsWith('.js')).sort();

describe('QUARANTINE.md: o registro bate com o disco', () => {
  it('todo arquivo real de engines/ aparece na árvore-resumo', () => {
    const t = arvore();
    const ausentes = arquivosReais.filter((f) => !t.includes(f));
    expect(ausentes, `arquivos em engines/ fora da árvore: ${ausentes.join(', ')}`).toEqual([]);
  });

  it('a árvore não inventa arquivo que não existe mais', () => {
    const t = arvore();
    const citados = [...new Set(t.match(/[a-z0-9-]+\.js/g) ?? [])];
    const fantasmas = citados.filter((c) => !arquivosReais.includes(c));
    expect(fantasmas, `citados na árvore mas ausentes do disco: ${fantasmas.join(', ')}`).toEqual([]);
  });
});

describe('QUARANTINE.md: "graduado" significa fiação real, não intenção', () => {
  it('todo motor marcado ACTIVE_READ_ONLY na árvore é importado de verdade pela ponte', () => {
    const t = arvore();
    const graduados = t
      .split('\n')
      .filter((l) => l.includes('ACTIVE_READ_ONLY'))
      .map((l) => l.match(/([a-z0-9-]+\.js)/)?.[1])
      .filter((x): x is string => Boolean(x));

    expect(graduados.length, 'nenhum motor graduado na árvore — leitura suspeita').toBeGreaterThan(5);

    const semImport = graduados.filter((g) => !bridge.includes(`engines/${g}`));
    expect(
      semImport,
      `marcados GRADUADO mas sem import em engine-bridge.ts: ${semImport.join(', ')}`,
    ).toEqual([]);
  });

  it('a árvore não contradiz as seções detalhadas do próprio arquivo', () => {
    // O defeito real que originou este teste. Para cada seção "## `X` —
    // GRADUADO", a linha de X na árvore não pode dizer LABORATÓRIO.
    const secoesGraduadas = [...quarantine.matchAll(/^## `([a-z0-9-]+\.js)` — GRADUADO/gm)].map(
      (m) => m[1],
    );
    expect(secoesGraduadas.length).toBeGreaterThan(0);

    const t = arvore();
    for (const motor of secoesGraduadas) {
      const linha = t.split('\n').find((l) => l.includes(motor)) ?? '';
      expect(linha, `${motor} tem seção GRADUADO mas sumiu da árvore`).not.toBe('');
      expect(
        linha.includes('LABORATÓRIO'),
        `${motor}: a seção diz GRADUADO e a árvore diz LABORATÓRIO — foi exatamente este o defeito`,
      ).toBe(false);
    }
  });

  it('o que a árvore chama de LABORATÓRIO/QUARENTENA realmente NÃO está ligado', () => {
    // A direção oposta importa igual: um motor "isolado" que já foi ligado em
    // silêncio é uma graduação sem revisão — o oposto da disciplina do
    // Laboratório de Evolução.
    const t = arvore();
    const isolados = t
      .split('\n')
      .filter((l) => l.includes('LABORATÓRIO') || l.includes('EM QUARENTENA'))
      .map((l) => l.match(/([a-z0-9-]+\.js)/)?.[1])
      .filter((x): x is string => Boolean(x));

    const ligadosEmSilencio = isolados.filter((m) => bridge.includes(`engines/${m}`));
    expect(
      ligadosEmSilencio,
      `marcados isolados mas JÁ importados pela ponte: ${ligadosEmSilencio.join(', ')}`,
    ).toEqual([]);
  });
});
