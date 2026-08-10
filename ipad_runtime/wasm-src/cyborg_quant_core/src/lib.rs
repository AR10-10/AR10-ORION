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

/// Simple Moving Average of the last `window` samples in the first `len`
/// buffer entries. Returns NaN on invalid input (FAIL_CLOSED, not a guess).
#[no_mangle]
pub extern "C" fn sma(len: usize, window: usize) -> f64 {
    if window == 0 || len == 0 || window > len {
        return f64::NAN;
    }
    let buf = read_slice(len);
    let start = len - window;
    let sum: f64 = buf[start..len].iter().sum();
    sum / window as f64
}

/// Exponential Moving Average across the first `len` buffer entries.
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
    let mean: f64 = buf.iter().sum::<f64>() / len as f64;
    let var: f64 = buf.iter().map(|v| (v - mean) * (v - mean)).sum::<f64>() / (len as f64 - 1.0);
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
    let mean: f64 = buf.iter().sum::<f64>() / len as f64;
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
    let buf = read_slice(len);
    buf.iter().fold(f64::MIN, |a, &b| if b > a { b } else { a })
}

/// Lowest value in the first `len` entries.
#[no_mangle]
pub extern "C" fn min_val(len: usize) -> f64 {
    if len == 0 {
        return f64::NAN;
    }
    let buf = read_slice(len);
    buf.iter().fold(f64::MAX, |a, &b| if b < a { b } else { a })
}

/// Build identifier exposed for diagnostics (date encoded by the build script).
#[no_mangle]
pub extern "C" fn engine_version() -> u32 {
    1_000
}
