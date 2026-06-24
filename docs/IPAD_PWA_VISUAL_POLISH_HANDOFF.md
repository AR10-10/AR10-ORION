# iPad PWA Visual Polish — handoff de design do AR10 Cyborg 2.0

*Escopo: sub-produto `ipad_runtime/` (AR10 Cyborg 2.0). Não afeta o
organismo Python `AR10 ORION` na raiz do monorepo (`src/`, `config/`,
`data/`).*

## Propósito

Handoff técnico do trabalho de **polimento visual** (Fase A) e da camada
visual da **voz Siriform** (Fase B) sobre o painel único de
`ipad_runtime/index.html`. Documenta o que mudou, por que, e que vocabulário
de UI qualquer agente/dev futuro deve reutilizar em vez de inventar um novo
— para que o próximo polimento (cor, espaçamento, novo card) seja
consistente com o que já existe, sem precisar reconstituir essas decisões
lendo CSS bruto.

Este documento descreve a interface **tal como ela é hoje** — não é
roadmap. Para roadmap de capacidade (voz nativa, Meta Llama), ver
`docs/SIRIFORM_VOICE_AND_NATIVE_COMPANION_ROUTE.md` e
`docs/META_LLAMA_WEBLLM_ROUTE.md`.

## Linha do tempo (rastreabilidade por commit)

| Commit | O que entregou |
|---|---|
| `bbbc622` — "Nebula Core panel redesign + repo alignment + canonical handoff" | Siriform Avatar (8 estados, CSS-only), reestruturação de `index.html` nos 18 cards atuais, `reloadVaultState()` corrigido para devolver o motivo de um `LOCKED`. |
| `adce9b3` — "Add ONE-LINK iPad runtime, Siriform Voice Layer, and Meta Llama route docs" | `handlePrepareCyborg()` (pipeline de um toque), `js/voice.js` (Siriform Voice Layer), botão de microfone + atalhos rápidos, grid responsivo 2/3 colunas, painéis de status ligados a sondagens reais. |
| Pós-`adce9b3` (este handoff) | Painel unificado **Cyborg Readiness**, parágrafo de onboarding no Local Pack Manager, frase bloqueada `'enviar ordem'` adicionada a `BLOCKED_PHRASES`, correção de referências de doc desatualizadas (`META_LLAMA_WEB_NATIVE_ROUTE.md` → `META_LLAMA_WEBLLM_ROUTE.md`, `APPLE_INTELLIGENCE_AND_SIRI_ROUTE.md` → `SIRIFORM_VOICE_AND_NATIVE_COMPANION_ROUTE.md`). |

## Princípio de design que governa todo o resto

**Um painel, um scroll, zero rota nova.** `index.html` é uma única página
com cards sequenciais — nunca houve (e esta fase não introduziu) SPA
router, modal de navegação entre "telas", ou qualquer estado de URL além da
própria raiz. Todo polimento visual descrito abaixo respeitou essa
restrição: nenhum card foi promovido a página separada, nenhum botão
existente foi removido ou reposicionado para fora de ordem — apenas
adicionado, restilizado, ou reagrupado via CSS Grid (sem reordenar o DOM).

## Ordem real dos cards (após Fases A/B)

```
siriform-card               → orbe central, legenda, tag de estado, botão de mic
cyborg-readiness-panel      → NOVO: resumo unificado (ver seção dedicada)
voice-status-panel          → Siriform Voice (voz/microfone)
runtime-status-panel        → PWA/Service Worker/Cache/IndexedDB/OPFS/WebCrypto
feature-detect-panel        → sondas funcionais por API (WebGL, WASM, Workers...)
quant-engine-widget         → motor WASM real (sma/ema/stddev/zscore)
ai-models-panel             → Meta Llama/WebLLM/Transformers/ONNX (FUTURE)
replay-wrap                 → Replay BTC/USDT + profile-toggle Light/Balanced/Heavy
analysis-frame-panel        → estatística descritiva real ("não é recomendação")
data-policy-panel           → Política de Dados de Mercado (DADOS INSUFICIENTES)
evaluations-panel           → NOVO (Missão 8): equivalente local do framework Evaluations (WWDC26)
decision-frame-panel        → STUB CONTROLLED (sem lógica de decisão)
vault-evidence-card         → SHA-256 por arquivo, re-verificado a cada boot
vault-local-panel           → Vault Local do iPad (o que está instalado/validado)
metrics-panel                → NOVO (Missão 8): equivalente leve do Instruments (WWDC26)
local-pack-manager          → os 11 botões de ação (ver seção dedicada)
```

