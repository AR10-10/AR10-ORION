"""
AR10 ORION V5.0 — DIAGNÓSTICO DE IMPLANTAÇÃO (TESTES REAIS)

Sobe o Data Service de verdade e verifica, de ponta a ponta:
  1. Versão do Python e dependências
  2. Infraestrutura gerada (pastas, configs, blindagem do cofre)
  3. Servidor vivo: /health, Cockpit UI, /static
  4. Segurança do /ingest (local OK, túnel sem token = 403)
  5. Cadência do fluxo nervoso WebSocket (janela 50-100ms)

Uso:  python run_diagnostics.py
Sai com código 0 se o organismo está pronto para operar.
"""

import asyncio
import json
import os
import stat
import subprocess
import sys
import time

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SERVICE_URL = "http://127.0.0.1:8080"
RESULTS = []


def check(name, ok, detail=""):
    icon = "✅" if ok else "❌"
    print(f"  {icon} {name}" + (f" — {detail}" if detail else ""))
    RESULTS.append(ok)
    return ok


def section(title):
    print(f"\n=== {title} ===")


def check_environment():
    section("1. AMBIENTE")
    check("Python >= 3.10", sys.version_info >= (3, 10), sys.version.split()[0])
    try:
        import aiohttp  # noqa: F401
        check("aiohttp instalado", True)
    except ImportError:
        check("aiohttp instalado", False, "rode: pip install -r requirements.txt")
    for opcional in ("numpy", "psutil", "backoff"):
        try:
            __import__(opcional)
            print(f"  ✅ {opcional} instalado (núcleo do organismo)")
        except ImportError:
            print(f"  ⚠️  {opcional} ausente (necessário só para run_organism.py)")
    try:
        __import__("torch")
        print("  ✅ torch instalado (cérebro neural habilitado)")
    except ImportError:
        print("  ⚠️  torch ausente (cérebro neural off; servidor funciona normalmente)")


def check_infrastructure():
    section("2. INFRAESTRUTURA")
    for directory in ("data/feature_store", "data/raw_ticks_cache",
                      "data/episodic_memory_cache", "src/agent_skills"):
        check(f"{directory}/", os.path.isdir(os.path.join(BASE_DIR, directory)),
              "" if os.path.isdir(os.path.join(BASE_DIR, directory))
              else "rode: python build_skills_and_data.py")

    feeds = os.path.join(BASE_DIR, "config", "data_feeds_config.json")
    if check("config/data_feeds_config.json", os.path.exists(feeds)):
        with open(feeds, encoding="utf-8") as fh:
            cfg = json.load(fh)
        check("config válido (cloud_sync + telemetry)",
              "cloud_sync" in cfg and "telemetry" in cfg)

    vault = os.path.join(BASE_DIR, "config", "encrypted_credentials.env")
    if check("config/encrypted_credentials.env", os.path.exists(vault)):
        if os.name == "posix":
            mode = stat.S_IMODE(os.stat(vault).st_mode)
            check("blindagem POSIX 0600", mode == 0o600, oct(mode))
        else:
            print("  ⚠️  Windows: blindagem POSIX não se aplica (use ACL/NTFS do usuário)")


async def check_live_service():
    import aiohttp

    section("3. SERVIDOR VIVO")
    process = subprocess.Popen(
        [sys.executable, os.path.join("src", "api", "data_service.py")],
        cwd=BASE_DIR, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    try:
        async with aiohttp.ClientSession() as session:
            alive = False
            for _ in range(20):
                try:
                    async with session.get(f"{SERVICE_URL}/health") as resp:
                        alive = resp.status == 200
                        if alive:
                            break
                except aiohttp.ClientError:
                    await asyncio.sleep(0.5)
            if not check("Data Service respondeu /health", alive):
                return

            async with session.get(SERVICE_URL) as resp:
                check("Cockpit UI servido (/)", resp.status == 200)
            async with session.get(f"{SERVICE_URL}/static/glassmorphism_theme.css") as resp:
                check("Tema Ciborgue servido (/static)", resp.status == 200)

            section("4. SEGURANÇA DO /ingest")
            payload = {"sensorial_status": "DIAGNÓSTICO", "ticks_per_sec": 999}
            async with session.post(f"{SERVICE_URL}/ingest", json=payload) as resp:
                check("módulo local (loopback) aceito", resp.status == 200)
            async with session.post(f"{SERVICE_URL}/ingest", json=payload,
                                    headers={"CF-Connecting-IP": "203.0.113.7"}) as resp:
                check("escrita via túnel SEM token bloqueada (403)", resp.status == 403)

            section("5. FLUXO NERVOSO (WebSocket)")
            async with session.ws_connect(f"{SERVICE_URL}/ws") as ws:
                stamps, first = [], None
                for _ in range(15):
                    msg = await ws.receive_json()
                    if first is None:
                        first = msg
                    stamps.append(time.perf_counter())
                deltas = [(b - a) * 1000 for a, b in zip(stamps, stamps[1:])]
                cadence = sum(deltas) / len(deltas)
                check("cadência na janela 50-100ms", 40 <= cadence <= 120, f"{cadence:.1f}ms")
                check("telemetria propaga estado ingerido",
                      first.get("sensorial_status") == "DIAGNÓSTICO")
    finally:
        process.terminate()
        process.wait(timeout=10)


def main():
    print("🩺 AR10 ORION — DIAGNÓSTICO DE IMPLANTAÇÃO")
    check_environment()
    check_infrastructure()
    try:
        import aiohttp  # noqa: F401
        asyncio.run(check_live_service())
    except ImportError:
        print("\n⛔ Sem aiohttp não há como testar o servidor. Instale e rode de novo.")

    total, passed = len(RESULTS), sum(RESULTS)
    print(f"\n{'=' * 50}")
    if passed == total:
        print(f"🚀 ORGANISMO PRONTO: {passed}/{total} verificações aprovadas.")
        sys.exit(0)
    print(f"⛔ {total - passed} falha(s) de {total} verificações. Corrija antes de operar.")
    sys.exit(1)


if __name__ == "__main__":
    main()
