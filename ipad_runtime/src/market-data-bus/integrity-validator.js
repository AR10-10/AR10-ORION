// integrity-validator.js — Validação (Fase B / V15 Cap. 2/4: "Normalizer ->
// Integrity Validator"). Checa a série de candles JÁ normalizada (ver
// normalizer.js) como um CONJUNTO — não campo isolado, mas a coerência real
// entre os campos de uma linha e entre linhas consecutivas. Rejeita a série
// inteira (fail-closed, mesma filosofia de probe.js/schema.js) em vez de
// tentar consertar ou descartar linha a linha: uma série com uma
// inconsistência estrutural (ex.: high < low, timestamps fora de ordem) é
// sinal de que algo no meio do caminho corrompeu o dado, não que uma única
// vela isolada é ruim — silenciosamente podar essa linha esconderia o
// problema em vez de reportá-lo.
export function validateCandleSeries(candles) {
    const errors = [];
    if (!Array.isArray(candles) || candles.length === 0) {
        return { valid: false, errors: ['serie_vazia'] };
    }

    let prevT = -Infinity;
    for (let i = 0; i < candles.length; i++) {
        const c = candles[i];
        if (c.o <= 0 || c.h <= 0 || c.l <= 0 || c.c <= 0) errors.push(`preco_nao_positivo_no_indice_${i}`);
        if (c.v < 0) errors.push(`volume_negativo_no_indice_${i}`);
        if (c.h < c.l) errors.push(`high_menor_que_low_no_indice_${i}`);
        if (c.h < Math.max(c.o, c.c)) errors.push(`high_abaixo_de_open_ou_close_no_indice_${i}`);
        if (c.l > Math.min(c.o, c.c)) errors.push(`low_acima_de_open_ou_close_no_indice_${i}`);
        if (c.t <= prevT) errors.push(`timestamp_nao_estritamente_crescente_no_indice_${i}`);
        prevT = c.t;
    }

    return { valid: errors.length === 0, errors };
}
