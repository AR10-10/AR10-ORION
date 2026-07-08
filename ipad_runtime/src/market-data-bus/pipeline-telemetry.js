// pipeline-telemetry.js — Estabilização (Prioridade 2, "Market Data Bus com
// telemetria por etapa"): observação REAL das 5 etapas que bus.js já
// documentava no próprio header desde a Fase B — Recebido -> Normalizado ->
// Validado -> Sincronizado -> Distribuído — agora capturadas em runtime em
// vez de existirem só como comentário. Camada PURAMENTE DE OBSERVAÇÃO: nunca
// decide ok/not-ok (isso continua exclusivo de bus.js) — só registra QUAL
// etapa uma tentativa real de coleta alcançou e, quando uma etapa não passa,
// QUAL componente e QUAL razão pararam ela, com timestamp real de cada marca.
//
// "Recuperação automática" (Prioridade 3, Fail Closed Inteligente):
// markRecovered() sinaliza quando bus.js devolveu o último snapshot bom
// conhecido (fail-closed já existente desde a Fase B) em vez de um
// resultado vazio — para o operador ver que o terminal se recuperou
// sozinho, não que ficou "parado".
export const PIPELINE_STAGES = Object.freeze([
    'recebido',
    'normalizado',
    'validado',
    'sincronizado',
    'distribuido',
]);

function blankRecord(key) {
    return {
        key,
        startedAt: null,
        updatedAt: null,
        stages: { recebido: null, normalizado: null, validado: null, sincronizado: null, distribuido: null },
        failedStage: null,
        failedComponent: null,
        failedReason: null,
        recovered: false,
    };
}

export class PipelineTelemetry {
    constructor() {
        this._byKey = new Map();
    }

    /** Abre uma nova tentativa real para `key` — chamado uma vez por
     *  requestSnapshot() que de fato dispara collect() (nunca em um
     *  cache-hit, que não passa pelo pipeline). Substitui qualquer registro
     *  anterior: só a tentativa mais recente importa para diagnóstico ao
     *  vivo — histórico não é o objetivo aqui (isso é papel de logs, não
     *  de um painel operacional). */
    begin(key) {
        const record = blankRecord(key);
        record.startedAt = Date.now();
        this._byKey.set(key, record);
        return record;
    }

    /** Marca o resultado real de uma etapa nomeada para a tentativa em
     *  aberto de `key`. A primeira etapa que falhar fixa failedStage/
     *  failedComponent/failedReason — etapas posteriores nunca chegam a
     *  rodar, então ficam null (nunca um "ok" fabricado para uma etapa que
     *  não executou). */
    mark(key, stage, ok, { component = null, reason = null } = {}) {
        let record = this._byKey.get(key);
        if (!record) record = this.begin(key);
        const at = Date.now();
        record.stages[stage] = { ok, at, component, reason };
        record.updatedAt = at;
        if (!ok && !record.failedStage) {
            record.failedStage = stage;
            record.failedComponent = component;
            record.failedReason = reason;
        }
        return record;
    }

    /** Sinaliza que, apesar de uma etapa ter falhado nesta tentativa, o Bus
     *  recuperou automaticamente (devolveu o último snapshot bom real) em
     *  vez de deixar o consumidor sem dado algum. */
    markRecovered(key) {
        const record = this._byKey.get(key);
        if (record) record.recovered = true;
    }

    /** Retrato imutável do estado de telemetria mais recente para `key`, ou
     *  null se esta chave nunca disparou uma tentativa real de coleta
     *  (sempre serviu de um cache fresco, ou nunca foi pedida). */
    reportFor(key) {
        const record = this._byKey.get(key);
        if (!record) return null;
        return Object.freeze({
            ...record,
            stages: Object.freeze({ ...record.stages }),
        });
    }
}
