//! cyborg_quant_core — AR10 Cyborg 2.0 iPad Runtime
//!
//! READ-ONLY analytics WASM module. Computes rolling indicators (SMA, EMA,
//! STDDEV, Z-SCORE) over a price series held in a fixed shared buffer.
//!
//! Hard boundary (by design, not just by convention): this module exposes
//! no order, signal, execution, or network primitive of any kind. It is
//! pure numeric analytics over caller-supplied data living in WASM linear
//! memory. FAIL_CLOSED inputs (empty/zero/oversized window) return NaN or 0
//! instead of guessing.
//!
//! Fase I (V15 Cap. 16.2, autorizacao explicita da ordem de ignicao):
//! FONTE UNICA, DOIS BINARIOS. Os kernels de reducao (soma, soma de
//! desvios quadrados, max, min) tem duas implementacoes selecionadas em
//! tempo de COMPILACAO por cfg(target_feature = "simd128"):
//!   - build escalar (default) => wasm/cyborg_quant_core.wasm
//!     preserva EXATAMENTE a ordem de operacoes do binario historico
//!     (soma esquerda->direita), entao a rede de 15 testes numericos da
//!     Fase G continua validando o mesmo comportamento de sempre;
//!   - build SIMD (RUSTFLAGS="-C target-feature=+simd128") =>
//!     wasm/cyborg_quant_core_simd.wasm
//!     usa intrinsics f64x2 explicitos (core::arch::wasm32). NOTA DE
//!     HONESTIDADE NUMERICA: a reducao vetorial soma em ordem diferente
//!     (2 acumuladores de lane + colapso no fim). Soma de ponto flutuante
//!     nao e associativa (IEEE 754), entao "bit-a-bit" e matematicamente
//!     impossivel de prometer entre as duas ordens — a equivalencia e
//!     verificada em CI a 10-12 casas decimais pela suite de paridade
//!     (tests/wasm-simd-parity.test.ts), que roda os DOIS binarios lado a
//!     lado contra as mesmas referencias independentes da Fase G.
//!   A EMA permanece escalar nos dois builds: e uma recorrencia serial
//!   (cada passo depende do anterior) — vetoriza-la mudaria o algoritmo,
//!   nao so a ordem, e isso a trava de governanca da Fase G proibe sem
//!   evidencia.
//! A selecao em runtime (Safari com/sem SIMD) acontece em
//! workers/quant-worker.js: sonda WebAssembly.validate + fallback
//! SILENCIOSO para o binario escalar (diretriz 4 da Fase I).

const CAPACITY: usize = 8192;

static mut BUFFER: [f64; CAPACITY] = [0.0; CAPACITY];

/// Pointer to the shared f64 buffer. JS writes price data here via
/// `new Float64Array(memory.buffer, buffer_ptr(), len)` before calling
/// any indicator function.
#[no_mangle]
pub extern "C" fn buffer_ptr() -> *mut f64 {
    core::ptr::addr_of_mut!(BUFFER) as *mut f64
}

#[no_mangle]
pub extern "C" fn buffer_capacity() -> usize {
    CAPACITY
}

fn read_slice(len: usize) -> &'static [f64] {
    let capped = if len > CAPACITY { CAPACITY } else { len };
    unsafe { &*core::ptr::slice_from_raw_parts(core::ptr::addr_of!(BUFFER) as *const f64, capped) }
}

// ─────────────────────────────────────────────────────────────────────────
// Kernels de reducao — caminho ESCALAR (ordem historica preservada).
// ─────────────────────────────────────────────────────────────────────────
#[cfg(not(target_feature = "simd128"))]
fn sum_slice(buf: &[f64]) -> f64 {
    buf.iter().sum()
}

#[cfg(not(target_feature = "simd128"))]
fn sum_sq_dev(buf: &[f64], mean: f64) -> f64 {
    buf.iter().map(|v| (v - mean) * (v - mean)).sum()
}

#[cfg(not(target_feature = "simd128"))]
fn max_slice(buf: &[f64]) -> f64 {
    buf.iter().fold(f64::MIN, |a, &b| if b > a { b } else { a })
}

#[cfg(not(target_feature = "simd128"))]
fn min_slice(buf: &[f64]) -> f64 {
    buf.iter().fold(f64::MAX, |a, &b| if b < a { b } else { a })
}

