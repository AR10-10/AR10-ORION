// v16-institutional-command-center.test.ts — trava a arquitetura da
// "DIRETRIZ V16 — INSTITUTIONAL COMMAND CENTER" (mockup do Operador):
// 3 colunas SEMPRE visíveis (esquerda Market Intelligence / centro
// Gráfico dominante / direita Core Intelligence), Workspace Manager com
// os 5 estados (Pinned/Docked/Collapsed/Hidden/Floating) para os módulos
// verdadeiramente secundários, e o Decision Status (WAIT/CONFIRM/
// EXECUTE) honesto — nunca um score inventado. Mesmo espírito dos
// boundary tests já existentes: padrão no código-fonte, não render.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');

describe('V16 Workspace Manager: widgets ganham collapsed+pinned (5 estados) sem quebrar visible+floating existentes', () => {
  it('WIDGET_PREFS_KEY foi versionado para v2 — localStorage antigo (tudo visible:true) não pode ressuscitar os defaults pré-V16', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('"ramber_widget_prefs_v2"');
    expect(app).not.toContain('"ramber_widget_prefs_v1"');
  });

  it('DEFAULT_WIDGETS declara collapsed e pinned em toda entrada (mesmo formato de objeto para as 16 chaves)', () => {
    const app = read('../src/App.tsx');
    const defaultsMatch = app.match(/const DEFAULT_WIDGETS:[\s\S]*?= \{\n([\s\S]*?)\n {2}\};/);
    expect(defaultsMatch, 'DEFAULT_WIDGETS não encontrado').not.toBeNull();
    const body = defaultsMatch![1];
    const entries = body.match(/^\s*\w+: \{[^}]*\},?$/gm) ?? [];
    expect(entries.length).toBeGreaterThanOrEqual(16);
    for (const entry of entries) {
      expect(entry, `entrada sem collapsed/pinned: ${entry}`).toMatch(/collapsed: (true|false)/);
      expect(entry, `entrada sem collapsed/pinned: ${entry}`).toMatch(/pinned: (true|false)/);
    }
  });

  it('os 9 módulos secundários (Order Book/Order Flow/Heatmap/Scanner/Exposição/Eventos/Núcleo Neural/Heatmap de Ativos/Liquidações) começam ocultos por padrão', () => {
    const app = read('../src/App.tsx');
    const defaultsMatch = app.match(/const DEFAULT_WIDGETS:[\s\S]*?= \{\n([\s\S]*?)\n {2}\};/);
    const body = defaultsMatch![1];
    for (const id of ['orderflow', 'heatmap', 'orderbook', 'scanner', 'exposure', 'events', 'neural_core', 'tactical', 'asset_heatmap']) {
      const line = body.match(new RegExp(`^\\s*${id}: \\{([^}]*)\\},?$`, 'm'));
      expect(line, `${id} não encontrado em DEFAULT_WIDGETS`).not.toBeNull();
      expect(line![1], `${id} deveria ter visible: false por padrão (Workspace Manager)`).toContain('visible: false');
    }
  });

  it('os módulos SEMPRE visíveis (chart/direção/GMIL/regime/validação/saúde) começam visible:true — nunca atrás de gear', () => {
    const app = read('../src/App.tsx');
    const defaultsMatch = app.match(/const DEFAULT_WIDGETS:[\s\S]*?= \{\n([\s\S]*?)\n {2}\};/);
    const body = defaultsMatch![1];
    for (const id of ['chart', 'market_direction', 'se_core', 'gmil_context', 'market_regime', 'system_health', 'decision_validation']) {
      const line = body.match(new RegExp(`^\\s*${id}: \\{([^}]*)\\},?$`, 'm'));
      expect(line, `${id} não encontrado em DEFAULT_WIDGETS`).not.toBeNull();
      expect(line![1], `${id} deveria ter visible: true (parte fixa do V16)`).toContain('visible: true');
    }
  });

  it('setWidgetWorkspaceState cobre exatamente os 5 estados nomeados do Workspace Manager', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('const setWidgetWorkspaceState = useCallback(');
    for (const state of ['"hidden"', '"docked"', '"collapsed"', '"pinned"', '"floating"']) {
      expect(app).toContain(state);
    }
    expect(app).toContain('const WORKSPACE_STATES = ["hidden", "docked", "collapsed", "pinned", "floating"] as const;');
  });

  it('WorkspaceManagerPanel lista exatamente os 9 módulos secundários — nunca o Gráfico nem as colunas sempre-visíveis', () => {
    const app = read('../src/App.tsx');
    const listMatch = app.match(/const WORKSPACE_MANAGER_MODULES: \{ id: string; label: string \}\[\] = \[([\s\S]*?)\n\];/);
    expect(listMatch, 'WORKSPACE_MANAGER_MODULES não encontrado').not.toBeNull();
    const ids = [...listMatch![1].matchAll(/\{ id: "(\w+)"/g)].map((m) => m[1]);
    expect(ids.sort()).toEqual(
      ['orderbook', 'orderflow', 'heatmap', 'scanner', 'exposure', 'events', 'neural_core', 'asset_heatmap', 'tactical'].sort(),
    );
    for (const permanent of ['chart', 'market_direction', 'se_core', 'gmil_context', 'market_regime', 'decision_validation', 'system_health']) {
      expect(ids).not.toContain(permanent);
    }
  });
});

