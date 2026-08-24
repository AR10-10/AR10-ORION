// Suíte de EXECUÇÃO REAL do perfil de camadas por tempo gráfico.
//
// PEDIDO DO OPERADOR: "o que é necessário pra operar em cada tempo gráfico
// perfeitamente, pra não ter dúvida de decisão... o gráfico não ficar
// poluído com o que não é necessário".
//
// DEFEITO REAL: `grep -n "timeframe" layer-relevance.ts` voltou ZERO. A
// ordem de precisão e o teto eram os MESMOS em 1m e em 1W — um gráfico
// semanal disputava espaço com camadas de fluxo de curtíssimo prazo.
//
// O CRITÉRIO NÃO É GOSTO, É COBERTURA DE DADO. Cada regra tem razão
// verificável no próprio repositório, e os testes abaixo travam a RAZÃO,
// não só o resultado.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  layerHorizonFit,
  resolveTimeframePrecisionOrder,
  horizonFitReason,
  timeframeMinutes,
  ORDER_FLOW_COVERAGE_MINUTES,
} from "../src/nexus/timeframe-layer-profile";
import { AUTO_LAYER_PRECISION_ORDER, resolveAutoLayerVisibility, AUTO_LAYER_MAX_SIMULTANEOUS } from "../src/nexus/layer-relevance";

const read = (p: string) => readFileSync(resolve(__dirname, p), "utf-8");

describe("fluxo de ordens: a regra vem da janela REAL retida, não de opinião", () => {
  it("a janela declarada bate com a retenção real do poller", () => {
    // ORDERFLOW_HISTORY_CAPACITY = 120 amostras a ~4s => ~8 minutos.
    const src = read("../src/nexus/orderflow-history.ts");
    expect(src).toContain("export const ORDERFLOW_HISTORY_CAPACITY = 120;");
    expect(ORDER_FLOW_COVERAGE_MINUTES).toBe(8);
  });

  it("em 1m/5m o fluxo é CORE — a vela inteira cabe na janela retida", () => {
    for (const tf of ["1m", "3m", "5m"]) {
      for (const id of ["cvd", "order_flow_heatmap", "liquidation_heatmap", "order_book_depth"]) {
        expect(layerHorizonFit(id, tf), `${id} em ${tf}`).toBe("core");
      }
    }
  });

  it("em 15m/1h vira CONTEXTO — a janela cobre só parte da vela", () => {
    for (const tf of ["15m", "30m", "1h"]) {
      expect(layerHorizonFit("cvd", tf), `cvd em ${tf}`).toBe("context");
    }
  });

  it("em 4h/1d/1w é UNFIT — o dado retido não cobre nem a vela em formação", () => {
    // Não é "menos útil": é ausência de dado. A mesma limitação já está
    // documentada em multi-timeframe-engine.ts.
    for (const tf of ["4h", "1d", "1w"]) {
      expect(layerHorizonFit("cvd", tf), `cvd em ${tf}`).toBe("unfit");
    }
    expect(read("../src/nexus/multi-timeframe-engine.ts")).toContain("não existe dado real retido para calcular Order Flow");
  });
});

describe("VWAP e sessões: ancoradas ao DIA UTC", () => {
  it("a âncora declarada bate com o motor real", () => {
    expect(read("../src/nexus/vwap.ts")).toContain("UTC calendar day");
  });

  it("intradiário é CORE", () => {
    for (const tf of ["1m", "15m", "1h"]) {
      expect(layerHorizonFit("vwap", tf), `vwap em ${tf}`).toBe("core");
    }
  });

  it("em 1d/1w é UNFIT — uma vela já contém o dia inteiro", () => {
    // Numa vela diária a VWAP tem no máximo um ponto: deixa de dizer onde o
    // preço está DENTRO da sessão, que é a única coisa que ela responde.
    for (const tf of ["1d", "1w"]) {
      for (const id of ["vwap", "market_sessions", "kill_zones", "session_key_levels"]) {
        expect(layerHorizonFit(id, tf), `${id} em ${tf}`).toBe("unfit");
      }
    }
  });
});