// ─────────────────────────────────────────────────────────────────────────
// Kernels de reducao — caminho SIMD (f64x2 explicito, Fase I).
// v128_load e tolerante a desalinhamento por especificacao wasm; ainda
// assim BUFFER e um array de f64 (alinhamento natural de 8 bytes).
// ─────────────────────────────────────────────────────────────────────────
#[cfg(target_feature = "simd128")]
use core::arch::wasm32::{
    f64x2_add, f64x2_extract_lane, f64x2_max, f64x2_min, f64x2_mul, f64x2_splat, f64x2_sub,
    v128_load,
};

#[cfg(target_feature = "simd128")]
fn sum_slice(buf: &[f64]) -> f64 {
    let pairs = buf.len() / 2;
    let mut acc = f64x2_splat(0.0);
    for i in 0..pairs {
        let v = unsafe { v128_load(buf.as_ptr().add(i * 2) as *const _) };
        acc = f64x2_add(acc, v);
    }
    let mut total = f64x2_extract_lane::<0>(acc) + f64x2_extract_lane::<1>(acc);
    if buf.len() % 2 == 1 {
        total += buf[buf.len() - 1];
    }
    total
}

#[cfg(target_feature = "simd128")]
fn sum_sq_dev(buf: &[f64], mean: f64) -> f64 {
    let pairs = buf.len() / 2;
    let m = f64x2_splat(mean);
    let mut acc = f64x2_splat(0.0);
    for i in 0..pairs {
        let v = unsafe { v128_load(buf.as_ptr().add(i * 2) as *const _) };
        let d = f64x2_sub(v, m);
        acc = f64x2_add(acc, f64x2_mul(d, d));
    }
    let mut total = f64x2_extract_lane::<0>(acc) + f64x2_extract_lane::<1>(acc);
    if buf.len() % 2 == 1 {
        let d = buf[buf.len() - 1] - mean;
        total += d * d;
    }
    total
}

#[cfg(target_feature = "simd128")]
fn max_slice(buf: &[f64]) -> f64 {
    let pairs = buf.len() / 2;
    let mut acc = f64x2_splat(f64::MIN);
    for i in 0..pairs {
        let v = unsafe { v128_load(buf.as_ptr().add(i * 2) as *const _) };
        acc = f64x2_max(acc, v);
    }
    let mut best = {
        let a = f64x2_extract_lane::<0>(acc);
        let b = f64x2_extract_lane::<1>(acc);
        if b > a { b } else { a }
    };
    if buf.len() % 2 == 1 {
        let last = buf[buf.len() - 1];
        if last > best {
            best = last;
        }
    }
    best
}

#[cfg(target_feature = "simd128")]
fn min_slice(buf: &[f64]) -> f64 {
    let pairs = buf.len() / 2;
    let mut acc = f64x2_splat(f64::MAX);
    for i in 0..pairs {
        let v = unsafe { v128_load(buf.as_ptr().add(i * 2) as *const _) };
        acc = f64x2_min(acc, v);
    }
    let mut best = {
        let a = f64x2_extract_lane::<0>(acc);
        let b = f64x2_extract_lane::<1>(acc);
        if b < a { b } else { a }
    };
    if buf.len() % 2 == 1 {
        let last = buf[buf.len() - 1];
        if last < best {
            best = last;
        }
    }
    best
}

/// Simple Moving Average of the last `window` samples in the first `len`
/// buffer entries. Returns NaN on invalid input (FAIL_CLOSED, not a guess).
#[no_mangle]
pub extern "C" fn sma(len: usize, window: usize) -> f64 {
    if window == 0 || len == 0 || window > len {
        return f64::NAN;
    }
    let buf = read_slice(len);
    let start = len - window;
    sum_slice(&buf[start..len]) / window as f64
}

/// Exponential Moving Average across the first `len` buffer entries.
/// Recorrencia serial — deliberadamente escalar nos dois builds (ver
/// cabecalho).
#[no_mangle]
pub extern "C" fn ema(len: usize, period: f64) -> f64 {
    if len == 0 || period <= 0.0 {
        return f64::NAN;
    }
    let buf = read_slice(len);
    let k = 2.0 / (period + 1.0);
    let mut e = buf[0];
    for &v in &buf[1..len] {
        e = v * k + e * (1.0 - k);
    }
    e
}

