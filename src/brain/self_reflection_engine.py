import logging

logger = logging.getLogger("AR10.Brain.SelfReflection")

class SelfReflectionEngine:
    """Consciência Sintética - Double check vetorial para evitar impulsos predatórios."""
    def evaluate_impulse(self, decision_tensor, cortisol):
        # Filtro final antes do Córtex Motor.
        if cortisol > 0.8:
            logger.info("Reflexão: Bloqueando impulso de trade devido ao estresse sistêmico elevado.")
            return False
        return True
