# Riscos e Bloqueios Encontrados

## Bloqueadores do externo

- src/ui_cockpit/dashboard_render.py: erro de sintaxe, linha 19, positions = vazio.
- src/sensors/pipeline_orchestrator.py: erro de sintaxe, linha 13, self.active_sensors = vazio.
- Telemetria externa usa andom.*, inadequado para REAL DATA ONLY sem marcar como simulacao.
- RAR inclui .venv, aumentando peso e risco de empacotamento ruim.
- RAR inclui .git, criando ruido de versionamento e risco de conflito.
- config/encrypted_credentials.env existe; nesta auditoria todos os valores estavam vazios/placeholders, mas o arquivo nao deve ser copiado para pacote final.
- Nomes e comentarios externos usam semantica de execucao/atuador. No oficial isso deve ser traduzido para monitoramento/shadow.
- README externo fala em V5.0/HFT/operar; oficial esta em V3 READ_ONLY. A identidade deve ser consolidada antes de qualquer import.

## Decisao de seguranca

Nenhum arquivo do externo foi promovido para o runtime oficial. Nenhuma chamada de broker foi habilitada. Nenhum segredo foi copiado.