Os dois cards novos da Missão 8 (`evaluations-panel`, `metrics-panel`)
seguem o mesmo princípio: dentro de `.advanced-section`, nenhuma rota
nova, nenhum SPA router — apenas mais dois cards na mesma página de
scroll único. Detalhe completo em
`docs/WWDC26_APPLE_AI_NATIVE_SCOUTING_ROUTE.md`.

Nenhum card foi removido. O único card novo desta fase é
`cyborg-readiness-panel`, inserido logo após o Siriform — propositalmente o
primeiro painel de status que o usuário vê, por ser o resumo mais
condensado.

## Siriform Avatar — vocabulário de estado (não inventar um décimo segundo valor)

Duas trilhas independentes, mantidas separadas de propósito (mesmo um
estado "atualizando" pode coexistir com voz "ouvindo" sem se misturar) —
ver comentário verbatim no topo de `js/siriform.js`. Vocabulário corrente
(11 estados, pós-Missão 8/WWDC26 scouting — substitui qualquer tabela
anterior deste documento):

### Trilha de atividade (`data-state` em `#siriform-avatar`)

| Estado | Legenda padrão | Origem |
|---|---|---|
| `idle` | "Cyborg em standby. Toque em 'Preparar / Atualizar Cyborg neste iPad' para começar." | estado de repouso "de lei", reassumido automaticamente 3.6s após qualquer estado transiente, exceto `blocked` |
| `listening` | "Ouvindo o seu toque..." | Missão 7 |
| `thinking` | "🧠 Processando localmente, sem rede..." | Missão 7 (emoji + shimmer na Missão 8) |
| `updating` | "✨ Atualizando/instalando pacote local no Safari Storage..." | Missão 7 (emoji na Missão 8) |
| `checking` | "Verificando dados locais..." | Missão 7 |
| `diagnosing` | "📡 Executando diagnóstico offline completo..." | **novo na Missão 8** — RUNNING_DIAGNOSTIC (WWDC26) |
| `repairing` | "🧩 Reparando instalação local..." | Missão 7 (emoji na Missão 8) |
| `success` | "✅ Pronto." | Missão 7 (emoji na Missão 8) |
| `warning` | "⚠️ Atenção: ação manual pode ser necessária." | Missão 7 (emoji na Missão 8) |
| `blocked` | "🛡️ Execução real bloqueada. Modo seguro ativo." | Missão 7 (emoji na Missão 8) — único estado que **não** reverte para `idle` automaticamente (FAIL_CLOSED visualmente persistente) |
| `protected` | "🔒 Protegido: somente leitura, execução real bloqueada por política." | **novo na Missão 8** — READ_ONLY_PROTECTED (WWDC26), confirmação ambiente ao final de um `runEvaluations()` 100% PASS |

`blocked` e `protected` são estados-irmãos, não sinônimos: `blocked` é o
aviso de que uma ação específica foi recusada **agora** (ex.: comando de
voz pedindo execução real); `protected` é a confirmação ambiente de que
as leis de segurança seguem intactas **após uma verificação** (ex.: fim
de Evaluations sem nenhuma falha). Ver
`docs/WWDC26_APPLE_AI_NATIVE_SCOUTING_ROUTE.md` para o mapeamento
completo Evaluations/Instruments → `js/evaluations.js`/`js/metrics.js`.

### Trilha de voz (`data-voice-state` no botão de microfone)

| Estado | Legenda padrão |
|---|---|
| `voice_idle` | "Microfone em standby." |
| `voice_permission_required` | "Preciso da permissão do microfone para ouvir você." |
| `voice_listening` | "Ouvindo..." |
| `voice_processing` | "Interpretando o comando de voz..." |
| `voice_responding` | "Pronto." (reassume `voice_idle` 3.2s depois) |
| `voice_text_only` | "Voz indisponível neste Safari — use os botões na tela." |
| `voice_unsupported` | "Reconhecimento de voz não suportado neste navegador." |
| `voice_blocked_by_policy` | "Execução real está bloqueada. O Cyborg está em READ_ONLY / FAIL_CLOSED." |

Qualquer novo estado de avatar precisa decidir explicitamente em qual das
duas trilhas entra — nunca criar uma terceira trilha nem misturar um
conceito de voz dentro de `data-state`.

