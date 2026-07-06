// regime-history.js — registro de transições de regime (Fase D / V15
// Cap. 5: "Mudanças de regime serão registradas para análise histórica").
// Em memória, por sessão, com teto fixo — mesma decisão de RAM previsível
// do CandleRingBuffer: nada persiste em disco porque este app não tem (por
// design pós-purge) camada de vault/IndexedDB viva; quando a V15 definir
// persistência real, ela consome esta mesma classe.
const MAX_TRANSITIONS = 50;

export class RegimeHistory {
    constructor() {
        this._byKey = new Map();
    }

    _stateFor(key) {
        let state = this._byKey.get(key);
        if (!state) {
            state = { current: null, transitions: [] };
            this._byKey.set(key, state);
        }
        return state;
    }

    /** Registra a leitura atual. Só uma MUDANÇA real (regime OU direção
     *  diferentes) gera transição — leituras repetidas do mesmo regime não
     *  inflam o histórico. Retorna { changed, startedAt }: startedAt é o
     *  timestamp real de quando o regime VIGENTE começou (para a UI mostrar
     *  "regime X há N min" sem inventar idade). */
    record(key, regime, direction, price, at = Date.now()) {
        const state = this._stateFor(key);
        const cur = state.current;
        if (cur && cur.regime === regime && cur.direction === direction) {
            return { changed: false, startedAt: cur.since };
        }
        state.transitions.push({
            from: cur ? cur.regime : null,
            from_direction: cur ? cur.direction : null,
            to: regime,
            to_direction: direction,
            price: Number.isFinite(price) ? price : null,
            at,
        });
        if (state.transitions.length > MAX_TRANSITIONS) state.transitions.shift();
        state.current = { regime, direction, since: at };
        return { changed: true, startedAt: at };
    }

    /** Transições registradas (mais antiga primeiro), cópia defensiva. */
    historyFor(key) {
        return (this._byKey.get(key)?.transitions ?? []).slice();
    }

    currentFor(key) {
        return this._byKey.get(key)?.current ?? null;
    }
}
