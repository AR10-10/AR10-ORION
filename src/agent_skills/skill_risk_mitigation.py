import logging

logger = logging.getLogger("AR10.Skills.Risk")

class RiskMitigationSkill:
    """
    Proteção dinâmica do organismo.
    Dimensiona a posição pelo nível de Cortisol (Amígdala), aplica stop
    adaptativo por volatilidade e arma o circuit breaker em sequência de dor.
    """
    def __init__(self, max_risk_per_trade_pct=0.5, atr_stop_multiplier=1.8,
                 max_consecutive_losses=3):
        self.max_risk_per_trade_pct = max_risk_per_trade_pct
        self.atr_stop_multiplier = atr_stop_multiplier
        self.max_consecutive_losses = max_consecutive_losses
        self.consecutive_losses = 0
        self.circuit_open = False

    def position_size(self, equity, cortisol_level):
        """Cortisol alto comprime a exposição: o medo reduz a mão, nunca a aumenta."""
        if self.circuit_open:
            return 0.0
        fear_brake = max(0.0, 1.0 - cortisol_level)
        risk_capital = equity * (self.max_risk_per_trade_pct / 100.0)
        return risk_capital * fear_brake

    def dynamic_stop(self, entry_price, atr, side):
        """Stop adaptativo ancorado na volatilidade corrente (ATR)."""
        offset = atr * self.atr_stop_multiplier
        return entry_price - offset if side == "LONG" else entry_price + offset

    def register_outcome(self, pnl):
        if pnl < 0:
            self.consecutive_losses += 1
            if self.consecutive_losses >= self.max_consecutive_losses:
                self.circuit_open = True
                logger.critical("⛔ Circuit breaker ARMADO: vias motoras suspensas.")
        else:
            self.consecutive_losses = 0

    def reset_circuit(self):
        """Rearmar exige decisão consciente (Self-Reflection Engine)."""
        self.circuit_open = False
        self.consecutive_losses = 0
        logger.warning("🔁 Circuit breaker rearmado por decisão consciente.")
