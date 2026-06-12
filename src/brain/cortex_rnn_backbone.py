import torch
import torch.nn as nn
import logging

logger = logging.getLogger("AR10.Brain.Cortex")

class CortexRNNBackbone(nn.Module):
    """
    Viés Macro Estável usando xLSTM/RNN sobre tensores vetorizados.
    Lê O(1) do Barramento de Memória Compartilhada.
    """
    def __init__(self, input_size, hidden_size):
        super().__init__()
        # Inicialização do núcleo recorrente sem alocação dinâmica contínua
        self.rnn = nn.LSTM(input_size, hidden_size, batch_first=True)
        logger.info("Córtex RNN Inicializado.")

    def forward(self, x):
        # Processamento vetorizado sem loops 'for'
        out, _ = self.rnn(x)
        return out
