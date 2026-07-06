// ensemble-engine.js — Consensus Engine / Ensemble Probabilístico (Fase F
// / V15 Cap. 20 Fase F; Cap. 9 da Parte 2: "cada motor entrega direção/
// qualidade/peso; o Consensus combina todas as evidências em uma
// distribuição probabilística única; nenhum motor individual possui
// autoridade absoluta").
//
// ALGORITMO (clássico, nomeado, auditável): LINEAR OPINION POOL — média
// ponderada de distribuições de opinião (Stone 1961/DeGroot 1974), o
// método clássico de agregação de comitê que a diretriz da Fase F oferece
// como alternativa ("média ponderada"). Cada membro do comitê emite uma
// distribuição de opinião sobre {ALTA, BAIXA, NEUTRO}; o pool é
//   O_pool = Σ w_i · O_i / Σ w_i
// com w_i vindos da matriz de pesos adaptativos por regime (Fase D) — os
// "ponderadores dinâmicos oficiais" da diretriz 2. Este arquivo é o
// consumidor explícito que a Fase D deixou contratado.
//
// HONESTIDADE SOBRE "PROBABILÍSTICO" (mesma regra do R:R da Fase 6 e do
// BREAKOUT da Fase D): a distribuição de saída é a OPINIÃO AGREGADA DO
// COMITÊ (fração da massa de opinião ponderada em cada direção) — NÃO é a
// probabilidade de o mercado subir/cair. Calibrar isso exigiria histórico
// de acertos (backtest) que esta base não tem; pela mesma razão a
// "confiança histórica" sugerida na diretriz 3 é indisponível de forma
// honesta, e os pesos dinâmicos vêm do REGIME VIGENTE (Fase D) — o
// autoaprendizado estatístico da V15 (Cap. 12/13) recalibra estes pesos
// quando existir evidência real registrada.
//
// HIERARQUIA INVIOLÁVEL: esta leitura NUNCA gera, altera ou bloqueia o
// LONG/SHORT/WAIT do Core Engine — é o comitê consultivo das lógicas
// SECUNDÁRIAS, exibido ao lado (mesma regra do Lorentziano/HTF/GMIL/
// Regime). read_only em toda saída.
//
// Zero atraso de processamento (diretriz 3): matemática síncrona pura
// sobre ≤ 6 objetos minúsculos por ciclo — nenhuma rede, nenhum worker,
// nenhuma alocação relevante; roda dentro do useMemo já existente da UI.
import { getSensitivity } from '../market-regime/weight-matrix.js';

export const ENSEMBLE_DIRECTIONS = Object.freeze({
    ALTA: 'ALTA',
    BAIXA: 'BAIXA',
    NEUTRO: 'NEUTRO',
});

// Peso de um membro cujo regime não modula (membro externo já ponderado
// na origem, ou regime indisponível): 1.0 = "sem modulação", nunca um
// boost.
const UNMODULATED_WEIGHT = 1;

/** Distribuição degenerada a partir de um rótulo determinístico real
 *  (estrutura ALTA/BAIXA/LATERAL). O membro acredita integralmente na
 *  própria leitura — isto é a opinião real dele, não uma probabilidade de
 *  acerto. LATERAL/desconhecido => opinião 100% NEUTRO. null => null
 *  (membro sem leitura fica FORA do comitê, nunca um voto fabricado). */
export function opinionFromLabel(label) {
    if (label === null || label === undefined) return null;
    if (label === 'ALTA') return { alta: 1, baixa: 0, neutro: 0 };
    if (label === 'BAIXA') return { alta: 0, baixa: 1, neutro: 0 };
    return { alta: 0, baixa: 0, neutro: 1 };
}

/** Distribuição a partir de um lean contínuo em [-1,1] (GMIL): massa
 *  direcional proporcional ao módulo, resto em NEUTRO — mapeamento linear
 *  documentado, mesma semântica do lean na origem. */
export function opinionFromLean(lean) {
    if (lean === null || !Number.isFinite(lean)) return null;
    const clamped = Math.max(-1, Math.min(1, lean));
    return {
        alta: Math.max(clamped, 0),
        baixa: Math.max(-clamped, 0),
        neutro: 1 - Math.abs(clamped),
    };
}

/** Distribuição a partir de um voto com confiança REAL (k-NN Lorentziano:
 *  confidence = fração real dos vizinhos que votou no rótulo vencedor).
 *  A massa restante (1−c) vai para NEUTRO — não sabemos como os vizinhos
 *  restantes se dividiram entre as outras classes, e chutar essa divisão
 *  seria fabricação; massa desconhecida = massa neutra (conservador). */
