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
