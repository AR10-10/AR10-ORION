# AR10 Orion Cyborg Master Cockpit V21 - QA

## Escopo

Aplicacao oficial alterada diretamente em `C:\Users\mv\Documents\GitHub\AR10-ORION`.

Pacote canonico lido primeiro:

- `runtime\handoff_canonico_v1_readonly\00_CYBORG_MASTER_COCKPIT_GUIA_EXECUCAO_PIXEL_PERFECT.pdf`
- `runtime\handoff_canonico_v1_readonly\01_IMAGENS_CANONICAS_APROVADAS\`
- `runtime\handoff_canonico_v1_readonly\02_MONTAGEM_CANONICA_SEIS_TELAS.jpg`

## Decisoes Aplicadas

- Mantida uma unica shell oficial do cockpit.
- Mantidas seis abas oficiais: Cerebro Vivo, Mercado, Analise Quant, Fluxo & Micro, Risco Shadow e Memoria.
- Adicionado dock superior com ativo, timeframe, saude, modo READ_ONLY e acoes de leitura.
- Mercado recebeu grafico maior e escala corrigida para ignorar niveis invalidos ou zerados.
- Invalidação ausente agora aparece como `SEM_DADO`, sem fabricar numero.
- Fluxo & Micro mantem L2/Tape/CVD como indisponivel quando nao ha fonte autenticada.
- Memoria remove vazamento visual de nomes legados/Omega nos rotulos exibidos.
- Print social usa a propria tela real via `window.print()`.

## Guardrails

- `READ_ONLY=true`
- `financial_execution=false`
- `trade_execution=false`
- `real_orders_enabled=false`
- `live_enabled=false`
- `demo_orders_enabled=false`
- `order_send=false`
- `broker_actions=blocked`
- `fail_closed=true`

## Validacoes Executadas

- `node --check src\ui_cockpit\assets\orion_cockpit.js` - PASS
- `python -m compileall src tests` - PASS
- `/api/status` - PASS, retornando READ_ONLY e execucao bloqueada
- Busca restrita por ativacao de ordem - PASS, sem ocorrencias proibidas
- QA visual V21b - PASS:
  - desktop 1440x900: 6/6 abas sem overflow horizontal e sem overlap detectado
  - iPad landscape 1180x820: 6/6 abas sem overflow horizontal e sem overlap detectado
  - iPad portrait 820x1180: 6/6 abas sem overflow horizontal e sem overlap detectado

## Evidencias

Métricas:

- `screenshots\visual_qa_metrics_v21b.json`

Capturas principais:

- `screenshots\overview_desktop_1440x900_v21b.png`
- `screenshots\market_desktop_1440x900_v21b.png`
- `screenshots\deep_desktop_1440x900_v21b.png`
- `screenshots\micro_desktop_1440x900_v21b.png`
- `screenshots\risk_desktop_1440x900_v21b.png`
- `screenshots\memory_desktop_1440x900_v21b.png`

## Limites Honestamente Mantidos

- A aba Microestrutura nao mostra L2 profundo, Tape real ou CVD real sem endpoint autenticado.
- A aba Memoria nao inventa ledger temporal, checkpoint ou rollback quando o runtime nao expoe endpoint.
- Nenhum dado operacional foi preenchido por fallback sintetico.

