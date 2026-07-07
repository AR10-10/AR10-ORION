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

  it('CandleChart recebe support/resistance/strength/breakouts e desenha R1/S1 com a MESMA convenção visual das zonas de liquidez (linha tracejada + badge)', () => {
    const app = read('../src/App.tsx');
    const sigMatch = app.match(/function CandleChart\(\{([\s\S]*?)\n\}\) \{/);
    expect(sigMatch, 'assinatura de CandleChart não encontrada').not.toBeNull();
    expect(sigMatch![1]).toContain('resistanceStrength?:');
    expect(sigMatch![1]).toContain('supportBreakouts?:');

    const bodyMatch = app.match(/function CandleChart\(\{[\s\S]*?\n\}\) \{([\s\S]*?)\nconst CandlesSvg/);
    expect(bodyMatch, 'corpo de CandleChart não encontrado').not.toBeNull();
    expect(bodyMatch![1]).toContain('R1 {fmtInt(resistance)}');
    expect(bodyMatch![1]).toContain('S1 {fmtInt(support)}');
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

  it('dois botões discretos (PanelLeft/PanelRight) nas bordas ABREM cada gaveta e desaparecem enquanto ela está aberta; o backdrop e o X do cabeçalho fecham', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('<PanelLeft size={14} />');
    expect(app).toContain('<PanelRight size={14} />');
    // Achado real do Operador: com a alça sempre visível E fixa no centro
    // vertical de .terminal-row (não da gaveta), abrir uma gaveta curta
    // (agora abraçando a altura do conteúdo) deixava a alça flutuando
    // sozinha fora dela. A alça some enquanto a própria gaveta está
    // aberta — abrir é só {!leftDrawerOpen && <button onClick={() =>
    // setLeftDrawerOpen(true)}>...
    expect(app).toContain('{!leftDrawerOpen && (');
    expect(app).toContain('onClick={() => setLeftDrawerOpen(true)}');
    expect(app).toContain('{!rightDrawerOpen && (');
    expect(app).toContain('onClick={() => setRightDrawerOpen(true)}');
    expect(app).toContain('terminal-drawer-backdrop');
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
