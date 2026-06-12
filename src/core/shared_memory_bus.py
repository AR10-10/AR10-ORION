import numpy as np
import torch
import logging
from multiprocessing import shared_memory
from typing import Tuple, Optional

logger = logging.getLogger("AR10.Core.SharedMemoryBus")

class TensorMemoryBus:
    """
    Barramento IPC de latência zero utilizando blocos POSIX unificados.
    Cria uma via direta de memória física entre os sensores e a malha PyTorch.
    """
    
    def __init__(self, name: str, shape: Tuple[int,...], dtype: np.dtype, is_creator: bool = False):
        self.name = name
        self.shape = shape
        self.dtype = dtype
        self.num_elements = int(np.prod(self.shape))
        self.size = self.num_elements * self.dtype.itemsize
        self.is_creator = is_creator
        
        self.shm: Optional = None
        self._np_array: Optional[np.ndarray] = None
        self._tensor: Optional = None

    def connect(self) -> torch.Tensor:
        try:
            if self.is_creator:
                # Extermina blocos de execuções abortadas
                try:
                    existing_shm = shared_memory.SharedMemory(name=self.name)
                    existing_shm.unlink()
                    logger.debug(f"[{self.name}] Memória fantasma eliminada.")
                except FileNotFoundError:
                    pass
                
                self.shm = shared_memory.SharedMemory(create=True, size=self.size, name=self.name)
                logger.info(f"[{self.name}] Barramento neural estabelecido: {self.size} bytes.")
            else:
                self.shm = shared_memory.SharedMemory(name=self.name, create=False)
                logger.info(f"[{self.name}] Leitor acoplado ao barramento sensorial.")

            # Mapeia array NumPy e tensor PyTorch para o mesmo buffer bruto O(1)
            self._np_array = np.ndarray(self.shape, dtype=self.dtype, buffer=self.shm.buf)
            
            if self.is_creator:
                self._np_array.fill(0)

            self._tensor = torch.from_numpy(self._np_array)
            return self._tensor

        except Exception as e:
            logger.critical(f"Falha terminal no barramento {self.name}: {e}")
            raise

    def close(self):
        if self.shm is not None:
            self.shm.close()
            logger.debug(f"[{self.name}] Ponteiro local liberado.")
            if self.is_creator:
                self.shm.unlink()
                logger.info(f"[{self.name}] Infraestrutura física demolida.")
