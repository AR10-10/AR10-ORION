import gc
import logging
import torch
import psutil
import asyncio

logger = logging.getLogger("AR10.Core.LymphaticPurger")

class LymphaticPurger:
    """
    Ação profilática contínua de lixo residual para manter o Caching Allocator CUDA
    saudável sem degradar o micro-scalping com invocações drásticas recorrentes.
    """
    
    def __init__(self, memory_critical_pct: float = 85.0, gc_interval: int = 60):
        self.memory_critical_pct = memory_critical_pct
        self.gc_interval = gc_interval
        self.cuda_available = torch.cuda.is_available()
        
        if self.cuda_available:
            torch.cuda.set_per_process_memory_fraction(1.0)
            logger.info("[Lymphatic] Drenos linfáticos e barramentos CUDA monitorados.")
        else:
            logger.warning("[Lymphatic] ATENÇÃO: Substrato CUDA inativo (Modo CPU CPU-only fallback).")

    async def run_purger(self, kill_switch: asyncio.Event):
        logger.info(f"[Lymphatic] Contração autônoma basal definida a cada {self.gc_interval}s.")
        while not kill_switch.is_set():
            await asyncio.sleep(self.gc_interval)
            self._purge_cycle()

    def _purge_cycle(self):
        gc.collect()
        ram_usage = psutil.virtual_memory().percent
        
        if self.cuda_available:
            gpu_reserved = torch.cuda.memory_reserved() / (1024**3)
            total_gpu_mem = torch.cuda.get_device_properties(0).total_memory / (1024**3)
            
            gpu_usage_pct = (gpu_reserved / total_gpu_mem) * 100 if total_gpu_mem > 0 else 0.0
            
            if gpu_usage_pct > self.memory_critical_pct:
                logger.warning(
                    f"[Lymphatic] Entropia VRAM próxima à asfixia ({gpu_usage_pct:.1f}%). "
                    "Iniciando manobra de desfragmentação (empty_cache)."
                )
                torch.cuda.empty_cache()
            
            logger.debug(f"[Lymphatic] Baseline checado -> RAM: {ram_usage}% | VRAM Reservada: {gpu_usage_pct:.1f}%")
        else:
            if ram_usage > self.memory_critical_pct:
                logger.warning(f"[Lymphatic] Pressão crítica de RAM do sistema principal: {ram_usage}%.")
