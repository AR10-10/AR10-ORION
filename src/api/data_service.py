"""
AR10 ORION V5.0 — DATA SERVICE (NÓ CENTRAL DO HOST LOCAL)

Topologia: a máquina local é o host da aplicação (execução MT5 e processamento
neural com latência zero). A nuvem é estritamente repositório persistente e
hub de sincronização. O acesso externo (iPad etc.) chega via Túnel Reverso
(Cloudflare Tunnel / Tailscale): o serviço escuta APENAS em 127.0.0.1 e o
túnel termina o TLS, entregando https:// e wss:// ao mundo sem abrir
nenhuma porta no roteador.

Responsabilidades:
  - Servir o Cockpit UI e o canal /ws de telemetria (50-100ms)
  - Receber estado dos módulos do organismo via POST /ingest (loopback IPC)
  - Push assíncrono de snapshots para a nuvem e fetch de memórias/comandos
"""

import asyncio
import json
import logging
import os
import time
from collections import deque

from aiohttp import ClientSession, ClientTimeout, web

logger = logging.getLogger("AR10.API.DataService")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
UI_DIR = os.path.join(BASE_DIR, "src", "ui_cockpit")
CONFIG_PATH = os.path.join(BASE_DIR, "config", "data_feeds_config.json")
CREDENTIALS_PATH = os.path.join(BASE_DIR, "config", "encrypted_credentials.env")


def load_credentials(path=CREDENTIALS_PATH):
    """Parser mínimo do cofre .env (sem dependências externas)."""
    credentials = {}
    if not os.path.exists(path):
        logger.warning("🔒 Cofre de credenciais ausente. Rode build_skills_and_data.py.")
        return credentials
    with open(path, encoding="utf-8") as file:
        for line in file:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, value = line.partition("=")
                credentials[key.strip()] = value.strip()
    return credentials


