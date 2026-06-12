import asyncio
import itertools
import logging
import os
from aiohttp import web

logger = logging.getLogger("AR10.UI.Dashboard")

async def index(request):
    """Serve a interface principal HTML."""
    html_path = os.path.join(os.path.dirname(__file__), "index.html")
    return web.FileResponse(html_path)

async def websocket_handler(request):
    """Canal duplex via WebSockets para telemetria em tempo de execução."""
    ws = web.WebSocketResponse()
    await ws.prepare(request)
    logger.info("📡 Cockpit UI: Terminal conectado ao fluxo nervoso.")
    
    try:
        # Loop assíncrono de telemetria simulada para teste da interface.
        # position_side/session_pnl alimentam o Código Óptico de Trade
        # (Verde #00FF9D = LONG, Vermelho #FF3E52 = SHORT).
        sides = itertools.cycle(["LONG", "SHORT", "FLAT"])
        side, pnl, cortisol = next(sides), 0.0, 0.15
        for tick in itertools.count():
            if ws.closed:
                break
            if tick % 8 == 0:
                side = next(sides)
            pnl += 0.12 if side == "LONG" else -0.09 if side == "SHORT" else 0.0
            cortisol = min(0.95, max(0.05, cortisol + (0.05 if pnl < 0 else -0.03)))
            await ws.send_json({
                "sensorial_status": "ONLINE",
                "ticks_per_sec": 1450,
                "xlstm_state": "ESTÁVEL",
                "vdb_recall": "ATIVO",
                "position_side": side,
                "session_pnl": round(pnl, 2),
                "cortisol": round(cortisol, 2),
                "dopamine": 0.55,
                "ram_usage": 42.1,
                "vram_usage": 3.1
            })
            await asyncio.sleep(1.0)
    except Exception as e:
        logger.error(f"Erro na via de telemetria: {e}")
    finally:
        logger.info("📡 Cockpit UI: Terminal desconectado.")
    return ws

def run_dashboard(host="127.0.0.1", port=8080):
    app = web.Application()
    app.router.add_get("/", index)
    app.router.add_get("/ws", websocket_handler)
    
    current_dir = os.path.dirname(__file__)
    app.router.add_static("/static/", path=current_dir, name="static")
    
    logger.info(f"🚀 Cockpit UI ativo em: http://{host}:{port}")
    web.run_app(app, host=host, port=port)

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run_dashboard()
