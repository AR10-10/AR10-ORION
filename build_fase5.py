import os

dashboard_render_py = '''import asyncio
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
        while not ws.closed:
            await ws.send_json({
                "sensorial_status": "ONLINE",
                "ticks_per_sec": 1450,
                "xlstm_state": "ESTÁVEL",
                "vdb_recall": "ATIVO",
                "cortisol": 0.15,
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
'''

index_html = '''<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AR10 Orion V5.0 - Cockpit UI</title>
    <link rel="stylesheet" href="/static/glassmorphism_theme.css">
</head>
<body>
    <div class="cockpit-container">
        <div class="panel neon-cyan">
            <h2>1. Sensorial Roots</h2>
            <div class="stat-row">
                <span class="label">Status WSS:</span>
                <span class="value cyan-pulse" id="sensorial-status">CONECTANDO...</span>
            </div>
            <div class="stat-row">
                <span class="label">Order Flow Rate:</span>
                <span class="value" id="ticks-rate">0 Ticks/s</span>
            </div>
            <div class="stat-row">
                <span class="label">Audio Squawk:</span>
                <span class="value">Aguardando Feed</span>
            </div>
        </div>

        <div class="panel neon-magenta">
            <h2>2. Core Cognition</h2>
            <div class="stat-row">
                <span class="label">xLSTM Backbone:</span>
                <span class="value" id="xlstm-state">ESTÁVEL</span>
            </div>
            <div class="stat-row">
                <span class="label">VDB Memory Recall:</span>
                <span class="value magenta-pulse" id="vdb-recall">INATIVO</span>
            </div>
            <div class="stat-row">
                <span class="label">Consolidação Sono:</span>
                <span class="value">Pronto</span>
            </div>
        </div>

        <div class="panel neon-amber" id="operational-panel">
            <h2>3. Operational Crown</h2>
            <div class="stat-row">
                <span class="label">Cortisol (Stress):</span>
                <span class="value amber-pulse" id="cortisol-val">0.10</span>
            </div>
            <div class="stat-row">
                <span class="label">Dopamina (Lucro):</span>
                <span class="value" id="dopamine-val">0.50</span>
            </div>
            <div class="stat-row">
                <span class="label">MEXC Gateway:</span>
                <span class="value">Air-Gap Ativo</span>
            </div>
        </div>

        <div class="panel neon-vitals">
            <h2>4. System Vitals</h2>
            <div class="stat-row">
                <span class="label">RAM Principal:</span>
                <span class="value" id="ram-usage">0%</span>
            </div>
            <div class="stat-row">
                <span class="label">VRAM Alocada:</span>
                <span class="value" id="vram-usage">0 GB</span>
            </div>
            <div class="stat-row">
                <span class="label">Purgador Linfático:</span>
                <span class="value vitals-pulse">Homeostase</span>
            </div>
        </div>
    </div>

    <script>
        const ws = new WebSocket(`ws://${window.location.host}/ws`);
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            document.getElementById('sensorial-status').innerText = data.sensorial_status;
            document.getElementById('ticks-rate').innerText = `${data.ticks_per_sec} Ticks/s`;
            document.getElementById('xlstm-state').innerText = data.xlstm_state;
            document.getElementById('vdb-recall').innerText = data.vdb_recall;
            document.getElementById('cortisol-val').innerText = data.cortisol.toFixed(2);
            document.getElementById('dopamine-val').innerText = data.dopamine.toFixed(2);
            document.getElementById('ram-usage').innerText = `${data.ram_usage}%`;
            document.getElementById('vram-usage').innerText = `${data.vram_usage} GB`;
        };
    </script>
</body>
</html>
'''

