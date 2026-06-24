#!/usr/bin/env python3
"""Builds AR10_CYBORG_LOCAL_PACK_V1.ar10pack — the local install package
for the iPad Safari Runtime.

Format: AR10PACK_JSON_V1 — a single UTF-8 JSON file. Chosen deliberately
over a real ZIP so the in-browser installer needs zero third-party
decompression library (no CDN, no eval, nothing beyond JSON.parse + the
built-in Web Crypto API). Not a Windows executable; an inert local
install container for the PWA's Local Pack Manager.

Run from ipad_runtime/:  python3 tools/build_pack.py
Outputs:
  - AR10_CYBORG_LOCAL_PACK_V1.ar10pack   (the package itself)
  - pack/checksums.sha256                 (human/CLI-verifiable sidecar)
"""
import base64
import hashlib
import json
import os

ROOT = os.path.join(os.path.dirname(__file__), "..")
PACK_DIR = os.path.join(ROOT, "pack")
OUT_PACK = os.path.join(ROOT, "AR10_CYBORG_LOCAL_PACK_V1.ar10pack")
OUT_CHECKSUMS = os.path.join(PACK_DIR, "checksums.sha256")

# Caminhos relativos a ipad_runtime/ — viram as chaves usadas pelo
# instalador (storage.saveFile(relPath, bytes)) e pelo checksums.sha256.
PAYLOAD_FILES = [
    "wasm/cyborg_quant_core.wasm",
    "data/btcusdt_replay.json",
]


def sha256_of(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        h.update(f.read())
    return h.hexdigest()


def package_checksum(checksums_by_path):
    lines = sorted(f"{k}:{v}" for k, v in checksums_by_path.items() if k != "_package")
    text = "\n".join(lines)
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def main():
    files_b64 = {}
    checksums = {}
    for rel in PAYLOAD_FILES:
        abs_path = os.path.join(ROOT, rel)
        with open(abs_path, "rb") as f:
            data = f.read()
        files_b64[rel] = base64.b64encode(data).decode("ascii")
        checksums[rel] = hashlib.sha256(data).hexdigest()

    checksums["_package"] = package_checksum(checksums)

    with open(os.path.join(PACK_DIR, "manifest.pack.json")) as f:
        manifest = json.load(f)
    with open(os.path.join(PACK_DIR, "manifest.models.json")) as f:
        models_manifest = json.load(f)
    with open(os.path.join(PACK_DIR, "runtime_config.json")) as f:
        runtime_config = json.load(f)

    pack = {
        "format": "AR10PACK_JSON_V1",
        "package": "AR10_CYBORG_LOCAL_PACK_V1",
        "generated_by": "tools/build_pack.py",
        "manifest": manifest,
        "models_manifest": models_manifest,
        "runtime_config": runtime_config,
        "checksums": checksums,
        "files": files_b64,
    }

    with open(OUT_PACK, "w") as f:
        json.dump(pack, f, separators=(",", ":"))

    with open(OUT_CHECKSUMS, "w") as f:
        for rel in PAYLOAD_FILES:
            f.write(f"{checksums[rel]}  {rel}\n")
        f.write(f"# _package (sha256 of sorted 'path:hash' lines joined by \\n): {checksums['_package']}\n")

    size = os.path.getsize(OUT_PACK)
    print(f"wrote {OUT_PACK} ({size} bytes)")
    print(f"wrote {OUT_CHECKSUMS}")
    for rel in PAYLOAD_FILES:
        print(f"  sha256({rel}) = {checksums[rel]}")
    print(f"  sha256(_package)        = {checksums['_package']}")


if __name__ == "__main__":
    main()
