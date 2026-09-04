// backtest-in-app.test.ts — a taxa de acerto medida DENTRO do app.
//
// O motor (structural-backtest.js) e a captura (history-capture.js) já tinham
// suíte própria. O que nasce aqui é a SUPERFÍCIE: validação do pedido,
// fail-closed da captura, e a redação do número. É exatamente onde um número
// honesto vira desonesto se alguém escorregar — daí o peso dos testes de
// apresentação.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  validarPedido,
  capturaUtilizavel,
  executarPedido,
  BACKTEST_MIN_CANDLES,
  BACKTEST_MAX_CANDLES,
  type BacktestWorkerResponse,
} from "../src/workers/backtest-worker";
import {
  formatarFracao,
  formatarR,
  forcaDaAmostra,
  descreverTaxa,
  avisoObrigatorio,
  explicarFalha,
  BACKTEST_MIN_RESOLVED_FOR_RATE,
  type BacktestAggregate,
  type BacktestProvenance,
} from "../src/nexus/backtest-presentation";

const read = (p: string) => readFileSync(resolve(__dirname, p), "utf8");

const agg = (over: Partial<BacktestAggregate> = {}): BacktestAggregate => ({
  samples: 100, targetHits: 40, stopHits: 40, bothTouchedCountedAsStop: 3,
  unresolved: 20, resolved: 80, taxaAlvoAmostra: 0.5,
  avgMfeR: 1.2, avgMaeR: -0.6, farTargetEligible: 30, farTargetHitRate: 0.2, ...over,
});

describe("validação do pedido: recusa ANTES de gastar rede", () => {
  it("aceita um pedido real", () => {
    expect(validarPedido({ symbol: "BTCUSDT", timeframe: "15m", targetCandleCount: 2000 })).toEqual({ ok: true });
  });

  it("recusa símbolo, timeframe e quantidade inválidos, cada um com sua razão", () => {
    expect(validarPedido({ symbol: "btc", timeframe: "15m", targetCandleCount: 2000 })).toEqual({ ok: false, motivo: "simbolo_invalido" });
    expect(validarPedido({ symbol: "BTCUSDT", timeframe: "", targetCandleCount: 2000 })).toEqual({ ok: false, motivo: "timeframe_invalido" });
    expect(validarPedido({ symbol: "BTCUSDT", timeframe: "15m", targetCandleCount: 1.5 })).toEqual({ ok: false, motivo: "quantidade_invalida" });
    expect(validarPedido({ symbol: "BTCUSDT", timeframe: "15m", targetCandleCount: NaN })).toEqual({ ok: false, motivo: "quantidade_invalida" });
  });

  it("os limites de amostra são RECUSA explícita, nunca truncamento silencioso", () => {
    // Truncar sem dizer faria o Operador achar que mediu 10000 quando mediu 5000.
    expect(validarPedido({ symbol: "BTCUSDT", timeframe: "15m", targetCandleCount: BACKTEST_MIN_CANDLES - 1 }))
      .toEqual({ ok: false, motivo: `amostra_minima_${BACKTEST_MIN_CANDLES}` });
    expect(validarPedido({ symbol: "BTCUSDT", timeframe: "15m", targetCandleCount: BACKTEST_MAX_CANDLES + 1 }))
      .toEqual({ ok: false, motivo: `amostra_maxima_${BACKTEST_MAX_CANDLES}` });
    // e as bordas exatas passam
    expect(validarPedido({ symbol: "BTCUSDT", timeframe: "15m", targetCandleCount: BACKTEST_MIN_CANDLES }).ok).toBe(true);
    expect(validarPedido({ symbol: "BTCUSDT", timeframe: "15m", targetCandleCount: BACKTEST_MAX_CANDLES }).ok).toBe(true);
  });
});

describe("captura: fail-closed antes de virar número", () => {
  it("captura vazia preserva o stopReason real — a causa que o Operador pode agir", () => {
    expect(capturaUtilizavel({ candles: [], stopReason: "conector_estado:BLOCKED_BY_POLICY" }))
      .toEqual({ ok: false, motivo: "conector_estado:BLOCKED_BY_POLICY" });
  });

  it("amostra real curta demais NÃO vira backtest — nem com candles de verdade", () => {
    const poucos = Array.from({ length: BACKTEST_MIN_CANDLES - 1 }, () => ({}));
    const r = capturaUtilizavel({ candles: poucos });
    expect(r.ok).toBe(false);
    expect((r as { motivo: string }).motivo).toContain("amostra_real_insuficiente");
  });

  it("amostra suficiente passa", () => {
    expect(capturaUtilizavel({ candles: Array.from({ length: BACKTEST_MIN_CANDLES }, () => ({})) })).toEqual({ ok: true });
  });
});