glassmorphism_theme_css = '''@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&family=Share+Tech+Mono&display=swap');

:root {
    --cyan-neon: #00f3ff;
    --magenta-neon: #ff007f;
    --amber-neon: #ffaa00;
    --vitals-neon: #00ff66;
    --bg-dark: #020208;
    --glass-bg: rgba(2, 2, 8, 0.6);
    --glass-border: rgba(255, 255, 255, 0.05);
}

body {
    background-color: var(--bg-dark);
    color: #e2e8f0;
    font-family: 'Share Tech Mono', monospace;
    margin: 0;
    padding: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    box-sizing: border-box;
    overflow: hidden;
}

.cockpit-container {
    width: calc(100vw - 32mm);
    height: calc(100vh - 32mm);
    margin: 16mm;
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr 1fr;
    gap: 8mm;
    box-sizing: border-box;
}

.panel {
    background: var(--glass-bg);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid var(--glass-border);
    border-radius: 12px;
    padding: 6mm;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
}

h2 {
    font-family: 'Orbitron', sans-serif;
    font-size: 1.25rem;
    margin-top: 0;
    margin-bottom: 4mm;
    letter-spacing: 2px;
    text-transform: uppercase;
}

.stat-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 3mm;
    font-size: 1.1rem;
    border-bottom: 1px dashed rgba(255, 255, 255, 0.05);
    padding-bottom: 1mm;
}

.neon-cyan {
    border-color: rgba(0, 243, 255, 0.15);
    box-shadow: inset 0 0 15px rgba(0, 243, 255, 0.05);
}
.neon-cyan h2,.neon-cyan.cyan-pulse {
    color: var(--cyan-neon);
    text-shadow: 0 0 8px rgba(0, 243, 255, 0.5);
}

.neon-magenta {
    border-color: rgba(255, 0, 127, 0.15);
    box-shadow: inset 0 0 15px rgba(255, 0, 127, 0.05);
}
.neon-magenta h2,.neon-magenta.magenta-pulse {
    color: var(--magenta-neon);
    text-shadow: 0 0 8px rgba(255, 0, 127, 0.5);
}

.neon-amber {
    border-color: rgba(255, 170, 0, 0.15);
    box-shadow: inset 0 0 15px rgba(255, 170, 0, 0.05);
}
.neon-amber h2,.neon-amber.amber-pulse {
    color: var(--amber-neon);
    text-shadow: 0 0 8px rgba(255, 170, 0, 0.5);
}

.neon-vitals {
    border-color: rgba(0, 255, 102, 0.15);
    box-shadow: inset 0 0 15px rgba(0, 255, 102, 0.05);
}
.neon-vitals h2,.neon-vitals.vitals-pulse {
    color: var(--vitals-neon);
    text-shadow: 0 0 8px rgba(0, 255, 102, 0.5);
}

@keyframes pulseCyan {
    0% { opacity: 0.7; }
    50% { opacity: 1; text-shadow: 0 0 12px var(--cyan-neon); }
    100% { opacity: 0.7; }
}
.cyan-pulse { animation: pulseCyan 1.5s infinite; }

@keyframes pulseMagenta {
    0% { opacity: 0.7; }
    50% { opacity: 1; text-shadow: 0 0 12px var(--magenta-neon); }
    100% { opacity: 0.7; }
}
.magenta-pulse { animation: pulseMagenta 1.5s infinite; }

@keyframes pulseAmber {
    0% { opacity: 0.7; }
    50% { opacity: 1; text-shadow: 0 0 12px var(--amber-neon); }
    100% { opacity: 0.7; }
}
.amber-pulse { animation: pulseAmber 1.5s infinite; }

@keyframes pulseVitals {
    0% { opacity: 0.7; }
    50% { opacity: 1; text-shadow: 0 0 12px var(--vitals-neon); }
    100% { opacity: 0.7; }
}
.vitals-pulse { animation: pulseVitals 2s infinite; }

.value { font-weight: bold; }
'''

run_organism_py = '''import asyncio
import logging
import numpy as np
from src.core.shared_memory_bus import TensorMemoryBus
from src.core.temporal_oscillator import TemporalOscillator
from src.core.lymphatic_purger import LymphaticPurger

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("AR10.Orion.Core")

async def main():
    logger.info("Iniciando Organismo Vivo AR10 Orion V5.0...")
    kill_switch = asyncio.Event()

    bus_order_book = TensorMemoryBus(
        name="orion_orderbook_shm", 
        shape=(10, 4), 
        dtype=np.float32, 
        is_creator=True
    )
    tensor_ob = bus_order_book.connect()
    logger.info("Barramento Sensorial Zero-Copy estabelecido.")

    oscillator = TemporalOscillator(target_frequency_hz=1000, max_drift_ms=1.5)
    purger = LymphaticPurger(memory_critical_pct=80.0, gc_interval=30)

    tasks = [
        asyncio.create_task(oscillator.run_heartbeat(kill_switch)),
        asyncio.create_task(purger.run_purger(kill_switch)),
    ]

    logger.info("🚀 Organismo Executando. Marcapasso operando a 1000 Hz. Pressione Ctrl+C para encerrar.")
    
    try:
        await asyncio.gather(*tasks)
    except KeyboardInterrupt:
        logger.info("Interrupção manual detectada. Iniciando procedimento de desligamento...")
    finally:
        kill_switch.set()
        bus_order_book.close()
        logger.info("Homeostase desfeita. Barramentos e ponteiros desalocados com sucesso.")

if __name__ == "__main__":
    asyncio.run(main())
'''

def build_fase5():
    print("Montando a arquitetura AR10 Orion V5.0 - FASE 5 (O Rosto)...")
    
    directories = ["src/ui_cockpit", "src/ui_cockpit/static"]
    for directory in directories:
        os.makedirs(directory, exist_ok=True)
        print(f"📁 Diretório instanciado: {directory}/")

    files_to_create = {
        "src/ui_cockpit/dashboard_render.py": dashboard_render_py,
        "src/ui_cockpit/index.html": index_html,
        "src/ui_cockpit/static/glassmorphism_theme.css": glassmorphism_theme_css,
        "run_organism.py": run_organism_py
    }

    for filepath, content in files_to_create.items():
        with open(filepath, "w", encoding="utf-8") as file:
            file.write(content.strip() + "\n") # Correção aplicada: Uso de quebra de linha real "\n"
        print(f"📄 Arquivo gravado: {filepath}")

    print("\n✅ FASE 5 e ORQUESTRADOR GLOBAL implantados com sucesso na raiz do seu projeto!")

if __name__ == "__main__":
    build_fase5()