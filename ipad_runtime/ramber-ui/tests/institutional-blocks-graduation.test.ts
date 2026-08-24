// GRADUAÇÃO de institutional-blocks.js — Breaker / Mitigation Block.
//
// O motor e sua suíte de EXECUÇÃO REAL (institutional-blocks.test.ts, 24
// casos) existiam desde a entrega anterior e nunca tinham chegado ao
// sistema ao vivo: `grep` confirmava ZERO importadores. Um motor correto
// que ninguém consome não é inteligência entregue — é código morto com
// testes verdes.
//
// Este arquivo trava a GRADUAÇÃO (a regra do QUARANTINE.md: ligado ao
// sistema real via engine-bridge.ts, documentado, e chegando de fato à
// tela). Convenção do projeto: aqui o bug provável é "esqueceram de
// conectar A com B" — a matemática já tem sua própria suíte de execução
// real —, então isto é teste de padrão no código-fonte.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(__dirname, p), "utf-8");
const bridge = () => read("../src/engine-bridge.ts");
const app = () => read("../src/App.tsx");
const chart = () => read("../src/chart/EnhancedChart_110_Percent.tsx");
const plugin = () => read("../src/chart/LiquidityZonesPlugin.tsx");

describe("o motor deixou de ter zero importadores", () => {
  it("engine-bridge importa o motor real, nunca uma segunda implementação", () => {
    const src = bridge();
    expect(src).toContain("from '../../src/research/engines/institutional-blocks.js'");
    expect(src).toContain("export function computeInstitutionalBlocks(");
  });

  it("o wrapper é fino — classifica nada, só repassa o que o motor devolveu", () => {
    const src = bridge();
    const i = src.indexOf("export function computeInstitutionalBlocks(");
    const corpo = src.slice(i, src.indexOf("\n}", i));
    expect(corpo).toContain("analyzeInstitutionalBlocks({ ohlcv_series: candles })");
    expect(corpo).toContain("return result.blocks;");
    // Nenhuma regra de negócio duplicada no bridge.
    expect(corpo).not.toContain("BREAKER");
    expect(corpo).not.toContain("swept");
  });

  it("fail-closed: sem leitura real, lista vazia — nunca um bloco fabricado", () => {
    const src = bridge();
    const i = src.indexOf("export function computeInstitutionalBlocks(");
    expect(src.slice(i, i + 900)).toContain("if (result.status !== 'OK') return [];");
  });
});

describe("computado contra o MESMO array de candles que o gráfico desenha", () => {
  it("o memo do App usa chartData, igual a computeSmcZones/computeLiquidityVoids", () => {
    const src = app();
    expect(src).toContain("const institutionalBlocks = useMemo<InstitutionalBlock[]>(");
    expect(src).toMatch(
      /institutionalBlocks = useMemo<InstitutionalBlock\[\]>\([\s\S]{0,300}chartData && chartData\.length > 0 \? computeInstitutionalBlocks\(chartData\) : \[\]/,
    );
  });

  it("passa pelo contexto até o widget do gráfico — nunca recomputado lá dentro", () => {
    const src = app();
    expect(src).toContain("institutionalBlocks,"); // valor + dep array do provider
    expect(src).toContain("liquidityVoids, institutionalBlocks, selectedAsset");
    // Um segundo computeInstitutionalBlocks seria uma segunda fonte da
    // mesma leitura — exatamente o que o memo elevado existe para evitar.
    expect(src.match(/computeInstitutionalBlocks\(/g)).toHaveLength(1);
  });
});

describe("chega à tela pelo canvas que já existe — zero arquitetura nova", () => {
  it("nenhum canvas novo, nenhum loop de rAF novo", () => {
    // Um 17º canvas seria mais um ResizeObserver e mais um loop no main
    // thread, contra Regra de Ouro 6/7 e o "deixa o sistema leve".
    const src = plugin();
    expect(src).toContain('drawGroup(breakers ?? [], undefined, "BREAKER", "BULLISH");');
    expect(src).toContain('drawGroup(mitigations ?? [], undefined, "MITIGATION", "BEARISH");');
    // Um único elemento <canvas> real no arquivo, como antes. Contado pelo
    // ref (forma executável) e não pela string "<canvas", que aparece de
    // propósito nos comentários de arquitetura deste mesmo arquivo.
    expect(src.match(/useRef<HTMLCanvasElement \| null>/g)).toHaveLength(1);
    expect(src.match(/requestAnimationFrame\(/g)).toHaveLength(1);
  });

  it("as props chegam ao plugin com fallback estável, nunca array literal por render", () => {
    const src = chart();
    expect(src).toMatch(/breakerBlocks=\{.*breakerBlocks \?\? NO_FILLABLE_ZONES.*\}/);
    expect(src).toMatch(/mitigationBlocks=\{.*mitigationBlocks \?\? NO_FILLABLE_ZONES.*\}/);
  });

  it("entram no ref/dep array do dirty-flag — um bloco novo nunca fica invisível", () => {
    const src = plugin();
    const refInicial = src.match(/const zonesRef = useRef\(\{([^}]*)\}/)?.[1] ?? "";
    const espelho = src.match(/zonesRef\.current = \{([^}]*)\}/)?.[1] ?? "";
    const deps = src.match(/markDirtyRef\.current\?\.\(\);\s*\}, \[([^\]]*)\]/)?.[1] ?? "";
    for (const prop of ["breakerBlocks", "mitigationBlocks"]) {
      expect(refInicial, `${prop} fora do ref inicial`).toContain(prop);
      expect(espelho, `${prop} fora do espelho por render`).toContain(prop);
      expect(deps, `${prop} fora do dep array`).toContain(prop);
    }
  });
});

