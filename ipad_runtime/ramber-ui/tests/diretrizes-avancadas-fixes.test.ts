// diretrizes-avancadas-fixes.test.ts — trava permanente dos achados reais
// da auditoria "DIRETRIZES AVANÇADAS DE AUDITORIA, CONSOLIDAÇÃO E EVOLUÇÃO"
// (3 agentes paralelos: ecossistema/duplicação, censo visual, sincronização/
// consistência de decisão). Mesmo espírito dos testes de padrão-de-fonte já
// existentes (diretriz3-fixes.test.ts): a lógica pura já tem sua própria
// suíte dedicada onde existe (candles-cache.ts); isto trava a FIAÇÃO dentro
// de App.tsx que um teste de execução real não alcançaria.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');

describe('Bug HIGH confirmado (auditoria de sincronização): store.price reseta de verdade ao trocar de ativo', () => {
  it('o efeito espelho de setPrice NUNCA mais tem o guard "if (priceData)" que suprimia o reset', () => {
    const app = read('../src/App.tsx');
    // A causa raiz era literal: o guard pulava a chamada inteira quando
    // priceData virava null (troca de ativo), deixando store.price com o
    // ÚLTIMO PREÇO REAL DO ATIVO ANTERIOR até o WS do novo ativo reconectar.
    expect(app).not.toContain('if (priceData) useUnifiedSnapshotStore.getState().setPrice(priceData);');
  });

  it('o efeito espelho de setPrice agora SEMPRE escreve, com EMPTY_PRICE como reset honesto quando priceData é null', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('useUnifiedSnapshotStore.getState().setPrice(priceData ?? EMPTY_PRICE);');
  });

  it('EMPTY_PRICE é importado de unified-snapshot-store.ts — mesmo valor real usado como estado inicial da store, nunca um literal duplicado em App.tsx', () => {
    const app = read('../src/App.tsx');
    const importLine = app.match(/^import \{ useUnifiedSnapshotStore.*\} from "\.\/store\/unified-snapshot-store";$/m);
    expect(importLine, 'linha de import da store não encontrada').not.toBeNull();
    expect(importLine![0]).toContain('EMPTY_PRICE');
  });

  it('EMPTY_PRICE é exportado (não mais um const privado) por unified-snapshot-store.ts', () => {
    const store = read('../src/store/unified-snapshot-store.ts');
    expect(store).toContain('export const EMPTY_PRICE: PriceSnapshot');
  });

  it('orderBook/derivatives continuam com o padrão CORRETO já existente (sempre escrevem, nunca um guard) — nada regrediu neles', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('useUnifiedSnapshotStore.getState().setOrderBook(orderBook);');
    expect(app).toContain('useUnifiedSnapshotStore.getState().setDerivatives(derivatives);');
  });
});

describe('LEI 24 (censo de sincronização/decisão): CouncilWidget nunca mais rotula o voto do Conselho como "DECISÃO" sem qualificação', () => {
  it('a linha de stance do Conselho usa "VOTO DO CONSELHO", nunca o bare "DECISÃO"', () => {
    const app = read('../src/App.tsx');
    const idx = app.indexOf('function CouncilWidget()');
    expect(idx, 'CouncilWidget não encontrado').toBeGreaterThan(-1);
    const block = app.slice(idx, idx + 4000);
    expect(block).toContain('VOTO DO CONSELHO{council?.riskGated');
    expect(block).not.toMatch(/>\s*DECISÃO\{council\?\.riskGated/);
  });

  it('a linha de stance do Conselho tem tooltip real explicando que é confluência, nunca a decisão real do sistema (LEI 24)', () => {
    const app = read('../src/App.tsx');
    const idx = app.indexOf('function CouncilWidget()');
    const block = app.slice(idx, idx + 4000);
    expect(block).toContain('nunca a decisão do sistema');
    expect(block).toContain('LEI 24');
  });
});

describe('Censo visual (achado real): Entrada usa o mesmo âmbar/dourado do gráfico em MarketBiasDecisionCard, nunca mais ciano', () => {
  it('LevelCard "Entrada" usa accent="#f0d06f" (mesmo tom real de rgba(240,208,111,…) do gráfico), não mais #00f0ff', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('<LevelCard label="Entrada" value={entry} accent="#f0d06f" tag="REF" />');
    expect(app).not.toContain('<LevelCard label="Entrada" value={entry} accent="#00f0ff" tag="REF" />');
  });

  it('Invalidação (stop) e Alvo 1 continuam com as cores que já batiam com o gráfico — nada regrediu neles', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('<LevelCard label="Invalidação" value={stop} accent="#ff0055" tag="REAL" />');
    expect(app).toContain('accent="#00ffaa"');
  });
});

describe('event-bus.ts: os 3 eventos DATA.* sem publicador vivo hoje ficam documentados, nunca um mistério silencioso', () => {
  it('o comentário acima de NexusEvent avisa explicitamente que DATA.* não tem publicador vivo nesta fase', () => {
    const eventBus = read('../src/nexus/event-bus.ts');
    const idx = eventBus.indexOf('export type NexusEvent');
    expect(idx, 'NexusEvent não encontrado').toBeGreaterThan(-1);
    const before = eventBus.slice(Math.max(0, idx - 700), idx);
    expect(before).toContain('NÃO têm publicador vivo hoje');
  });
});
