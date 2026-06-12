import asyncio
import logging
import aiohttp
import backoff
from typing import Any, Dict

logger = logging.getLogger("AR10.Core.ImmuneSystem")

def is_fatal_network_pathology(e: Exception) -> bool:
    if isinstance(e, aiohttp.ClientResponseError):
        # Proteção contra falhas de chave corrompida / credencial não sanável
        return e.status in (400, 401, 403)
    return False

class ImmuneSystemAPIClient:
    """
    Glóbulos brancos digitais. Implementa retentativas assíncronas de redes 
    e mitigação inteligente de 'Rate Limit' das corretoras cripto.
    """
    
    def __init__(self, tcp_limit: int = 100, keepalive: int = 60):
        self.session = aiohttp.ClientSession(
            connector=aiohttp.TCPConnector(limit=tcp_limit, keepalive_timeout=keepalive)
        )
        logger.info("[Immune] Sessão imune persistente (TCP Keepalive) instanciada.")

    async def close_system(self):
        if not self.session.closed:
            await self.session.close()
            logger.debug("[Immune] Sessão imunológica encerrada.")

    @backoff.on_exception(
        backoff.expo,
        (aiohttp.ClientError, asyncio.TimeoutError),
        max_tries=7,
        max_time=120,
        giveup=is_fatal_network_pathology,
        jitter=backoff.full_jitter,
        logger=logger
    )
    async def resilient_fetch(self, method: str, url: str, **kwargs) -> Dict[str, Any]:
        try:
            async with self.session.request(method, url, **kwargs) as response:
                if response.status == 429:
                    retry_after = int(response.headers.get('Retry-After', 5))
                    logger.warning(
                        f"[Immune] HTTP 429 Rate Limit detectado em {url}. "
                        f"Refúgio autônomo acionado por {retry_after}s."
                    )
                    await asyncio.sleep(retry_after)
                    response.raise_for_status()

                response.raise_for_status()
                return await response.json()
                
        except aiohttp.ClientResponseError as e:
            logger.error(f"[Immune] Invasão/Falha confirmada no endpoint {url} | Código: {e.status}")
            raise
