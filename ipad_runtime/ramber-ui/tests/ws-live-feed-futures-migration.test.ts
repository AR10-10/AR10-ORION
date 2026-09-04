// ws-live-feed-futures-migration.test.ts — trava permanente da migração
// Spot→Futures do feed AO VIVO de preço/book (achado registrado em
// ELITE_TRADING_RESEARCH_MAP.md §13: candles REST/diretriz3-fixes.test.ts
// já eram Futures-exclusivos, mas o WebSocket de ticker+depth em App.tsx
// ainda conectava em Binance SPOT — inconsistente com a arquitetura
// declarada do projeto e com o resto do sistema).
//
// Teste de PADRÃO NO CÓDIGO-FONTE (mesmo espírito de diretriz3-fixes.test.ts
// e do fix irmão em binance-liquidations-stream.test.ts): App.tsx é
// componente-monólito de UI, não uma função pura de fronteira, então "a
// matemática está sutilmente errada" não é o risco aqui — "esqueceram de
// conectar A com B" (ou reintroduziram a URL Spot) é. A máquina de
// reconnect+heartbeat em si (ConnectionManager) já tem sua própria suíte
// de execução real em connection-manager.test.ts — isto verifica só a
// FIAÇÃO: que App.tsx realmente usa Futures, realmente usa duas conexões
// (uma por categoria de URL), e nunca faz fallback silencioso pra Spot.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');

describe('App.tsx: feed de preço/book AO VIVO (ticker+depth) conecta em Binance Futures, nunca Spot', () => {
  it('nunca conecta em stream.binance.com (Spot) — só fstream.binance.com (Futures)', () => {
    const app = read('../src/App.tsx');
    expect(app).not.toContain('stream.binance.com:9443');
    expect(app).not.toMatch(/new WebSocket\(\s*`wss:\/\/stream\.binance\.com/);
  });

  it('ticker usa a categoria /market e depth usa a categoria /public (reestruturação de URL 2026-03-06 — cada categoria é sua própria conexão)', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain(
      'const tickerUrl = `wss://fstream.binance.com/market/stream?streams=${tickerStream}`;',
    );
    expect(app).toContain(
      'const depthUrl = `wss://fstream.binance.com/public/stream?streams=${depthStream}`;',
    );
  });

  it('as duas conexões (ticker e depth) são supervisionadas pela ConnectionManager real — nunca uma segunda fórmula de reconnect escrita à mão', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('import { ConnectionManager } from "./nexus/connection-manager";');
    expect(app).toContain('const tickerManager = new ConnectionManager({');
    expect(app).toContain('const depthManager = new ConnectionManager({');
    expect(app).toContain('connect: () => new WebSocket(tickerUrl)');
    expect(app).toContain('connect: () => new WebSocket(depthUrl)');
    expect(app).toContain('tickerManager.start();');
    expect(app).toContain('depthManager.start();');
    expect(app).toContain('tickerManager.stop();');
    expect(app).toContain('depthManager.stop();');
  });

  it('wsLive é fail-closed: só true quando AMBAS conexões estão LIVE, nunca um fallback silencioso pra Spot se uma cair', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain(
      'setWsLive(tickerState === "LIVE" && depthState === "LIVE");',
    );
  });

  it('o parser de mensagem de cada conexão só aceita o stream esperado (nunca aplica payload de depth como se fosse ticker ou vice-versa)', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('if (msg.stream !== tickerStream || !msg.data) return;');
    expect(app).toContain('if (msg.stream !== depthStream || !msg.data) return;');
  });
});
