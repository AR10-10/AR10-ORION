// zigzag-engine.js — v16.0 PRO MAX §4/§6.3 ("ZigZag: deviation %"). Motor
// puro do indicador ZigZag clássico (reversão por limiar percentual +
// profundidade mínima de barras) — DISTINTO do fractal de K barras fixas
// já compartilhado em fractal-swings.js (support/structure/FVG usam K=2
// fixo, uma janela de confirmação constante; ZigZag usa limiar % +
// profundidade, os 2 parâmetros reais do indicador nomeado — confirmado
// via pesquisa real (WebSearch: StockCharts ChartSchool, Corporate
// Finance Institute, Capital.com) antes de implementar qualquer variante
// própria, Disciplina de trabalho item 2 do CLAUDE.md).
//
// Definição de referência (2 parâmetros reais do indicador padrão):
//   deviation % — variação mínima desde o último extremo rastreado para
//     confirmar um novo pivô (default comum de mercado: 5%, faixa usual
//     5-30% conforme volatilidade/timeframe do ativo).
//   depth (profundidade) — número mínimo de barras entre o pivô candidato
//     e a barra que confirma a reversão — filtro extra contra zigue-
//     zagues artificialmente apertados mesmo quando o limiar % é cruzado
//     cedo.
//
// Só pivôs CONFIRMADOS são retornados — a "perna em formação" (ainda sem
// reversão de deviation% oposta) nunca aparece na saída: mostrar um pivô
// que ainda pode mudar seria o oposto do fail-closed (Regra de Ouro 3)
// deste projeto. DADOS_INSUFICIENTES é reservado pra candles REALMENTE
// insuficientes (menos que o necessário pra sequer 1 comparação) — um
// mercado real que nunca se move o bastante pra cruzar o limiar produz
// points:[] com status OK (resposta real: "sem pivô relevante nesta
// janela com este limiar", não "faltou dado").
//
// Graduado do Laboratório de Evolução na Entrega 47 (pedido direto do
// Operador) — importado por engine-bridge.ts (computeZigZag) e ligado ao
// gráfico real via CHART_LAYER_IDS/ZigZagPlugin.tsx, display-only (LEI 24).
// Motor puro abaixo inalterado desde o isolamento original — ver
// QUARANTINE.md para o histórico da graduação.

// ACHADO REAL (auditoria "milímetro a milímetro" pedida pelo Operador,
// 2026-09-01): este era o único motor GRADUADO do repositório sem
// `export const metadata` — a auto-declaração que
// `quarantine-registry.test.ts` cruza contra a árvore-resumo e as seções
// detalhadas do QUARANTINE.md (a "terceira fonte de verdade"). Sem
// metadata, `statusDe()` devolve `null` e o teste PULA este arquivo em
// silêncio nas 3 checagens que dependem dela — não é uma mentira ativa
// (o import em engine-bridge.ts é real, conferido por leitura direta),
// mas era um ponto cego real na própria rede que este projeto construiu
// para pegar exatamente esse tipo de coisa. hmm-regime-model.js tinha o
// mesmo buraco — ver o cabeçalho dele.
export const metadata = {
    engine: 'zigzag-engine',
    description: 'ZigZag classico (deviation % + profundidade minima de barras) sobre candles reais — pivos CONFIRMADOS apenas, nunca a perna em formacao.',
    concepts: [
        'ZigZag classico (deviation % + depth, StockCharts/CFI/Capital.com)',
        'Rastreamento de dois lados simultaneo ate a primeira confirmacao (dir=0)',
        'Fail-closed: dado insuficiente = DADOS_INSUFICIENTES; mercado parado = OK com points:[]',
    ],
    required_data: ['ohlcv_series com high/low reais'],
    status: 'ACTIVE_READ_ONLY',
    limitations: [
        'Distinto do fractal de K barras fixas (fractal-swings.js): ZigZag usa limiar percentual + profundidade, os 2 parametros reais do indicador nomeado — nao e um sinonimo do fractal.',
        'A perna mais recente, ainda sem reversao de deviation% confirmada, nunca aparece na saida — mostrar um pivo que pode mudar seria o oposto do fail-closed deste projeto.',
        'Direcao (HIGH/LOW) e um FATO do pivo, nunca uma emissao de LONG/SHORT (LEI 24): o unico emissor de direcao continua sendo o Core Engine.',
    ],
};

