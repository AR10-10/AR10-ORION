import torch
import torch.nn as nn
import logging

logger = logging.getLogger("AR10.Brain.Synapse")

class SynapticFusionNode(nn.Module):
    """Nó de Fusão Matemática integrando a leitura atual, memórias resgatadas e cortisol."""
    def __init__(self, feature_dim):
        super().__init__()
        # Pesos adaptativos análogos a matrizes LoRA
        self.W_p = nn.Parameter(torch.randn(feature_dim, feature_dim))

    def forward(self, h_t, v_rec, alpha_cortisol):
        # h_final = h_t + tanh(W_p * v_rec) * alpha
        fusion_signal = torch.tanh(torch.matmul(v_rec, self.W_p))
        h_final = h_t + (fusion_signal * alpha_cortisol)
        return h_final
