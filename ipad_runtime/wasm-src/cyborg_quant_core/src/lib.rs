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
