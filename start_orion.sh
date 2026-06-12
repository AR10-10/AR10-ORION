#!/usr/bin/env bash
# ============================================================
# AR10 ORION V5.0 — INICIALIZAÇÃO COMPLETA (LINUX/MAC)
# Cria o ambiente, instala dependências, gera a infraestrutura,
# roda o diagnóstico real e sobe o servidor do Cockpit.
# ============================================================
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -d .venv ]; then
    echo "[1/5] Criando ambiente virtual..."
    python3 -m venv .venv
fi
source .venv/bin/activate

echo "[2/5] Instalando dependências do servidor..."
pip install -q -r requirements.txt

echo "[3/5] Gerando infraestrutura (idempotente, preserva o cofre)..."
python build_skills_and_data.py

echo "[4/5] Rodando diagnóstico de implantação (testes reais)..."
python run_diagnostics.py

echo "[5/5] Subindo o Data Service em http://127.0.0.1:8080 ..."
echo "Para acesso externo, rode em outro terminal:"
echo "   cloudflared tunnel --url http://localhost:8080"
python src/api/data_service.py
