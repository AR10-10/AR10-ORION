# AR10 Orion V3.0 Final - Especificação Mestre

## Finalidade

O AR10 Orion é o esqueleto de um organismo vivo para leitura de futuros, análise contextual e operação supervisionada. Ele traduz dados de mercado, memória, risco e aprendizado em uma interface operacional clara.

Na fase atual, o Orion é **READ_ONLY** e **SHADOW_ASSISTIDO**. Ele pode observar, calcular, explicar, simular e exibir estados. Ele não pode enviar ordens.

## Arquitetura por níveis

### Nível 1: Entrada Sensorial

Nome operacional: **Raízes Sensoriais**.

Responsabilidade:

- Ler fluxo de mercado já disponível no AR10.
- Usar histórico, ticks, Price Truth e source health como visão inicial.
- Reservar o canal de áudio, squawk e notícias do FED como módulo planejado READ_ONLY.

Fontes atuais:

- `GET /api/market/history`
- `GET /api/market/ticks`
- `GET /api/price-truth`
- `GET /api/source-health`

Estados aceitos:

- `REAL_DATA_ONLY`
- `READ_ONLY`
- `SEM_DADO`
- `SOURCE_UNAVAILABLE`
- `PLANEJADO_READONLY`

### Nível 2: Barramento Core

Nome operacional: **Tronco Encefálico**.

Responsabilidade:

- Normalizar os sinais que chegam dos conectores.
- Manter ritmo visual e operacional conforme horário, latência e disponibilidade de fonte.
- Preparar a ponte futura para pipeline de baixa latência sem alterar a fase READ_ONLY.

Escopo v1:

- Sem ZeroMQ real.
- Sem shared memory real.
- Sem novo conector L2.
- Apenas agregação de dados já existentes.

### Nível 3: Cérebro Orion

Nome operacional: **Central Cognitiva**.

Componentes oficiais:

1. **Córtex Cerebral**
   - Função: leitura estável da tendência macro.
   - v1: derivado de candles/histórico e qualidade do feed.
   - futuro: xLSTM/Mamba ou backbone equivalente.

2. **Olho de Sincronização**
   - Função: medir surpresa, entropia e ruptura do fluxo micro.
   - v1: indicador visual derivado de variação recente, latência, stale data e status de fonte.
   - futuro: gating optic com cálculo próprio.

3. **Hipocampo**
   - Função: recuperar memória episódica e cenários similares.
   - v1: status do `vector_memory_core` em modo `LEXICAL_SAFE` e Shadow monitor.
   - futuro: HNSW in-memory ou índice vetorial dedicado.

4. **Complexo da Amígdala**
   - Função: representar stress, drawdown, medo operacional e bloqueios.
   - v1: derivado de guardrails, execução bloqueada, P&L shadow e estado de risco.
   - futuro: stress engine com cálculo de cortisol.

5. **Plasticidade Sináptica**
   - Função: exibir adaptação e aprendizado.
   - v1: estado planejado/auditável.
   - futuro: camada adaptativa controlada.

Equação conceitual preservada:

```text
h_final = h_t + tanh(W_p * v_rec) * alpha
```

Na fase READ_ONLY, `alpha` nunca arma execução financeira. Ele pode apenas reduzir risco visual/simulado e sinalizar cautela.

### Nível 4: Comportamento Eferente

Nome operacional: **Coroa Operacional**.

Responsabilidade:

- Mostrar o estado de execução.
- Mostrar gates e bloqueios.
- Exibir aprendizado/reward apenas como leitura ou simulação.

Escopo v1:

- Execução de contratos futuros aparece como **BLOQUEADA**.
- Sem boleta real.
- Sem envio automático.
- Sem trailing stop real.
- Sem `order_send`.
- Sem `mt5.order_send`.

## Cockpit em quatro quadrantes

### Quadrante 1: Percepção Sensorial

Mostra o que as raízes estão lendo:

- Candles/ticks READ_ONLY.
- Fonte oficial e source health.
- Latência, stale status e Price Truth.
- Áudio/squawk/FED como `PLANEJADO_READONLY` até existir conector real.

Cor principal: ciano.

### Quadrante 2: Central Cognitiva

Mostra o que o cérebro está calculando:

- Pulso do hidden state visual.
- Entropia ou surpresa do mercado.
- Estado do córtex, gating optic e oscilador temporal.

Cor principal: ciano com onda senoidal.

### Quadrante 3: Memória Episódica

Mostra o que o hipocampo está resgatando:

- Status da memória vetorial.
- Modo do índice.
- Eventos Shadow.
- Matches históricos quando houver busca disponível.

Cor principal: magenta/roxo.

### Quadrante 4: Monitor de Execução

Mostra o que a máquina pode ou não pode operar:

- Execução bloqueada.
- Gates ativos.
- Estado de demo/real.
- Cortisol/stress visual.
- Dopamina/reward apenas como leitura/simulação.

Cor principal: amber para alerta e vermelho para bloqueio.

## Nomenclatura oficial

- Projeto: **AR10 Orion V3.0 Final**
- Preview: **Cockpit Orion READ_ONLY**
- Pasta central: `system/docs/current/orion_v3_current`
- Endpoint futuro: `GET /api/orion/status`
- Página futura: `/orion`
- Modo: `SHADOW_ASSISTIDO`
- Política de dados: `REAL_DATA_ONLY` quando houver fonte real, `SEM_DADO` quando faltar.
- Política de execução: `EXECUCAO_BLOQUEADA`.

## Fora de escopo da Macroentrega 1

- Envio automático de ordens.
- Alteração de `project_manifest.json` para liberar demo/real.
- Conectores novos de escrita.
- Migração de dados persistidos.
- Reorganização de `data`, `memory`, `state`, `config`, `backups`, `blackbox`, `logs`, `models` ou `exports`.
- Substituição do Painel Mestre atual.