describe("estrutura é escalável — nunca empurrada por horizonte", () => {
  it("plano, BOS/CHOCH, zonas e Fibonacci são CORE em TODO timeframe", () => {
    const estruturais = ["trade_plan_zone", "structure_breaks", "liquidity_zones", "fibonacci", "institutional_zones", "equal_highs_lows", "supertrend"];
    for (const tf of ["1m", "15m", "1h", "4h", "1d", "1w"]) {
      for (const id of estruturais) {
        expect(layerHorizonFit(id, tf), `${id} em ${tf}`).toBe("core");
      }
    }
  });

  it("o PLANO ATIVO nunca perde a primeira posição — é a entrada/saída", () => {
    // O Operador foi explícito: o que não pode sumir é o alvo/entrada/saída.
    for (const tf of ["1m", "15m", "4h", "1d", "1w"]) {
      expect(resolveTimeframePrecisionOrder(AUTO_LAYER_PRECISION_ORDER, tf)[0], tf).toBe("trade_plan_zone");
    }
  });
});

describe("a reordenação NUNCA remove nada (Regra de Ouro 4)", () => {
  it("a ordem resolvida tem exatamente as mesmas camadas da declarada", () => {
    for (const tf of ["1m", "15m", "1d", "1w"]) {
      const out = resolveTimeframePrecisionOrder(AUTO_LAYER_PRECISION_ORDER, tf);
      expect(out.length, tf).toBe(AUTO_LAYER_PRECISION_ORDER.length);
      expect([...out].sort(), tf).toEqual([...AUTO_LAYER_PRECISION_ORDER].sort());
    }
  });

  it("dentro de um mesmo grupo a ordem declarada é preservada", () => {
    // O módulo nunca inventa uma hierarquia própria: ele só empurra para
    // trás o que o dado não sustenta.
    const out = resolveTimeframePrecisionOrder(AUTO_LAYER_PRECISION_ORDER, "1d");
    const core = out.filter((id) => layerHorizonFit(id, "1d") === "core");
    const originalCore = AUTO_LAYER_PRECISION_ORDER.filter((id) => layerHorizonFit(id, "1d") === "core");
    expect(core).toEqual(originalCore);
  });
});

describe("fail-closed", () => {
  it("timeframe desconhecido devolve a ordem declarada INTACTA", () => {
    for (const tf of [null, undefined, "", "abacaxi", "99z"]) {
      expect(resolveTimeframePrecisionOrder(AUTO_LAYER_PRECISION_ORDER, tf as string)).toEqual([...AUTO_LAYER_PRECISION_ORDER]);
    }
  });

  it("sem timeframe, TODA camada é core — o módulo não reordena no escuro", () => {
    expect(layerHorizonFit("cvd", null)).toBe("core");
    expect(layerHorizonFit("vwap", undefined)).toBe("core");
  });

  it("timeframeMinutes só afirma o que conhece", () => {
    expect(timeframeMinutes("15m")).toBe(15);
    expect(timeframeMinutes("1d")).toBe(1440);
    expect(timeframeMinutes("abacaxi")).toBeNull();
  });
});

