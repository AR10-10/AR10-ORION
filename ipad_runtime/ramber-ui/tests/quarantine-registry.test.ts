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

// ═══ A TERCEIRA FONTE: o metadata que cada motor declara sobre si ═══
//
// Alem da arvore-resumo e das secoes detalhadas do QUARANTINE.md, cada motor
// carrega `export const metadata = { ..., status }`. Nada consome esse campo
// (verificado por grep) — e' documentacao. Foi justamente por isso que ele
// envelheceu sem ninguem notar, nos DOIS sentidos ao mesmo tempo:
//
//   supertrend-engine.js      dizia LABORATORIO       — ligado ha 8 dias
//   delta-divergence-engine.js dizia ACTIVE_READ_ONLY — sem nenhum importador
//
// Documentacao que ninguem le programaticamente e' documentacao que mente
// devagar. Estes testes fazem alguem ler.
describe('metadata.status de cada motor bate com a fiacao real', () => {
  const engines = readdirSync(RAIZ_ENGINES).filter((f) => f.endsWith('.js'));

  const statusDe = (arquivo: string): string | null => {
    const src = readFileSync(resolve(RAIZ_ENGINES, arquivo), 'utf-8');
    const i = src.indexOf('export const metadata');
    if (i === -1) return null;
    // so' dentro do bloco de metadata — nunca um `status: 'OK'` de retorno
    const bloco = src.slice(i, src.indexOf('\n};', i));
    return bloco.match(/status:\s*'([A-Z_]+)'/)?.[1] ?? null;
  };

  it("ACTIVE_READ_ONLY exige import real na ponte", () => {
    const mentindo = engines.filter(
      (e) => statusDe(e) === 'ACTIVE_READ_ONLY' && !bridge.includes(`engines/${e}`),
    );
    expect(mentindo, `dizem ACTIVE_READ_ONLY sem importador: ${mentindo.join(', ')}`).toEqual([]);
  });

  it('LABORATORIO exige AUSENCIA de import — graduar em silencio e o defeito oposto', () => {
    const ligados = engines.filter(
      (e) => statusDe(e) === 'LABORATORIO' && bridge.includes(`engines/${e}`),
    );
    expect(ligados, `dizem LABORATORIO mas ja estao ligados: ${ligados.join(', ')}`).toEqual([]);
  });

  it('o metadata nao contradiz a arvore do QUARANTINE.md', () => {
    for (const e of engines) {
      const st = statusDe(e);
      if (!st) continue;
      const linha = quarantine.split('\n').find((l) => l.includes(e) && (l.includes('ACTIVE_READ_ONLY') || l.includes('LABORATÓRIO') || l.includes('EM QUARENTENA')));
      if (!linha) continue;
      if (st === 'ACTIVE_READ_ONLY') {
        expect(linha.includes('ACTIVE_READ_ONLY'), `${e}: metadata diz ativo, árvore não`).toBe(true);
      }
    }
  });
});

describe('QUARANTINE.md nao cita constante que ja mudou de valor', () => {
  it('a retencao de order flow citada e a real', () => {
    // O defeito que motivou este teste: a secao do delta-divergence dizia que
    // o CVD retido cobria "~8 minutos (capacidade 120)" e que ISSO era o
    // bloqueio para gradua-lo. A capacidade tinha subido para 900 (~1h) uma
    // semana antes — ou seja, o motivo do bloqueio ja nao existia, e o
    // registro seguia mandando a proxima sessao nem olhar.
    const oh = readFileSync(resolve(__dirname, '../src/nexus/orderflow-history.ts'), 'utf-8');
    const real = oh.match(/ORDERFLOW_HISTORY_CAPACITY = (\d+)/)?.[1];
    expect(real, 'ORDERFLOW_HISTORY_CAPACITY não encontrada').toBeTruthy();
    expect(
      quarantine.includes(`${real}`),
      `QUARANTINE.md não cita o valor real (${real}) de ORDERFLOW_HISTORY_CAPACITY`,
    ).toBe(true);
  });
});
