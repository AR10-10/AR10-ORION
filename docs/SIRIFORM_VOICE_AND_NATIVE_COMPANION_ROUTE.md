# Siriform Voice and Native Companion Route — voz no AR10 Cyborg 2.0

Documento técnico de apoio a
`AR10_CYBORG_2_FINAL_IPAD_ONE_LINK_SIRIFORM_LLAMA_DEPLOY_V1`. Cobre as
**duas camadas de voz** do produto: a que já existe e roda hoje dentro da
própria página (`Siriform Voice Layer`), e a que é apenas roadmap
declarado (`Native Companion Route` — App Intents / Siri Shortcuts /
Apple Intelligence).

## Camada 1 — Siriform Voice Layer (implementada agora)

Arquivo: `ipad_runtime/js/voice.js`, consumido por `ipad_runtime/js/app.js`.

- **Motor**: `SpeechRecognition`/`webkitSpeechRecognition` (Web Speech
  API) + `speechSynthesis` (Web Speech Synthesis API) — ambas nativas do
  Safari/WebKit, nenhuma biblioteca externa, nenhum CDN.
- **Idioma**: `pt-BR` fixo, tanto para escuta quanto para resposta falada.
- **Modo de escuta**: janela única (`continuous = false`,
  `interimResults = false`) — toca o microfone, fala uma frase, solta.
  Não é um modo "always listening"; nunca grava ou transmite áudio para
  fora do dispositivo por iniciativa deste app (ver nota de privacidade
  abaixo).
- **Fallback honesto**: se o motor de reconhecimento ou síntese não
  existir nesta versão do Safari, o painel "Siriform Voice" mostra
  `UNSUPPORTED`/`TEXT_ONLY` e a legenda do Siriform Avatar (texto puro,
  sempre funciona) substitui a voz — nunca um "voz disponível" falso.

### Comandos permitidos (verbatim)

Cada comando reconhecido vira uma **intenção** (`id`), nunca uma chamada
direta de execução. Lista completa (`ALLOWED_COMMANDS` em `voice.js`):

| Frase reconhecida | Intenção (`id`) | Handler real (mesmo do botão na tela) |
|---|---|---|
| "verificar safari" | `check-safari` | `handleCheckSafari` |
| "preparar cyborg neste ipad" / "preparar cyborg" | `prepare-cyborg` | `handlePrepareCyborg` |
| "rodar diagnostico offline" / "rodar diagnostico" | `run-diagnostics` | `handleRunDiagnostics` |
| "rodar replay btc usdt" / "rodar replay btc/usdt" / "rodar replay btc" | `run-replay` | `handleRunReplay` |
| "mostrar status" | `show-status` | `handleShowStatus` |
| "explicar analise" | `explain-analysis` | `handleExplainAnalysis` |
| "mostrar modo de seguranca" | `show-safety-mode` | `handleShowSafetyMode` |
| "como adicionar a tela de inicio" | `show-add-home` | `handleAddHome` |

### Frases bloqueadas por política (verbatim, prioridade máxima)

Checadas **antes** de qualquer comando permitido — se a transcrição
contiver qualquer uma destas, o resultado é sempre `blocked`, mesmo que a
mesma frase também contenha um trecho permitido (defesa em profundidade):

```
comprar · vender · abrir ordem · fechar ordem · enviar ordem · operar real · usar chave · conectar conta real
```

**Resposta obrigatória, sempre a mesma, falada e escrita:**

> "Execução real está bloqueada. O Cyborg está em READ_ONLY / FAIL_CLOSED."

### Por que "ordem por voz" nunca é possível aqui (arquitetura, não promessa)

`voice.js` só faz `matchCommand(transcript) → { type, id|response }`.
Quem decide o que fazer com essa intenção é sempre `app.js`, através de
`dispatchVoiceCommand(id)` — e esse despachante chama **exatamente as
mesmas funções** (`handleCheckSafari`, `handlePrepareCyborg`,
`handleRunDiagnostics`, `handleRunReplay`, `handleShowStatus`,
`handleExplainAnalysis`, `handleShowSafetyMode`, `handleAddHome`) que os
botões na tela já chamam. Não existe — e nunca existiu — uma segunda
superfície de execução exclusiva da voz. Voz é apenas um atalho de
entrada para o mesmo conjunto de ações seguras; não pode, por construção,
desbloquear nada que o toque na tela já não fizesse.

