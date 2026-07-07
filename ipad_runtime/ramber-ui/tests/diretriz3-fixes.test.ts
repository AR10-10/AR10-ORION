// diretriz3-fixes.test.ts — trava permanente dos 3 defeitos reportados
// pelo Operador após o Overhaul Cross-Market (gráfico colapsando,
// dropdown do Omnibox sem rolagem por toque, painéis sem responder a
// gesto em paisagem) e do roteamento Spot→Futuros real (Diretriz 2). São
// testes de PADRÃO NO CÓDIGO-FONTE (mesmo espírito dos boundary tests já
// existentes) — a prova física em navegador real (Playwright/Chromium,
// viewport de iPad com hasTouch:true) já confirmou os 4 comportamentos;
// isto garante que ninguém reintroduza a mesma classe de bug sem o CI
// avisar.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');

describe('bug 1: colapso do Gráfico — o wrapper do Vetor de Mercado/S.E. precisa de flex-grow real', () => {
  it('o wrapper que envolve MarketDirectionWidget+AssistantOrb NÃO é mais "shrink-0" sozinho (sem crescimento) dentro de .terminal-main', () => {
    const app = read('../src/App.tsx');
    // A causa raiz: um filho com flex-1 (AssistantOrb) dentro de um pai
    // shrink-0/altura-auto cria distribuição de altura mal-definida,
    // fazendo o Gráfico (flex-[1.8] no .terminal-main) colapsar. A
    // correção dá ao wrapper um flex-grow explícito.
    const wrapperMatch = app.match(
      /className=\{`([^`]*)\s+flex flex-col gap-2 relative z-0 transition-\[filter\][^`]*`\}\s*\n\s*>\s*\n\s*<div className="absolute inset-0[^"]*mix-blend-screen">/,
    );
    expect(wrapperMatch, 'wrapper do Vetor de Mercado/S.E. não encontrado com a estrutura esperada').not.toBeNull();
    const classesBeforeFlex = wrapperMatch![1];
    expect(classesBeforeFlex).not.toMatch(/^\s*shrink-0\s*$/);
    expect(classesBeforeFlex).toMatch(/flex-\[[\d.]+\]/); // algum flex-grow numérico real
  });

  it('esse wrapper tem min-h-0 (necessário para o flex-grow realmente distribuir a altura do .terminal-main)', () => {
    const app = read('../src/App.tsx');
    const wrapperMatch = app.match(/className=\{`(flex-\[[\d.]+\][^`]*)\s+flex flex-col gap-2 relative z-0/);
    expect(wrapperMatch).not.toBeNull();
    expect(wrapperMatch![1]).toContain('min-h-0');
  });
});

