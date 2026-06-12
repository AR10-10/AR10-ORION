"""
AR10 ORION V5.0 — BUILD: ARSENAL COGNITIVO + CAMADA FÍSICA DE DADOS
Gera, de forma idempotente e Production-Ready:
  1. Árvore de dados (feature_store, raw_ticks_cache, episodic_memory_cache)
  2. Configurações de blindagem (encrypted_credentials.env com chmod 0600
     e data_feeds_config.json)
  3. Habilidades do Agente (src/agent_skills/)

Regra de ouro: o cofre de credenciais NUNCA é sobrescrito se já existir —
o script apenas reforça a permissão POSIX 0600 a cada execução.
"""

import json
import os
import stat

# ----------------------------------------------------------------------------
# 1. CAMADA FÍSICA DE DADOS
# ----------------------------------------------------------------------------
DATA_DIRECTORIES = [
    "data/feature_store",          # Tensores limpos (Combustível)
    "data/raw_ticks_cache",        # Cache em RAM (Latência zero)
    "data/episodic_memory_cache",  # Banco Vetorial HNSW
]

# ----------------------------------------------------------------------------
# 2. CONFIGURAÇÕES DE BLINDAGEM
# ----------------------------------------------------------------------------
CREDENTIALS_PATH = "config/encrypted_credentials.env"
CREDENTIALS_TEMPLATE = """# ============================================================
# AR10 ORION — COFRE DE CREDENCIAIS (BLINDAGEM POSIX 0600)
# NUNCA commitar este arquivo. Preencher apenas na máquina-alvo.
# ============================================================
MT5_ACCOUNT_ID=
MT5_PASSWORD=
MT5_SERVER=
MEXC_API_KEY=
MEXC_API_SECRET=
CLOUD_DB_URL=
CLOUD_DB_TOKEN=
"""

DATA_FEEDS_PATH = "config/data_feeds_config.json"
DATA_FEEDS_CONFIG = {
    "mode": "READ_ONLY",
    "air_gap_enforced": True,
    "feeds": {
        "binance_spot": {
            "ws_endpoint": "wss://stream.binance.com:9443/ws",
            "streams": ["btcusdt@depth20@100ms", "btcusdt@aggTrade"],
            "reconnect_backoff_sec": [1, 2, 4, 8, 16],
        },
        "okx_public": {
            "ws_endpoint": "wss://ws.okx.com:8443/ws/v5/public",
            "channels": [
                {"channel": "books", "instId": "BTC-USDT"},
                {"channel": "trades", "instId": "BTC-USDT"},
            ],
            "reconnect_backoff_sec": [1, 2, 4, 8, 16],
        },
        "onchain_whales": {
            "rest_endpoint": "https://api.whale-alert.io/v1/transactions",
            "poll_interval_sec": 30,
        },
    },
    "cloud_sync": {
        "push_interval_sec": 5,
        "fetch_interval_sec": 15,
        "batch_max_records": 500,
        "reconnect_backoff_sec": [1, 2, 4, 8, 16],
    },
    "telemetry": {
        "interval_ms": 75,
        "bind_host": "127.0.0.1",
        "bind_port": 8080,
    },
}

# ----------------------------------------------------------------------------
# 3. HABILIDADES DO AGENTE (src/agent_skills/)
# ----------------------------------------------------------------------------
skill_order_flow_py = '''import logging
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
'''

skill_risk_mitigation_py = '''import logging

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
'''

skill_self_evolution_py = '''import logging
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
'''

SKILL_FILES = {
    "src/agent_skills/skill_order_flow.py": skill_order_flow_py,
    "src/agent_skills/skill_risk_mitigation.py": skill_risk_mitigation_py,
    "src/agent_skills/skill_self_evolution.py": skill_self_evolution_py,
}


def build_data_layer():
    for directory in DATA_DIRECTORIES:
        os.makedirs(directory, exist_ok=True)
        # .gitkeep preserva a árvore no git sem versionar os caches
        gitkeep = os.path.join(directory, ".gitkeep")
        if not os.path.exists(gitkeep):
            open(gitkeep, "w", encoding="utf-8").close()
        print(f"📁 Camada física pronta: {directory}/")


def build_shield_configs():
    os.makedirs("config", exist_ok=True)

    if os.path.exists(CREDENTIALS_PATH):
        print(f"🔒 Cofre já existe (preservado): {CREDENTIALS_PATH}")
    else:
        with open(CREDENTIALS_PATH, "w", encoding="utf-8") as file:
            file.write(CREDENTIALS_TEMPLATE)
        print(f"🔒 Cofre de credenciais gerado: {CREDENTIALS_PATH}")
    # Blindagem POSIX 0600 reforçada em toda execução (leitura/escrita só do dono)
    os.chmod(CREDENTIALS_PATH, stat.S_IRUSR | stat.S_IWUSR)

    with open(DATA_FEEDS_PATH, "w", encoding="utf-8") as file:
        json.dump(DATA_FEEDS_CONFIG, file, indent=4, ensure_ascii=False)
        file.write("\n")
    print(f"📡 Endpoints Read-Only configurados: {DATA_FEEDS_PATH}")


def build_agent_skills():
    os.makedirs("src/agent_skills", exist_ok=True)
    for filepath, content in SKILL_FILES.items():
        with open(filepath, "w", encoding="utf-8") as file:
            file.write(content.strip() + "\n")
        print(f"🧠 Habilidade instanciada: {filepath}")


def build_skills_and_data():
    print("Montando a arquitetura AR10 Orion V5.0 - ARSENAL COGNITIVO + DADOS...")
    build_data_layer()
    build_shield_configs()
    build_agent_skills()
    print("\n✅ Arsenal Cognitivo e Camada de Dados implantados com sucesso!")


if __name__ == "__main__":
    build_skills_and_data()
