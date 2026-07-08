# RAMBER · Terminal V-PRIME ELITE — Release Notes (arco RC1 → RC2 / Gold Master)

Registro do ciclo de consolidação Enterprise que levou o terminal React de
protótipo funcional a candidato a produção. Cada item abaixo foi
verificado antes do merge (testes node, `tsc` estrito, build de produção,
auditoria Playwright em matriz real de iPad) — restrições permanentes
READ_ONLY / FAIL_CLOSED preservadas em todos os commits.

## Motor e inteligência (dados 100% reais)

- **CVD de sessão** no Order Flow Engine (soma sinalizada de volume real
  MEXC, nunca resetada dentro da sessão).
- **Feed de liquidações institucionais** — WS público
  `!forceOrder` da Binance Futures, com reconexão e backoff.
- **SMC**: Fair Value Gaps, Order Blocks (variante objetivamente
  verificável) e zonas de liquidez Equal Highs/Lows, renderizados no
  gráfico com o mesmo mapeamento de preço do marcador de último preço.
- **Classificador k-NN Lorentziano** com suavização de Fourier CAUSAL
  (janela retrocedente — a distorção de borda de um DFT acausal cairia
  exatamente no candle atual) e rotulagem sem lookahead. Amostra pequena
  (~50-80 pontos) sempre declarada.
- **Previsão multi-horizonte**: `classify({horizon})` re-rotula o mesmo
  k-NN para 4/8/16 velas de 15m; confiança e amostra reportadas POR
  horizonte; horizonte sem amostra → AGUARDANDO, nunca número inventado.
- **Núcleo Neural opt-in**: Llama 3 local (WebLLM/WebGPU) em Web Worker,
  chunks lazy (~6MB cada) fora do bundle principal; prompt de sistema
  proíbe inventar dados e linguagem que implique envio de ordem.

## IRON-VOICE (camada de voz, fundida no Núcleo S.E.)

- TTS via `speechSynthesis` com fila de prioridade (CRITICAL cancela e
  fura fila), avanço por eventos, voz pt-BR, init idempotente.
- STT push-to-talk via `webkitSpeechRecognition` — único modo que o
  Safari/iPadOS sustenta de verdade; sem promessa falsa de always-listen.
- Assistente conversacional com respostas construídas EXCLUSIVAMENTE do
  estado real (tendência/previsão/confiança/risco/absorção/consenso/
  preço/diagnóstico/atualizar); campo ausente vira "aguardando".
- Alertas executivos falados apenas em TRANSIÇÕES reais de estado
  (vetor confirmado/invalidado, divergência motor×classificador,
  liquidação nova, absorção surgindo, motor caiu/voltou).
- Controles Glass (VOZ/SOM/volume/PTT/status) fundidos dentro do card do
  Núcleo — não é um painel separado. APIs ausentes → INDISPONÍVEL.

## Interface e responsividade

- Cockpit completo visível por padrão (preferências persistidas por
  aparelho; merge por chave conhecida impede que prefs antigas
  ressuscitem widgets removidos).
- Layout de 3 colunas só engata a ≥1120px (onde os mínimos das colunas
  cabem de verdade): todo iPad retrato empilha em largura cheia; todo
  paisagem mostra as 3 colunas inteiras — fim da coluna cortada em tira
  atrás de scroll oculto.
- Split View / Slide Over / Stage Manager: barra de pressão e cabeçalhos
  de painel quebram linha em vez de estourar a borda a 320-375px.
- Safe-area do iPad (`pb-safe`) no container raiz — o indicador de home
  não cobre mais o rodapé em modo standalone.
- Painel morto "CONSENSO MULTI-AGENTE" removido (backend impossível num
  app estático — só repetia AGUARDANDO 5×); placeholders consolidados em
  mensagens únicas; nomenclatura PT institucional no painel de
  configuração (nomes idênticos aos títulos reais dos widgets).

## Confiabilidade e limpeza

- Service worker legado (cache-first) substituído por shim de
  autodestruição — corrige aparelhos presos na versão antiga em cache
  (ordem crítica verificada: caches → unregister → navigate, sem
  clients.claim, que trava).
- Auto-retry limitado (2s/4s/8s) no boot REST + botão REINICIAR SISTEMA;
  o retry infinito do WS de preço permanece intocado (correto para feed
  vivo).
- Erros de carregamento de worker deixam de aparecer como
  "[object Event]" — o tipo do evento é nomeado.
- Código morto eliminado: variante FAB flutuante do orbe (inalcançável),
  zero variáveis órfãs (tsc estrito), zero dependências não importadas,
  zero console.log residual. Build de produção sem warnings.

## Validação consolidada (Gold Master)

- 54 testes node (42 camada de voz + 12 multi-horizonte, incluindo
  teste de resposta conhecida em sawtooth e fail-closed em horizonte
  impossível).
- `tsc --noEmit --noUnusedLocals --noUnusedParameters` limpo.
- Auditoria Playwright: 6 combinações reais de iPad (Mini/Air/Pro 12.9 ×
  retrato/paisagem) + 6 larguras de multitarefa (320/375/507/672/900/981)
  — zero overflow de borda, zero scroll horizontal, zero conteúdo oculto.
- Deploy GitHub Pages verde em todos os commits do arco.

## Pendências conhecidas

- Purga dos arquivos legados da raiz de `ipad_runtime/` — aguarda
  confirmação explícita do proprietário (recomendação: excluir 14,
  manter `service-worker.js` enquanto houver aparelhos antigos).
- Validação de áudio em aparelho físico (alto-falante/microfone não
  existem no ambiente de CI) — TTS/STT verificados por instrumentação,
  não por som real.
- Execução real de ordens: permanentemente fora de escopo, por projeto.
