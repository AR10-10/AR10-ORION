// publication-formats-wiring.test.ts — Ordem "AR10 PUBLICATION STUDIO"
// §1/§4/§6/§10: travas de padrão-de-fonte (fiação/composição, não
// matemática) — nenhum dos 4 formatos consulta motor de novo, nenhum
// desenha overlay de contexto do terminal (a hierarquia do §4 é garantida
// pela AUSÊNCIA estrutural desses overlays, não por uma dimensão de peso
// visual), e as dimensões de export batem com a especificação real de
// plataforma.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');

describe('formats.ts: as 4 render* funções são PURA composição — zero segunda consulta a motor/decision', () => {
  const src = read('../src/publication/formats.ts');

  it('assinatura de cada render* é (ctx, snapshot) — nunca um parâmetro extra que poderia carregar leitura independente', () => {
    expect(src).toContain('export function renderAnalysis(ctx: CanvasRenderingContext2D, snapshot: PublicationSnapshot): void {');
    expect(src).toContain('export function renderStory(ctx: CanvasRenderingContext2D, snapshot: PublicationSnapshot): void {');
    expect(src).toContain('export function renderX(ctx: CanvasRenderingContext2D, snapshot: PublicationSnapshot): void {');
    expect(src).toContain('export function renderPremium(ctx: CanvasRenderingContext2D, snapshot: PublicationSnapshot): void {');
  });

  it('nunca importa buildMarketAnalysis/buildNexusDecision/engine-bridge — só o TIPO MarketAnalysis e a tradução pública já existente PUBLIC_BIAS_LABEL', () => {
    expect(src).not.toContain('buildMarketAnalysis');
    expect(src).not.toContain('buildNexusDecision');
    expect(src).not.toContain('engine-bridge');
    expect(src).toContain('import { PUBLIC_BIAS_LABEL } from "../nexus/market-analysis";');
  });

  it('nunca busca rede (fetch/XMLHttpRequest/axios) — composição pura sobre dado já em memória', () => {
    expect(src).not.toContain('fetch(');
    expect(src).not.toContain('XMLHttpRequest');
    expect(src).not.toContain('axios');
  });

  it('cada formato lê analysis.plan/bias/confluence/risk direto do snapshot — nunca uma variável local recalculando entry/stop/target', () => {
    // toMiniChartPlan é o ÚNICO adaptador (mapeia analysis.plan/corePlan ->
    // formato esperado pelo mini-gráfico) — nunca uma segunda fórmula de
    // preço. Correção Definitiva §5: dentro do guard `if (analysis.plan)`
    // já narrowed, então lê `analysis.plan.entryLow` direto (sem `?.`), e o
    // fallback do Núcleo (`analysis.corePlan`) usa a MESMA leitura direta.
    expect(src).toContain('entryLow: analysis.plan.entryLow,');
    expect(src).toContain('stopPrice: analysis.plan.invalidationPrice,');
    expect(src).toContain('stopPrice: cp.stop, targets, livePrice');
    expect(src).not.toMatch(/entryLow\s*=\s*analysis\.plan\.entryLow\s*[+\-*/]/);
    expect(src).not.toMatch(/invalidationPrice\s*[+\-*/]/);
  });
});

// Remove comentários antes de varrer por overlays proibidos — o próprio
// cabeçalho de mini-chart.ts NOMEIA VWAP/EMA/sessão/sweep/BOS-CHOCH/
// Fibonacci ao EXPLICAR por que eles ficam de fora (documentação honesta
// da decisão), o que faria uma varredura ingênua do texto inteiro do
// arquivo achar um falso positivo dentro da própria explicação. O teste
// real é sobre CÓDIGO executável, nunca sobre a prosa que descreve o
// código.
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n');
}

describe('Hierarquia (§4): nenhum overlay de contexto do terminal é desenhado na composição publicável', () => {
  const chartSrc = stripComments(read('../src/publication/mini-chart.ts'));
  const formatsSrc = stripComments(read('../src/publication/formats.ts'));
  const combined = `${chartSrc}\n${formatsSrc}`;

  it('candles + Entry/Stop/Target são os ÚNICOS elementos de mercado desenhados — nenhuma referência a VWAP/EMA/sessão/sweep/BOS-CHOCH/Fibonacci/zona institucional', () => {
    const forbidden = [
      /vwap/i,
      /\bema\b/i,
      /session/i,
      /sweep/i,
      /bos.?choch/i,
      /fibonacci/i,
      /institutional.?zone/i,
      /liquidity.?zone/i,
      /trendChannel/i,
    ];
    for (const pattern of forbidden) {
      expect(combined).not.toMatch(pattern);
    }
  });
});

