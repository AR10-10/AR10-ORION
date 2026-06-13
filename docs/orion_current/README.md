# AR10 Orion V3.0 Final

Pasta central canônica do projeto **AR10 Orion V3.0 Final**.

O Orion é a nova camada conceitual e operacional do AR10 para organizar percepção de mercado, fusão cognitiva, memória episódica, stress/risk e monitoramento de execução em um cockpit único.

Nesta fase, o Orion fica em **SHADOW_ASSISTIDO / READ_ONLY**. A execução financeira permanece bloqueada: `real_orders_enabled=false`, `live_enabled=false`, `demo_orders_enabled=false`, `order_send=PROIBIDO` e `mt5.order_send=PROIBIDO`.

## Arquivos oficiais

- `AR10_ORION_V3_MASTER_SPEC.md`: especificação humana principal.
- `AR10_ORION_V3_CORE_DATA.json`: dados estruturados para implementação futura.
- `AR10_ORION_V3_IMPLEMENTATION_PLAN.md`: plano de macroentregas e aceitação.
- `AR10_ORION_V3_GUARDRAILS.md`: travas permanentes e limites de segurança.

## Decisão atual

Macroentrega 1 escolhida: **Cockpit Orion READ_ONLY**.

O primeiro produto será um preview separado em quatro quadrantes, alimentado por dados existentes do AR10:

- Price Truth, market history, ticks e source health.
- Guardrails, telemetry e execution policy.
- Vector Memory e Shadow monitor.
- Execução exibida somente como bloqueada/READ_ONLY.

## Referências visuais

- `references/AR10_ORION_V3_REFERENCE_01_NEUROLOGICAL_TREE_CORTISOL.jpg`: árvore neural bio-digital com dopamina/cortisol.
- `references/AR10_ORION_V3_REFERENCE_02_NEUROLOGICAL_TREE_GATING.jpg`: árvore neural bio-digital com feedback dopaminérgico.
- `references/AR10_ORION_V3_REFERENCE_03_QUADRANTS_BLUEPRINT.jpg`: diagrama operacional em quatro níveis e quatro quadrantes.

## Regra de continuidade

Qualquer implementação funcional do Orion deve começar por checkpoint, hashes anteriores, validação de guardrails e manifesto SHA256. Nenhum módulo Orion pode introduzir envio de ordem, escrita em conta real/demo ou bypass de gate humano.
