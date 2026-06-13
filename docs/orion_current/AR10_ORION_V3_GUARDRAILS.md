# AR10 Orion V3.0 Final - Guardrails

## Travas permanentes

- `SHADOW_ASSISTIDO` sempre preservado.
- `READ_ONLY` sempre preservado nesta fase.
- `real_orders_enabled=false`.
- `live_enabled=false`.
- `demo_orders_enabled=false`.
- `demo_trading_enabled=false`.
- `orders_sent=false`.
- `order_send` proibido.
- `mt5.order_send` proibido.
- Zero Delete ativo.
- Safe Quarantine ativo.
- FAIL_CLOSED em caso de risco de regressão.

## Proibições da Macroentrega 1

O Orion não pode:

- Enviar ordem.
- Simular envio real como se fosse execução.
- Criar rota POST de execução.
- Habilitar demo ou real.
- Alterar secrets.
- Ler `config/secrets`.
- Mover dados persistidos.
- Reorganizar `data`, `memory`, `state`, `blackbox`, `logs`, `backups`, `models` ou `exports`.
- Substituir o Painel Mestre atual.

## Estados permitidos

Quando não houver dado real, usar:

- `SEM_DADO`
- `SOURCE_UNAVAILABLE`
- `STALE_DATA`
- `PLANEJADO_READONLY`
- `BLOQUEADO`

Nunca inventar preço, latência, score, histórico, match de memória, reward ou status de execução.

## Política de visualização

A execução de contratos futuros aparece apenas como monitor bloqueado. Boletas, trailing stops, long/short e risk management podem aparecer como conceitos visuais ou estados de gate, mas não como ação executável.

## Política de desenvolvimento

Antes de qualquer alteração funcional:

- Criar checkpoint.
- Gerar hash anterior dos arquivos tocados.
- Validar ausência de chamadas de ordem.
- Rodar validações mínimas.
- Gerar manifesto SHA256.

Se houver ambiguidade entre avançar e preservar, preservar.