/// Sample standard deviation across the first `len` buffer entries.
#[no_mangle]
pub extern "C" fn stddev(len: usize) -> f64 {
    if len < 2 {
        return 0.0;
    }
    let buf = read_slice(len);
    let mean: f64 = sum_slice(buf) / len as f64;
    let var: f64 = sum_sq_dev(buf, mean) / (len as f64 - 1.0);
    var.sqrt()
}

/// Z-score of the last sample relative to the mean/stddev of the first
/// `len` entries. Pure descriptive statistic — not a trade signal.
#[no_mangle]
pub extern "C" fn zscore_last(len: usize) -> f64 {
    if len < 2 {
        return 0.0;
    }
    let buf = read_slice(len);
    let mean: f64 = sum_slice(buf) / len as f64;
    let sd = stddev(len);
    if sd == 0.0 {
        return 0.0;
    }
    (buf[len - 1] - mean) / sd
}

/// Highest value in the first `len` entries.
#[no_mangle]
pub extern "C" fn max_val(len: usize) -> f64 {
    if len == 0 {
        return f64::NAN;
    }
    max_slice(read_slice(len))
}

/// Lowest value in the first `len` entries.
#[no_mangle]
pub extern "C" fn min_val(len: usize) -> f64 {
    if len == 0 {
        return f64::NAN;
    }
    min_slice(read_slice(len))
}

// ─────────────────────────────────────────────────────────────────────────
// Volume Profile — V-MAX Fase 1.3 (Blueprint Fase 1 item 2).
//
// PRECISAO HONESTA (auditoria Fase 1.3, zero repeticao verificada antes de
// escrever isto — nenhuma outra implementacao de Volume Profile existe no
// repo): candles OHLCV carregam UM volume agregado por candle, sem
// distribuicao intra-candle real. O unico tick stream real do codebase e
// MEXC Spot — mercado DIFERENTE dos candles Futures que o chart exibe,
// entao um perfil tick-level para o chart nao e construivel hoje sem
// fabricar granularidade. Este perfil usa a aproximacao padrao para OHLCV:
// o volume de cada candle e distribuido UNIFORMEMENTE pela faixa
// [low, high] dele, proporcional a sobreposicao com cada bucket — uma
// aproximacao DECLARADA, nunca apresentada como tick-level.
//
// Fixed Range vs Session: mesma matematica — a diferenca e so QUAIS
// candles o caller escreve no buffer (janela toda vs desde a abertura da
// sessao). Uma segunda funcao seria duplicacao, nao feature.
//
// Escalar nos DOIS builds (mesma justificativa da EMA): o laco de
// distribuicao e um scatter com faixas dependentes de dados, nao uma
// reducao lane-a-lane — vetorizar mudaria o algoritmo, nao so a ordem.
// Consequencia verificavel: a suite de paridade exige igualdade EXATA
// (bit-a-bit) entre os dois binarios nesta funcao, criterio mais forte que
// o das reducoes SIMD.
// ─────────────────────────────────────────────────────────────────────────

/// Teto de buckets: array local na stack (4KB) + mais buckets do que
/// pixels verticais de qualquer tela real nao acrescenta informacao.
const VP_MAX_BUCKETS: usize = 512;