## Vocabulário de cor/status (`v-ok` / `v-fail` / `v-info` / `v-pending` / `v-limited`)

Definido em `ipad_runtime/css/ipad-runtime.css`, mapeado em runtime por
`classFor()` (`js/app.js`). **Esta é a única paleta semântica do painel** —
qualquer status novo deve mapear para uma destas cinco classes, nunca
introduzir uma sexta sem necessidade real:

| Classe | Cor | Quando `classFor()` aplica |
|---|---|---|
| `v-ok` | verde (`--long-green`) | valor é `OK`, `true`, `INSTALLED`, `READY`, `AVAILABLE` ou `GRANTED` |
| `v-fail` | vermelho (`--short-red`) | valor é `FAIL`, `MISSING`, `UNSUPPORTED`, `TOO_LARGE` ou `DENIED` |
| `v-info` | ciano (`--sys-cyan`) | valor é `FUTURE`, `LIGHT`, `BALANCED` ou `HEAVY` |
| `v-pending` | neutro | valor inicial em HTML antes de qualquer sondagem rodar (texto `…`) |
| `v-limited` | neutro/âmbar | qualquer outro valor não listado acima (ex.: `LIMITED`, `PARTIAL`) — é o ramo `else` de `classFor()`, não uma lista fechada própria |

Nenhum campo de status deste painel nasce com `v-ok` por padrão — todos
começam `v-pending` no HTML estático e só mudam de classe depois de uma
sondagem real rodar (`refreshFeatureStatus()`, `getVoiceStatus()`, etc.).
Isso é deliberado: um "tudo verde" antes de qualquer verificação rodar
seria um falso positivo.

## Painel novo: Cyborg Readiness (`#cyborg-readiness-panel`)