### Estados de voz do Siriform Avatar

Trilha independente (`data-voice-state`) do estado de atividade
(`data-state`) do mesmo avatar — ver `ipad_runtime/js/siriform.js`:

| Estado | Gatilho | Frase/legenda |
|---|---|---|
| `voice_idle` | Repouso, microfone pronto | "Microfone em standby." |
| `voice_permission_required` | Permissão de microfone pendente/negada | "Preciso da permissão do microfone para ouvir você." |
| `voice_listening` | Escutando (janela única ativa) | "Ouvindo..." |
| `voice_processing` | Interpretando a transcrição (`matchCommand`) | "Interpretando o comando de voz..." |
| `voice_responding` | Comando permitido executado, resposta pronta | "Pronto." |
| `voice_text_only` | Nem reconhecimento nem síntese disponíveis | "Voz indisponível neste Safari — use os botões na tela." |
| `voice_unsupported` | `SpeechRecognition` ausente neste navegador | "Reconhecimento de voz não suportado neste navegador." |
| `voice_blocked_by_policy` | Frase bloqueada reconhecida | "Execução real está bloqueada. O Cyborg está em READ_ONLY / FAIL_CLOSED." |

### Painel "Siriform Voice" — campos de status

`st-voice` (resumo geral: `AVAILABLE`/`LIMITED`/`TEXT_ONLY`),
`st-speech-rec` (`AVAILABLE`/`UNSUPPORTED`), `st-speech-syn`
(`AVAILABLE`/`UNSUPPORTED`), `st-mic-perm`
(`GRANTED`/`DENIED`/`REQUIRED`) — todos sondados de verdade via
`voice.getVoiceStatus()`, nunca assumidos como `OK` por padrão.

### Nota de privacidade (honestidade técnica)

Dependendo do dispositivo/idioma, o próprio Safari/iPadOS pode processar
o reconhecimento de fala em um servidor da Apple — isso é um detalhe de
implementação do **sistema operacional**, fora do controle desta página,
e não constitui uma chamada de rede deste app: nenhum `fetch()`/`XHR` é
feito por `voice.js`, e a CSP (`connect-src 'self'`) permanece intacta
durante todo o fluxo de voz.

## Camada 2 — Native Companion Route (FUTURE, não implementada)

Esta seção é roadmap declarado, não uma funcionalidade disponível nesta
versão. Documentada para deixar claro **o que seria necessário** para
existir uma integração nativa com Siri/Apple Intelligence, e por que
ainda não existe.

| Campo de status (UI) | Valor atual | Significado |
|---|---|---|
| `st-siri-native` | `FUTURE_NATIVE_COMPANION` | Nenhum app nativo/companion existe; PWA não pode registrar um App Intent por conta própria |
| `st-apple-intel` | `APP_INTENTS_FUTURE` | Apple Intelligence/Siri Shortcuts exigem App Intents, que exigem um app nativo (Swift/SwiftUI), não um PWA |

### O que faltaria tecnicamente (honesto, sem promessa de prazo)

1. **Um app nativo companion** (Swift/SwiftUI, fora do escopo deste PWA)
   que declare `AppIntent`s — PWAs/Safari não podem registrar intents do
   sistema Siri/Apple Intelligence diretamente.
2. **App Intents** específicos por comando seguro (ex.: "Verificar
   Safari", "Mostrar status"), cada um mapeando para os mesmos handlers
   read-only já existentes — nunca para uma ação nova.
3. **Siri Shortcuts** configurados pelo usuário no app Atalhos do
   iOS/iPadOS, invocando esses App Intents.
4. **Mesma lista de comandos permitidos/bloqueados** desta camada,
   replicada no app nativo — a política de segurança não muda ao trocar
   de transporte (voz no navegador vs. Siri nativo).
5. **Possível ponte local** entre o app nativo e o PWA (ex.: Universal
   Links/URL scheme) para abrir o painel já no estado certo — não uma
   API de rede nova, não uma rota de execução nova.

### O que esta rota nunca vai fazer, nem no futuro

Executar ordem, abrir/fechar posição, usar API secret ou qualquer chave
privada, operar conta real, ou contornar READ_ONLY/FAIL_CLOSED sob
qualquer comando — de voz, de texto, ou nativo via Siri/Apple
Intelligence. A política de segurança é a mesma em todas as camadas de
voz, presentes e futuras.
