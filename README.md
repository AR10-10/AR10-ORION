# AR10 ORION V5.0 — Digital Android (HFT Cripto)

Organismo agêntico autônomo com Cockpit UI "Ciborgue", servido pelo host
local (latência zero) e acessível globalmente via Túnel Reverso.

## Instalação rápida (chegou em casa, quer rodar agora)

Requisitos: **Python 3.10+** e **Git** instalados.

```bash
# 1. Baixar o sistema
git clone https://github.com/AR10-10/AR10-ORION.git
cd AR10-ORION

# 2. Subir tudo (Windows)
start_orion.bat

# 2. Subir tudo (Linux/Mac)
bash start_orion.sh
```

O script faz, nesta ordem: cria o ambiente virtual → instala dependências →
gera a infraestrutura (`build_skills_and_data.py`) → roda o **diagnóstico
com testes reais** (`run_diagnostics.py`) → sobe o servidor.

Cockpit no navegador local: **http://127.0.0.1:8080**

## Credenciais (cofre blindado)

O arquivo `config/encrypted_credentials.env` é gerado localmente com
permissão `0600` e **nunca sobe para o GitHub**. Preencha na sua máquina:

```
MT5_ACCOUNT_ID=     MT5_PASSWORD=      MT5_SERVER=
MEXC_API_KEY=       MEXC_API_SECRET=
CLOUD_DB_URL=       CLOUD_DB_TOKEN=    INGEST_TOKEN=
```

`INGEST_TOKEN`: segredo longo qualquer — exigido para escrita no `/ingest`
vinda de fora do host (proteção do túnel).

## Acesso global (iPad) — Túnel Reverso

Com o servidor rodando, em outro terminal:

```bash
# Teste imediato (URL temporária, sem conta):
cloudflared tunnel --url http://localhost:8080

# Produção (URL fixa): ver túnel nomeado + Cloudflare Access na doc do PR #1
```

O `wss://` da telemetria é terminado pelo túnel automaticamente; nenhuma
porta é aberta no roteador.

## Testes reais a qualquer momento

```bash
python run_diagnostics.py
```

Verifica ambiente, infraestrutura, servidor vivo, segurança do `/ingest`
e cadência do WebSocket (50–100ms). Sai com código 0 = pronto para operar.

## Cérebro neural completo (opcional, instalação pesada)

```bash
pip install -r requirements-neural.txt   # torch (~2GB+)
python run_organism.py                   # núcleo basal a 1000 Hz
```

## Arquitetura

- `src/api/data_service.py` — nó central: Cockpit UI, telemetria WebSocket
  75ms, sync assíncrono com a nuvem (push/fetch com backoff)
- `src/ui_cockpit/` — tema "Ciborgue": preto absoluto, circuitos orgânicos,
  LONG `#00FF9D` / SHORT `#FF3E52` / Sistema `#00F2FF` / Dor `#FFB800`
- `src/agent_skills/` — order flow (L2), mitigação de risco (cortisol,
  circuit breaker) e auto-evolução (propõe mutação de alpha LoRA)
- `src/brain/`, `src/core/`, `src/sensors/`, `src/motor_cortex/` — fases 1–4
  do organismo (ver `DOCUMENTO MESTRE`)
