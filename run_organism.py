import asyncio
import logging
import numpy as np
from src.core.shared_memory_bus import TensorMemoryBus
from src.core.temporal_oscillator import TemporalOscillator
from src.core.lymphatic_purger import LymphaticPurger

# Configuração de Logs Unificada do Sistema
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("AR10.Orion.Core")

async def main():
    logger.info("Iniciando Organismo Vivo AR10 Orion V5.0...")
    kill_switch = asyncio.Event()

    # 1. Alocando Canal Sensorial de Latência Zero na Memória RAM Física O(1)
    # Exemplo: Reservando espaço para matriz de Order Book (10 níveis de Bid/Ask)
    bus_order_book = TensorMemoryBus(
        name="orion_orderbook_shm", 
        shape=(10, 4), 
        dtype=np.float32, 
        is_creator=True
    )
    tensor_ob = bus_order_book.connect()
    logger.info("Barramento Sensorial Zero-Copy estabelecido.")

    # 2. Inicializando Marcapasso de Sincronização Cronobiológica HFT a 1000 Hz (Sem Drift)
    oscillator = TemporalOscillator(target_frequency_hz=1000, max_drift_ms=1.5)

    # 3. Inicializando Purgador Linfático (Drenagem automática de fragmentação VRAM CUDA)
    purger = LymphaticPurger(memory_critical_pct=80.0, gc_interval=30)

    # 4. Agendamento concorrente das vias autonômicas do organismo
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
        # Procedimento de encerramento limpo para evitar processos zumbis
        kill_switch.set()
        bus_order_book.close()
        logger.info("Homeostase desfeita. Barramentos e ponteiros desalocados com sucesso.")

if __name__ == "__main__":
    asyncio.run(main())
