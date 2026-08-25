// use-backtest-runner.ts — ponte React → Worker do backtest.
//
// Mantido fino de propósito: toda a matemática vive nos motores graduados,
// toda a redação vive em backtest-presentation.ts, e este arquivo só cuida
// do ciclo de vida do Worker. É o mesmo papel que engine-bridge.ts cumpre
// para os outros motores — nunca uma segunda implementação de nada.

import { useCallback, useEffect, useRef, useState } from "react";
import type { BacktestWorkerRequest, BacktestWorkerResponse } from "../workers/backtest-worker";

export interface BacktestEstado {
  rodando: boolean;
  fase: string | null;
  resultado: unknown | null;
  erro: { motivo: string; detalhe?: string } | null;
}

const INICIAL: BacktestEstado = { rodando: false, fase: null, resultado: null, erro: null };

export function useBacktestRunner() {
  const [estado, setEstado] = useState<BacktestEstado>(INICIAL);
  const workerRef = useRef<Worker | null>(null);

  // O Worker é encerrado ao desmontar. Sem isto, sair da aba durante uma
  // captura deixaria o worker paginando a exchange sem ninguém escutando —
  // rede real gasta por nada.
  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  const rodar = useCallback((symbol: string, timeframe: string, targetCandleCount: number) => {
    // Uma execução por vez: o worker anterior é encerrado antes. Duas
    // capturas simultâneas competiriam pela mesma janela de rate limit da
    // exchange e as duas ficariam piores.
    workerRef.current?.terminate();
    setEstado({ rodando: true, fase: "iniciando", resultado: null, erro: null });

    let worker: Worker;
    try {
      worker = new Worker(new URL("../workers/backtest-worker.ts", import.meta.url), { type: "module" });
    } catch (err) {
      // Fail-closed real: sem Worker não há caminho alternativo aqui. Rodar
      // o walk-forward no main thread congelaria o gráfico (Regra de Ouro 6)
      // — é melhor não medir do que travar o terminal do Operador.
      setEstado({
        rodando: false,
        fase: null,
        resultado: null,
        erro: { motivo: "worker_indisponivel", detalhe: err instanceof Error ? err.message : String(err) },
      });
      return;
    }
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent<BacktestWorkerResponse>) => {
      const msg = e.data;
      if (msg.type === "progress") {
        setEstado((s) => ({ ...s, fase: msg.detalhe }));
      } else if (msg.type === "done") {
        setEstado({ rodando: false, fase: null, resultado: msg.resultado, erro: null });
        worker.terminate();
        if (workerRef.current === worker) workerRef.current = null;
      } else {
        setEstado({ rodando: false, fase: null, resultado: null, erro: { motivo: msg.motivo, detalhe: msg.detalhe } });
        worker.terminate();
        if (workerRef.current === worker) workerRef.current = null;
      }
    };

    worker.onerror = (ev) => {
      setEstado({
        rodando: false,
        fase: null,
        resultado: null,
        erro: { motivo: "falha_no_worker", detalhe: ev.message || "erro sem mensagem" },
      });
      worker.terminate();
      if (workerRef.current === worker) workerRef.current = null;
    };

    const req: BacktestWorkerRequest = { type: "run", symbol, timeframe, targetCandleCount };
    worker.postMessage(req);
  }, []);

  return { estado, rodar };
}
