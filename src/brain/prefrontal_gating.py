import logging
import torch

logger = logging.getLogger("AR10.Brain.Prefrontal")

class PrefrontalGating:
    """Filtro de Entropia para inibir ruído excessivo antes do Córtex."""
    def __init__(self, entropy_threshold=0.8):
        self.threshold = entropy_threshold

    def filter_noise(self, tensor_data):
        # Medição rápida de dispersão (Entropia de Shannon em tensores)
        entropy = -(tensor_data * torch.log(tensor_data + 1e-9)).sum()
        if entropy > self.threshold:
            logger.warning("Entropia alta detectada. Ativando inibição do córtex (Gating).")
            return None
        return tensor_data
