import logging

logger = logging.getLogger("AR10.Brain.Amygdala")

class AmygdalaStressEngine:
    """Sensor de Medo - Modula os níveis de Cortisol baseados no risco de mercado."""
    def __init__(self, base_cortisol=0.1):
        self.cortisol_level = base_cortisol

    def process_stress_signals(self, drawdown_pct, volatility_spike):
        # Elevação de cortisol linear em função do drawdown
        self.cortisol_level += (drawdown_pct * 0.5) + (volatility_spike * 0.2)
        self.cortisol_level = min(self.cortisol_level, 1.0) # Teto orgânico
        
        if self.cortisol_level > 0.7:
            logger.warning(f"Amígdala ativada: Cortisol Elevado ({self.cortisol_level:.2f})")
            
        return self.cortisol_level
