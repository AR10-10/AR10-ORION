// context-read-strip-wiring.test.ts — Entrega 26 Prioridade 4 ("O Operador
// deve conseguir responder em menos de 2 segundos: tendência? força?
// risco? liquidez? contexto? SEM ABRIR GAVETAS").
//
// Convenção mista deliberada do projeto (CLAUDE.md): a lógica pura desta
// entrega (buildNarrativeSummary + contexto) tem teste de EXECUÇÃO REAL em
// operational-readability.test.ts; o que este arquivo trava é a FIAÇÃO
// dentro de App.tsx — que a faixa existe, que ela vive na linha SEMPRE
// VISÍVEL (nunca dentro de uma gaveta), que ela é fail-closed e que não
// duplica o que a linha 1 já mostra. O bug mais provável aqui é "alguém
// moveu a faixa para dentro de uma gaveta de novo", não "a matemática
// está errada" — exatamente o caso que a convenção manda cobrir por
// padrão de fonte.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const app = readFileSync(resolve(here, '../src/App.tsx'), 'utf8');

describe('ContextReadStrip: a leitura de contexto vive na barra sempre visível, nunca numa gaveta', () => {
  it('o componente existe', () => {
    expect(app).toContain('function ContextReadStrip()');
  });

  it('é renderizado na MESMA linha sempre visível do Trade Plan / S1-R1 (linha 2 do header), não dentro de terminal-left/terminal-right', () => {
    const idx = app.indexOf('<TradePlanTopStrip livePrice={data?.price ?? null} />');
    expect(idx, 'linha 2 do header não encontrada').toBeGreaterThan(-1);
    // janela real da linha 2 — a faixa precisa estar ao lado dos 2 strips já sempre visíveis
    const linha2 = app.slice(idx, idx + 700);
    expect(linha2).toContain('<StructureLevelsStrip />');
    expect(linha2).toContain('<ContextReadStrip />');
  });

  it('a única renderização de ContextReadStrip está fora das gavetas (nunca em terminal-left/terminal-right)', () => {
    const renders = app.match(/<ContextReadStrip \/>/g) ?? [];
    expect(renders.length, 'esperado exatamente 1 ponto de renderização').toBe(1);
    // Nesting real, não posição no arquivo: o JSX das 2 gavetas é montado
    // dentro de App() (bem antes, no fonte, da definição da barra de
    // comando) — então a checagem honesta é "a faixa não aparece DENTRO
    // do bloco JSX das gavetas", nunca "vem antes no arquivo".
    const leftDrawerIdx = app.indexOf('className={`terminal-left');
    const rightDrawerIdx = app.indexOf('className={`terminal-right');
    expect(leftDrawerIdx, 'gaveta esquerda não encontrada').toBeGreaterThan(-1);
    expect(rightDrawerIdx, 'gaveta direita não encontrada').toBeGreaterThan(-1);
    // fatia generosa cobrindo as 2 gavetas inteiras (esquerda começa antes
    // da direita; +6000 cobre com folga o fechamento do bloco da direita)
    const drawersBlock = app.slice(leftDrawerIdx, rightDrawerIdx + 6000);
    expect(drawersBlock).not.toContain('<ContextReadStrip />');
    // e a faixa continua sendo irmã dos 2 strips já sempre visíveis
    expect(drawersBlock).not.toContain('<TradePlanTopStrip');
    expect(drawersBlock).not.toContain('<StructureLevelsStrip');
  });

  it('reusa BarField (mesma linguagem visual das 2 faixas irmãs) — nunca um segundo sistema de chip só para esta faixa', () => {
    const idx = app.indexOf('function ContextReadStrip()');
    const block = app.slice(idx, idx + 4200);
    expect(block).toContain('<BarField');
    expect(block).not.toContain('cyber-panel'); // não é um painel novo, é uma faixa da barra existente
  });

  it('fail-closed: sem NENHUM valor real a faixa inteira some (altura zero), nunca uma fileira de traços fabricados', () => {
    const idx = app.indexOf('function ContextReadStrip()');
    const block = app.slice(idx, idx + 4200);
    expect(block).toContain('if (!regimeDisplay && !flowReal && !risk && !confluence) return null;');
  });

  it('os 4 campos são leituras JÁ existentes (zero cálculo novo na interface, regra explícita da Ordem)', () => {
    const idx = app.indexOf('function ContextReadStrip()');
    const block = app.slice(idx, idx + 4200);
    // regime: mesmo REGIME_DISPLAY do painel MARKET REGIME
    expect(block).toContain('REGIME_DISPLAY[regime.regime]');
    // risco/confluência: mesmas funções puras já testadas da Readability Layer
    expect(block).toContain('deriveRiskState(nexusDecision)');
    expect(block).toContain('deriveConfluenceState(nexusDecision)');
    // fluxo: sinal do CVD real, mesma regra do painel MARKET REGIME
    expect(block).toContain('num(cvd) && cvd !== 0');
    // e NENHUMA matemática nova de mercado dentro da faixa
    expect(block).not.toMatch(/Math\.(sqrt|pow|log)|reduce\(/);
  });

  it('não duplica o que a linha 1 já mostra sempre (direção do Núcleo e percentual de confluência) — Prioridades 1/9 da própria Ordem', () => {
    const idx = app.indexOf('function ContextReadStrip()');
    const block = app.slice(idx, idx + 4200);
    expect(block).not.toContain('institutionalScore');
    expect(block).not.toContain('engine?.direction');
    expect(block).not.toContain('confidenceZone');
  });
});

describe('NarrativeSummaryCard: contexto de mercado real chega à LEITURA CONSOLIDADA (Prioridade 8)', () => {
  it('passa regimeLabel e flow reais para buildNarrativeSummary — nunca recalcula regime/fluxo no componente', () => {
    const idx = app.indexOf('function NarrativeSummaryCard()');
    expect(idx, 'NarrativeSummaryCard não encontrado').toBeGreaterThan(-1);
    const block = app.slice(idx, idx + 1400);
    expect(block).toContain('buildNarrativeSummary(nexusDecision ?? null, {');
    expect(block).toContain('REGIME_DISPLAY[regime.regime]');
    expect(block).toContain('flow: num(cvd) && cvd !== 0');
  });
});
