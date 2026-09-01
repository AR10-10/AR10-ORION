// paper-trading-wiring.test.ts — v16.0 PRO MAX §9.1/§9.4: fiação real do
// Paper Trading manual no App.tsx + store. A matemática pura já tem
// execução real em paper-trading.test.ts — aqui trancam-se os pontos de
// conexão E, principalmente, a garantia de segurança central da decisão
// do Operador: NENHUM useEffect de preço pode chamar
// openPaperPosition/closePaperPosition — só um onClick pode.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');

describe('unified-snapshot-store.ts: paperTrading no domínio §5 ORGANISMO, mesmo padrão de trackRecord', () => {
  it('importa as funções puras reais do módulo real (paper-trading.ts), nunca uma segunda implementação', () => {
    const store = read('../src/store/unified-snapshot-store.ts');
    expect(store).toContain('openPaperPosition,\n  closePaperPosition,\n  addPaperEntry,\n  recordPaperEquity,\n  EMPTY_PAPER_TRADING_STATE,');
    expect(store).toContain('from "../nexus/paper-trading";');
  });

  it('state interface, defaults e seletor presentes (4 lugares, mesmo campo)', () => {
    const store = read('../src/store/unified-snapshot-store.ts');
    expect(store).toContain('paperTrading: PaperTradingState;');
    expect(store).toContain('paperTrading: EMPTY_PAPER_TRADING_STATE,');
    expect(store).toContain('export const usePaperTradingSnapshot = (): PaperTradingState =>');
  });

  it('as 4 actions chamam as funções puras reais, hydrate é passthrough (mesmo padrão de hydrateTrackRecord)', () => {
    const store = read('../src/store/unified-snapshot-store.ts');
    // Contrato v2: openPaperPosition ganhou symbol+leverage, e entraram duas
    // actions novas (addPaperEntry = DCA, recordPaperEquity = amostragem da
    // curva). O que este teste guarda continua o mesmo e mais amplo: NENHUMA
    // action reimplementa matemática — todas delegam à função pura homônima
    // do motor, e o relógio (`Date.now()`) entra sempre pela store, nunca de
    // dentro do módulo puro.
    expect(store).toContain('openPaperPosition: (plan, sizeUsdt, symbol, leverage) => set((s) => {\n      s.paperTrading = openPaperPosition(s.paperTrading as PaperTradingState, plan, sizeUsdt, Date.now(), symbol, leverage);\n    }),');
    expect(store).toContain('closePaperPosition: (currentPrice, reason) => set((s) => {\n      s.paperTrading = closePaperPosition(s.paperTrading as PaperTradingState, currentPrice, Date.now(), reason);\n    }),');
    expect(store).toContain('addPaperEntry: (price, sizeUsdt) => set((s) => {\n      s.paperTrading = addPaperEntry(s.paperTrading as PaperTradingState, price, sizeUsdt, Date.now());\n    }),');
    expect(store).toContain('recordPaperEquity: (currentPrice) => set((s) => {\n      s.paperTrading = recordPaperEquity(s.paperTrading as PaperTradingState, currentPrice, Date.now());\n    }),');
    expect(store).toContain('hydratePaperTrading: (state) => set((s) => { s.paperTrading = state; }),');
  });
});

