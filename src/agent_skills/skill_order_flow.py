import logging
from collections import deque

logger = logging.getLogger("AR10.Skills.OrderFlow")

class OrderFlowSkill:
    """
    Habilidade de leitura tática do Order Book (Profundidade L2).
    Converte profundidade bruta em métricas de pressão (desequilíbrio
    comprador/vendedor e absorção institucional) para alimentar o Córtex.
    """
    def __init__(self, depth_levels=10, history_size=200, absorption_ratio=3.0):
        self.depth_levels = depth_levels
        self.absorption_ratio = absorption_ratio
        self.imbalance_history = deque(maxlen=history_size)

    def compute_imbalance(self, bids, asks):
        """Desequilíbrio normalizado [-1, +1]: positivo = pressão compradora."""
        bid_vol = sum(volume for _, volume in bids[:self.depth_levels])
        ask_vol = sum(volume for _, volume in asks[:self.depth_levels])
        total = bid_vol + ask_vol
        if total <= 0:
            return 0.0
        imbalance = (bid_vol - ask_vol) / total
        self.imbalance_history.append(imbalance)
        return imbalance

    def detect_absorption(self, aggressed_volume, price_displacement):
        """
        Absorção: volume agressor alto com deslocamento de preço mínimo.
        Assinatura clássica de player institucional defendendo o nível.
        """
        if price_displacement == 0:
            return aggressed_volume > 0
        efficiency = aggressed_volume / abs(price_displacement)
        absorbed = efficiency >= self.absorption_ratio
        if absorbed:
            logger.info(f"🧱 Absorção institucional detectada (eficiência {efficiency:.2f})")
        return absorbed

    def snapshot(self):
        """Estado resumido para o barramento IPC (shared_memory_bus)."""
        if not self.imbalance_history:
            return {"imbalance_now": 0.0, "imbalance_mean": 0.0}
        history = list(self.imbalance_history)
        return {
            "imbalance_now": history[-1],
            "imbalance_mean": sum(history) / len(history),
        }
