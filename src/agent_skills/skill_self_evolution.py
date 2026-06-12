import logging
from collections import deque

logger = logging.getLogger("AR10.Skills.Evolution")

class SelfEvolutionSkill:
    """
    Motor evolutivo do agente.
    Audita janelas de performance e PROPÕE micro-ajustes no alpha da
    plasticidade sináptica (LoRA). Nenhuma mutação é aplicada aqui:
    a aprovação final pertence ao Self-Reflection Engine.
    """
    def __init__(self, window_size=50, min_win_rate=0.45, alpha_step=0.05):
        self.trade_window = deque(maxlen=window_size)
        self.min_win_rate = min_win_rate
        self.alpha_step = alpha_step

    def record_trade(self, pnl):
        self.trade_window.append(pnl)

    def performance_report(self):
        if not self.trade_window:
            return {"trades": 0, "win_rate": 0.0, "net_pnl": 0.0}
        wins = sum(1 for pnl in self.trade_window if pnl > 0)
        return {
            "trades": len(self.trade_window),
            "win_rate": wins / len(self.trade_window),
            "net_pnl": sum(self.trade_window),
        }

    def propose_mutation(self, current_alpha):
        """
        Win rate abaixo do piso => contrai o alpha (menos peso à memória).
        Acima => expande com cautela. Retorna a proposta, nunca aplica.
        """
        report = self.performance_report()
        if report["trades"] < self.trade_window.maxlen:
            return None  # Amostra insuficiente: o organismo não evolui no escuro
        direction = -1 if report["win_rate"] < self.min_win_rate else 1
        proposed_alpha = max(0.0, min(1.0, current_alpha + direction * self.alpha_step))
        logger.info(
            f"🧬 Mutação proposta: alpha {current_alpha:.2f} -> {proposed_alpha:.2f} "
            f"(win rate {report['win_rate']:.2%})"
        )
        return {
            "current_alpha": current_alpha,
            "proposed_alpha": proposed_alpha,
            "evidence": report,
        }