export function opinionFromVote(direction, confidence) {
    if (!direction || !Number.isFinite(confidence)) return null;
    const c = Math.max(0, Math.min(1, confidence));
    if (direction === 'ALTA' || direction === 'LONG') return { alta: c, baixa: 0, neutro: 1 - c };
    if (direction === 'BAIXA' || direction === 'SHORT') return { alta: 0, baixa: c, neutro: 1 - c };
    return { alta: 0, baixa: 0, neutro: 1 };
}

function insufficient(reason) {
    return Object.freeze({
        status: 'DADOS_INSUFICIENTES',
        status_reason: reason,
        direcao: null,
        opiniao: null,
        forca: null,
        forca_ajustada: null,
        membros: Object.freeze([]),
        regime_aplicado: null,
        peso_qualidade_dados: null,
        read_only: true,
    });
}

/** Comitê de Validação (Ensemble Probabilístico).
 *  @param {{
 *    members: Array<{id: string, familia: string|null, opiniao: {alta:number,baixa:number,neutro:number}|null}>,
 *    regime?: string|null,
 *    dataQualityWeight?: number|null,
 *  }} input
 *  - members: cada lógica secundária com sua opinião já mapeada (pelas
 *    funções puras acima). opiniao null => membro excluído desta leitura.
 *  - regime: regime vigente da Fase D — seleciona a linha da matriz de
 *    pesos. null/desconhecido => todos os pesos 1 (sem base real para
 *    modular, não se modula).
 *  - dataQualityWeight: peso 0..1 do Data Quality Layer (Fase C, snapshot
 *    do Bus) — amortece a FORÇA reportada (forca_ajustada), nunca muda a
 *    direção: dado ruim enfraquece a leitura, não a inverte. */
export function buildEnsembleConsensus({ members, regime = null, dataQualityWeight = null } = {}) {
    if (!Array.isArray(members)) return insufficient('sem_membros');

    const contributing = [];
    for (const member of members) {
        const o = member?.opiniao;
        if (!o || ![o.alta, o.baixa, o.neutro].every(Number.isFinite)) continue;
        const regimeWeight = member.familia ? getSensitivity(regime, member.familia) : null;
        const peso = regimeWeight ?? UNMODULATED_WEIGHT;
        if (peso <= 0) continue;
        contributing.push({ id: member.id, familia: member.familia ?? null, peso, opiniao: o });
    }

    if (contributing.length === 0) {
        return insufficient('nenhum_membro_com_leitura_real_nesta_janela');
    }

    const totalWeight = contributing.reduce((acc, m) => acc + m.peso, 0);
    const pooled = contributing.reduce(
        (acc, m) => ({
            alta: acc.alta + (m.peso / totalWeight) * m.opiniao.alta,
            baixa: acc.baixa + (m.peso / totalWeight) * m.opiniao.baixa,
            neutro: acc.neutro + (m.peso / totalWeight) * m.opiniao.neutro,
        }),
        { alta: 0, baixa: 0, neutro: 0 },
    );

    // Direção do comitê: maior massa direcional; empate exato entre alta e
    // baixa (ou domínio neutro) => NEUTRO — um comitê dividido não tem
    // direção, e reportar uma seria fabricação.
    const direcao = pooled.alta > pooled.baixa && pooled.alta > pooled.neutro
        ? ENSEMBLE_DIRECTIONS.ALTA
        : pooled.baixa > pooled.alta && pooled.baixa > pooled.neutro
            ? ENSEMBLE_DIRECTIONS.BAIXA
            : ENSEMBLE_DIRECTIONS.NEUTRO;

    // Força = desequilíbrio direcional do comitê (0 = dividido/neutro,
    // 1 = unânime numa direção). NÃO é probabilidade de acerto.
    const forca = Math.abs(pooled.alta - pooled.baixa);
    const qualityOk = Number.isFinite(dataQualityWeight);
    const forcaAjustada = qualityOk
        ? forca * Math.max(0, Math.min(1, dataQualityWeight))
        : null;

    return Object.freeze({
        status: 'OK',
        status_reason: 'linear_opinion_pool_sobre_membros_reais',
        direcao,
        opiniao: Object.freeze(pooled),
        forca,
        forca_ajustada: forcaAjustada,
        // Explicabilidade (V15 Cap. 13): cada membro com a opinião real e o
        // peso realmente aplicado — a leitura é auditável linha a linha.
        membros: Object.freeze(contributing.map((m) => Object.freeze({ ...m, opiniao: Object.freeze({ ...m.opiniao }) }))),
        regime_aplicado: regime ?? null,
        peso_qualidade_dados: qualityOk ? dataQualityWeight : null,
        read_only: true,
    });
}
