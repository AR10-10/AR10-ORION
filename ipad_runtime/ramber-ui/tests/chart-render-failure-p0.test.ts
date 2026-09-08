// chart-render-failure-p0.test.ts — ORDEM 2B (P0 CHART RENDER FAILURE) /
// ORDEM 2B.1 (VALIDAR DEFINITIVAMENTE O FIX): trava o achado real e a
// correção real do "BTC/USDT · ERRO DE RENDERIZAÇÃO" reportado no iPad.
//
// DIAGNÓSTICO CORRIGIDO (ORDEM 2B.1 — a versão anterior desta suíte, como
// o comentário que ela travava em EnhancedChart_110_Percent.tsx, citava
// incorretamente "React error #185, Cannot update a component while
// rendering a different component"): a exceção real, reproduzida ao vivo
// (Playwright, fixture de candles — nunca dado de mercado real, semeado
// direto no IndexedDB local, mesma trilha que o app usa pra "Local-First
// instant paint" — em DEV e em produção, não um artefato de StrictMode) é
// **"Maximum update depth exceeded"** (nestedUpdateCount > 50,
// getRootForUpdatedFiber em react-dom) — a assinatura de um LOOP real de
// atualizações. "Cannot update a component..." é um `console.error`
// distinto, não-lançável, de outro caminho de código
// (scheduleUpdateOnFiber) — nunca observado nesta investigação.
//
// CAUSA RAIZ REAL: várias populações de zona em App.tsx
// (unmitigatedFvgs/unmitigatedBlocks/unmitigatedVoids/breakerZones/
// mitigationZones/unsweptLiquidity) eram `const` soltos — `.filter()`/
// `.map()` executados a CADA render, sempre com uma referência NOVA mesmo
// com o mesmo conteúdo. EnhancedChart_110_Percent é React.memo — receber
// referência nova nessas props a cada render de App derrotava o memo,
// forçava institutionalZoneInput/institutionalZones (useMemo) a
// recomputar, o que disparava o useEffect que publica institutionalZones
// na store (useUnifiedSnapshotStore) — e App (a própria ANCESTRAL deste
// componente) assina esse mesmo slice via useInstitutionalZonesSnapshot().
// A escrita re-renderizava App, que recomputava os mesmos `.filter()`
// soltos de novo, produzindo outra referência nova: um ciclo
// autossustentado que nunca precisava de dado novo de mercado — capturado
// pelo WidgetErrorBoundary do painel "chart" (título dinâmico
// `${selectedAsset}/USDT`).
//
// A correção real (ORDEM 2B.1, "não aceitar um fix que apenas posterga
// writes infinitos") tem DUAS camadas, cada uma travada nesta suíte:
//   1. App.tsx memoiza agora aquela cadeia pelas dependências REAIS
//      (smcZones/liquidityVoids/institutionalBlocks/chartObstacleZones/
//      livePrice.price/chartAtrPercent) — a referência só muda quando o
//      dado real por trás dela muda.
//   2. setInstitutionalZones (unified-snapshot-store.ts) ganhou uma guarda
//      de igualdade REAL (institutionalZonesEqual,
//      nexus/institutional-zones.ts, testada por execução real em
//      institutional-zones-equality.test.ts e institutional-zones-store-
//      wiring.test.ts) — mesmo que uma referência nova chegue por
//      qualquer razão futura, o `set()` só toca o state quando o CONTEÚDO
//      mudou de verdade.
// `queueMicrotask` (ORDEM 2B) foi REMOVIDO: só adiava o ciclo, nunca o
// corrigia — escrita síncrona dentro de useEffect nunca foi o problema
// (roda depois do commit, nunca durante o render).
//
// Esta suíte não pode montar/derrubar EnhancedChart_110_Percent de verdade
// (não existe @testing-library/react/jsdom neste repo) — trava por PADRÃO
// DE CÓDIGO a parte que só existe em App.tsx/EnhancedChart_110_Percent.tsx
// (mesma disciplina de global-error-boundary-wiring.test.ts), e por
// EXECUÇÃO REAL a parte que é lógica pura de fronteira (a guarda de
// igualdade em si, coberta em institutional-zones-equality.test.ts +
// institutional-zones-store-wiring.test.ts).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), "utf8");

