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
  it('renderizado depois de RadarPanel, recebendo priceData E chartData por PROP (nunca via Context)', () => {
    const a = app();
    const wsIdx = a.indexOf('<WorkspaceManagerPanel />');
    const clIdx = a.indexOf('<ChartLayersPanel />');
    const rpIdx = a.indexOf('<RadarPanel />');
    const maIdx = a.indexOf('<MarketAnalysisPanel priceData={priceData} chartData={chartData} />');
    expect(wsIdx).toBeGreaterThan(-1);
    expect(clIdx).toBeGreaterThan(wsIdx);
    expect(rpIdx).toBeGreaterThan(clIdx);
    expect(maIdx).toBeGreaterThan(rpIdx);
  });

  it('a assinatura do componente recebe priceData E chartData como prop tipada — mesmo padrão fixado pela correção f74c533 (Unificação da Inteligência Operacional): dado ao vivo tem 1 único caminho de distribuição, nunca um espelho de Context. Ordem "AR10 Publication Studio" §1 estende essa mesma disciplina para os candles reais (necessários pro mini-gráfico das 4 peças)', () => {
    const a = app();
    expect(a).toContain(
      'function MarketAnalysisPanel({ priceData, chartData }: { priceData: PriceState | null; chartData: PublicationCandle[] }) {',
    );
  });
});

// Fatia pelo PRÓXIMO limite de função (nunca um número mágico de
// caracteres) — MarketAnalysisPanel já cresceu 3x nesta sessão (narrativa,
// flow, coreFallback) e cada vez quebrava um offset fixo. MarketAnalysisPanel
// é definida DEPOIS das duas abas (PainelTab/PublicationTab) no arquivo —
// NarrativeSummaryCard é a próxima função real após ela. Fatiar até lá é
// auto-ajustável: sobrevive a qualquer crescimento real do corpo de
// MarketAnalysisPanel sem precisar de manutenção manual.
function sliceMarketAnalysisPanel(a: string): string {
  const start = a.indexOf('function MarketAnalysisPanel(');
  expect(start, 'function MarketAnalysisPanel não encontrada').toBeGreaterThan(-1);
  const end = a.indexOf('function NarrativeSummaryCard(', start);
  expect(end, 'function NarrativeSummaryCard não encontrada após MarketAnalysisPanel').toBeGreaterThan(start);
  return a.slice(start, end);
}

describe('Snapshot congelado (§12 sincronia): o painel só recomputa quando ABRE, nunca enquanto está aberto', () => {
  it('useEffect com dependência ÚNICA marketAnalysisOpen — nenhum outro identificador reativo nas deps', () => {
    const block = sliceMarketAnalysisPanel(app());
    expect(block).toContain('useEffect(() => {\n    if (!marketAnalysisOpen) return;');
    expect(block).toContain('}, [marketAnalysisOpen]);');
  });

  it('a fotografia vem de buildMarketAnalysis (o único montador real, mesmo de market-analysis.test.ts) — nunca uma segunda leitura ad hoc de nexusDecision', () => {
    const block = sliceMarketAnalysisPanel(app());
    expect(block).toContain('setAnalysis(\n      buildMarketAnalysis({');
    expect(block).toContain('decision: nexusDecision ?? null,');
  });

  it('regimeLabel usa a MESMA expressão literal de NarrativeSummaryCard (REGIME_DISPLAY + regime.direction) — zero segunda derivação do rótulo de regime', () => {
    const block = sliceMarketAnalysisPanel(app());
    expect(block).toContain('const regime = engine?.marketRegime ?? null;');
    expect(block).toContain('const regimeDisplay = regime ? REGIME_DISPLAY[regime.regime] : null;');
    expect(block).toContain('regimeLabel: regimeDisplay ? `${regimeDisplay.label}${regime!.direction ? ` ${regime!.direction}` : ""}` : null,');
  });

  it('estrutura/support/resistance vêm dos MESMOS campos reais já usados pelo gráfico (engine.marketStructureLabel/support/resistance/*Strength) — zero segundo cálculo', () => {
    const block = sliceMarketAnalysisPanel(app());
    expect(block).toContain('structureLabel: engine?.marketStructureLabel ?? null,');
    expect(block).toContain('support: engine?.support ?? null,');
    expect(block).toContain('supportStrength: engine?.supportStrength ?? null,');
    expect(block).toContain('resistance: engine?.resistance ?? null,');
    expect(block).toContain('resistanceStrength: engine?.resistanceStrength ?? null,');
  });

  it('Ordem "AR10 Publication Studio" §1: candles/preço vivo congelados no MESMO effect/gatilho que analysis — nunca um segundo freeze só pro clique de Gerar Publicação', () => {
    const block = sliceMarketAnalysisPanel(app());
    expect(block).toContain('const livePriceNow = typeof priceData?.price === "number" ? priceData.price : null;');
    expect(block).toContain('setFrozenCandles(chartData);');
    expect(block).toContain('setFrozenLivePrice(livePriceNow);');
    // as duas novas linhas ficam DENTRO do mesmo useEffect de dependência
    // única — nunca um efeito paralelo com deps próprias.
    const effectStart = block.indexOf('useEffect(() => {');
    const effectEnd = block.indexOf('}, [marketAnalysisOpen]);');
    expect(block.indexOf('setFrozenCandles(chartData);')).toBeGreaterThan(effectStart);
    expect(block.indexOf('setFrozenCandles(chartData);')).toBeLessThan(effectEnd);
  });

  it('Ordem "Correção Definitiva" §5: coreFallback repassa os MESMOS campos brutos de engine que engineFallbackLevels já lê — nunca uma segunda leitura de campo', () => {
    const block = sliceMarketAnalysisPanel(app());
    expect(block).toContain('direction: engine?.direction ?? null,');
    expect(block).toContain('stop: engine?.stop ?? null,');
    expect(block).toContain('target1: engine?.target ?? null,');
    expect(block).toContain('target2: engine?.target2 ?? null,');
    expect(block).toContain('target3: engine?.extendedTarget ?? null,');
    expect(block).toContain('riskRewardRatio: engine?.riskRewardRatio ?? null,');
  });
});