/// Nucleo puro do Volume Profile — testavel nativamente (cargo test) sem
/// tocar o BUFFER estatico. Devolve None em qualquer dado corrompido
/// (FAIL_CLOSED): NaN/inf, volume negativo, high < low.
fn compute_volume_profile(
    highs: &[f64],
    lows: &[f64],
    volumes: &[f64],
    hist: &mut [f64],
) -> Option<(usize, f64, f64)> {
    let n = highs.len();
    let buckets = hist.len();
    if n == 0 || buckets == 0 || lows.len() != n || volumes.len() != n {
        return None;
    }
    let mut range_min = f64::MAX;
    let mut range_max = f64::MIN;
    for i in 0..n {
        let (h, l, v) = (highs[i], lows[i], volumes[i]);
        if !h.is_finite() || !l.is_finite() || !v.is_finite() || v < 0.0 || h < l {
            return None;
        }
        if l < range_min {
            range_min = l;
        }
        if h > range_max {
            range_max = h;
        }
    }
    for b in hist.iter_mut() {
        *b = 0.0;
    }
    let width = range_max - range_min;
    if width == 0.0 {
        // Caso degenerado REAL: todos os candles no mesmo preco exato —
        // todo o volume pertence de verdade a esse unico preco.
        let mut total = 0.0;
        for &v in volumes {
            total += v;
        }
        hist[0] = total;
        return Some((0, range_min, range_max));
    }
    let bucket_width = width / buckets as f64;
    for i in 0..n {
        let (h, l, v) = (highs[i], lows[i], volumes[i]);
        if v == 0.0 {
            continue;
        }
        if h == l {
            // Candle de preco unico: todo o volume no bucket que o contem.
            let mut b = ((l - range_min) / bucket_width) as usize;
            if b >= buckets {
                b = buckets - 1;
            }
            hist[b] += v;
            continue;
        }
        let candle_width = h - l;
        let mut first = ((l - range_min) / bucket_width) as usize;
        if first >= buckets {
            first = buckets - 1;
        }
        let mut last = ((h - range_min) / bucket_width) as usize;
        if last >= buckets {
            last = buckets - 1;
        }
        for b in first..=last {
            let b_lo = range_min + b as f64 * bucket_width;
            // Ultimo bucket fecha EXATAMENTE em range_max (nao em
            // range_min + buckets*bucket_width, que em ponto flutuante
            // pode ficar um ulp abaixo e vazar volume da borda superior).
            let b_hi = if b + 1 == buckets { range_max } else { range_min + (b + 1) as f64 * bucket_width };
            let lo = if l > b_lo { l } else { b_lo };
            let hi = if h < b_hi { h } else { b_hi };
            let overlap = hi - lo;
            if overlap > 0.0 {
                hist[b] += v * (overlap / candle_width);
            }
        }
    }
    // POC: primeiro bucket com o maior volume — empate resolve para o
    // indice mais baixo, deterministico nos dois builds.
    let mut poc = 0usize;
    let mut best = hist[0];
    for (b, &val) in hist.iter().enumerate().skip(1) {
        if val > best {
            best = val;
            poc = b;
        }
    }
    Some((poc, range_min, range_max))
}

