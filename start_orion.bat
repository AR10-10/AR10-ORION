@echo off
REM ============================================================
REM AR10 ORION V5.0 — INICIALIZACAO COMPLETA (WINDOWS)
REM Cria o ambiente, instala dependencias, gera a infraestrutura,
REM roda o diagnostico real e sobe o servidor do Cockpit.
REM ============================================================
cd /d %~dp0

if not exist .venv (
    echo [1/5] Criando ambiente virtual...
    python -m venv .venv
)
call .venv\Scripts\activate.bat

echo [2/5] Instalando dependencias do servidor...
pip install -q -r requirements.txt

echo [3/5] Gerando infraestrutura (idempotente, preserva o cofre)...
python build_skills_and_data.py

echo [4/5] Rodando diagnostico de implantacao (testes reais)...
python run_diagnostics.py
if errorlevel 1 (
    echo.
    echo DIAGNOSTICO FALHOU. Corrija os itens marcados acima e rode de novo.
    pause
    exit /b 1
)

echo [5/5] Subindo o Data Service em http://127.0.0.1:8080 ...
echo Para acesso externo, rode em outro terminal:
echo    cloudflared tunnel --url http://localhost:8080
python src\api\data_service.py