describe('V16 §4 Decision Status (WAIT/CONFIRM/EXECUTE): confluência honesta, nunca um score novo inventado', () => {
  it('MarketBiasDecisionCard deriva o status de campos JÁ reais (direction/riskSuggestion/ensembleConsensus) — nenhuma nova heurística de pontuação', () => {
    const app = read('../src/App.tsx');
    const fnMatch = app.match(/function MarketBiasDecisionCard\(\) \{([\s\S]*?)\n\}\n/);
    expect(fnMatch, 'MarketBiasDecisionCard não encontrada').not.toBeNull();
    const body = fnMatch![1];
    expect(body).toContain('"WAIT" | "CONFIRM" | "EXECUTE"');
    // WAIT exige ausência de direção OU Risk Engine sem sugestão real > 0
    expect(body).toMatch(/!direction \|\| !riskOk \|\| riskSuggestion\.suggested_position_pct <= 0/);
    // EXECUTE só quando o Comitê de Consenso (Ensemble) independente concorda com a direção do Core Engine
    expect(body).toContain('ensembleAgrees');
    expect(body).not.toMatch(/Math\.random/);
  });

  it('o rótulo é explicitamente analítico e nunca aciona execução (READ_ONLY) — mesmo texto de disclaimer usado no resto do sistema', () => {
    const app = read('../src/App.tsx');
    const fnMatch = app.match(/function MarketBiasDecisionCard\(\) \{([\s\S]*?)\n\}\n/);
    const body = fnMatch![1];
    expect(body).toContain('Rótulo analítico — nunca aciona ordens (READ_ONLY)');
    expect(body).toContain('SUGESTÃO ALGORÍTMICA · NÃO É CONSELHO FINANCEIRO');
  });
});