/// Volume Profile sobre candles OHLCV reais no BUFFER compartilhado.
///
/// Layout de ENTRADA (escrito pelo caller antes da chamada):
///   [0..n)    highs
///   [n..2n)   lows
///   [2n..3n)  volumes
/// Layout de SAIDA (escrito por esta funcao, sobrescrevendo a entrada —
/// mesmo canal unico de buffer de toda a API deste modulo):
///   [0..buckets)  histograma (volume por bucket, preco ascendente)
///   [buckets]     range_min real (menor low)
///   [buckets+1]   range_max real (maior high)
/// Retorna o indice do bucket POC (Point of Control) como f64, ou NaN em
/// qualquer entrada invalida (FAIL_CLOSED, nunca um chute).
#[no_mangle]
pub extern "C" fn volume_profile(candle_count: usize, bucket_count: usize) -> f64 {
    if candle_count == 0
        || bucket_count == 0
        || bucket_count > VP_MAX_BUCKETS
        || candle_count.saturating_mul(3) > CAPACITY
    {
        return f64::NAN;
    }
    let full = read_slice(candle_count * 3);
    let highs = &full[0..candle_count];
    let lows = &full[candle_count..candle_count * 2];
    let volumes = &full[candle_count * 2..candle_count * 3];
    let mut hist = [0.0f64; VP_MAX_BUCKETS];
    match compute_volume_profile(highs, lows, volumes, &mut hist[..bucket_count]) {
        None => f64::NAN,
        Some((poc, range_min, range_max)) => {
            // Escrita de saida so DEPOIS de todo o consumo da entrada
            // (hist e local; a regiao dos highs so e sobrescrita aqui).
            unsafe {
                let base = core::ptr::addr_of_mut!(BUFFER) as *mut f64;
                for (b, &val) in hist[..bucket_count].iter().enumerate() {
                    *base.add(b) = val;
                }
                *base.add(bucket_count) = range_min;
                *base.add(bucket_count + 1) = range_max;
            }
            poc as f64
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────
// TrustScoreEngine — V-MAX Fase 2 (Supremacia).
//
// Confiança na FONTE DE DADOS (nunca no mercado): score composto de
// medições reais, complementar ao isDataFresh do Health Monitor (que já
// cobre staleness binária — zero repetição):
//   regularidade  = 1/(1+CV) onde CV = stddev_amostral(gaps)/média(gaps)
//                   sobre os INTERVALOS REAIS de chegada de preço (ms) —
//                   cadência estável (CV→0) => 1; cadência errática => →0.
//                   Reusa os MESMOS kernels sum_slice/sum_sq_dev (escalar/
//                   SIMD) das demais reduções — zero repetição em Rust.
//   convergência  = 1/(1+média(|bps|)/10) sobre as divergências REAIS de
//                   preço entre exchanges (Binance vs Bybit/OKX, quando
//                   LIVE). 10 bps = escala de materialidade documentada
//                   (na média, 10 bps de divergência => componente 0.5) —
//                   parâmetro de julgamento, nunca medição.
//   score         = média dos componentes DISPONÍVEIS: sem divergência
//                   medida (m=0), score = regularidade sozinha e o
//                   componente sai NaN honesto (não medido ≠ perfeito).
//
// Layout do BUFFER na entrada: [gaps_ms (n) | divergencias_bps (m)].
// Na saída: [0]=regularidade, [1]=convergência (NaN se m=0).
// Retorno: score 0..1, ou NaN FAIL_CLOSED (n<2, gap negativo/não-finito,
// média de gaps 0, divergência não-finita, n+m>capacidade).
// ─────────────────────────────────────────────────────────────────────────

const TRUST_DIVERGENCE_SCALE_BPS: f64 = 10.0;

/// Núcleo puro — testável nativamente sem tocar o BUFFER estático.
fn compute_trust_score(gaps: &[f64], divergences_bps: &[f64]) -> Option<(f64, f64, f64)> {
    if gaps.len() < 2 {
        return None;
    }
    for &g in gaps {
        if !g.is_finite() || g < 0.0 {
            return None;
        }
    }
    for &d in divergences_bps {
        if !d.is_finite() {
            return None;
        }
    }
    let n = gaps.len() as f64;
    let mean = sum_slice(gaps) / n;
    if !(mean > 0.0) {
        return None; // cadência real não tem média 0 sobre 2+ amostras — relógio quebrado => fail closed
    }
    let var = sum_sq_dev(gaps, mean) / (n - 1.0);
    let cv = var.sqrt() / mean;
    let regularity = 1.0 / (1.0 + cv);

    if divergences_bps.is_empty() {
        return Some((regularity, regularity, f64::NAN));
    }
    let m = divergences_bps.len() as f64;
    let mut abs_sum = 0.0;
    for &d in divergences_bps {
        abs_sum += if d < 0.0 { -d } else { d };
    }
    let mean_abs_bps = abs_sum / m;
    let convergence = 1.0 / (1.0 + mean_abs_bps / TRUST_DIVERGENCE_SCALE_BPS);
    Some(((regularity + convergence) / 2.0, regularity, convergence))
}

/// TrustScore sobre amostras reais no BUFFER: [gaps_ms (n) | bps (m)].
/// Escreve [0]=regularidade, [1]=convergência; retorna o score (ou NaN).
#[no_mangle]
pub extern "C" fn trust_score(gap_count: usize, divergence_count: usize) -> f64 {
    let total = gap_count.saturating_add(divergence_count);
    if gap_count == 0 || total > CAPACITY {
        return f64::NAN;
    }
    let full = read_slice(total);
    let gaps = &full[0..gap_count];
    let divergences = &full[gap_count..total];
    match compute_trust_score(gaps, divergences) {
        None => f64::NAN,
        Some((score, regularity, convergence)) => {
            unsafe {
                let base = core::ptr::addr_of_mut!(BUFFER) as *mut f64;
                *base = regularity;
                *base.add(1) = convergence;
            }
            score
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────
// Kelly Criterion — Entrega 44 (Biblioteca Matematica Avancada; motor
// escolhido e autorizado pelo Operador via AskUserQuestion, ver
// docs/BIBLIOTECA_MATEMATICA_AVANCADA.md).
//
// Um documento externo ("Ponte de Otimizacao Matematica") chegou junto
// pedindo Kelly + um SignalEngine paralelo (BOS/FVG/EMA -> LONG/SHORT
// proprio) treinado sobre trades SINTETICOS simulados por ele mesmo.
// REJEITADO: isso duplicaria um segundo emissor real de decisao (viola
// LEI 24 do CLAUDE.md -- so o Core Engine emite LONG/SHORT/WAIT) e seu
// detect_regime() repetia, quase palavra por palavra, o bug de ADX/DX ja
// rejeitado na Entrega 43 ("ADX verdadeiro requer smoothing, mas dx ja e
// suficiente"). Nada daquele SignalEngine/regime/trade-sintetico/
// wasm-bindgen entrou aqui -- so a formula pura de Kelly, isolada.
//
// f* = p - (1-p)/b (Kelly 1956, fracao COMPLETA). p = taxa de acerto real,
// b = payoff ratio (ganho medio / perda media, ou R:R). Esta funcao NAO
// decide qual fracao de f* e prudente usar na pratica -- essa politica de
// seguranca (1/2, 1/4, 1/8-Kelly por forca do Comite) ja existe, real e
// graduada, em risk-engine.js (KELLY_FRACTION_TIERS/kellyFractionForForca,
// Fase H) desde antes desta entrega. O que risk-engine.js nao tinha ate
// agora era uma taxa de acerto REAL para alimentar p — usava p=0.5 fixo
// por falta de historico (documentado ali: "nenhuma probabilidade e
// fabricada"). Esta primitiva Rust espelha a MESMA formula que
// risk-engine.js passa a calcular inline em JS quando tem amostra real
// (trivial o bastante — 2 operacoes aritmeticas — para nao justificar uma
// dependencia WASM sincrona dentro de um modulo que se declara
// deliberadamente "zero imports, sincrono" por design); fica aqui
// disponivel e testada para consumidores futuros em Worker (nenhum
// caminho ao vivo chama esta funcao ainda nesta entrega — ver PR).
//
// FAIL_CLOSED: win_rate fora de [0,1] ou nao-finito, ou payoff_ratio <= 0
// ou nao-finito => NaN, nunca um chute. Resultado sempre clampado em
// [0,1]: nunca sugere fracao negativa (sem edge = sem posicao) nem
// alavancagem (>1) — mesmo teto duro que MAX_POSITION_PCT em
// risk-engine.js.
// ─────────────────────────────────────────────────────────────────────────

/// Kelly Criterion, fracao COMPLETA (f*), a partir de estatisticas reais.
#[no_mangle]
pub extern "C" fn kelly_fraction(win_rate: f64, payoff_ratio: f64) -> f64 {
    if !win_rate.is_finite() || win_rate < 0.0 || win_rate > 1.0 {
        return f64::NAN;
    }
    if !payoff_ratio.is_finite() || payoff_ratio <= 0.0 {
        return f64::NAN;
    }
    let f_star = win_rate - (1.0 - win_rate) / payoff_ratio;
    f_star.max(0.0).min(1.0)
}

/// Build identifier exposed for diagnostics. 1000 = escalar; 1001 = SIMD —
/// a suite de paridade e o worker usam isto para saber qual variante
/// realmente carregou.
#[cfg(not(target_feature = "simd128"))]
#[no_mangle]
pub extern "C" fn engine_version() -> u32 {
    1_000
}

#[cfg(target_feature = "simd128")]
#[no_mangle]
pub extern "C" fn engine_version() -> u32 {
    1_001
}

// ─────────────────────────────────────────────────────────────────────────
// Testes nativos (cargo test, alvo host, caminho escalar) — exercitam o
// NUCLEO puro sem tocar o BUFFER estatico (paralelismo de testes seguro).
// A validacao do binario wasm real continua nas suites TS (Fase G +
// paridade), que instanciam os .wasm compilados de verdade.
// ─────────────────────────────────────────────────────────────────────────
#[cfg(test)]
mod tests {
    use super::{compute_volume_profile, kelly_fraction};

    #[test]
    fn perfil_simples_distribui_proporcional_a_sobreposicao() {
        // 1 candle cobrindo exatamente a faixa toda: volume uniforme.
        let highs = [110.0];
        let lows = [100.0];
        let vols = [40.0];
        let mut hist = [0.0; 4];
        let (poc, min, max) = compute_volume_profile(&highs, &lows, &vols, &mut hist).unwrap();
        assert_eq!(min, 100.0);
        assert_eq!(max, 110.0);
        for b in hist {
            assert!((b - 10.0).abs() < 1e-9);
        }
        assert_eq!(poc, 0); // empate perfeito => indice mais baixo, deterministico
    }

    #[test]
    fn poc_e_o_bucket_de_maior_volume_real() {
        // Dois candles: um cobre a metade de baixo, outro (mais volume) a de cima.
        let highs = [105.0, 110.0];
        let lows = [100.0, 105.0];
        let vols = [10.0, 30.0];
        let mut hist = [0.0; 2];
        let (poc, _, _) = compute_volume_profile(&highs, &lows, &vols, &mut hist).unwrap();
        assert!((hist[0] - 10.0).abs() < 1e-9);
        assert!((hist[1] - 30.0).abs() < 1e-9);
        assert_eq!(poc, 1);
    }

    #[test]
    fn volume_total_e_conservado() {
        let highs = [103.0, 107.5, 110.0, 104.2];
        let lows = [100.0, 102.0, 106.0, 101.1];
        let vols = [12.5, 7.25, 19.0, 3.75];
        let mut hist = [0.0; 24];
        compute_volume_profile(&highs, &lows, &vols, &mut hist).unwrap();
        let total: f64 = hist.iter().sum();
        let expected: f64 = vols.iter().sum();
        assert!((total - expected).abs() < 1e-9);
    }

    #[test]
    fn candle_de_preco_unico_vai_inteiro_para_um_bucket() {
        let highs = [100.0, 105.0];
        let lows = [100.0, 95.0];
        let vols = [50.0, 10.0];
        let mut hist = [0.0; 10];
        compute_volume_profile(&highs, &lows, &vols, &mut hist).unwrap();
        // O doji em 100.0 esta na metade da faixa [95,105] => bucket 5.
        assert!(hist[5] >= 50.0);
        let total: f64 = hist.iter().sum();
        assert!((total - 60.0).abs() < 1e-9);
    }

    #[test]
    fn faixa_degenerada_todos_no_mesmo_preco() {
        let highs = [100.0, 100.0];
        let lows = [100.0, 100.0];
        let vols = [5.0, 7.0];
        let mut hist = [0.0; 8];
        let (poc, min, max) = compute_volume_profile(&highs, &lows, &vols, &mut hist).unwrap();
        assert_eq!(poc, 0);
        assert_eq!(min, 100.0);
        assert_eq!(max, 100.0);
        assert_eq!(hist[0], 12.0);
    }

    #[test]
    fn fail_closed_em_dado_corrompido() {
        let mut hist = [0.0; 4];
        // NaN no high
        assert!(compute_volume_profile(&[f64::NAN], &[1.0], &[1.0], &mut hist).is_none());
        // volume negativo
        assert!(compute_volume_profile(&[2.0], &[1.0], &[-1.0], &mut hist).is_none());
        // high < low (candle impossivel)
        assert!(compute_volume_profile(&[1.0], &[2.0], &[1.0], &mut hist).is_none());
        // vazio
        assert!(compute_volume_profile(&[], &[], &[], &mut hist).is_none());
        // tamanhos desalinhados
        assert!(compute_volume_profile(&[2.0, 3.0], &[1.0], &[1.0], &mut hist).is_none());
    }

    #[test]
    fn trust_score_cadencia_perfeita_e_1() {
        // gaps idênticos => CV 0 => regularidade 1; sem divergência medida
        // => score = regularidade, convergência NaN honesta.
        let (score, reg, conv) = super::compute_trust_score(&[200.0, 200.0, 200.0, 200.0], &[]).unwrap();
        assert!((score - 1.0).abs() < 1e-12);
        assert!((reg - 1.0).abs() < 1e-12);
        assert!(conv.is_nan());
    }

    #[test]
    fn trust_score_cadencia_erratica_degrada() {
        let (uniform, _, _) = super::compute_trust_score(&[200.0, 200.0, 200.0, 200.0], &[]).unwrap();
        let (erratic, _, _) = super::compute_trust_score(&[50.0, 800.0, 20.0, 1500.0], &[]).unwrap();
        assert!(erratic < uniform);
        assert!(erratic > 0.0 && erratic < 1.0);
    }

    #[test]
    fn trust_score_convergencia_na_escala_documentada() {
        // média |bps| = 10 => convergência exatamente 0.5 (escala documentada).
        let (_, _, conv) = super::compute_trust_score(&[200.0, 200.0], &[10.0, -10.0]).unwrap();
        assert!((conv - 0.5).abs() < 1e-12);
        // divergência zero real => convergência 1.
        let (_, _, conv0) = super::compute_trust_score(&[200.0, 200.0], &[0.0]).unwrap();
        assert!((conv0 - 1.0).abs() < 1e-12);
    }

    #[test]
    fn trust_score_fail_closed() {
        // menos de 2 gaps
        assert!(super::compute_trust_score(&[200.0], &[]).is_none());
        // gap negativo (relógio andou para trás)
        assert!(super::compute_trust_score(&[200.0, -5.0], &[]).is_none());
        // gap não-finito
        assert!(super::compute_trust_score(&[200.0, f64::NAN], &[]).is_none());
        // média zero (todos os gaps 0)
        assert!(super::compute_trust_score(&[0.0, 0.0], &[]).is_none());
        // divergência não-finita
        assert!(super::compute_trust_score(&[200.0, 200.0], &[f64::INFINITY]).is_none());
    }

    #[test]
    fn borda_superior_nao_vaza_volume() {
        // Candle cujo high e exatamente range_max: o ultimo bucket fecha
        // em range_max, nada se perde por um ulp de ponto flutuante.
        let highs = [110.0, 110.0];
        let lows = [90.0, 108.0];
        let vols = [20.0, 6.0];
        let mut hist = [0.0; 7]; // 7 buckets: largura nao-exata em binario
        compute_volume_profile(&highs, &lows, &vols, &mut hist).unwrap();
        let total: f64 = hist.iter().sum();
        assert!((total - 26.0).abs() < 1e-9);
    }

    #[test]
    fn kelly_fraction_cenario_base_da_risk_engine_js() {
        // Mesmo cenario verificavel a mao de risk-engine.test.ts (BASE):
        // p=0.5, b=2 => f* = 0.5 - 0.5/2 = 0.25.
        assert!((kelly_fraction(0.5, 2.0) - 0.25).abs() < 1e-12);
    }

    #[test]
    fn kelly_fraction_payoff_1_para_1_com_p_05_e_breakeven() {
        // b=1, p=0.5 => f* = 0.5 - 0.5/1 = 0.0 (sem assimetria de payoff,
        // mesmo caso que risk-engine.js rotula "kelly_nao_positivo").
        assert_eq!(kelly_fraction(0.5, 1.0), 0.0);
    }

    #[test]
    fn kelly_fraction_negativo_e_clampado_em_zero_nunca_sugere_reversao() {
        // p=0.4, b=1 => f* = 0.4 - 0.6 = -0.2 => clamp 0 (sem edge = sem
        // posicao, nunca uma fracao negativa/invertida).
        assert_eq!(kelly_fraction(0.4, 1.0), 0.0);
    }

    #[test]
    fn kelly_fraction_taxa_de_acerto_perfeita_e_clampada_em_1_nunca_alavancagem() {
        // p=1.0 => f* = 1.0 - 0 = 1.0 (ja <= 1, confirma o teto duro).
        assert_eq!(kelly_fraction(1.0, 3.0), 1.0);
    }

    #[test]
    fn kelly_fraction_fail_closed_em_entrada_invalida() {
        assert!(kelly_fraction(-0.1, 2.0).is_nan()); // win_rate < 0
        assert!(kelly_fraction(1.1, 2.0).is_nan()); // win_rate > 1
        assert!(kelly_fraction(f64::NAN, 2.0).is_nan());
        assert!(kelly_fraction(0.5, 0.0).is_nan()); // payoff_ratio <= 0
        assert!(kelly_fraction(0.5, -1.0).is_nan());
        assert!(kelly_fraction(0.5, f64::NAN).is_nan());
        assert!(kelly_fraction(0.5, f64::INFINITY).is_nan());
    }
}
