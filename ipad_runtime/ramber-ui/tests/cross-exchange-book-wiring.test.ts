// cross-exchange-book-wiring.test.ts — Ponta Solta 1 da Auditoria do
// Ecossistema, lado da FIAÇÃO.
//
// Convenção mista deliberada (CLAUDE.md): a matemática do motor tem teste de
// execução real em `cross-exchange-book.test.ts`; aqui o bug provável é
// "esqueceram de conectar A com B" — exatamente o defeito que originou esta
// entrega (a fatia `orderBooks` tinha 3 escritores reais e ZERO leitores).
// Então este arquivo é teste de padrão no código-fonte.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const src = (p: string) => readFileSync(resolve(__dirname, p), 'utf-8');
const app = src('../src/App.tsx');
const store = src('../src/store/unified-snapshot-store.ts');

describe('Ponta Solta 1: a fatia orderBooks deixou de ser write-only', () => {
  it('o seletor que existia sem nenhum importador agora é importado de verdade em App.tsx', () => {
    // O achado literal da auditoria: `useExchangeOrderBooks` era exportado
    // pela store e NUNCA aparecia num import em lugar nenhum.
    expect(store).toContain('export const useExchangeOrderBooks');
    expect(app).toMatch(/import\s*{[^}]*\buseExchangeOrderBooks\b[^}]*}\s*from\s*"\.\/store\/unified-snapshot-store"/s);
    expect(app).toContain('const exchangeBooks = useExchangeOrderBooks();');
  });

  it('os 3 escritores reais que alimentam a fatia continuam existindo — a captura não foi tocada', () => {
    // Regra de Ouro 4: nada de dado real removido. A entrega adiciona a
    // leitura que faltava; a captura cara (rede/parsing) segue intacta.
    expect(app).toContain('setExchangeOrderBook(');
    const svc = src('../src/nexus/cross-exchange-service.ts');
    expect(svc.match(/setExchangeOrderBook\(/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it('o motor puro é o único caminho de cálculo — App.tsx não reimplementa a comparação', () => {
    expect(app).toContain('from "./nexus/cross-exchange-book"');
    expect(app).toContain('computeCrossExchangeBook(exchangeBooks, Date.now())');
    // Se alguém voltar a calcular melhor bid/ask na UI, esta linha quebra:
    // a única fonte de "melhor preço entre praças" é o motor.
    expect(app).not.toMatch(/Math\.max\([^)]*bestBid/);
  });

  it('a leitura é MEMOIZADA na referência do livro — não recalcula a cada render', () => {
    // Regra de Ouro 6 (Main Thread sagrada): o livro muda a cada tick, o
    // React re-renderiza por muitos outros motivos.
    const idx = app.indexOf('const crossBook = useMemo(');
    expect(idx).toBeGreaterThan(-1);
    expect(app.slice(idx, idx + 200)).toContain('[exchangeBooks],');
  });

  it('a frase honesta do motor chega à tela — describeCrossExchangeBook tem consumidor real', () => {
    // Este teste existe porque a primeira versão desta entrega exportou
    // `describeCrossExchangeBook` sem nenhum leitor: seria a MESMA ponta
    // solta que ela veio fechar, só que uma camada acima.
    expect(app).toMatch(/import\s*{[^}]*\bdescribeCrossExchangeBook\b[^}]*}\s*from\s*"\.\/nexus\/cross-exchange-book"/s);
    expect(app).toContain('const crossBookLabel = describeCrossExchangeBook(crossBook);');
    expect(app).toContain('{crossBookLabel}');
  });

  it('praças desalinhadas (spread consolidado negativo) não recebem a cor de "tudo normal"', () => {
    const idx = app.indexOf('const crossBookColor =');
    expect(idx).toBeGreaterThan(-1);
    const block = app.slice(idx, idx + 320);
    expect(block).toContain('crossBook.status !== "OK"');
    expect(block).toContain('(crossBook.consolidatedSpread ?? 0) < 0');
    expect(block).toContain('#f0d06f'); // atenção, nunca o verde de leitura sadia
  });

  it('LEI 24: o card é rotulado como execução/contexto, nunca como decisão', () => {
    expect(app).toContain('LIVRO ENTRE PRAÇAS · EXECUÇÃO');
    // e a leitura não entra na contagem de confluência do sinal (checks[]),
    // que é sobre a direção — este dado é sobre ONDE executar.
    const checksStart = app.indexOf('const checks: { label: string; available: boolean | null }[]');
    const checksEnd = app.indexOf('];', checksStart);
    expect(app.slice(checksStart, checksEnd)).not.toContain('crossBook');
  });
});