describe('V16 §3 Chart Engine: R1/S1 no gráfico usam força/toques REAIS (passthrough) e rompimentos REAIS (contagem nova, honesta)', () => {
  it('RealCycleResult.supportStrength/resistanceStrength são passthrough puro de frame.support_1_strength/resistance_1_strength — nunca recomputados', () => {
    const bridge = read('../src/engine-bridge.ts');
    expect(bridge).toContain("supportStrength?: { label: 'FORTE' | 'FRACA'; touches: number } | null;");
    expect(bridge).toContain("resistanceStrength?: { label: 'FORTE' | 'FRACA'; touches: number } | null;");
    expect(bridge).toContain('supportStrength: frame.support_1_strength ?? null,');
    expect(bridge).toContain('resistanceStrength: frame.resistance_1_strength ?? null,');
  });

  it('countBreakouts conta closes reais da MESMA janela chartData — nunca Math.random nem uma probabilidade', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('const countBreakouts = (level: number | null, kind: "support" | "resistance"): number =>');
    expect(app).toMatch(/kind === "resistance" \? c\.close > level : c\.close < level/);
    expect(app).not.toMatch(/countBreakouts[\s\S]{0,200}Math\.random/);
  });

  // V18 Sprint 1 (Tarefa B): CandleChart (SVG feito à mão) foi substituído
  // por EnhancedChart_110_Percent (lightweight-charts) — mesmo dado real
  // de força/toques/rompimentos, agora desenhado como price line nativa
  // (createPriceLine) em vez de um <span> posicionado em pixel.
  it('EnhancedChart_110_Percent recebe support/resistance/strength/breakouts e monta o título da price line com a MESMA informação real que o gráfico antigo mostrava', () => {
    const chart = read('../src/chart/EnhancedChart_110_Percent.tsx');
    const propsMatch = chart.match(/interface EnhancedChartProps \{([\s\S]*?)\n\}/);
    expect(propsMatch, 'EnhancedChartProps não encontrado').not.toBeNull();
    expect(propsMatch![1]).toContain('supportStrength?:');
    expect(propsMatch![1]).toContain('resistanceStrength?:');
    expect(propsMatch![1]).toContain('supportBreakouts?:');
    expect(propsMatch![1]).toContain('resistanceBreakouts?:');

    const titleFnMatch = chart.match(/function levelTitle\([\s\S]*?\n\}/);
    expect(titleFnMatch, 'levelTitle não encontrada').not.toBeNull();
    expect(titleFnMatch![0]).toContain('strength.label');
    expect(titleFnMatch![0]).toContain('strength.touches');

    expect(chart).toContain('createPriceLine');
    expect(chart).toContain('levelTitle("S1", supportStrength, supportBreakouts)');
    expect(chart).toContain('levelTitle("R1", resistanceStrength, resistanceBreakouts)');
  });

  it('V18.1 NucleoVoiceOrb: fusão núcleo+voz na barra de comando deriva a cor do MESMO engineStatus real (nunca um score fabricado) e usa o gesto real de voz do voiceEngine', () => {
    const app = read('../src/App.tsx');
    const fnMatch = app.match(/function NucleoVoiceOrb\(\) \{([\s\S]*?)\n\}\n/);
    expect(fnMatch, 'NucleoVoiceOrb não encontrada').not.toBeNull();
    const body = fnMatch![1];
    // Voz: mesmo gesto real do VoiceControlWidget, nunca um botão decorativo.
    expect(body).toContain('voiceEngine.setEnabled(next)');
    expect(body).not.toMatch(/Math\.random/);
    // Montado na TopBar (o "cantinho" ao lado do Power) — sempre visível.
    expect(app).toContain('<NucleoVoiceOrb />');
  });

  it('V-MAX Fase 0.9 (Blueprint §3.4 "100% reativo" / §5.1 "Offline: Orb STALE/âmbar"): o orb nunca mostra SINCRONIZADO se offline real ou dado real desatualizado, mesmo com o último ciclo ok', () => {
    const app = read('../src/App.tsx');
    const fnMatch = app.match(/function NucleoVoiceOrb\(\) \{([\s\S]*?)\n\}\n/);
    expect(fnMatch, 'NucleoVoiceOrb não encontrada').not.toBeNull();
    const body = fnMatch![1];
    // Sinais reais desta fase (Fase 0.4/0.8) — nunca um segundo cálculo de
    // offline/freshness dentro do próprio componente.
    expect(body).toContain('useOfflineSnapshot()');
    expect(body).toContain('useDataFreshSnapshot()');
    // offline é o sinal MAIS autoritativo — checado antes de engineStatus.
    const offlineIdx = body.indexOf('if (offline)');
    const errorIdx = body.indexOf('engineStatus === "error"');
    expect(offlineIdx).toBeGreaterThan(-1);
    expect(errorIdx).toBeGreaterThan(-1);
    expect(offlineIdx).toBeLessThan(errorIdx);
    // "pending" (nunca teve ciclo ainda) nunca é confundido com
    // "desatualizado" (já teve ciclo ok, mas os dados pararam de chegar).
    expect(body).toContain('engineStatus === "ok" && !isDataFresh');
    expect(body).toContain('"DESATUALIZADO"');
    expect(body).toContain('"OFFLINE"');
    expect(body).not.toMatch(/Math\.random/);
  });

  it('"fio de seda" (pedido explícito do Operador): TODAS as price lines são sólidas e finas — nunca pontilhadas/tracejadas', () => {
    const chart = read('../src/chart/EnhancedChart_110_Percent.tsx');
    expect(chart).toContain('LineStyle.Solid');
    expect(chart).not.toContain('LineStyle.Dotted');
    expect(chart).not.toContain('LineStyle.Dashed');
    expect(chart).not.toContain('LineStyle.LargeDashed');
    expect(chart).not.toContain('LineStyle.SparseDotted');
    // lineWidth 1 = o traço mais fino que a lib desenha.
    expect(chart).not.toMatch(/lineWidth: [2-9]/);
  });

  it('"fio de seda" cobre também a price line AUTOMÁTICA da série (último preço) — achado real via harness: a lib usa LineStyle.Dashed por padrão quando priceLineStyle não é explicitado, e nenhum grep por "Dashed" pega uma OMISSÃO', () => {
    const chart = read('../src/chart/EnhancedChart_110_Percent.tsx');
    const seriesMatch = chart.match(/chart\.addSeries\(CandlestickSeries, \{([\s\S]*?)\n    \}\)/);
    expect(seriesMatch, 'chart.addSeries(CandlestickSeries, {...}) não encontrado').not.toBeNull();
    expect(seriesMatch![1]).toContain('priceLineStyle: LineStyle.Solid');
  });

  it('ChartWidget passa engine.support/resistance/strength/breakouts REAIS para EnhancedChart_110_Percent — mesma fonte de sempre, nunca recomputado', () => {
    const app = read('../src/App.tsx');
    const fnMatch = app.match(/function ChartWidget\(\{ chartData \}: any\) \{([\s\S]*?)\n\}\n/);
    expect(fnMatch, 'ChartWidget não encontrada').not.toBeNull();
    const body = fnMatch![1];
    expect(body).toContain('<EnhancedChart_110_Percent');
    expect(body).toContain('support={engine?.support ?? null}');
    expect(body).toContain('resistance={engine?.resistance ?? null}');
    expect(body).toContain('supportStrength={engine?.supportStrength ?? null}');
    expect(body).toContain('resistanceStrength={engine?.resistanceStrength ?? null}');
  });
});