describe("apresentação: null NUNCA vira zero (Regra de Ouro 3)", () => {
  it("fração e R ausentes viram travessão, nunca 0% nem 0.00R", () => {
    for (const v of [null, undefined, NaN, Infinity]) {
      expect(formatarFracao(v as number), `fracao ${v}`).toBe("—");
      expect(formatarR(v as number), `R ${v}`).toBe("—");
    }
    // e um zero REAL continua sendo exibido como zero
    expect(formatarFracao(0)).toBe("0.0%");
    expect(formatarR(0)).toBe("0.00R");
  });

  it("formata valores reais com a precisão declarada", () => {
    expect(formatarFracao(0.6667)).toBe("66.7%");
    expect(formatarR(1.234)).toBe("1.23R");
    expect(formatarR(-0.5)).toBe("-0.50R");
  });
});

describe("a força da amostra é DITA, não escondida", () => {
  it("o piso é o mesmo do Track Record real — não um número novo inventado", () => {
    expect(BACKTEST_MIN_RESOLVED_FOR_RATE).toBe(30);
    const expectancy = read("../src/nexus/expectancy.ts");
    expect(expectancy).toMatch(/MIN_TRADES_FOR_VALID_EXPECTANCY\s*=\s*30/);
  });

  it("classifica pela amostra RESOLVIDA, nunca pela total", () => {
    expect(forcaDaAmostra(0)).toBe("INSUFICIENTE");
    expect(forcaDaAmostra(29)).toBe("FRACA");
    expect(forcaDaAmostra(30)).toBe("SUFICIENTE");
  });

  it("amostra fraca MOSTRA o número real, com a ressalva junto — nunca esconde", () => {
    // Esconder seria tão desonesto quanto apresentar como sólido: o Operador
    // tem direito ao dado, e à ressalva no mesmo lugar.
    const d = descreverTaxa(agg({ resolved: 8, taxaAlvoAmostra: 0.75 }));
    expect(d.valor).toBe("75.0%");
    expect(d.forca).toBe("FRACA");
    expect(d.ressalva).toContain("8 cenários resolvidos");
    expect(d.ressalva).toContain("30");
  });

  it("sem nada resolvido não existe número — travessão e razão, nunca 0%", () => {
    const d = descreverTaxa(agg({ resolved: 0, taxaAlvoAmostra: null }));
    expect(d.valor).toBe("—");
    expect(d.forca).toBe("INSUFICIENTE");
    expect(d.ressalva).toContain("não há o que medir");
  });

  it("amostra suficiente não inventa ressalva", () => {
    expect(descreverTaxa(agg({ resolved: 120, taxaAlvoAmostra: 0.61 })).ressalva).toBeNull();
  });
});

describe("o aviso é OBRIGATÓRIO e diz o que a medida NÃO é", () => {
  const prov: BacktestProvenance = { symbol: "BTCUSDT", timeframe: "15m", candles: 2000, windowSize: 120, horizonBars: 48, frames: 1880 };

  it("declara amostra, escopo estrutural, empate conservador e que não é probabilidade", () => {
    const a = avisoObrigatorio(prov);
    expect(a).toContain("2000 candles");
    expect(a).toContain("BTCUSDT 15m");
    expect(a).toContain("ESTRUTURAL");
    expect(a).toContain("não o sistema vivo");
    expect(a).toContain("Empate no mesmo candle conta STOP");
    expect(a).toContain("Não é probabilidade");
  });

  it("o painel RENDERIZA o aviso, não só o define (a fiação real)", () => {
    // Sexta vez nesta trilha que uma mutação de fiação passaria verde com a
    // função pura testada e a chamada não travada.
    const app = read("../src/App.tsx");
    expect(app).toContain("{prov && <span");
    expect(app).toContain("avisoObrigatorio(prov)");
    // e a ressalva de amostra fraca também é renderizada
    expect(app).toContain("taxa.ressalva &&");
  });
});

describe("falhas explicadas em linguagem acionável", () => {
  it("rede bloqueada vira instrução, não código de erro", () => {
    expect(explicarFalha("captura_incompleta", "conector_estado:BLOCKED_BY_POLICY")).toContain("não alcança a Binance");
  });

  it("amostra curta diz quantos vieram", () => {
    expect(explicarFalha("captura_incompleta", "amostra_real_insuficiente_312")).toContain("312");
  });

  it("motivo desconhecido preserva a causa em vez de virar 'erro'", () => {
    expect(explicarFalha("coisa_nova", "detalhe cru")).toContain("detalhe cru");
  });
});