describe('types.ts: dimensões reais de export por plataforma (não estilo copiado — especificação de pixel)', () => {
  const src = read('../src/publication/types.ts');

  it('ANALYSIS 16:9 Full HD, STORY 9:16 nativo de Stories, X 16:9 compacto, PREMIUM 1:1', () => {
    expect(src).toContain('ANALYSIS: { width: 1920, height: 1080, label: "Market Terminal", needsChart: true },');
    expect(src).toContain('STORY: { width: 1080, height: 1920, label: "Story", needsChart: true },');
    expect(src).toContain('X: { width: 1200, height: 675, label: "X", needsChart: true },');
    expect(src).toContain('PREMIUM: { width: 1080, height: 1080, label: "Premium", needsChart: false },');
  });

  it('PREMIUM é o único sem gráfico (§2-D não lista "gráfico" no conteúdo) — os outros 3 exigem', () => {
    const specMatch = src.match(/PUBLICATION_FORMAT_SPECS[\s\S]*?=\s*\{([\s\S]*?)\};/);
    expect(specMatch, 'PUBLICATION_FORMAT_SPECS não encontrado').not.toBeNull();
    const body = specMatch![1];
    const needsChartTrueCount = (body.match(/needsChart: true/g) ?? []).length;
    const needsChartFalseCount = (body.match(/needsChart: false/g) ?? []).length;
    expect(needsChartTrueCount).toBe(3);
    expect(needsChartFalseCount).toBe(1);
  });
});

describe('generate.ts: gate ANTES de desenhar (§5) — um formato bloqueado nunca chega a alocar canvas', () => {
  const src = read('../src/publication/generate.ts');

  it('renderPublicationAssets filtra por canPublishFormat antes de qualquer render', () => {
    const idx = src.indexOf('export async function renderPublicationAssets');
    expect(idx).toBeGreaterThan(-1);
    const body = src.slice(idx, idx + 400);
    expect(body).toContain('PUBLICATION_FORMAT_ORDER.filter((f) => canPublishFormat(f, snapshot));');
  });

  it('cada asset carrega o nome de arquivo real (buildPublicationFilename), nunca um nome genérico fixo', () => {
    expect(src).toContain('filename: buildPublicationFilename(snapshot.analysis.symbol, snapshot.analysis.timeframe, snapshot.analysis.generatedAt, format),');
  });

  it('revokePublicationAssets existe — nenhum object URL fica vazando memória entre gerações', () => {
    expect(src).toContain('export function revokePublicationAssets(assets: PublicationAsset[]): void {');
    expect(src).toContain('URL.revokeObjectURL(a.objectUrl)');
  });
});