class DataService:
    def __init__(self):
        with open(CONFIG_PATH, encoding="utf-8") as file:
            self.config = json.load(file)

        sync_cfg = self.config.get("cloud_sync", {})
        self.push_interval = sync_cfg.get("push_interval_sec", 5)
        self.fetch_interval = sync_cfg.get("fetch_interval_sec", 15)
        self.batch_max = sync_cfg.get("batch_max_records", 500)
        self.backoff_steps = sync_cfg.get("reconnect_backoff_sec", [1, 2, 4, 8, 16])

        telemetry_cfg = self.config.get("telemetry", {})
        # Cadência do fluxo nervoso para o Cockpit (50-100ms)
        self.telemetry_interval = telemetry_cfg.get("interval_ms", 75) / 1000.0
        self.bind_host = telemetry_cfg.get("bind_host", "127.0.0.1")
        self.bind_port = telemetry_cfg.get("bind_port", 8080)

        credentials = load_credentials()
        self.cloud_url = credentials.get("CLOUD_DB_URL", "").rstrip("/")
        self.cloud_token = credentials.get("CLOUD_DB_TOKEN", "")
        self.ingest_token = credentials.get("INGEST_TOKEN", "")

        self.started_at = time.time()
        # Estado vivo do organismo, atualizado via /ingest pelos módulos locais
        self.state = {
            "sensorial_status": "AGUARDANDO ORGANISMO",
            "ticks_per_sec": 0,
            "xlstm_state": "INICIALIZANDO",
            "vdb_recall": "INATIVO",
            "position_side": "FLAT",
            "session_pnl": 0.0,
            "cortisol": 0.10,
            "dopamine": 0.50,
            "ram_usage": 0.0,
            "vram_usage": 0.0,
            "cloud_sync": "OFFLINE",
        }
        # Buffer de snapshots aguardando persistência na nuvem
        self.outbound_buffer = deque(maxlen=self.batch_max * 4)

    # ------------------------------------------------------------------
    # ROTAS HTTP / WEBSOCKET
    # ------------------------------------------------------------------
    async def index(self, request):
        return web.FileResponse(os.path.join(UI_DIR, "index.html"))

    async def health(self, request):
        return web.json_response({
            "status": "ALIVE",
            "uptime_sec": round(time.time() - self.started_at, 1),
            "cloud_sync": self.state["cloud_sync"],
            "buffered_snapshots": len(self.outbound_buffer),
        })

    # Cabeçalhos que só existem quando a requisição atravessou o túnel/proxy.
    # Módulos locais batem direto no loopback, sem nenhum deles.
    PROXY_HEADERS = ("CF-Connecting-IP", "X-Forwarded-For", "Tailscale-User-Login")

    async def ingest(self, request):
        """
        Módulos do organismo (loopback) injetam estado fresco aqui.
        Escrita vinda através do túnel exige Bearer INGEST_TOKEN — sem isso,
        qualquer pessoa com a URL pública poderia falsificar telemetria.
        """
        came_through_tunnel = any(h in request.headers for h in self.PROXY_HEADERS)
        if came_through_tunnel:
            expected = f"Bearer {self.ingest_token}" if self.ingest_token else None
            if expected is None or request.headers.get("Authorization") != expected:
                logger.warning("⛔ /ingest externo recusado (token ausente ou inválido).")
                raise web.HTTPForbidden(reason="INGEST_TOKEN inválido")
        payload = await request.json()
        self.state.update({k: v for k, v in payload.items() if k in self.state})
        self.outbound_buffer.append({"ts": time.time(), **payload})
        return web.json_response({"accepted": True})

    async def websocket_handler(self, request):
        """
        Canal duplex de telemetria. Sob o túnel, o cliente chega como wss://
        (TLS terminado pelo túnel); aqui o tráfego já é ws local em loopback.
        heartbeat mantém o túnel reverso vivo em períodos de silêncio.
        """
        ws = web.WebSocketResponse(heartbeat=15.0)
        await ws.prepare(request)
        logger.info("📡 Cockpit conectado ao fluxo nervoso (%s)", request.remote)
        try:
            while not ws.closed:
                await ws.send_json(self.state)
                await asyncio.sleep(self.telemetry_interval)
        except ConnectionResetError:
            pass
        finally:
            logger.info("📡 Cockpit desconectado.")
        return ws

    # ------------------------------------------------------------------
    # SINCRONIZAÇÃO COM A NUVEM (repositório persistente / hub)
    # ------------------------------------------------------------------
    def _cloud_headers(self):
        return {"Authorization": f"Bearer {self.cloud_token}"} if self.cloud_token else {}

    async def cloud_push_loop(self):
        """Drena o buffer local para a nuvem em lotes, com backoff em falha."""
        if not self.cloud_url:
            logger.warning("☁️  CLOUD_DB_URL vazio: operando em modo STANDALONE (sem persistência).")
            return
        backoff_idx = 0
        timeout = ClientTimeout(total=10)
        async with ClientSession(timeout=timeout, headers=self._cloud_headers()) as session:
            while True:
                try:
                    if self.outbound_buffer:
                        batch = [self.outbound_buffer.popleft()
                                 for _ in range(min(self.batch_max, len(self.outbound_buffer)))]
                        async with session.post(f"{self.cloud_url}/snapshots", json=batch) as resp:
                            resp.raise_for_status()
                        self.state["cloud_sync"] = "SYNCED"
                        backoff_idx = 0
                    await asyncio.sleep(self.push_interval)
                except asyncio.CancelledError:
                    raise
                except Exception as exc:
                    self.state["cloud_sync"] = "DEGRADED"
                    wait = self.backoff_steps[min(backoff_idx, len(self.backoff_steps) - 1)]
                    backoff_idx += 1
                    logger.error("☁️  Push falhou (%s). Backoff de %ss.", exc, wait)
                    await asyncio.sleep(wait)

    async def cloud_fetch_loop(self):
        """Busca memórias consolidadas/comandos persistidos no hub."""
        if not self.cloud_url:
            return
        timeout = ClientTimeout(total=10)
        async with ClientSession(timeout=timeout, headers=self._cloud_headers()) as session:
            while True:
                try:
                    async with session.get(f"{self.cloud_url}/sync") as resp:
                        if resp.status == 200:
                            remote = await resp.json()
                            self.state.update(
                                {k: v for k, v in remote.items() if k in self.state}
                            )
                except asyncio.CancelledError:
                    raise
                except Exception as exc:
                    logger.error("☁️  Fetch falhou: %s", exc)
                await asyncio.sleep(self.fetch_interval)

    # ------------------------------------------------------------------
    # CICLO DE VIDA
    # ------------------------------------------------------------------
    async def background_tasks(self, app):
        tasks = [
            asyncio.create_task(self.cloud_push_loop()),
            asyncio.create_task(self.cloud_fetch_loop()),
        ]
        yield
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)

    def build_app(self):
        app = web.Application()
        app.router.add_get("/", self.index)
        app.router.add_get("/health", self.health)
        app.router.add_get("/ws", self.websocket_handler)
        app.router.add_post("/ingest", self.ingest)
        app.router.add_static("/static/", path=UI_DIR, name="static")
        app.cleanup_ctx.append(self.background_tasks)
        return app

    def run(self):
        logger.info("🚀 Data Service no host local: http://%s:%s (exponha via túnel reverso)",
                    self.bind_host, self.bind_port)
        web.run_app(self.build_app(), host=self.bind_host, port=self.bind_port)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    DataService().run()
