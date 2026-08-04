// market-analysis-panel-wiring.test.ts — Ordem "Market Analysis & Publication
// Engine": a lógica pura (fail-closed/retest/zona de interesse/texto de X)
// já tem execução real em market-analysis.test.ts. Este arquivo trava só a
// FIAÇÃO da UI (mesma convenção do repositório: readFileSync + regex) —
// entry point real, snapshot congelado, nenhum auto-post, e reuso literal
// do vocabulário público (nunca uma segunda tradução por vista).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');
const app = () => read('../src/App.tsx');

describe('Estado + Context: marketAnalysisOpen segue o MESMO padrão de workspaceManagerOpen/chartLayersOpen/radarPanelOpen', () => {
  it('useState declarado ao lado dos 3 painéis existentes', () => {
    const a = app();
    expect(a).toContain('const [radarPanelOpen, setRadarPanelOpen] = useState(false);');
    expect(a).toContain('const [marketAnalysisOpen, setMarketAnalysisOpen] = useState(false);');
  });

  it('contextValue expõe marketAnalysisOpen/setMarketAnalysisOpen — objeto e array de dependências', () => {
    const a = app();
    const memoMatch = a.match(/const contextValue = useMemo\(\s*\(\) => \(\{([\s\S]*?)\}\),/);
    expect(memoMatch, 'contextValue não encontrado').not.toBeNull();
    const body = memoMatch![1];
    expect(body).toContain('marketAnalysisOpen,');
    expect(body).toContain('setMarketAnalysisOpen,');

    const depsMatch = a.match(/\[\s*widgets,\s*toggleWidget,[\s\S]*?\],\s*\);\n\n {2}return \(/);
    expect(depsMatch, 'dependency array de contextValue não encontrado').not.toBeNull();
    expect(depsMatch![0]).toContain('marketAnalysisOpen,');
  });
});

describe('Entry point real: quarto botão no rodapé da SideBar, mesmo padrão dos 3 acima', () => {
  it('SideBar destrutura setMarketAnalysisOpen do contexto', () => {
    const a = app();
    const sideBarIdx = a.indexOf('function SideBar(');
    const rightRailIdx = a.indexOf('function RightRail(');
    expect(sideBarIdx).toBeGreaterThan(-1);
    expect(rightRailIdx).toBeGreaterThan(sideBarIdx);
    const sideBarBody = a.slice(sideBarIdx, rightRailIdx);
    expect(sideBarBody).toContain('setMarketAnalysisOpen');
    expect(sideBarBody).toContain('title="Análise de Mercado — gerar leitura publicável (Painel/X/Story)"');
    expect(sideBarBody).toContain('onClick={() => setMarketAnalysisOpen?.((v: boolean) => !v)}');
    expect(sideBarBody).toContain('<Share2 size={17} className="relative z-10" />');
  });
});

describe('Montagem: MarketAnalysisPanel ao lado dos outros 3 painéis, mesmo nível do Provider', () => {
  it('renderizado depois de RadarPanel, recebendo priceData por PROP (nunca via Context)', () => {
    const a = app();
    const wsIdx = a.indexOf('<WorkspaceManagerPanel />');
    const clIdx = a.indexOf('<ChartLayersPanel />');
    const rpIdx = a.indexOf('<RadarPanel />');
    const maIdx = a.indexOf('<MarketAnalysisPanel priceData={priceData} />');
    expect(wsIdx).toBeGreaterThan(-1);
    expect(clIdx).toBeGreaterThan(wsIdx);
    expect(rpIdx).toBeGreaterThan(clIdx);
    expect(maIdx).toBeGreaterThan(rpIdx);
  });

  it('a assinatura do componente recebe priceData como prop tipada — mesmo padrão fixado pela correção f74c533 (Unificação da Inteligência Operacional): preço ao vivo tem 1 único caminho de distribuição, nunca um espelho de Context', () => {
    const a = app();
    expect(a).toContain('function MarketAnalysisPanel({ priceData }: { priceData: PriceState | null }) {');
  });
});

describe('Snapshot congelado (§12 sincronia): o painel só recomputa quando ABRE, nunca enquanto está aberto', () => {
  it('useEffect com dependência ÚNICA marketAnalysisOpen — nenhum outro identificador reativo nas deps', () => {
    const a = app();
    const idx = a.indexOf('function MarketAnalysisPanel(');
    expect(idx).toBeGreaterThan(-1);
    const block = a.slice(idx, idx + 2400);
    expect(block).toContain('useEffect(() => {\n    if (!marketAnalysisOpen) return;');
    expect(block).toContain('}, [marketAnalysisOpen]);');
  });

  it('a fotografia vem de buildMarketAnalysis (o único montador real, mesmo de market-analysis.test.ts) — nunca uma segunda leitura ad hoc de nexusDecision', () => {
    const a = app();
    const idx = a.indexOf('function MarketAnalysisPanel(');
    const block = a.slice(idx, idx + 2400);
    expect(block).toContain('setAnalysis(\n      buildMarketAnalysis({');
    expect(block).toContain('decision: nexusDecision ?? null,');
  });

  it('regimeLabel usa a MESMA expressão literal de NarrativeSummaryCard (REGIME_DISPLAY + regime.direction) — zero segunda derivação do rótulo de regime', () => {
    const a = app();
    const idx = a.indexOf('function MarketAnalysisPanel(');
    const block = a.slice(idx, idx + 2400);
    expect(block).toContain('const regime = engine?.marketRegime ?? null;');
    expect(block).toContain('const regimeDisplay = regime ? REGIME_DISPLAY[regime.regime] : null;');
    expect(block).toContain('regimeLabel: regimeDisplay ? `${regimeDisplay.label}${regime!.direction ? ` ${regime!.direction}` : ""}` : null,');
  });

  it('estrutura/support/resistance vêm dos MESMOS campos reais já usados pelo gráfico (engine.marketStructureLabel/support/resistance/*Strength) — zero segundo cálculo', () => {
    const a = app();
    const idx = a.indexOf('function MarketAnalysisPanel(');
    const block = a.slice(idx, idx + 2400);
    expect(block).toContain('structureLabel: engine?.marketStructureLabel ?? null,');
    expect(block).toContain('support: engine?.support ?? null,');
    expect(block).toContain('supportStrength: engine?.supportStrength ?? null,');
    expect(block).toContain('resistance: engine?.resistance ?? null,');
    expect(block).toContain('resistanceStrength: engine?.resistanceStrength ?? null,');
  });
});

describe('Fail-closed real (§6): sem leitura, o painel mostra DADOS INSUFICIENTES — nunca uma leitura parcial', () => {
  it('branch !analysis renderiza o texto explícito, nunca um placeholder genérico', () => {
    const a = app();
    const idx = a.indexOf('function MarketAnalysisPanel(');
    const block = a.slice(idx, idx + 3600);
    expect(block).toContain('{!analysis ? (');
    expect(block).toContain('DADOS INSUFICIENTES');
  });
});

describe('Nunca publica sozinha: zero chamada de rede em todo o bloco do painel + disclaimer visível', () => {
  it('do início ao fim de MarketAnalysisPanel, nenhum fetch()/XMLHttpRequest/axios — só clipboard local', () => {
    const a = app();
    const start = a.indexOf('function MarketAnalysisPanel(');
    const end = a.indexOf('\n// --- RIGHT COLUMN', start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const block = a.slice(start, end);
    expect(block).not.toContain('fetch(');
    expect(block).not.toContain('XMLHttpRequest');
    expect(block).not.toContain('axios');
    expect(block).toContain('navigator.clipboard.writeText(');
  });

  it('disclaimer real e visível: geração é sob demanda do Operador, cópia/captura é sempre ação manual', () => {
    const a = app();
    const idx = a.indexOf('function MarketAnalysisPanel(');
    const block = a.slice(idx, idx + 4200);
    expect(block).toContain('Gerado sob demanda pelo Operador — esta tela nunca publica sozinha; copiar/capturar é sempre uma ação sua.');
  });
});

describe('Aba X: reusa formatMarketAnalysisForX literal (zero segunda redação do texto público), Copiar é fail-closed', () => {
  it('MarketAnalysisXTab chama formatMarketAnalysisForX(analysis) uma única vez, nunca monta o texto na mão', () => {
    const a = app();
    const idx = a.indexOf('function MarketAnalysisXTab(');
    expect(idx).toBeGreaterThan(-1);
    const block = a.slice(idx, idx + 900);
    expect(block).toContain('const text = formatMarketAnalysisForX(analysis);');
  });

  it('handleCopy só marca "copied" DEPOIS do await resolver, e cai em "failed" no catch — nunca reporta sucesso que não aconteceu', () => {
    const a = app();
    const idx = a.indexOf('const handleCopy = async () => {');
    expect(idx).toBeGreaterThan(-1);
    const block = a.slice(idx, idx + 350);
    expect(block).toContain('await navigator.clipboard.writeText(formatMarketAnalysisForX(analysis));');
    expect(block).toContain('setCopyState("copied");');
    expect(block).toContain('} catch {');
    expect(block).toContain('setCopyState("failed");');
  });
});

describe('Aba Story: vocabulário público único (PUBLIC_BIAS_LABEL importado, nunca um 2º mapa hardcoded)', () => {
  it('market-analysis.ts exporta PUBLIC_BIAS_LABEL', () => {
    const m = read('../src/nexus/market-analysis.ts');
    expect(m).toContain('export const PUBLIC_BIAS_LABEL: Record<NexusBiasLabel, string> = {');
  });

  it('App.tsx importa PUBLIC_BIAS_LABEL de nexus/market-analysis e MarketAnalysisStoryTab a reusa direto — nenhum Record<NexusBiasLabel,...> duplicado em App.tsx', () => {
    const a = app();
    expect(a).toContain('import { buildMarketAnalysis, formatMarketAnalysisForX, PUBLIC_BIAS_LABEL, type MarketAnalysis } from "./nexus/market-analysis";');
    const idx = a.indexOf('function MarketAnalysisStoryTab(');
    expect(idx).toBeGreaterThan(-1);
    const block = a.slice(idx, idx + 1600);
    expect(block).toContain('{biasArrow} {PUBLIC_BIAS_LABEL[analysis.bias]}');
    expect(a).not.toMatch(/Record<NexusBiasLabel, string>\s*=\s*\{\s*LONG_BIAS:/);
  });

  it('ordem de campos §8 presente: symbol/timeframe → bias → estrutura → Entry → Stop → Alvos → Reteste → Invalidação → marca AR10', () => {
    const a = app();
    const idx = a.indexOf('function MarketAnalysisStoryTab(');
    const end = a.indexOf('function MarketAnalysisPanel(', idx);
    const block = a.slice(idx, end);
    const order = [
      'analysis.symbol',
      'analysis.timeframe.toUpperCase()',
      'PUBLIC_BIAS_LABEL[analysis.bias]',
      'contextLine',
      '>Entry<',
      '>Stop<',
      'Alvo/Cenário',
      'Cenário de reteste',
      'Invalidação do cenário:',
      'AR10 CYBORG',
    ];
    let cursor = 0;
    for (const token of order) {
      const found = block.indexOf(token, cursor);
      expect(found, `token "${token}" fora de ordem ou ausente`).toBeGreaterThan(-1);
      cursor = found;
    }
  });

  it('nunca exporta PNG/imagem — só a prévia DOM 9:16 e uma instrução de screenshot manual (escopo §17: gerar primeiro, exportar depois se autorizado)', () => {
    const a = app();
    const idx = a.indexOf('function MarketAnalysisStoryTab(');
    const end = a.indexOf('function MarketAnalysisPanel(', idx);
    const block = a.slice(idx, end);
    expect(block).toContain('Prévia 9:16 — capture a tela (screenshot) para publicar no Instagram Stories');
    expect(block).not.toContain('toDataURL');
    expect(block).not.toContain('html2canvas');
    expect(block).not.toContain('download=');
  });
});

describe('Aba Painel: reusa ModulePanel/ModuleStat genéricos (mesmo vocabulário interno já usado pela aba ANALYSIS), zero componente paralelo', () => {
  it('MarketAnalysisPainelTab usa ModulePanel/ModuleStat, nunca um <div>/<span> ad hoc para as mesmas linhas label/valor', () => {
    const a = app();
    const idx = a.indexOf('function MarketAnalysisPainelTab(');
    expect(idx).toBeGreaterThan(-1);
    const end = a.indexOf('function MarketAnalysisXTab(', idx);
    const block = a.slice(idx, end);
    expect(block).toContain('<ModulePanel title="Leitura">');
    expect(block).toContain('<ModuleStat');
    expect(block).toContain('tone={analysis.bias === "LONG_BIAS" ? "long" : analysis.bias === "SHORT_BIAS" ? "short" : "neutral"}');
  });
});
