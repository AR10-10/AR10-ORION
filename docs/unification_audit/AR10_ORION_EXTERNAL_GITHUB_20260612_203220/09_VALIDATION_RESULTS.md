# Validacao Executada

## Oficial Orion

- python -m compileall src tests: PASS
- 
ode --check src\ui_cockpit\assets\orion_cockpit.js: PASS
- GET http://127.0.0.1:8970/api/status: PASS

Resposta confirmada:

`json
{
  "service": "AR10 Orion Cockpit",
  "ok": true,
  "mode": "READ_ONLY",
  "shadow_assisted": true,
  "real_orders_enabled": false,
  "live_enabled": false,
  "demo_orders_enabled": false,
  "broker_actions": "blocked",
  "copy_secrets": false,
  "copy_large_databases": false,
  "fail_closed": true
}
`

## Varredura de execucao

Comando: g -n "order_send|mt5\.order_send|real_orders_enabled\s*=\s*true|live_enabled\s*=\s*true|demo_orders_enabled\s*=\s*true|fire_market_order|execute_order" src config tests

Resultado: apenas duas ocorrencias textuais em src/ui_cockpit/assets/orion_cockpit.js exibindo order_send=false no painel. Nenhuma ativacao real/demo encontrada.

## Externo GitHub/RAR

Validacao estatica sem promocao:

- 2 erros de sintaxe detectados.
- Nenhum segredo preenchido detectado no .env externo; somente placeholders/vazios.
- Nenhum arquivo externo foi copiado para o runtime oficial.
