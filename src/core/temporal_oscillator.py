import asyncio
import time
import logging

logger = logging.getLogger("AR10.Core.Oscillator")

class TemporalOscillator:
    """
    Controlador rítmico do Event Loop para precisão micrométrica e prevenção de 'clock drift'.
    """
    
    def __init__(self, target_frequency_hz: int, max_drift_ms: float = 1.5):
        self.target_frequency = target_frequency_hz
        self.interval_sec = 1.0 / self.target_frequency
        self.max_drift_sec = max_drift_ms / 1000.0
        self.last_tick = time.perf_counter()
        self.drift_accumulator = 0.0

    async def accurate_sleep(self):
        now = time.perf_counter()
        elapsed = now - self.last_tick
        time_to_wait = self.interval_sec - elapsed
        target_wake_time = now + time_to_wait

        # Hibernação cooperativa híbrida
        while True:
            current_time = time.perf_counter()
            if current_time >= target_wake_time:
                break
            
            if target_wake_time - current_time > 0.001:
                await asyncio.sleep(0.0001) # Cede a thread em janelas grandes
            else:
                await asyncio.sleep(0)      # Rendição estrita para alinhamento sub-mili

        actual_wake_time = time.perf_counter()
        self.last_tick = actual_wake_time
        self.drift_accumulator += (actual_wake_time - target_wake_time)
        
        if self.drift_accumulator > self.max_drift_sec:
            logger.warning(
                f"[Oscillator] Entropia cronológica: Drift de {self.drift_accumulator * 1000:.3f} ms."
            )
            self.drift_accumulator = 0.0

    async def run_heartbeat(self, kill_switch: asyncio.Event):
        logger.info(f"[Oscillator] Marcapasso inicializado a {self.target_frequency} Hz.")
        self.last_tick = time.perf_counter()
        while not kill_switch.is_set():
            await self.accurate_sleep()
