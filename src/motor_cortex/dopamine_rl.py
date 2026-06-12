import logging

logger = logging.getLogger("AR10.Motor.RL")

class DopamineRLEngine:
    """
    Feedback Loop Analítico.
    Injeta Dopamina (reforço positivo) ou aciona Cortisol (dor) baseado 
    no fechamento financeiro Real (PnL) dos atuadores.
    """
    def __init__(self, dopamine_scale=1.0):
        self.dopamine_scale = dopamine_scale
        self.current_dopamine = 0.5 # Estado Basal

    def register_trade_result(self, pnl_percentage):
        if pnl_percentage > 0:
            reward = pnl_percentage * self.dopamine_scale
            self.current_dopamine = min(1.0, self.current_dopamine + reward)
            logger.info(f" Trade Lucrativo (+{pnl_percentage:.2f}%). Recompensa neural de Dopamina: {self.current_dopamine:.2f}")
        else:
            penalty = abs(pnl_percentage)
            self.current_dopamine = max(0.0, self.current_dopamine - penalty)
            logger.warning(f" Drawdown detectado ({pnl_percentage:.2f}%). Reduzindo Dopamina e engajando vias de dor sistêmica.")
        
        return self.current_dopamine