describe('Fail-closed real (§6): sem leitura, o painel mostra DADOS INSUFICIENTES — nunca uma leitura parcial', () => {
  it('branch !analysis renderiza o texto explícito, nunca um placeholder genérico', () => {
    const block = sliceMarketAnalysisPanel(app());
    expect(block).toContain('{!analysis ? (');
    expect(block).toContain('DADOS INSUFICIENTES');
  });
});

describe('Nunca publica sozinha: zero chamada de rede em todo o bloco Publicação + disclaimer visível', () => {
  it('do início de MarketAnalysisPublicationTab ao fim de MarketAnalysisPanel, nenhum fetch()/XMLHttpRequest/axios — só clipboard/share locais', () => {
    const a = app();
    const start = a.indexOf('function MarketAnalysisPublicationTab(');
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
    const block = sliceMarketAnalysisPanel(app());
    expect(block).toContain('Gerado sob demanda pelo Operador — esta tela nunca publica sozinha; copiar/capturar é sempre uma ação sua.');
  });
});

describe('Ordem "AR10 Publication Studio": aba Publicação — UMA ação (Gerar Publicação), 4 peças do MESMO snapshot, fail-closed por peça', () => {
  it('botão principal chama renderPublicationAssets(snapshot) — o mesmo snapshot recebido por prop, nunca uma nova leitura', () => {
    const a = app();
    const idx = a.indexOf('function MarketAnalysisPublicationTab(');
    expect(idx).toBeGreaterThan(-1);
    const block = a.slice(idx, idx + 3800);
    expect(block).toContain('const next = await renderPublicationAssets(snapshot);');
    expect(block).toContain('Gerar Publicação');
  });

  it('object URLs velhos são revogados ANTES de um novo lote e ao desmontar — nunca acumulam entre gerações/fechamentos do painel', () => {
    const a = app();
    const idx = a.indexOf('function MarketAnalysisPublicationTab(');
    const block = a.slice(idx, idx + 1400);
    const revokeCount = (block.match(/revokePublicationAssets\(/g) ?? []).length;
    expect(revokeCount).toBeGreaterThanOrEqual(2); // cleanup do useEffect + antes do novo setAssets
  });

  it('genState "failed" mostra DADOS INSUFICIENTES — nunca um resultado vazio silencioso', () => {
    const a = app();
    const idx = a.indexOf('function MarketAnalysisPublicationTab(');
    const end = a.indexOf('function MarketAnalysisPanel(', idx);
    const block = a.slice(idx, end);
    expect(block).toContain('genState === "failed"');
    expect(block).toContain('DADOS INSUFICIENTES');
  });

  it('Baixar Todas dispara downloads a partir do MESMO gesto (loop síncrono), nunca pede um novo clique por arquivo', () => {
    const a = app();
    const idx = a.indexOf('const downloadAll = () => {');
    expect(idx).toBeGreaterThan(-1);
    const block = a.slice(idx, idx + 320);
    expect(block).toContain('assets.forEach((a, i) => setTimeout(() => downloadAsset(a), i * 200));');
  });

  it('Compartilhar usa Web Share API com feature-detection real (canShare) — nunca finge sucesso quando o navegador não suporta', () => {
    const a = app();
    const idx = a.indexOf('const shareAll = async () => {');
    expect(idx).toBeGreaterThan(-1);
    const block = a.slice(idx, idx + 700);
    expect(block).toContain('!nav.share || !nav.canShare || !nav.canShare({ files })');
    expect(block).toContain('setShareState("unsupported");');
  });
});

describe('Legenda de X preservada (Regra de Ouro 4: realocar, nunca apagar) — mesma formatMarketAnalysisForX, mesmo botão Copiar fail-closed, agora ao lado da imagem real', () => {
  it('a legenda reusa formatMarketAnalysisForX(snapshot.analysis) literal — nunca uma segunda redação do texto público', () => {
    const a = app();
    const idx = a.indexOf('function MarketAnalysisPublicationTab(');
    const end = a.indexOf('function MarketAnalysisPanel(', idx);
    const block = a.slice(idx, end);
    expect(block).toContain('Legenda sugerida para X');
    expect(block).toContain('{formatMarketAnalysisForX(snapshot.analysis)}');
  });

  it('handleCopyCaption só marca "copied" DEPOIS do await resolver, e cai em "failed" no catch — nunca reporta sucesso que não aconteceu', () => {
    const a = app();
    const idx = a.indexOf('const handleCopyCaption = async () => {');
    expect(idx).toBeGreaterThan(-1);
    const block = a.slice(idx, idx + 350);
    expect(block).toContain('await navigator.clipboard.writeText(formatMarketAnalysisForX(snapshot.analysis));');
    expect(block).toContain('setCaptionCopyState("copied");');
    expect(block).toContain('} catch {');
    expect(block).toContain('setCaptionCopyState("failed");');
  });
});

describe('Vocabulário público único (PUBLIC_BIAS_LABEL) — reusado por publication/formats.ts, nunca um 2º mapa hardcoded em App.tsx', () => {
  it('market-analysis.ts exporta PUBLIC_BIAS_LABEL', () => {
    const m = read('../src/nexus/market-analysis.ts');
    expect(m).toContain('export const PUBLIC_BIAS_LABEL: Record<NexusBiasLabel, string> = {');
  });

  it('App.tsx NÃO importa mais PUBLIC_BIAS_LABEL diretamente (a Ordem "AR10 Publication Studio" moveu a composição visual das 4 peças para publication/formats.ts, que importa e reusa a mesma tradução) — nunca um 2º Record<NexusBiasLabel,...> duplicado em App.tsx', () => {
    const a = app();
    expect(a).not.toMatch(/Record<NexusBiasLabel, string>\s*=\s*\{\s*LONG_BIAS:/);
    // publication/formats.ts é quem importa/usa PUBLIC_BIAS_LABEL agora —
    // confirmado no describe "formats.ts" de publication-formats-wiring.test.ts.
    const pub = read('../src/publication/formats.ts');
    expect(pub).toContain('import { PUBLIC_BIAS_LABEL } from "../nexus/market-analysis";');
  });
});

describe('Aba Painel: reusa ModulePanel/ModuleStat genéricos (mesmo vocabulário interno já usado pela aba ANALYSIS), zero componente paralelo', () => {
  it('MarketAnalysisPainelTab usa ModulePanel/ModuleStat, nunca um <div>/<span> ad hoc para as mesmas linhas label/valor', () => {
    const a = app();
    const idx = a.indexOf('function MarketAnalysisPainelTab(');
    expect(idx).toBeGreaterThan(-1);
    const end = a.indexOf('function MarketAnalysisPublicationTab(', idx);
    const block = a.slice(idx, end);
    expect(block).toContain('<ModulePanel title="Leitura">');
    expect(block).toContain('<ModuleStat');
    expect(block).toContain('tone={analysis.bias === "LONG_BIAS" ? "long" : analysis.bias === "SHORT_BIAS" ? "short" : "neutral"}');
  });
});
