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
    use super::compute_volume_profile;

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
}