describe("EnhancedChart_110_Percent.tsx: setInstitutionalZones — diagnóstico corrigido, zero deferimento por timing", () => {
  const src = () => read("../src/chart/EnhancedChart_110_Percent.tsx");

  it("a escrita real na store voltou a ser síncrona dentro do useEffect — queueMicrotask (ORDEM 2B, só adiava o loop) foi removido", () => {
    const s = src();
    // O NOME queueMicrotask ainda aparece em comentários explicando o que
    // foi removido e por quê (memória evolutiva real) — o que não pode
    // mais existir é a CHAMADA executável.
    expect(s).not.toMatch(/queueMicrotask\(/);
    const idx = s.indexOf("setInstitutionalZones(institutionalZones)");
    expect(idx, "chamada real de setInstitutionalZones não encontrada").toBeGreaterThan(-1);
    const bloco = s.slice(Math.max(0, idx - 80), idx + 110);
    expect(bloco).toMatch(/useEffect\(\(\) => \{\s*useUnifiedSnapshotStore\.getState\(\)\.setInstitutionalZones\(institutionalZones\);\s*\}, \[institutionalZones\]\);/);
  });

  it("o diagnóstico documentado no arquivo é 'Maximum update depth exceeded' — nunca mais 'React error #185'", () => {
    const s = src();
    expect(s).toContain("Maximum update depth exceeded");
    // A única menção a "#185" que pode sobreviver é a que EXPLICA o
    // diagnóstico anterior errado, nunca uma que o reafirme como causa.
    const idx = s.indexOf("#185");
    if (idx > -1) {
      const bloco = s.slice(Math.max(0, idx - 200), idx + 100);
      expect(bloco).toMatch(/nunca|diagnóstico corrigido|errado/i);
    }
  });

  it("só existe UM ponto de escrita real de institutionalZones neste arquivo — nunca uma segunda chamada desprotegida introduzida em paralelo", () => {
    const s = src();
    const ocorrencias = s.split("setInstitutionalZones(institutionalZones)").length - 1;
    expect(ocorrencias).toBe(1);
  });
});

describe("App.tsx: cadeia de zonas (fairValueGaps/orderBlocks/liquidityZones/breaker/mitigation) memoizada pelas dependências reais", () => {
  const src = () => read("../src/App.tsx");

  it("unmitigatedFvgs/unmitigatedBlocks/unmitigatedVoids/breakerZones/mitigationZones/unsweptLiquidity vêm de um ÚNICO useMemo, não de `const` soltos recomputados a cada render", () => {
    const s = src();
    const destructIdx = s.indexOf(
      "const {\n    unmitigatedFvgs,\n    unmitigatedBlocks,\n    unmitigatedVoids,\n    breakerZones,\n    mitigationZones,\n    unsweptLiquidity,\n  } = useMemo(() => {",
    );
    expect(destructIdx, "destructuring do useMemo real não encontrado").toBeGreaterThan(-1);
  });

  it("a dependência real do useMemo é a fonte primária dos dados (smcZones/liquidityVoids/institutionalBlocks/chartObstacleZones/livePrice.price/chartAtrPercent) — nunca as populações intermediárias já filtradas", () => {
    const s = src();
    expect(s).toContain("}, [smcZones, liquidityVoids, institutionalBlocks, chartObstacleZones, livePrice.price, chartAtrPercent]);");
  });
});

describe("App.tsx: WidgetErrorBoundary captura e mostra o erro real (achado independente do diagnóstico #185, continua válido)", () => {
  const src = () => read("../src/App.tsx");

  it("componentDidCatch real existe e loga no console — a próxima falha real fica diagnosticável, nunca só o texto genérico", () => {
    const s = src();
    expect(s).toContain("componentDidCatch(error: Error, info: React.ErrorInfo)");
    expect(s).toContain("console.error(`[WidgetErrorBoundary]");
  });

  it("o estado guarda o Error real (não só um boolean) — mesmo padrão já usado por GlobalErrorBoundary, reaproveitado", () => {
    const s = src();
    expect(s).toContain("interface WidgetErrorBoundaryState {\n  error: Error | null;\n}");
    expect(s).toContain("static getDerivedStateFromError(error: Error): WidgetErrorBoundaryState {\n    return { error };\n  }");
  });

  it("a mensagem real do erro aparece na tela de fallback quando existe — nunca escondida só no console", () => {
    const s = src();
    // Âncora na renderização real (JSX), não no comentário explicativo
    // acima dela — a mesma string aparece nos dois lugares.
    // Frente 3 §17 (padronização de idioma): texto traduzido pra English Technical.
    const idx = s.indexOf('{this.props.title || "PANEL"} · RENDER ERROR');
    expect(idx).toBeGreaterThan(-1);
    const bloco = s.slice(idx, idx + 500);
    expect(bloco).toContain("this.state.error.message");
  });

  it("ORDEM DE SERVIÇO FINAL (auto-cura): dá ao Operador um retry manual, sem recarregar a página inteira", () => {
    const s = src();
    expect(s).toContain("handleRetry = () => this.setState({ error: null });");
    expect(s).toContain("onClick={this.handleRetry}");
  });
});
