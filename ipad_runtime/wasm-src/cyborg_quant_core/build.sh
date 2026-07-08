#!/usr/bin/env bash
# build.sh — compila os DOIS binarios do Quant Core (Fase I / V15 Cap. 16.2)
# a partir da MESMA fonte (src/lib.rs, kernels cfg-gated):
#   wasm/cyborg_quant_core.wasm       escalar (engine_version 1000)
#   wasm/cyborg_quant_core_simd.wasm  simd128 (engine_version 1001)
# A selecao em runtime (com fallback silencioso) vive em
# workers/quant-worker.js. A equivalencia numerica entre os dois e
# verificada em CI por ramber-ui/tests/wasm-simd-parity.test.ts.
set -euo pipefail
cd "$(dirname "$0")"

OUT_DIR="../../wasm"
TARGET="wasm32-unknown-unknown"
ARTIFACT="target/${TARGET}/release/cyborg_quant_core.wasm"

echo "== build escalar =="
cargo build --release --target "${TARGET}"
cp "${ARTIFACT}" "${OUT_DIR}/cyborg_quant_core.wasm"

echo "== build simd128 =="
RUSTFLAGS="-C target-feature=+simd128" cargo build --release --target "${TARGET}"
cp "${ARTIFACT}" "${OUT_DIR}/cyborg_quant_core_simd.wasm"

ls -la "${OUT_DIR}"/cyborg_quant_core*.wasm