describe("a direção exibida é a OPERACIONAL, não a polaridade original", () => {
  it("o App traduz direction (ALTA/BAIXA), nunca originType", () => {
    // Este é o ponto onde o Breaker é fácil de errar: ele INVERTE a
    // polaridade do Order Block original. Desenhar `originType` mostraria a
    // zona empurrando exatamente para o lado CONTRÁRIO ao real.
    const src = app();
    expect(src).toContain('type: (b.direction === "ALTA" ? "BULLISH" : "BEARISH")');
    expect(src).not.toContain("b.originType");
  });

  it("a âncora temporal é a falha do bloco, não a formação do OB original", () => {
    // O retângulo começa onde o bloco FALHOU — antes disso ele ainda era um
    // Order Block comum, e o motor base já o desenha nesse papel.
    expect(app()).toContain("index: b.failIndex,");
  });
});

describe("recortes antes do canvas — declarados, nunca silenciosos", () => {
  it("só blocos ainda NÃO retestados disputam espaço no gráfico", () => {
    const src = app();
    expect(src).toContain("(institutionalBlocks ?? []).filter((b: InstitutionalBlock) => !b.retested)");
  });

  it("teto de contagem com a MESMA escapatória de obstáculo real dos Voids", () => {
    // Um bloco no caminho entrada→alvo nunca pode ser cortado pelo teto:
    // é risco estrutural do plano ATIVO, não decoração de destaque.
    //
    // A FORMA mudou (auditoria posterior, ver liquidity-significance.test.ts):
    // as 3 vagas deixaram de ser por ORDEM DE CHEGADA (`i < 3`) e passaram a
    // ser disputadas dentro do subconjunto SIGNIFICATIVO em unidades de ATR —
    // o mesmo filtro que FVG/Order Block já tinham e que nunca chegou aqui.
    // O CONTRATO que este teste guarda não mudou: a escapatória de obstáculo
    // real continua existindo, e continua existindo nos DOIS tipos de bloco.
    const src = app();
    expect(src.match(/isRealObstacle\(b\) \|\| significant(?:Breakers|Mitigations)\.indexOf\(b\)/g)?.length).toBe(2);
    // E o teto continua sendo 3 nos dois — não virou "todos".
    expect(src.match(/significant(?:Breakers|Mitigations)\.indexOf\(b\) < 3/g)?.length).toBe(2);
  });
});

describe("LEI 24 — display only", () => {
  it("nenhum consumidor do bloco emite ou altera direção de trade", () => {
    const src = app();
    // O bloco só é lido para desenhar. Se algum dia alimentar decisão, isto
    // fica vermelho e obriga uma autorização explícita do Operador.
    expect(src).not.toMatch(/institutionalBlocks[\s\S]{0,200}setDirection/);
    expect(src).not.toMatch(/institutionalBlocks[\s\S]{0,200}engine\.direction/);
  });
});

describe("documentado no QUARANTINE.md — a regra de graduação do projeto", () => {
  it("a entrada de graduação existe e cita a suíte real", () => {
    const q = read("../../src/research/QUARANTINE.md");
    expect(q).toContain("institutional-blocks.js");
    expect(q.toLowerCase()).toContain("breaker");
  });
});
