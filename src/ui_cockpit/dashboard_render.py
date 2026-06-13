from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

PROJECT_ROOT = Path(__file__).resolve().parents[2]
SRC_ROOT = PROJECT_ROOT / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from agent_skills.skill_audio_nlp import audio_urgency
from agent_skills.skill_order_flow import decode_order_flow
from agent_skills.skill_risk_mitigation import risk_limiter
from agent_skills.skill_self_evolution import evolution_status
from brain.amygdala_stress import cortisol_state
from brain.cortex_rnn_backbone import macro_trend_state
from brain.dopamine_rl import reward_shadow_state
from brain.hippocampus_vdb import episodic_matches
from brain.synaptic_plasticity import fusion_state
from core.temporal_oscillator import TemporalOscillator
from data_ingestion.pipeline_orchestrator import public_feed_snapshot, synchronize_timestamps
from gateways import mexc_gateway, mt5_gateway
from market_analysis.public_market_analyzer import analyze_market


ASSETS_DIR = PROJECT_ROOT / "src" / "ui_cockpit" / "assets"
REUSE_MATRIX = PROJECT_ROOT / "docs" / "reuse_analysis" / "ORION_REUSE_MATRIX.json"


def load_reuse_matrix() -> dict:
    with REUSE_MATRIX.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def guardrails() -> dict:
    return {
        "mode": "READ_ONLY",
        "shadow_assisted": True,
        "real_orders_enabled": False,
        "live_enabled": False,
        "demo_orders_enabled": False,
        "broker_actions": "blocked",
        "copy_secrets": False,
        "copy_large_databases": False,
        "fail_closed": True,
    }


def telemetry() -> dict:
    cortex = macro_trend_state()
    matches = episodic_matches()
    amygdala = cortisol_state()
    fusion = fusion_state(
        hidden_pulse=float(cortex["hidden_state_pulse"]),
        memory_match=float(matches[0]["match_pct"]),
        cortisol=float(amygdala["cortisol"]),
    )
    dopamine = reward_shadow_state()
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "oscillator": TemporalOscillator().current_rate(volatility=0.35),
        "feeds": synchronize_timestamps(public_feed_snapshot()),
        "sensory": {
            "order_flow": decode_order_flow(),
            "audio": audio_urgency(),
        },
        "brain": {
            "cortex": cortex,
            "hippocampus": matches,
            "amygdala": amygdala,
            "plasticity": fusion,
            "dopamine": dopamine,
        },
        "skills": {
            "risk": risk_limiter(float(amygdala["cortisol"])),
            "self_evolution": evolution_status(),
        },
        "gateways": [mt5_gateway.gateway_status(), mexc_gateway.gateway_status()],
        "guardrails": guardrails(),
    }


class OrionHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ASSETS_DIR), **kwargs)

    def _send_json(self, payload: dict | list, status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)
        if path == "/api/status":
            self._send_json({"service": "AR10 Orion Cyborg", "ok": True, **guardrails()})
            return
        if path == "/api/orion/reuse-matrix":
            self._send_json(load_reuse_matrix())
            return
        if path == "/api/orion/telemetry":
            self._send_json(telemetry())
            return
        if path == "/api/orion/guardrails":
            self._send_json(guardrails())
            return
        if path == "/api/orion/market-analysis":
            symbol = query.get("symbol", ["BTCUSDT"])[0]
            interval = query.get("interval", ["15m"])[0]
            pressure = int(query.get("pressure", ["30"])[0])
            self._send_json(analyze_market(symbol=symbol, interval=interval, pressure_minutes=pressure))
            return
        if path in {"/", "/index.html"}:
            self.path = "/index.html"
        super().do_GET()

    def log_message(self, fmt: str, *args) -> None:
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


def run(host: str = "127.0.0.1", port: int = 8970) -> None:
    server = ThreadingHTTPServer((host, port), OrionHandler)
    print(f"AR10 Orion Cyborg READ_ONLY: http://{host}:{port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    run(os.environ.get("ORION_HOST", "127.0.0.1"), int(os.environ.get("ORION_PORT", "8970")))