// ═══ REGRESSÃO REAL: o aviso legal sumiu de METADE das peças ═══
//
// Achado desta rodada (pedido do Operador: "o nome lá embaixo que não é
// recomendação de investimento tem que estar perfeito também"): o aviso
// estava escrito à mão em renderAnalysis e renderStory, e SIMPLESMENTE
// AUSENTE em renderX e renderPremium — os dois formatos de rede social.
// Metade das peças publicáveis saía sem o aviso.
//
// A causa era estrutural (cada formato reescrevia a marca à mão), então a
// correção também é: uma primitiva única (drawBrandLockup) + estes testes,
// que quebram se qualquer formato voltar a escrever a marca sozinho.
describe('Aviso legal: presente em TODAS as 4 peças, sempre — nunca escrito à mão por formato', () => {
  const src = read('../src/publication/formats.ts');
  const primitives = read('../src/publication/canvas-primitives.ts');

  it('o texto do aviso existe em UM só lugar (canvas-primitives), nunca literal dentro de formats.ts', () => {
    expect(primitives).toContain('export const PUBLICATION_DISCLAIMER = "confluência real, não é recomendação de investimento";');
    // Nenhum formato pode reescrever o texto à mão — se reescrever, some
    // do controle único e volta a poder faltar num deles.
    const handWritten = src.split('\n').filter(
      (l) => l.includes('não é recomendação de investimento') && !l.includes('//'),
    );
    expect(handWritten, `aviso escrito à mão em formats.ts: ${handWritten.join(' | ')}`).toHaveLength(0);
  });

  it('cada uma das 4 render* alcança o aviso (drawBrandLockup ou drawBrandFooter)', () => {
    const bodies: Array<[string, string]> = [
      ['renderAnalysis', 'export function renderAnalysis'],
      ['renderStory', 'export function renderStory'],
      ['renderX', 'export function renderX'],
      ['renderPremium', 'export function renderPremium'],
    ];
    const starts = bodies.map(([name, marker]) => {
      const i = src.indexOf(marker);
      expect(i, `${name} não encontrado`).toBeGreaterThan(-1);
      return [name, i] as [string, number];
    });
    starts.forEach(([name, start], idx) => {
      const end = idx + 1 < starts.length ? starts[idx + 1][1] : src.length;
      const body = src.slice(start, end);
      const reaches = body.includes('drawBrandLockup(') || body.includes('drawBrandFooter(');
      expect(reaches, `${name} não alcança o aviso legal`).toBe(true);
    });
  });

  it('drawBrandFooter (usado pelo formato Análise) carrega o aviso da constante única', () => {
    expect(src).toContain('drawText(ctx, `AR10 CYBORG · ${PUBLICATION_DISCLAIMER}`');
  });

  it('drawBrandLockup SEMPRE desenha marca E aviso — nunca só a marca', () => {
    const start = primitives.indexOf('export function drawBrandLockup');
    const body = primitives.slice(start, primitives.indexOf('\n}', start));
    expect(body).toContain('PUBLICATION_BRAND');
    expect(body).toContain('PUBLICATION_DISCLAIMER');
  });
});

describe('Acabamento visual: o efeito carrega o VIÉS real, nunca decoração neutra', () => {
  const src = read('../src/publication/formats.ts');

  it('as 4 peças pintam a aura/acento na cor do viés já resolvido', () => {
    expect(src.match(/paintDirectionalAura\(ctx, width, height, color\)/g) ?? []).toHaveLength(4);
    expect(src.match(/paintAccentEdge\(ctx, width, height, color\)/g) ?? []).toHaveLength(4);
  });

  it('a cor da aura vem de biasColor (o viés real), nunca um hex escolhido à mão', () => {
    // Asserção de INTENÇÃO, não de contagem: a 1ª versão deste teste exigia
    // exatamente 4 ocorrências e quebrou quando renderPremium virou 2
    // passadas (uma 5ª ocorrência legítima em premiumBody). Contagem fixa
    // trava refatoração honesta sem provar nada a mais — o que importa é
    // que TODA atribuição de `color` venha de biasColor.
    const assignments = src.match(/const color = [^;]+;/g) ?? [];
    expect(assignments.length).toBeGreaterThanOrEqual(4);
    for (const a of assignments) {
      expect(a, `atribuição de cor fora de biasColor: ${a}`).toBe('const color = biasColor(analysis.bias);');
    }
  });
});

describe('Chip de padrão de vela: dado real do snapshot, nunca recalculado no renderer', () => {
  const src = read('../src/publication/formats.ts');

  it('lê snapshot.candlePattern — nunca chama o motor de padrões dentro do formato', () => {
    expect(src).toContain('const p = snapshot.candlePattern;');
    expect(src).not.toContain('candlestick-patterns');
    expect(src).not.toContain('computeCandlePatterns');
  });

  it('fail-closed: sem padrão real, nada é desenhado', () => {
    expect(src).toContain('if (!p) return 0;');
  });

  it('doji (direção null) nunca é pintado de verde nem vermelho', () => {
    const start = src.indexOf('function patternChipColor');
    const body = src.slice(start, src.indexOf('\n}', start));
    expect(body).toContain('PUB_COLORS.neutral');
  });

  it('o chip nunca exibe taxa de acerto/probabilidade (Regra de Ouro 2)', () => {
    const start = src.indexOf('function patternChipText');
    const body = src.slice(start, src.indexOf('\n}', start));
    expect(body).not.toMatch(/%/);
    expect(body).not.toMatch(/probab|winRate|acerto/i);
  });
});