describe("a razão é DITA, não só aplicada", () => {
  it("camada empurrada carrega uma explicação legível", () => {
    expect(horizonFitReason("cvd", "4h")).toContain("~8 min");
    expect(horizonFitReason("vwap", "1d")).toContain("dia inteiro");
  });

  it("camada core não inventa explicação nenhuma", () => {
    expect(horizonFitReason("trade_plan_zone", "1d")).toBeNull();
    expect(horizonFitReason("cvd", "1m")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// EFEITO REAL na decisão que o canvas recebe.
// ---------------------------------------------------------------------------
describe("o gráfico realmente muda de ferramenta conforme o tempo", () => {
  const todasRelevantes = () =>
    Object.fromEntries(
      AUTO_LAYER_PRECISION_ORDER.map((id) => [id, { relevant: true, emphasis: "normal" as const, reason: "leitura real" }]),
    );
  const visiveis = (tf: string | null) =>
    Object.entries(resolveAutoLayerVisibility(todasRelevantes(), [], undefined, tf))
      .filter(([, d]) => d.show)
      .map(([id]) => id);

  it("o teto continua valendo em qualquer horizonte", () => {
    for (const tf of ["1m", "1d"]) {
      expect(visiveis(tf).length, tf).toBe(AUTO_LAYER_MAX_SIMULTANEOUS);
    }
  });

  it("1m e 1d NÃO mostram o mesmo conjunto — era esse o defeito", () => {
    expect(visiveis("1m")).not.toEqual(visiveis("1d"));
  });

  it("o plano ativo está presente nos DOIS — entrada/saída nunca some", () => {
    for (const tf of ["1m", "15m", "1d", "1w"]) {
      expect(visiveis(tf), tf).toContain("trade_plan_zone");
    }
  });

  it("sem timeframe, o resultado é idêntico ao de antes desta feature", () => {
    const semTf = Object.entries(resolveAutoLayerVisibility(todasRelevantes(), []))
      .filter(([, d]) => d.show)
      .map(([id]) => id)
      .sort();
    expect(visiveis(null).sort()).toEqual(semTf);
  });

  it("o App REALMENTE passa o timeframe — não basta a função aceitar", () => {
    // Terceira vez nesta trilha que uma mutação de FIAÇÃO passou verde
    // porque o teste só exercitava a função pura. Testar o motor a fundo e
    // não travar a chamada deixa o recurso morto na tela com a suíte
    // inteira verde. Aqui a chamada real fica travada.
    const app = read("../src/App.tsx");
    expect(app).toContain("resolveAutoLayerVisibility(layerRelevance ?? {}, forced, undefined, chartTimeframe ?? null)");
    // E o timeframe precisa estar no dep array, senão a decisão não
    // recomputa ao trocar de tempo gráfico — o mesmo bug ficaria de pé.
    // Extração ancorada no FECHAMENTO do memo (`}, [`), nunca no primeiro
    // `]);` — o corpo tem `manual[id]);`, que casaria antes e faria o teste
    // olhar para o lugar errado (foi exatamente o que aconteceu na primeira
    // versão desta assertiva).
    const i = app.indexOf("const autoDecision = useMemo(");
    expect(i, "memo autoDecision não encontrado").toBeGreaterThan(-1);
    const fecho = app.indexOf("}, [", i);
    const deps = app.slice(fecho, app.indexOf("]);", fecho));
    expect(deps).toContain("chartTimeframe");
  });

  it("uma camada suprimida por HORIZONTE explica o porquê, não só 'cedeu espaço'", () => {
    const d = resolveAutoLayerVisibility(todasRelevantes(), [], undefined, "1d");
    const cvd = d["cvd"];
    expect(cvd.show).toBe(false);
    expect(cvd.reason).toContain("~8 min");
  });
});

// ---------------------------------------------------------------------------
// "NADA QUE ESTÁ PRA TRÁS" (pedido direto do Operador: tudo que foi
// adicionado precisa estar mesmo ATIVO no modo automático, não só existir).
//
// Uma camada só chega à tela em modo automático se estiver em SEIS listas.
// Estar em cinco delas é indistinguível de estar em nenhuma, e não havia
// nada travando as seis juntas — foi assim que `candle_patterns` ficou
// calculada, com plugin montado e custando 4 do orçamento de 12, sem poder
// aparecer nunca.
// ---------------------------------------------------------------------------
describe("cobertura de fiação: toda camada do canvas existe em TODAS as listas que a fazem aparecer", () => {
  const bloco = (s: string, ini: string, fim: string) => {
    const i = s.indexOf(ini);
    expect(i, `bloco ${ini} não encontrado`).toBeGreaterThan(-1);
    return s.slice(i, s.indexOf(fim, i));
  };
  const capturar = (txt: string, re: RegExp) => [...txt.matchAll(re)].map((m) => m[1]);

  const chart = read("../src/chart/EnhancedChart_110_Percent.tsx");
  const app = read("../src/App.tsx");
  const rel = read("../src/nexus/layer-relevance.ts");

  const canonicas = capturar(bloco(chart, "export const CHART_LAYER_IDS = [", "] as const;"), /^\s{2}"([a-z_]+)",$/gm);

  it("a lista canônica foi mesmo extraída (a guarda não passa por vacuidade)", () => {
    expect(canonicas.length).toBeGreaterThan(20);
    expect(canonicas).toContain("trade_plan_zone");
    expect(canonicas).toContain("candle_patterns");
  });

  const listas: Record<string, string[]> = {
    DEFAULT_CHART_LAYER_VISIBILITY: capturar(bloco(chart, "export const DEFAULT_CHART_LAYER_VISIBILITY", "};"), /^\s{2}([a-z_]+):\s*true,/gm),
    DEFAULT_CHART_LAYER_AUTO_MODE: capturar(bloco(chart, "export const DEFAULT_CHART_LAYER_AUTO_MODE", "};"), /^\s{2}([a-z_]+):\s*true,/gm),
    RELEVANCE_LAYER_IDS: capturar(bloco(rel, "export const RELEVANCE_LAYER_IDS = [", "] as const;"), /^\s{2}"([a-z_]+)",$/gm),
    // Sem âncora `$`: várias entradas desta lista carregam um comentário à
    // direita ("trade_plan_zone",      // o plano ativo…). Com `$` a extração
    // capturava só as entradas sem comentário e a guarda acusava camadas
    // reais como ausentes — falso positivo do próprio teste, pego na
    // primeira execução. O escopo continua seguro porque `bloco()` já
    // recorta exatamente esta declaração.
    AUTO_LAYER_PRECISION_ORDER: capturar(bloco(rel, "export const AUTO_LAYER_PRECISION_ORDER", "];"), /^\s{2}"([a-z_]+)",/gm),
    LAYER_VISUAL_COST: capturar(bloco(rel, "export const LAYER_VISUAL_COST", "};"), /^\s{2}([a-z_]+):/gm),
    CHART_LAYER_PANEL_MODULES: capturar(bloco(app, "const CHART_LAYER_PANEL_MODULES", "\n];"), /id: "([a-z_]+)"/g),
  };

  for (const [nome, lista] of Object.entries(listas)) {
    it(`${nome} cobre TODA camada canônica`, () => {
      expect(lista.length, `${nome} não foi extraída`).toBeGreaterThan(20);
      for (const id of canonicas) {
        expect(lista, `camada "${id}" não está em ${nome} — fica invisível ou incontrolável`).toContain(id);
      }
    });
  }

  it("nenhuma lista inventa uma camada que o canvas não conhece", () => {
    for (const [nome, lista] of Object.entries(listas)) {
      for (const id of lista) {
        expect(canonicas, `"${id}" está em ${nome} mas não em CHART_LAYER_IDS`).toContain(id);
      }
    }
  });
});

describe("candle_patterns: de invisível-por-omissão a competidora real", () => {
  // MEDIÇÃO REAL que motivou a mudança (2000 ciclos por densidade, gerador
  // determinístico). "Densidade" = fração das OUTRAS camadas com leitura
  // real no mesmo ciclo:
  //
  //            densidade   ANTES (fora da ordem)   DEPOIS (rank 8)
  //               20%              44,7%                98,7%
  //               35%               4,1%                87,0%
  //               50%               0,1%                62,1%
  //               70%               0,0%                23,9%
  //              100%               0,0%                 0,0%
  //
  // Em mercado normal (35–50% das camadas com leitura) ela saía de
  // praticamente nunca para a maioria dos ciclos. Em saturação total ela
  // continua cedendo — correto: não deve deslocar plano/estrutura.
  it("está na ordem de precisão — sem isso, rank = fim da fila = nunca", () => {
    expect(AUTO_LAYER_PRECISION_ORDER).toContain("candle_patterns");
  });

  it("fica no grupo dos eventos pontuais, nunca antes das âncoras estruturais", () => {
    const pos = (id: string) => AUTO_LAYER_PRECISION_ORDER.indexOf(id);
    // depois do plano, da mudança estrutural e das zonas — um padrão de vela
    // não manda mais que a estrutura que o contém.
    for (const ancora of ["trade_plan_zone", "structure_breaks", "institutional_zones", "liquidity_zones"]) {
      expect(pos("candle_patterns"), `candle_patterns passou na frente de ${ancora}`).toBeGreaterThan(pos(ancora));
    }
    // e antes das linhas de contexto contínuo, que respondem "como está",
    // não "agora" — é o critério declarado no topo da própria lista.
    for (const contexto of ["vwap", "ema", "nexus_line", "trend_channel"]) {
      expect(pos("candle_patterns"), `candle_patterns ficou atrás de ${contexto}`).toBeLessThan(pos(contexto));
    }
  });

  it("com as camadas mais precisas caladas, ela REALMENTE chega à tela", () => {
    // Execução real do resolvedor, não inspeção de lista: é a única forma de
    // provar que a posição nova produz visibilidade de fato.
    const rel: Record<string, any> = {
      candle_patterns: { relevant: true, emphasis: "normal", reason: "padrão real" },
      vwap: { relevant: true, emphasis: "normal", reason: "r" },
      ema: { relevant: true, emphasis: "normal", reason: "r" },
    };
    expect(resolveAutoLayerVisibility(rel, [], undefined, "15m")["candle_patterns"].show).toBe(true);
  });

  it("em saturação total ela cede — o plano e a estrutura continuam mandando", () => {
    const todas = Object.fromEntries(
      AUTO_LAYER_PRECISION_ORDER.map((id) => [id, { relevant: true, emphasis: "normal" as const, reason: "r" }]),
    );
    const d = resolveAutoLayerVisibility(todas, [], undefined, "15m");
    expect(d["candle_patterns"].show).toBe(false);
    expect(d["trade_plan_zone"].show).toBe(true);
    // e a razão é dita, nunca um sumiço silencioso
    expect(d["candle_patterns"].suppressedByCap).toBe(true);
    expect(d["candle_patterns"].reason.length).toBeGreaterThan(10);
  });
});