export const ZIGZAG_DEFAULT_DEVIATION_PCT = 5;
export const ZIGZAG_DEFAULT_DEPTH = 3;

/**
 * @typedef {{ index: number, price: number, kind: 'HIGH' | 'LOW' }} ZigZagPoint
 * @typedef {{ status: 'OK' | 'DADOS_INSUFICIENTES', points: ZigZagPoint[] }} ZigZagResult
 *
 * @param {Array<{h?: number, l?: number, high?: number, low?: number}>} candles
 * @param {number} [deviationPct]
 * @param {number} [depth]
 * @returns {ZigZagResult}
 */
export function computeZigZag(candles, deviationPct = ZIGZAG_DEFAULT_DEVIATION_PCT, depth = ZIGZAG_DEFAULT_DEPTH) {
    if (!Array.isArray(candles) || candles.length < depth + 1) {
        return { status: 'DADOS_INSUFICIENTES', points: [] };
    }
    if (!Number.isFinite(deviationPct) || deviationPct <= 0 || !Number.isFinite(depth) || depth < 0) {
        return { status: 'DADOS_INSUFICIENTES', points: [] };
    }

    const hi = (c) => c.h ?? c.high;
    const lo = (c) => c.l ?? c.low;
    for (const c of candles) {
        if (!Number.isFinite(hi(c)) || !Number.isFinite(lo(c))) {
            return { status: 'DADOS_INSUFICIENTES', points: [] };
        }
    }

    const points = [];
    // dir: 0 = ainda indeterminado (rastreia os 2 lados simultaneamente),
    // 1 = topo em formação (rastreando um pivô de ALTA), -1 = fundo em
    // formação (rastreando um pivô de BAIXA). extHigh/extLow seguem o
    // extremo candidato de cada lado — só o lado relevante ao `dir` atual
    // continua se movendo; o lado oposto fica congelado até a próxima
    // confirmação (mesmo princípio do indicador de referência: um pivô só
    // é revisto depois de confirmado).
    //
    // extHighIdx/extLowIdx são DELIBERADAMENTE 2 variáveis separadas (não
    // 1 índice compartilhado): enquanto dir===0 os dois lados avançam na
    // mesma iteração, e um único `extIdx` compartilhado contaminaria o
    // gate de `depth` (e o índice do pivô publicado) de um lado com o
    // avanço do outro lado — achado real de um teste que falhava
    // (zigzag-engine.test.ts) até esta separação.
    let dir = 0;
    let extHighIdx = 0;
    let extLowIdx = 0;
    let extHigh = hi(candles[0]);
    let extLow = lo(candles[0]);

    for (let i = 1; i < candles.length; i++) {
        const h = hi(candles[i]);
        const l = lo(candles[i]);

        if (dir >= 0 && h > extHigh) { extHigh = h; extHighIdx = i; }
        if (dir <= 0 && l < extLow) { extLow = l; extLowIdx = i; }

        if (dir >= 0) {
            // reversão pra baixo confirma o TOPO rastreado como pivô de ALTA.
            const reversedDown = l <= extHigh * (1 - deviationPct / 100);
            if (reversedDown && i - extHighIdx >= depth) {
                points.push({ index: extHighIdx, price: extHigh, kind: 'HIGH' });
                dir = -1;
                extLow = l;
                extLowIdx = i;
                continue;
            }
        }
        if (dir <= 0) {
            // reversão pra cima confirma o FUNDO rastreado como pivô de BAIXA.
            const reversedUp = h >= extLow * (1 + deviationPct / 100);
            if (reversedUp && i - extLowIdx >= depth) {
                points.push({ index: extLowIdx, price: extLow, kind: 'LOW' });
                dir = 1;
                extHigh = h;
                extHighIdx = i;
                continue;
            }
        }
    }

    return { status: 'OK', points };
}
