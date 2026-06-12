import logging
import torch

logger = logging.getLogger("AR10.Brain.Hippocampus")

class EpisodicMemoryVDB:
    """Banco Vetorial O(1) in-RAM para recuperação de cenários históricos."""
    def __init__(self, embedding_dim):
        # Alocação de cache na GPU ou RAM sem serialização extra
        self.memory_bank = torch.empty((0, embedding_dim))
        logger.info("Hipocampo Vetorial instanciado.")

    def store(self, v_rec):
        self.memory_bank = torch.cat((self.memory_bank, v_rec.unsqueeze(0)), dim=0)

    def retrieve(self, query, top_k=1):
        if self.memory_bank.shape == 0:
            return torch.zeros_like(query)
        # Similaridade de cosseno hiper-rápida via PyTorch core
        similarities = torch.nn.functional.cosine_similarity(query.unsqueeze(0), self.memory_bank)
        best_idx = torch.argmax(similarities)
        return self.memory_bank[best_idx]
