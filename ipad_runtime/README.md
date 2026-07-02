# RAMBER · Terminal V-PRIME ELITE — iPad PWA (AR10-CYBORG)

*Sub-produto iPad/PWA do monorepo `AR10-ORION` (ver `../README.md`). Este
diretório contém o terminal React em produção e o motor real que ele usa.*

**READ_ONLY / FAIL_CLOSED sempre. Sem execução real, sem API secret, sem
ordem, sem live trading. Nenhum valor é simulado: todo número vem de feed
público real ou aparece como AGUARDANDO.**

## O que está no ar

O site publicado (GitHub Pages) é o terminal React que vive em
[`ramber-ui/`](ramber-ui/). O workflow
[`deploy-ipad-pwa.yml`](../.github/workflows/deploy-ipad-pwa.yml)
builda `ramber-ui` (Vite) e copia `dist/` para a raiz de `ipad_runtime/`
antes de publicar — ou seja, o `index.html` DEPLOYADO é o do terminal
React, não o arquivo homônimo commitado nesta pasta (legado, ver abaixo).

## Arquitetura atual

```
ipad_runtime/
├── ramber-ui/                    ← terminal React em produção
│   └── src/
│       ├── App.tsx               cockpit (widgets, estado, boot real)
│       ├── engine-bridge.ts      ponte para o motor real (sem reimplementação)
│       ├── voice/                IRON-VOICE (fundida no Núcleo S.E.)
│       │   ├── voice-engine.ts        TTS (speechSynthesis) + fila prioridade
│       │   ├── voice-recognition.ts   STT push-to-talk (webkitSpeechRecognition)
│       │   ├── voice-intents.ts       transcript→resposta (funções puras, só dados reais)
│       │   ├── voice-dispatcher.ts    alertas falados em transições reais de estado
│       │   └── VoiceControlWidget.tsx controles Glass dentro do núcleo
│       ├── llm-bridge.ts / llm-worker.ts   Núcleo Neural opt-in (WebLLM/Llama 3, lazy)
│       └── index.css             tema glassmorphism (Tailwind v4)
├── js/                           módulos do motor real (importados pelo React)
│   ├── worker-client.js              RPC com o Web Worker do WASM
│   ├── orderflow-client.js           cliente do Order Flow Engine
│   ├── real-data/                    conectores públicos reais (fail-closed)
│   │   ├── binance-public.js             klines/ticker (probe)
│   │   ├── binance-liquidations-stream.js liquidações futures (WS !forceOrder)
│   │   ├── mexc-trades-stream.js         trades reais (polling REST, dedup puro)
│   │   └── analysis-frame.js / schema.js  contratos e frames
│   └── research/                     pipeline de pesquisa (funções puras)
│       └── research-engine.js / trade-setup-matrix.js / target-tracker.js
├── src/
│   ├── research/engines/             motores graduados (ver QUARANTINE.md)
│   │   ├── support-resistance-engine.js / market-structure-engine.js
│   │   ├── fvg-order-block-engine.js     SMC: FVG/Order Blocks/liquidez
│   │   └── lorentzian-classifier.js      k-NN Lorentziano + Fourier
│   │                                     (multi-horizonte via `horizon`)
│   └── orderflow/                    Order Flow Engine (OFI/Absorção/Exaustão)
├── workers/quant-worker.js       carrega o WASM fora da UI thread
├── wasm/cyborg_quant_core.wasm   motor real (Rust → wasm32)
├── icons/ · manifest.webmanifest metadados PWA (usados pelo deploy)
└── service-worker.js             shim de AUTODESTRUIÇÃO (ver nota legado)
```

## Cockpit (o que o operador vê)

- **Vetor de mercado** (LONG/SHORT/AGUARDANDO) do motor WASM real +
  pipeline de pesquisa; entrada/alvos/stop reais quando confirmado.
- **Previsão multi-horizonte**: o mesmo k-NN re-rotulado para 4/8/16
  velas de 15m, com confiança e amostra declaradas por horizonte —
  leitura probabilística, nunca garantia.
- **k-NN Lorentziano** como sinal de confluência independente (nunca
  substitui o vetor do motor).
- **Order flow real** (MEXC): OFI/Absorção/Exaustão + CVD da sessão.
- **Liquidações institucionais** (Binance Futures, feed público real).
- **SMC**: Fair Value Gaps, Order Blocks e zonas de liquidez no gráfico.
- **VOZ DO NÚCLEO (IRON-VOICE)**, fundida no card do S.E.: alertas
  executivos falados em transições reais + assistente por push-to-talk
  ("qual a tendência / previsão / risco / consenso / diagnóstico…").
  TTS/STT são as APIs nativas do Safari; sem suporte → INDISPONÍVEL.
- **Núcleo Neural** (opt-in): Llama 3 local via WebLLM/WebGPU, chunks
  lazy — zero custo até o usuário ativar.

## Desenvolvimento local

```bash
cd ipad_runtime/ramber-ui
npm install --include=dev   # NODE_ENV=production omite devDeps sem a flag
npm run dev                 # serve com fs.allow para importar ../js e ../src
npm run build               # dist/ (o deploy copia para ../)
```

O preview local (`vite preview`) serve só `dist/` — o worker WASM
(`workers/quant-worker.js`) é sibling do deploy real, então o status
"MOTOR WASM · FALHOU" em preview local é esperado; no site publicado ele
conecta.

## Nota sobre a árvore legada

`index.html`, `css/ipad-runtime.css` e os módulos de UI do app vanilla
anterior (`js/app.js`, `js/ui/*`, `js/siriform.js`, `js/voice.js`,
`js/feature-detect.js`, `js/edge/*`, `js/orderflow-engine-ui.js`,
`js/diagnostics.js`, `js/evaluations.js`) são a interface **anterior** ao
terminal React. Nada disso é importado pelo build atual; a remoção
aguarda confirmação explícita do proprietário do repo.
`service-worker.js` é a exceção deliberada: foi reescrito como shim de
autodestruição que limpa caches antigos de aparelhos que ainda tenham o
service worker cache-first da era vanilla — deve permanecer até essa
população de dispositivos se renovar.

## O que continua bloqueado (por design, sem exceção)

MT5, `order_send`, bridge local, MEXC private endpoint, API secret, live
trading, execução real, ordem por LLM, ordem sem Risk Gate, segredo em
`localStorage`. Nenhuma dessas rotas existe neste código — não é apenas
uma flag desligada.

Documentação histórica (rotas, decisões e handoffs) em [`../docs/`](../docs/).
Notas de release do arco RC: [`../docs/RELEASE_NOTES_RC2.md`](../docs/RELEASE_NOTES_RC2.md).
