// sidebar-nav-declutter-wiring.test.ts — pedido do Operador (áudio): "muita
// ferramenta atrapalhar outra... deixa só os principais que o analista usa
// no dia a dia... sistema leve profissional, não deleta nada". Auditoria
// real (Playwright contra o app rodando) contou 15 ícones na régua
// esquerda (9 abas + 6 gavetas de rodapé) — este arquivo trava a divisão
// principal/secundário e garante que nada foi apagado, só recolhido, MESMO
// padrão já usado por ChartLayersPanelContent ("Estado Inteligente
// Adaptativo"). Padrão-no-código-fonte: o bug mais provável aqui é
// "esqueceram de conectar A com B" (um botão que sumiu de verdade), não
// matemática sutil — não existe módulo puro nesta mudança.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const app = readFileSync(resolve(here, '../src/App.tsx'), 'utf8');

const sideBarIdx = app.indexOf('function SideBar({');
const sideBarEndIdx = app.indexOf('\n// --- RIGHT RAIL', sideBarIdx);
const sideBar = app.slice(sideBarIdx, sideBarEndIdx);

describe('SideBar: abas — 5 principais sempre visíveis, 4 secundárias atrás de "Mais abas"', () => {
  it('PRIMARY_TABS tem exatamente as 5 abas com dado ao vivo/reativo contínuo', () => {
    const m = sideBar.match(/const PRIMARY_TABS: \{ icon: any; id: string; label: string \}\[\] = \[([\s\S]*?)\n {2}\];/);
    expect(m, 'PRIMARY_TABS não encontrado').not.toBeNull();
    const ids = [...m![1].matchAll(/id: "([A-Z]+)"/g)].map((x) => x[1]);
    expect(ids).toEqual(['DASHBOARD', 'MARKETS', 'ANALYSIS', 'RISK', 'ALERTS']);
  });

  it('SECONDARY_TABS tem exatamente as 4 abas de uso pontual (nunca removidas, só recolhidas)', () => {
    const m = sideBar.match(/const SECONDARY_TABS: \{ icon: any; id: string; label: string \}\[\] = \[([\s\S]*?)\n {2}\];/);
    expect(m, 'SECONDARY_TABS não encontrado').not.toBeNull();
    const ids = [...m![1].matchAll(/id: "([A-Z]+)"/g)].map((x) => x[1]);
    expect(ids).toEqual(['SCANNER', 'NEWS', 'SETTINGS', 'EXECUTION']);
  });

  it('moreTabsOpen começa fechado (false) — nunca persistido, régua sempre volta enxuta no boot', () => {
    expect(sideBar).toContain('const [moreTabsOpen, setMoreTabsOpen] = useState(false);');
  });

  it('SECONDARY_TABS só renderiza quando moreTabsOpen é true — condicional real, não sempre montado', () => {
    expect(sideBar).toContain('{moreTabsOpen &&\n        SECONDARY_TABS.map((item) => (');
  });

  it('o toggle "Mais abas" é um botão real com aria-expanded (acessível a leitor de tela)', () => {
    const idx = sideBar.indexOf('onClick={() => setMoreTabsOpen((v) => !v)}');
    expect(idx).toBeGreaterThan(-1);
    const block = sideBar.slice(idx - 50, idx + 600);
    expect(block).toContain('aria-expanded={moreTabsOpen}');
    expect(block).toContain('<MoreHorizontal');
  });
});

describe('SideBar: gavetas de rodapé — Market Intelligence e Radar/OIH sempre visíveis, as outras 4 atrás de "Mais gavetas"', () => {
  it('Market Intelligence continua fora de qualquer condicional (troca o CONTEXTO do gráfico, não é auxiliar)', () => {
    const idx = sideBar.indexOf('label="Market Intelligence"');
    expect(idx).toBeGreaterThan(-1);
    // Não pode haver "moreDrawersOpen &&" entre o fim das abas e este ponto.
    const between = sideBar.slice(sideBar.indexOf('{moreTabsOpen &&'), idx);
    expect(between).not.toContain('moreDrawersOpen &&');
  });

  it('Radar/OIH continua fora de qualquer condicional — é o único dos 6 com contador AO VIVO (radarCandidateCount)', () => {
    const idx = sideBar.indexOf('title="Radar / OIH — Oportunidades já validadas pelo organismo"');
    expect(idx).toBeGreaterThan(-1);
    const moreDrawersToggleIdx = sideBar.indexOf('onClick={() => setMoreDrawersOpen((v) => !v)}');
    expect(idx).toBeLessThan(moreDrawersToggleIdx);
    expect(sideBar.slice(idx, idx + 600)).toContain('radarCandidateCount > 0 &&');
  });

  it('moreDrawersOpen começa fechado (false) — nunca persistido', () => {
    expect(sideBar).toContain('const [moreDrawersOpen, setMoreDrawersOpen] = useState(false);');
  });

  it('o toggle "Mais gavetas" é um botão real com aria-expanded, ancorado no rodapé (mt-auto)', () => {
    const idx = sideBar.indexOf('onClick={() => setMoreDrawersOpen((v) => !v)}');
    expect(idx).toBeGreaterThan(-1);
    const block = sideBar.slice(idx - 50, idx + 400);
    expect(block).toContain('aria-expanded={moreDrawersOpen}');
    expect(block).toContain('mt-auto');
  });

  it('os 4 botões secundários (Workspace Manager/Camadas do Gráfico/Análise de Mercado/Paper Trading) continuam TODOS no código — nada apagado, só recolhido', () => {
    const toggleIdx = sideBar.indexOf('onClick={() => setMoreDrawersOpen((v) => !v)}');
    const afterToggle = sideBar.slice(toggleIdx);
    expect(afterToggle).toContain('{moreDrawersOpen && (');
    expect(afterToggle).toContain('onClick={() => setWorkspaceManagerOpen?.((v: boolean) => !v)}');
    expect(afterToggle).toContain('onClick={() => setChartLayersOpen?.((v: boolean) => !v)}');
    expect(afterToggle).toContain('onClick={() => setMarketAnalysisOpen?.((v: boolean) => !v)}');
    expect(afterToggle).toContain('onClick={() => setPaperTradingOpen?.((v: boolean) => !v)}');
  });

  it('os 4 botões secundários só existem DEPOIS do "{moreDrawersOpen && (" — genuinamente condicionais, não só reordenados', () => {
    const conditionalIdx = sideBar.indexOf('{moreDrawersOpen && (');
    const handlers = [
      'onClick={() => setWorkspaceManagerOpen?.((v: boolean) => !v)}',
      'onClick={() => setChartLayersOpen?.((v: boolean) => !v)}',
      'onClick={() => setMarketAnalysisOpen?.((v: boolean) => !v)}',
      'onClick={() => setPaperTradingOpen?.((v: boolean) => !v)}',
    ];
    for (const h of handlers) {
      expect(sideBar.indexOf(h), `${h} deveria estar depois do bloco condicional`).toBeGreaterThan(conditionalIdx);
    }
  });
});

describe('MoreHorizontal importado de lucide-react — nenhum ícone novo redigitado à parte', () => {
  it('import real na lista de lucide-react', () => {
    expect(app).toContain('MoreHorizontal,\n} from "lucide-react";');
  });
});
