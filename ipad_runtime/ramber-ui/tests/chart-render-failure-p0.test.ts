// chart-render-failure-p0.test.ts — ORDEM 2B (P0 CHART RENDER FAILURE):
// trava o achado real e a correção real do "BTC/USDT · ERRO DE
// RENDERIZAÇÃO" reportado no iPad.
//
// CAUSA RAIZ, reproduzida ao vivo (Playwright, fixture de candles — nunca
// dado de mercado real, semeado direto no IndexedDB local, mesma trilha
// que o app usa pra "Local-First instant paint" — em DEV e em produção,
// não um artefato de StrictMode): React error #185 ("Cannot update a
// component while rendering a different component"). O efeito de
// EnhancedChart_110_Percent.tsx que publica `institutionalZones` na store
// (useUnifiedSnapshotStore) escrevia SINCRONAMENTE dentro do useEffect —
// e App.tsx (o próprio ANCESTRAL deste componente) assina esse mesmo
// slice via useInstitutionalZonesSnapshot(). No PRIMEIRO mount real do
// gráfico (chartData vazio → populado), esse write colidia com o flush de
// efeitos passivos da MESMA commit que estava montando App→...→o
// gráfico, e React derrubava o render inteiro — capturado pelo
// WidgetErrorBoundary do painel "chart" (título dinâmico
// `${selectedAsset}/USDT`).
//
// Esta suíte não pode executar o cenário completo (não existe
// @testing-library/react/jsdom neste repo para montar e derrubar
// EnhancedChart_110_Percent de verdade) — trava por PADRÃO DE CÓDIGO,
// mesma disciplina de global-error-boundary-wiring.test.ts: garante que a
// correção real (queueMicrotask) e o diagnóstico real (componentDidCatch)
// continuam no arquivo, e nunca removidos por engano numa edição futura.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), "utf8");

describe("EnhancedChart_110_Percent.tsx: setInstitutionalZones nunca mais escreve na store sincronamente dentro do useEffect", () => {
  const src = () => read("../src/chart/EnhancedChart_110_Percent.tsx");

  it("a escrita real na store é adiada via queueMicrotask — nunca um setState síncrono competindo com o flush de efeitos da commit de mount", () => {
    const s = src();
    const idx = s.indexOf("setInstitutionalZones(institutionalZones)");
    expect(idx, "chamada real de setInstitutionalZones não encontrada").toBeGreaterThan(-1);
    // A chamada precisa estar dentro do corpo de um queueMicrotask(() => {...})
    // no MESMO useEffect — busca pelo padrão real, não por uma string solta
    // que um comentário também poderia conter (mesma disciplina de
    // "comentário vs. executável" já usada em todo este repositório).
    const bloco = s.slice(Math.max(0, idx - 400), idx + 60);
    expect(bloco).toMatch(/useEffect\(\(\) => \{\s*queueMicrotask\(\(\) => \{/);
  });

  it("só existe UM ponto de escrita real de institutionalZones neste arquivo — nunca uma segunda chamada desprotegida introduzida em paralelo", () => {
    const s = src();
    const ocorrencias = s.split("setInstitutionalZones(institutionalZones)").length - 1;
    expect(ocorrencias).toBe(1);
  });
});

describe("App.tsx: WidgetErrorBoundary agora captura e mostra o erro real (era descartado por completo antes desta ordem)", () => {
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
    const idx = s.indexOf('{this.props.title || "PAINEL"} · ERRO DE RENDERIZAÇÃO');
    expect(idx).toBeGreaterThan(-1);
    const bloco = s.slice(idx, idx + 500);
    expect(bloco).toContain("this.state.error.message");
  });
});