describe('bug 2: scroll do Smart Omnibox — cascata CSS corrigida', () => {
  it('o dropdown usa !overflow-y-auto (important) para vencer o overflow:hidden de .cyber-panel na cascata', () => {
    const omnibox = read('../src/omnibox/SmartOmnibox.tsx');
    // A mesma classe de bug já documentada no Widget() maximizado
    // (!fixed !inset-2) — .cyber-panel vem DEPOIS do Tailwind no CSS
    // compilado (index.css importa tailwindcss primeiro), então
    // overflow-y-auto simples perde a cascata para o overflow:hidden
    // de .cyber-panel na MESMA propriedade.
    expect(omnibox).toContain('!overflow-y-auto');
    expect(omnibox).toContain('cyber-panel');
    // nunca o overflow-y-auto "cru" (sem o modificador important) nesse
    // mesmo elemento — evita reintroduzir o bug por engano numa edição futura
    expect(omnibox).not.toMatch(/className="[^"]*\bcyber-panel\b[^"]*\boverflow-y-auto\b(?!["']|\s)/);
  });
});

describe('bug 3: scroll em paisagem — pointer-events-none removido dos containers do grid', () => {
  it('nenhum dos 3 containers nomeados (.terminal-main/.terminal-aside/.terminal-strip) declara pointer-events-none', () => {
    const app = read('../src/App.tsx');
    for (const cls of ['terminal-main', 'terminal-aside', 'terminal-strip']) {
      const regex = new RegExp(`className="${cls}[^"]*"`, 'g');
      const matches = app.match(regex) ?? [];
      expect(matches.length, `nenhuma ocorrência de className="${cls}..." encontrada`).toBeGreaterThan(0);
      for (const m of matches) {
        expect(m, `${cls} não pode ter pointer-events-none (bloqueia gesto de toque)`).not.toContain('pointer-events-none');
      }
    }
  });
});

describe('diretriz 2: roteamento Spot→Futuros real — Gráfico e Risk Engine exclusivamente em /fapi/v1/', () => {
  it('engine-bridge.ts importa collectBinanceFuturesKlines e NUNCA collectBinanceKlines (spot)', () => {
    const bridge = read('../src/engine-bridge.ts');
    expect(bridge).toContain("import { collectBinanceFuturesKlines } from '../../src/market-data-bus/binance-futures-candle-connector.js'");
    expect(bridge).not.toContain('collectBinanceKlines');
    expect(bridge).not.toContain('binance-candle-connector.js');
  });

  it('as 3 chamadas ao Bus (HTF, ciclo principal, getChartCandles) usam collect: collectBinanceFuturesKlines', () => {
    const bridge = read('../src/engine-bridge.ts');
    const occurrences = bridge.match(/collect: collectBinanceFuturesKlines/g) ?? [];
    expect(occurrences).toHaveLength(3);
  });

  it('a chave do Bus usa sufixo -PERP (nunca colide em cache com um eventual snapshot spot do mesmo símbolo)', () => {
    const bridge = read('../src/engine-bridge.ts');
    const occurrences = bridge.match(/symbol: `\$\{symbol\}-PERP`/g) ?? [];
    expect(occurrences).toHaveLength(3);
  });

  it('CoreEvidence.instrument_type é sempre \'crypto_futures\' na construção real (união de tipos permanece fechada)', () => {
    const bridge = read('../src/engine-bridge.ts');
    expect(bridge).toContain("instrument_type: 'crypto_spot' | 'crypto_futures';");
    expect(bridge).toContain("instrument_type: 'crypto_futures',");
    // só uma atribuição de valor (não a definição de tipo) — sem duplicata
    const valueAssignments = bridge.match(/^\s*instrument_type: 'crypto_futures',\s*$/gm) ?? [];
    expect(valueAssignments).toHaveLength(1);
  });

  it('RealCycleResult expõe instrumentType como passthrough honesto (nunca uma string fixa na UI)', () => {
    const bridge = read('../src/engine-bridge.ts');
    expect(bridge).toContain("instrumentType?: 'crypto_spot' | 'crypto_futures' | null;");
    expect(bridge).toContain('instrumentType: evidence.instrument_type,');
  });

  it('binance-futures-candle-connector.js existe, exporta collectBinanceFuturesKlines e reaproveita o probe real de futuros', () => {
    const connector = read('../../src/market-data-bus/binance-futures-candle-connector.js');
    expect(connector).toContain('export async function collectBinanceFuturesKlines');
    expect(connector).toContain("import { probe as probeBinanceFutures } from '../../js/real-data/binance-futures-public.js'");
  });

  it('App.tsx deriva o rótulo do mercado de realCycle.instrumentType — nunca a string fixa "Spot"', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('realCycle?.instrumentType === "crypto_futures"');
    expect(app).toContain('"Futures/Perp"');
    // o badge de modo cripto usa a variável derivada, não um literal "Spot"
    expect(app).toContain('marketMode === "TRADFI" ? "Macro" : cryptoMarketLabel');
    expect(app).not.toMatch(/\{marketMode === "TRADFI" \? "Macro" : "Spot"\}/);
  });
});