Resumo unificado de 14 campos, todos alimentados por sondagens que já
existiam em painéis individuais — este card não introduz nenhuma sondagem
nova, apenas agrega os resultados existentes num único lugar de leitura
rápida (a motivação original: antes desta fase, confirmar "está tudo
pronto?" exigia rolar por 6 cards diferentes).

| Campo (`id`) | Rótulo | Fonte real do valor |
|---|---|---|
| `cr-pwa` | PWA HTTPS | `refreshFeatureStatus().pwaHttps` |
| `cr-sw` | Service Worker | `refreshFeatureStatus().serviceWorker` |
| `cr-cache` | Cache API | `refreshFeatureStatus().cacheApi` |
| `cr-idb` | IndexedDB | `refreshFeatureStatus().indexedDb` |
| `cr-opfs` | OPFS | `refreshFeatureStatus().opfs` (distingue `LIMITED` de `MISSING`) |
| `cr-webcrypto` | Web Crypto | `refreshFeatureStatus().webCrypto` |
| `cr-wasm` | WASM | `refreshFeatureStatus().wasm` |
| `cr-workers` | Workers | `refreshFeatureStatus().workers` |
| `cr-webgpu` | WebGPU | `refreshFeatureStatus().webgpu` (`UNSUPPORTED` em vez de `MISSING` — WebGPU é opcional, não bloqueante) |
| `cr-voice` | Siriform Voice | `voice.getVoiceStatus().overall` |
| `cr-llama` | Meta Llama/WebLLM | sempre `FUTURE` nesta versão (sem sondagem condicional — nenhum modelo está instalado, então não há o que sondar) |
| `cr-pack` | Local Pack | `vault.status === 'READY'` |
| `cr-replay` | Replay BTC/USDT | sucesso/falha de `packManager.loadReplayDataset()` |
| `cr-safety` | READ_ONLY / FAIL_CLOSED | sempre `OK` — é uma garantia estrutural do build, não uma sondagem condicional (ver `docs/READ_ONLY_MARKET_SAFETY.md`) |

`refreshCyborgReadiness(f, voiceStatus)` (`js/app.js`) é chamada em 4
pontos do fluxo — `handleCheckSafari()`, `boot()`,
`refreshVaultAndReplayStatus()`, `handleRunReplay()` — para que o resumo
nunca fique desatualizado em relação ao painel detalhado que originou cada
valor.

## Onboarding de primeiro uso

Dois elementos cobrem o fluxo de primeira vez, sem introduzir nenhum
wizard/modal novo:

1. **Botão "Preparar Cyborg neste iPad"** (`btn-prepare-cyborg`) —
   `handlePrepareCyborg()` executa, em sequência, download → verificação
   SHA-256 → instalação → init do WASM → replay → diagnóstico, com
   `FAIL_CLOSED` automático em qualquer divergência de checksum. É
   **aditivo**: os 9 botões originais da Fase 3 (Verificar Safari, Baixar
   Pacote Local, Importar Pacote do Arquivos, Verificar SHA256, Instalar no
   Safari Storage, Rodar Diagnóstico Offline, Rodar Replay BTC/USDT,
   Limpar/Reinstalar, Adicionar à Tela de Início) continuam todos
   presentes e funcionais para quem prefere repetir uma etapa manualmente
   — o total no `local-pack-manager` é 10 botões, não uma substituição dos
   9 anteriores.
2. **Parágrafo `.onboarding-hint`** acima da grade de botões, texto fixo:
   > "Primeira vez aqui? Toque em **'Preparar Cyborg neste iPad'** — um
   > único toque baixa, verifica, instala e roda o primeiro
   > diagnóstico/replay nesta ordem. Os botões abaixo continuam
   > disponíveis para repetir cada etapa manualmente."

Nenhum dos dois esconde os botões individuais nem altera a ordem deles —
o "modo fácil" e o "modo manual" coexistem na mesma tela.

## Layout responsivo (sem reordenar o DOM)

Estratégia: `grid-column` direto por `id`, nunca reordenação de elemento
no HTML. Os mesmos 12 cards aparecem na mesma ordem em qualquer largura —
o que muda é só quantas colunas a CSS Grid do contêiner principal usa.

| Breakpoint | Comportamento |
|---|---|
| (padrão, mobile/iPad portrait) | coluna única — ordem do DOM é a ordem visual |
| `@media (min-width: 900px)` | grade de 2 colunas — `cyborg-readiness-panel`, `voice-status-panel`, `status-panel`, `feature-detect-panel` etc. recebem `grid-column: 1`; `replay-wrap`, `analysis-frame-panel` etc. recebem `grid-column: 2` |
| `@media (min-width: 1300px)` | grade de 3 colunas, mesmo princípio |
| `@media (display-mode: standalone)` | ajustes de safe-area para o app instalado (ícone na Tela de Início), independente de largura |
| `@media (max-width: 480px)` | ajustes de densidade para a tela mais estreita suportada |

Consequência prática: adicionar um card novo no futuro exige só decidir em
qual coluna ele entra nos breakpoints de 900px/1300px — nunca mover sua
posição no HTML.

## O que esta fase deliberadamente não fez

- **Não trocou nenhuma fonte para CDN/Google Fonts** — a pilha de fontes
  de sistema (`ui-sans-serif`/`ui-monospace`) já estabelecida foi mantida;
  zero requisição de rede além do próprio HTTPS do app.
- **Não adicionou nenhum framework de UI** (React, Vue, etc.) — os
  arquivos continuam módulos ES simples, sem build step, no mesmo estilo
  de `replay-engine.js`/`diagnostics.js`.
- **Não removeu nem renomeou nenhum `id` de elemento existente** usado por
  `app.js` — toda adição usou IDs novos (`cr-*`, `cyborg-readiness-panel`,
  `onboarding-hint`).
- **Não introduziu uma sexta classe de status** — `LIMITED`/`PARTIAL`
  continuam caindo no ramo `v-limited` existente em vez de ganhar uma cor
  própria.

## Relação com outros documentos

| Documento | Relação |
|---|---|
| `docs/READ_ONLY_MARKET_SAFETY.md` | O campo `cr-safety` deste painel é a representação visual de 1 linha das 14 leis consolidadas naquele documento. |
| `docs/SIRIFORM_VOICE_AND_NATIVE_COMPANION_ROUTE.md` | Detalha a Camada 1 (Siriform Voice Layer) cuja UI (botão de mic, trilha `data-voice-state`) este documento descreve visualmente. |
| `docs/META_LLAMA_WEBLLM_ROUTE.md` | Detalha por que `cr-llama`/`st-llama-*` são `FUTURE` nesta versão. |
| `docs/PROMPT_CACHING_AND_AGENT_CONTEXT_STRATEGY.md` | "Stable Block 04 — UI/UX Contract" descreve o mesmo vocabulário `v-ok`/`v-fail`/`v-info`/`v-pending` em forma resumida, citável por qualquer agente. |
| `ipad_runtime/README.md` | Descreve a arquitetura de arquivos e as decisões técnicas originais (Fase 3) sobre as quais este polimento foi construído. |
