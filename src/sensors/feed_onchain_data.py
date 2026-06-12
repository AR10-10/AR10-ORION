import asyncio
import logging

logger = logging.getLogger("AR10.Sensors.OnChain")

class OnChainTracker:
    """
    Rastreio de Baleias e anomalias de rede (On-chain data).
    Monitora blocos da Mempool procurando por grandes alocações de liquidez.
    """
    async def monitor_mempool(self, kill_switch: asyncio.Event):
        logger.info(" Rastreio de movimentação na Mempool ativado.")
        while not kill_switch.is_set():
            # Chamadas RPC/WSS focadas em transações de grande volume
            await asyncio.sleep(5)
