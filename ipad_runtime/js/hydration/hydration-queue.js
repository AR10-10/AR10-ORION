// hydration-queue.js — mecanismo de fila genérico, sem nenhuma política
// específica de plataforma. Processa um item por vez, em ordem, com uma
// pausa de respiro entre itens (backpressure: nunca empurra tudo de uma vez,
// "bebe água pouco a pouco"). `shouldPause` é injetado por quem chama
// (hydration-manager.js) — esta fila não sabe o que é "aba em background" ou
// "bateria baixa", só sabe checar o hook antes de cada item e parar de forma
// limpa se ele disser que deve. Isso mantém a fila platform-agnostic e
// testável em Node puro (só usa setTimeout).
//
// Importante: pausar nunca trava esta função. Ela checa `shouldPause` UMA VEZ
// no topo de cada iteração e retorna imediatamente se for hora de parar — não
// existe espera ativa por um "resume" que pode nunca chegar. Quem chama é
// responsável por persistir o checkpoint e invocar run() de novo depois.

const DEFAULT_BREATH_MS = 120;

/**
 * @param {Array} items - itens a processar em ordem (já priorizados por quem chama).
 * @param {(item) => Promise<{ok:boolean, [key:string]:any}>} processFn
 * @param {object} [opts]
 * @param {() => Promise<string|false>} [opts.shouldPause] - retorna um motivo
 *   (string) se deve pausar antes do próximo item, ou false/''/undefined se
 *   pode continuar.
 * @param {(evt: {item, index, total, result}) => void} [opts.onProgress]
 * @param {number} [opts.breathMs] - pausa entre itens, em ms (respiro).
 */
export async function run(items, processFn, { shouldPause, onProgress, breathMs = DEFAULT_BREATH_MS } = {}) {
    const completed = [];
    const failed = [];
    let pausedEarly = false;
    let pauseReason = null;
    let i = 0;

    for (; i < items.length; i++) {
        if (shouldPause) {
            const reason = await shouldPause();
            if (reason) {
                pausedEarly = true;
                pauseReason = reason;
                break;
            }
        }

        const item = items[i];
        let result;
        try {
            result = await processFn(item);
        } catch (err) {
            result = { ok: false, error: String(err?.message || err) };
        }

        if (result?.ok) completed.push({ item, result });
        else failed.push({ item, result });

        onProgress?.({ item, index: i, total: items.length, result });

        if (i < items.length - 1 && breathMs > 0) {
            await sleep(breathMs);
        }
    }

    // `i` para no índice do primeiro item NÃO processado (break por pausa) ou
    // em items.length se o laço terminou normalmente (nada pendente).
    const pending = items.slice(i);
    return { completed, failed, pending, pausedEarly, pauseReason };
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
