// sync-button-wiring.test.ts — Diretriz Final — Polimento Visual e
// Sincronização Global §4 ("transformar o botão de atualização em um
// sincronizador global... exibir discretamente o status da
// sincronização"): trava a fiação real do botão de energia do header.
// handleManualRestart (App.tsx) já era um "sincronizador global" real
// desde antes desta rodada — bumpar bootGeneration reconecta REST+WS+
// ciclo do motor+feeds (comentário real no próprio App.tsx). Esta
// diretiva só pedia o status visível, nunca faltava; nada aqui
// reimplementa lógica de sincronização, só verifica que o título do
// botão agora comunica isso honestamente.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');
const app = () => read('../src/App.tsx');

describe('TopBar: botão de energia vira "Sincronizar Agora" com status real, zero conceito novo inventado', () => {
  it('nunca mais o título antigo em inglês ("Force reconnection of all real feeds")', () => {
    expect(app()).not.toContain('title="Force reconnection of all real feeds"');
  });

  it('onClick continua handleManualRestart — o MESMO "sincronizador global" real de sempre (bumpa bootGeneration, reconecta REST+WS+ciclo do motor+feeds), zero segunda função nova', () => {
    const s = app();
    const idx = s.indexOf('onClick={handleManualRestart}');
    expect(idx, 'botão de sincronização não encontrado').toBeGreaterThan(-1);
    const block = s.slice(idx, idx + 300);
    expect(block).toContain('title={`Sincronizar Agora');
  });

  it('status real reaproveita price.updatedAt via usePriceSnapshot() + ageLabelOf() (já usado por preço/livro/ciclo/HTF/GMIL) — zero segundo formatador de idade inventado', () => {
    const s = app();
    const idx = s.indexOf('const syncPriceSnapshot = usePriceSnapshot();');
    expect(idx, 'syncPriceSnapshot não encontrado').toBeGreaterThan(-1);
    const btnIdx = s.indexOf('onClick={handleManualRestart}');
    const block = s.slice(btnIdx, btnIdx + 400);
    expect(block).toContain('ageLabelOf(syncPriceSnapshot.updatedAt)');
  });

  it('fail-closed honesto: sem nenhum tick real ainda (updatedAt null), o título diz "aguardando conexão" — nunca um "0s"/idade fabricada', () => {
    const s = app();
    const btnIdx = s.indexOf('onClick={handleManualRestart}');
    const block = s.slice(btnIdx, btnIdx + 400);
    expect(block).toContain('syncPriceSnapshot.updatedAt === null ? "aguardando conexão"');
  });
});