describe('V16 §1: layout — .terminal-grid/.terminal-row usam flexbox (não grid-template-areas); nunca reservam espaço morto', () => {
  it('index.css não usa mais grid-template-areas para o cockpit (named areas reservam espaço mesmo sem elemento)', () => {
    const css = read('../src/index.css');
    // A propriedade CSS real (com dois-pontos) não pode existir — mas o
    // comentário que documenta POR QUE ela foi removida (contexto
    // histórico) tem permissão de citar o nome da propriedade.
    expect(css).not.toMatch(/grid-template-areas:/);
    expect(css).toContain('.terminal-row {');
    expect(css).toContain('display: flex');
  });
});

describe('V16.1 correção crítica (Protocolo TradingView e Gavetas Ocultas): esquerda/direita são OVERLAYS fechados por padrão, o Gráfico nunca divide espaço com elas', () => {
  // O Operador rejeitou a V16 original — as 3 colunas sempre visíveis
  // esmagavam o Gráfico. Esta suíte trava a correção: leftDrawerOpen/
  // rightDrawerOpen começam false (Gráfico ~100% no boot) e
  // .terminal-left/.terminal-right usam position:absolute (excluídas do
  // algoritmo de flex do pai — nunca voltam a disputar largura com
  // .terminal-main, mesmo abertas).
  it('leftDrawerOpen/rightDrawerOpen começam false — nenhuma gaveta aberta no boot', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('const [leftDrawerOpen, setLeftDrawerOpen] = useState(false);');
    expect(app).toContain('const [rightDrawerOpen, setRightDrawerOpen] = useState(false);');
  });

  it('.terminal-left/.terminal-right usam position:absolute (nunca dividem flexbox com .terminal-main) e começam deslocadas para fora da tela (transform translateX)', () => {
    const css = read('../src/index.css');
    const sharedMatch = css.match(/\.terminal-left,\s*\n\.terminal-right \{([\s\S]*?)\n\}/);
    expect(sharedMatch, 'regra combinada .terminal-left/.terminal-right não encontrada').not.toBeNull();
    expect(sharedMatch![1]).toContain('position: absolute');
    expect(css).toMatch(/\.terminal-left \{[\s\S]*?transform: translateX\(-110%\);/);
    expect(css).toMatch(/\.terminal-right \{[\s\S]*?transform: translateX\(110%\);/);
    expect(css).toContain('.drawer-open');
  });

  it('Fase M.1: as réguas de navegação (SideBar/RightRail) abrem cada gaveta via toggleLeftDrawer/toggleRightDrawer; o backdrop e o X do cabeçalho fecham', () => {
    const app = read('../src/App.tsx');
    // As alças soltas na borda do gráfico saíram — cada régua (SideBar à
    // esquerda, RightRail à direita) tem seu próprio NavRailButton
    // dedicado (PanelLeft/PanelRight) que abre a gaveta correspondente,
    // um único mecanismo de acesso em vez de dois.
    expect(app).toContain('icon={PanelLeft}');
    expect(app).toContain('label="Market Intelligence"');
    expect(app).toContain('icon={PanelRight}');
    expect(app).toContain('label="Core Intelligence"');
    expect(app).toContain('onClick={() => toggleLeftDrawer?.()}');
    expect(app).toContain('onClick={() => toggleRightDrawer?.()}');
    expect(app).toContain('terminal-drawer-backdrop');
  });

  it('Fase M.1: "somente um Drawer aberto por vez" — abrir uma gaveta fecha a outra; re-clicar no ícone fecha (toggle)', () => {
    const app = read('../src/App.tsx');
    const toggleLeftMatch = app.match(/const toggleLeftDrawer = useCallback\(\(\) => \{([\s\S]*?)\n {2}\}, \[\]\);/);
    expect(toggleLeftMatch, 'toggleLeftDrawer não encontrado').not.toBeNull();
    expect(toggleLeftMatch![1]).toContain('setRightDrawerOpen(false);');
    expect(toggleLeftMatch![1]).toContain('setLeftDrawerOpen((v) => !v);');
    const toggleRightMatch = app.match(/const toggleRightDrawer = useCallback\(\(\) => \{([\s\S]*?)\n {2}\}, \[\]\);/);
    expect(toggleRightMatch, 'toggleRightDrawer não encontrado').not.toBeNull();
    expect(toggleRightMatch![1]).toContain('setLeftDrawerOpen(false);');
    expect(toggleRightMatch![1]).toContain('setRightDrawerOpen((v) => !v);');
  });

  it('Fase M.1: ESC fecha qualquer gaveta aberta (Desktop)', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('if (e.key !== "Escape") return;');
    expect(app).toContain('document.addEventListener("keydown", onKeyDown);');
    expect(app).toContain('document.removeEventListener("keydown", onKeyDown);');
  });

  it('Fase M.1: réguas de navegação são finas (48-56px), sempre visíveis, sem texto (só ícone + tooltip via title)', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('function NavRailButton({');
    expect(app).toContain('function RightRail() {');
    // 48px (w-12) base / 56px (w-14) em telas maiores — dentro da faixa
    // pedida (48-56px) nos dois breakpoints.
    expect(app).toContain('w-12 md:w-14 border-r border-[#00f0ff20]');
    expect(app).toContain('w-12 md:w-14 border-l border-[#00f0ff20]');
    // NavRailButton usa title (tooltip), nunca um <span> de texto visível.
    const navBtnMatch = app.match(/function NavRailButton\(\{([\s\S]*?)\n\}\n/);
    expect(navBtnMatch, 'NavRailButton não encontrado').not.toBeNull();
    expect(navBtnMatch![1]).toContain('title={label}');
    expect(navBtnMatch![1]).not.toContain('<span');
  });

  it('.terminal-main é o único filho real de .terminal-row no fluxo — flex:1, sem "order" nem largura fixa disputando espaço', () => {
    const css = read('../src/index.css');
    const rowMatch = css.match(/\.terminal-row \{([\s\S]*?)\n\}/);
    expect(rowMatch, '.terminal-row não encontrado').not.toBeNull();
    expect(rowMatch![1]).not.toContain('order:');
    const mainMatch = css.match(/\.terminal-main \{([\s\S]*?)\n\}/);
    expect(mainMatch, '.terminal-main não encontrado').not.toBeNull();
    expect(mainMatch![1]).toContain('flex: 1');
    expect(mainMatch![1]).not.toContain('order:');
  });
});