describe("LEI 24 e Regra de Ouro 6: o backtest não decide e não trava a tela", () => {
  it("o cálculo pesado roda em Worker — nunca no main thread", () => {
    const hook = read("../src/nexus/use-backtest-runner.ts");
    expect(hook).toContain('new Worker(new URL("../workers/backtest-worker.ts", import.meta.url), { type: "module" })');
    // e sem Worker NÃO existe fallback no main thread: melhor não medir do
    // que congelar o terminal do Operador.
    expect(hook).toContain('motivo: "worker_indisponivel"');
    expect(hook).not.toMatch(/runStructuralBacktest\s*\(/);
  });

  it("o worker é encerrado ao desmontar e antes de uma nova execução", () => {
    const hook = read("../src/nexus/use-backtest-runner.ts");
    expect(hook).toContain("workerRef.current?.terminate();");
    expect(hook).toMatch(/return\s*\(\)\s*=>\s*\{[\s\S]{0,120}terminate\(\)/);
  });

  it("nada do backtest realimenta decisão — display only", () => {
    const app = read("../src/App.tsx");
    const i = app.indexOf("function BacktestPanel(");
    expect(i).toBeGreaterThan(-1);
    const bloco = app.slice(i, app.indexOf("\nfunction SecondaryModuleView", i));
    for (const proibido of ["setDirection", "engine.direction", "setChartLayerVisibility"]) {
      expect(bloco, `BacktestPanel toca ${proibido}`).not.toContain(proibido);
    }
  });
});


describe("o handler inteiro, por EXECUÇÃO REAL (captura injetada, zero rede)", () => {
  const coletar = async (
    req: Parameters<typeof executarPedido>[0],
    deps: Parameters<typeof executarPedido>[2],
  ) => {
    const msgs: BacktestWorkerResponse[] = [];
    await executarPedido(req, (m) => msgs.push(m), deps);
    return msgs;
  };
  const pedido = { type: "run" as const, symbol: "BTCUSDT", timeframe: "15m", targetCandleCount: 2000 };

  it("caminho feliz: progresso, progresso, resultado — nessa ordem", async () => {
    const msgs = await coletar(pedido, {
      capturar: async () => ({ candles: Array.from({ length: 2000 }, (_, i) => ({ t: i })), stopReason: "alvo_atingido" }) as never,
      medir: async () => ({ status: "OK", aggregate: { samples: 10 } }) as never,
    });
    expect(msgs.map((m) => m.type)).toEqual(["progress", "progress", "done"]);
    expect((msgs[0] as { detalhe: string }).detalhe).toContain("BTCUSDT 15m");
    expect((msgs[1] as { detalhe: string }).detalhe).toContain("2000 candles reais capturados");
    expect((msgs[2] as { resultado: { status: string } }).resultado.status).toBe("OK");
  });

  it("captura bloqueada: NUNCA chega a medir — o motivo real chega intacto", async () => {
    let mediu = false;
    const msgs = await coletar(pedido, {
      capturar: async () => ({ candles: [], stopReason: "conector_estado:BLOCKED_BY_POLICY" }) as never,
      medir: async () => { mediu = true; return {} as never; },
    });
    expect(mediu, "mediu sobre captura vazia").toBe(false);
    const erro = msgs.find((m) => m.type === "error") as { motivo: string; detalhe: string };
    expect(erro.motivo).toBe("captura_incompleta");
    expect(erro.detalhe).toContain("BLOCKED_BY_POLICY");
  });

  it("amostra real curta demais: também não mede — fail-closed, nunca um número parcial", async () => {
    let mediu = false;
    const msgs = await coletar(pedido, {
      capturar: async () => ({ candles: Array.from({ length: 100 }, () => ({})) }) as never,
      medir: async () => { mediu = true; return {} as never; },
    });
    expect(mediu).toBe(false);
    expect((msgs.find((m) => m.type === "error") as { detalhe: string }).detalhe).toContain("amostra_real_insuficiente_100");
  });

  it("pedido inválido: recusa ANTES de tocar a rede", async () => {
    let capturou = false;
    const msgs = await coletar({ ...pedido, symbol: "xx" }, {
      capturar: async () => { capturou = true; return {} as never; },
    });
    expect(capturou, "gastou rede num pedido inválido").toBe(false);
    expect(msgs).toEqual([{ type: "error", motivo: "simbolo_invalido" }]);
  });

  it("exceção na captura vira erro com a causa, nunca silêncio", async () => {
    const msgs = await coletar(pedido, {
      capturar: async () => { throw new Error("timeout da exchange"); },
    });
    const erro = msgs.find((m) => m.type === "error") as { motivo: string; detalhe: string };
    expect(erro.motivo).toBe("falha_na_execucao");
    expect(erro.detalhe).toContain("timeout da exchange");
  });

  it("o módulo do worker IMPORTA em Node — a lição do commit anterior, aplicada", async () => {
    // `self.onmessage` no topo do módulo tornaria este arquivo inimportável
    // fora de um Worker, exatamente o defeito corrigido em probe.js.
    await expect(import("../src/workers/backtest-worker")).resolves.toBeDefined();
    const src = read("../src/workers/backtest-worker.ts");
    expect(src).toContain('typeof self !== "undefined" && typeof self.postMessage === "function"');
  });
});