describe('App.tsx: PaperTradingPanel — botão, painel, persistência', () => {
  it('SideBar ganha um botão dedicado (mesmo padrão dos outros 4 painéis fixed/centered)', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('onClick={() => setPaperTradingOpen?.((v: boolean) => !v)}');
    expect(app).toContain('<Wallet size={17} className="relative z-10" />');
  });

  it('paperTradingOpen/setPaperTradingOpen circulam pelo MESMO WidgetContext que marketAnalysisOpen', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('const [paperTradingOpen, setPaperTradingOpen] = useState(false);');
    expect(app).toMatch(/marketAnalysisOpen,\s*setMarketAnalysisOpen,\s*paperTradingOpen,\s*setPaperTradingOpen,/);
  });

  it('PaperTradingPanel é renderizado no App real, recebendo priceData por PROP (nunca via Context — mesmo padrão de MarketAnalysisPanel)', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('<PaperTradingPanel priceData={priceData} />');
    expect(app).toContain('function PaperTradingPanel({ priceData }: { priceData: PriceState | null }) {');
  });

  it('GARANTIA DE SEGURANÇA CENTRAL: openPaperPosition/closePaperPosition só são chamados dentro de onClick, NUNCA dentro de um useEffect — zero automação real no código, não só na intenção', () => {
    const app = read('../src/App.tsx');
    // Todo useEffect(...) do arquivo, varredura por parênteses balanceados
    // a partir de cada ocorrência de "useEffect(" — mais robusto que um
    // regex guloso contra o arquivo inteiro (evita falso-negativo/positivo
    // por causa de useEffects aninhados/adjacentes).
    let idx = 0;
    let violations = 0;
    while (true) {
      const start = app.indexOf('useEffect(', idx);
      if (start === -1) break;
      let depth = 0;
      let end = start + 'useEffect('.length - 1;
      for (let i = end; i < app.length; i++) {
        if (app[i] === '(') depth++;
        else if (app[i] === ')') {
          depth--;
          if (depth === 0) { end = i; break; }
        }
      }
      const body = app.slice(start, end + 1);
      // Contrato v2: addPaperEntry (DCA) entra na MESMA trava — é uma
      // transição de posição como abrir/fechar, então também nunca pode
      // sair de um efeito de preço. `recordPaperEquity` é deliberadamente
      // EXCLUÍDA: é observação contábil (não abre/fecha/altera posição),
      // e roda mesmo num intervalo — ver item 4 do cabeçalho de
      // paper-trading.ts e o efeito de amostragem em App.tsx.
      if (
        body.includes('.openPaperPosition(') ||
        body.includes('.closePaperPosition(') ||
        body.includes('.addPaperEntry(')
      ) violations++;
      idx = end + 1;
    }
    expect(violations).toBe(0);
  });

  it('as 3 transições reais (abrir/aportar/fechar) vivem em onClick — contrato v2', () => {
    const app = read('../src/App.tsx');
    // Assinaturas do contrato v2: openPaperPosition ganhou symbol+alavancagem
    // (o symbol fecha a lacuna real de posição órfã de ativo), e addPaperEntry
    // é a transição NOVA do DCA. Formas atualizadas de propósito — a
    // invariante que este teste guarda (transição só por clique) ficou mais
    // forte, nunca mais fraca: agora são 3 transições travadas, não 2.
    expect(app).toMatch(/const handleOpen = \(\) => \{[\s\S]{0,400}useUnifiedSnapshotStore\.getState\(\)\.openPaperPosition\(tradePlan, size, selectedAsset \?\? null, lev\);/);
    expect(app).toMatch(/const handleAddEntry = \(\) => \{[\s\S]{0,400}useUnifiedSnapshotStore\.getState\(\)\.addPaperEntry\(livePrice, size\);/);
    expect(app).toMatch(/const handleClose = \(\) => \{[\s\S]{0,400}useUnifiedSnapshotStore\.getState\(\)\.closePaperPosition\(livePrice, reason\);/);
    expect(app).toContain('onClick={handleOpen}');
    expect(app).toContain('onClick={handleAddEntry}');
    expect(app).toContain('onClick={handleClose}');
  });

  it('a curva de capital é REALMENTE amostrada — o painel não exibe um contador que nunca sobe', () => {
    // ACHADO REAL desta rodada: `recordPaperEquity` existia no motor e na
    // store, e o painel já exibia contador de pontos + drawdown MÁXIMO —
    // mas nada chamava a amostragem. Os dois ficariam presos em 0 para
    // sempre. Esta trava existe para o gap não voltar em silêncio.
    const app = read('../src/App.tsx');
    expect(app).toContain('recordPaperEquity(p);');
    expect(app).toContain('PAPER_EQUITY_SAMPLE_MS');
    // Só amostra com posição aberta (anel de 500 pontos não é gasto com
    // conta parada em linha reta).
    expect(app).toMatch(/if \(!paperTradingSlice\.position\) return;[\s\S]{0,400}PAPER_EQUITY_SAMPLE_MS/);
    // E o degrau realizado do fechamento também entra na curva.
    expect(app).toMatch(/closePaperPosition\(livePrice, reason\);[\s\S]{0,400}recordPaperEquity\(livePrice\);/);
  });

  it('persistência Local-First: save-on-change + hydrate no boot, mesmo padrão do track record', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('void savePaperTrading(paperTradingSlice).catch(() => {});');
    expect(app).toContain('useUnifiedSnapshotStore.getState().hydratePaperTrading(rehydratePaperTrading(raw));');
  });
});

describe('nexus/persistence.ts: savePaperTrading/loadPaperTrading, mesmo padrão de saveTrackRecord/loadTrackRecord', () => {
  it('mesma chave-valor no mesmo SNAPSHOT_STORE genérico, mesmo best-effort', () => {
    const persistence = read('../src/nexus/persistence.ts');
    expect(persistence).toContain('await db.put(SNAPSHOT_STORE, { key: "paper-trading", state, savedAt: Date.now() });');
    expect(persistence).toContain('await db.get(SNAPSHOT_STORE, "paper-trading")');
  });
});
