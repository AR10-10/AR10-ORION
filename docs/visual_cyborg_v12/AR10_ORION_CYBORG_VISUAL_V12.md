# AR10 Orion Cyborg - Visual v12

## Objetivo

Lapidar a aplicacao unica do AR10 Orion para o padrao visual `AR10 ORION CYBORG`, usando a shell existente e preservando endpoints, dados, guardrails e runtime READ_ONLY.

## Escopo aplicado

- Identidade visual oficial alterada para `AR10 ORION CYBORG`.
- Topo convertido para cockpit com chips de estado: Cerebro Vivo, Sensores, Cortex, Challenger Shadow e Zero Execution.
- Abas padronizadas como uma unica shell interna: Visao Geral, Mercado, Analise Quant, Fluxo & Micro, Risco & Shadow e Memoria.
- Grafico principal ampliado e refinado com volume e faixa RSI 14 calculada dos candles reais.
- CSS refinado com glass preto, baixa saturacao textual e somente status em ciano, verde, vermelho e ambar.
- Backend preservado em leitura passiva.

## Guardrails preservados

- `real_orders_enabled=false`
- `live_enabled=false`
- `demo_orders_enabled=false`
- `order_send=false`
- `broker_actions=blocked`
- `fail_closed=true`

## Checkpoint

Um checkpoint antes da edicao foi salvo em `docs/visual_cyborg_v12/checkpoint_*` com copias dos arquivos alterados e hashes SHA256.

## Arquivos alterados

- `src/ui_cockpit/assets/index.html`
- `src/ui_cockpit/assets/glassmorphism_theme.css`
- `src/ui_cockpit/assets/orion_cockpit.js`
- `src/ui_cockpit/dashboard_render.py`
- `README.md`

## Resultado esperado

Uma unica aplicacao viva, sem painel paralelo, com shell premium, abas internas e estado READ_ONLY verificavel pelo endpoint `/api/status`.
