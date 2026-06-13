# AR10 ORION - Decisao de Unificacao

Gerado em: 20260612_203220

## Decisao

Manter como tronco oficial unico:

$official

Tratar como fonte externa de auditoria/reaproveitamento, sem promocao direta:

$external

## Motivo

O Orion oficial atual ja possui cockpit luxury-v11, porta 8970, rotas READ_ONLY, pacote final anterior, tunel registrado e guardrails explicitos. A versao externa do GitHub/RAR tem ideias uteis, mas nao esta pronta para virar produto oficial: contem .git, .venv, arquivos duplicados de UI, encoding quebrado em textos, dois arquivos Python com erro de sintaxe e gateways com semantica de atuador/executar ordem.

## Regra de produto

Nao manter duas versoes vivas. A rota correta e absorver apenas componentes aprovados dentro do tronco oficial, um por um, em candidate_staging, sempre com rollback e sem tocar em execucao financeira.

## Estado de execucao

- financial_execution = false
- trade_execution = false
- order_send = false
- real_orders_enabled = false
- demo_orders_enabled = false
- authenticated_broker = false
- modo recomendado = READ_ONLY / SHADOW_ASSISTIDO
