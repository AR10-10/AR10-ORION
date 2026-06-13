# Matriz de Reaproveitamento - AR10-ORION GitHub/RAR

## Aproveitar com prioridade

| Origem externa | Destino recomendado no oficial | Acao |
| --- | --- | --- |
| src/core/immune_system.py | src/core/immune_client.py ou adaptador interno | Aproveitar conceito de retry/backoff/rate-limit, mas tornar opcional e READ_ONLY. |
| src/core/lymphatic_purger.py | src/core/resource_health.py | Aproveitar como telemetria de saude RAM/VRAM, sem exigir torch no painel base. |
| src/brain/prefrontal_gating.py | src/brain/prefrontal_gating.py | Aproveitar conceito de entropy gating, corrigindo numerica, dependencia opcional e retorno auditavel. |
| src/brain/sleep_consolidator.py | src/brain/memory_consolidator.py | Aproveitar como agendamento de consolidacao de memoria, sem loop permanente no painel. |
| src/brain/self_reflection_engine.py | src/brain/signal_governance.py | Aproveitar como bloqueio de impulso por cortisol, sempre shadow/human gate. |
| src/api/data_service.py | estudo para futura camada websocket | Aproveitar ideia de /health e websocket, mas nao substituir o servidor oficial agora. |

## Nao promover direto

| Item | Razao |
| --- | --- |
| .git/ e .venv/ dentro do RAR | Nao devem entrar em pacote oficial nem backup de produto. |
| src/ui_cockpit/dashboard_render.py externo | Sintaxe quebrada em positions =; usa random/fake telemetry. |
| src/sensors/pipeline_orchestrator.py externo | Sintaxe quebrada em self.active_sensors =. |
| src/motor_cortex/mt5_gateway.py externo | Semantica de execute_order; precisa ser substituida por status READ_ONLY. |
| src/motor_cortex/mexc_gateway.py externo | Semantica de ire_market_order; precisa ser substituida por status READ_ONLY. |
| src/ui_cockpit/* externo | Duplicidade de CSS, layout simples 2x2 e cores antigas em uma folha. |
| update_visual.py | Replica o bug de positions = e gera UI paralela. |

## Sequencia recomendada

1. Congelar o oficial luxury-v11 como CURRENT visual.
2. Criar branch/candidate interno so para importar componentes selecionados.
3. Portar immune_system como adaptador publico READ_ONLY.
4. Portar prefrontal_gating e self_reflection_engine para enriquecer Central Cognitiva / Signal Governance.
5. Portar lymphatic_purger como telemetria opcional de saude, sem torch obrigatorio.
6. Atualizar painel oficial para exibir esses estados sem alterar rotas de execucao.
7. Rodar QA e gerar novo pacote final oficial.
8. So depois arquivar o externo como LEGACY_EXTERNAL_SOURCE, nao como app ativo.
