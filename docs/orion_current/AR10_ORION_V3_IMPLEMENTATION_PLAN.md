# AR10 Orion V3.0 Final - Plano de Implementação

## Macroentrega 1: Cockpit Orion READ_ONLY

Objetivo: criar uma página preview separada do Painel Mestre, com quatro quadrantes e dados derivados do AR10 atual.

Decisões fechadas:

- Entrada: preview separado em `/orion`.
- Visual: quatro quadrantes.
- Dados: endpoints existentes.
- Execução: bloqueada visualmente.
- Substituição do painel atual: não.

## Etapas

1. Criar módulo backend READ_ONLY para agregação Orion.
   - Nome sugerido: `system/core/orion_readonly.py`.
   - Função pública sugerida: `status(symbol="BTCUSD", root=None)`.
   - Sem escrita em `state`, `memory`, `blackbox`, `exports`, `config` ou `data`.

2. Expor endpoint local.
   - `GET /api/orion/status?symbol=BTCUSD`.
   - Adicionar à allowlist `REMOTE_GATEWAY_ONLY`.
   - Retornar `sensory`, `cognitive`, `memory`, `execution`, `guardrails` e `meta`.

3. Criar preview visual.
   - Página: `system/ui/panel/orion.html`.
   - CSS: `system/ui/panel/assets/orion.css`.
   - JS: `system/ui/panel/assets/orion.js`.
   - Rota `/orion` redireciona para `/orion.html`.

4. Validar segurança.
   - Confirmar que nenhum arquivo novo contém `order_send(` ou `mt5.order_send(`.
   - Confirmar flags de execução falsas.
   - Confirmar estados sem dado como `SEM_DADO`, `SOURCE_UNAVAILABLE` ou `PLANEJADO_READONLY`.

5. Validar sintaxe e visual.
   - `python -m compileall system tools installer`
   - `node --check system\ui\panel\assets\orion.js`
   - Abrir `/orion` em desktop e mobile.

6. Empacotar entrega.
   - Gerar evidências pequenas.
   - Gerar manifesto SHA256.
   - Registrar rollback e próxima ação segura.

## Critérios de aceite

- `/orion` abre sem quebrar `/index.html`.
- `/api/orion/status` responde JSON válido.
- Painel Mestre OMEGA RC3 permanece preservado.
- Nenhuma execução financeira é habilitada.
- Nenhum secret é lido ou exposto.
- Nenhuma pasta protegida é movida, apagada ou reestruturada.

## Macroentregas futuras

### Macroentrega 2: Motor de Entropia READ_ONLY

Criar cálculo explícito de entropia/surpresa com base em ticks, candles, latência e source health.

### Macroentrega 3: Hipocampo Orion

Evoluir memória episódica sem migrar dados persistidos. Primeiro passo: adaptador READ_ONLY sobre `vector_memory_core`.

### Macroentrega 4: Stress Engine / Cortisol

Criar métrica auditável de stress operacional com base em drawdown virtual, stale data, divergência de preço e bloqueios de guardrails.

### Macroentrega 5: Gateway de Execução como Gate Visual

Exibir readiness, order_check e bloqueios, sem envio de ordem. Qualquer execução real/demo continua exigindo gate humano separado.