describe('Fusão visual (imagem de referência AR10 CYBORG v15.1 GOD TIER): SideBar renomeada, ganho circular do Siriform, DIREÇÃO/GESTÃO DE POSIÇÃO em cards separados', () => {
  it('SideBar desacopla id (roteamento real) de label (texto exibido) — só DASHBOARD/SETTINGS continuam com comportamento próprio', () => {
    const app = read('../src/App.tsx');
    const itemsMatch = app.match(/const items: \{ icon: any; id: string; label: string \}\[\] = \[([\s\S]*?)\n {2}\];/);
    expect(itemsMatch, 'items do SideBar não encontrado').not.toBeNull();
    const body = itemsMatch![1];
    expect(body).toContain('id: "DASHBOARD", label: "COCKPIT"');
    expect(body).toContain('id: "SETTINGS", label: "CONFIGURAÇÕES"');
    // o roteamento real (App(), ternário do activeTab) continua comparando
    // contra as strings originais — a troca de label nunca pode quebrá-lo.
    expect(app).toContain('activeTab === "DASHBOARD" ?');
    expect(app).toContain('activeTab === "SETTINGS" ?');
    expect(app).toContain('onClick={() => setActiveTab(item.id)}');
  });

  it('SiriformCoreCard: anel de sincronização é derivado de engineStatus (a MESMA variável do statusLabel ao lado) — nunca uma % fabricada', () => {
    const app = read('../src/App.tsx');
    const fnMatch = app.match(/function SiriformCoreCard\(\) \{([\s\S]*?)\n\}\n/);
    expect(fnMatch, 'SiriformCoreCard não encontrada').not.toBeNull();
    const body = fnMatch![1];
    expect(body).toContain('const syncPct = engineStatus === "ok" ? 100 : engineStatus === "error" ? 0 : null;');
    expect(body).toContain('conic-gradient');
    // "pending" nunca vira uma porcentagem inventada — só o anel indeterminado.
    expect(body).not.toMatch(/syncPct = engineStatus === "pending" \? \d/);
  });

  it('MarketBiasDecisionCard renderiza DIREÇÃO e GESTÃO DE POSIÇÃO como 2 cyber-panels distintos (imagem de referência), mesmos campos reais de antes', () => {
    const app = read('../src/App.tsx');
    const fnMatch = app.match(/function MarketBiasDecisionCard\(\) \{([\s\S]*?)\n\}\n/);
    expect(fnMatch, 'MarketBiasDecisionCard não encontrada').not.toBeNull();
    const body = fnMatch![1];
    const panelCount = (body.match(/className="cyber-panel shrink-0 flex flex-col gap-2 p-3"/g) ?? []).length;
    expect(panelCount).toBe(2);
    expect(body).toContain('>DIREÇÃO<');
    expect(body).toContain('GESTÃO DE POSIÇÃO');
    // a alavancagem sugerida e o slider de quantidade/botão "TRADE
    // ASSISTIDO" da imagem de referência continuam FORA — READ_ONLY
    // permanente, sem caminho de execução em lugar nenhum do código.
    expect(app).not.toMatch(/alavancagem sugerida/i);
    expect(app).not.toContain('TRADE ASSISTIDO');
  });
});
