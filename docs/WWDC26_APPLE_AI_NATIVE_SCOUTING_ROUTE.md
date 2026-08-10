# WWDC26 Apple AI-Native Scouting Route — AR10 Cyborg 2.0

Documento técnico de apoio à entrega
`AR10_CYBORG_2_REAL_IPAD_HOLD_FIX_APPLE_NATIVE_APP_SHELL_ONE_BUTTON_SIRIFORM_V1_PLUS_WWDC26_AI_NATIVE_SCOUTING`
(Missão 8). Mapeia seis tecnologias anunciadas pela Apple na WWDC26
(Foundation Models framework, Private Cloud Compute, Core AI, MLX,
Evaluations framework, Instruments/profiling) contra uma arquitetura de
4 camadas, e documenta exatamente o que foi **implementado de verdade
nesta versão PWA** versus o que é **apenas mapeado como rota futura
nativa/híbrida**.

*Escopo: sub-produto `ipad_runtime/` (AR10 Cyborg 2.0). Não afeta o
organismo Python `AR10 ORION` na raiz do monorepo.*

## Regra de ouro (verbatim, governa todo este documento)

> Tudo que for PWA deve ser implementado de verdade no PWA. Tudo que for
> nativo deve ser marcado como "rota futura nativa/híbrida" até existir
> app nativo real. Sem claim falso.

Nenhuma seção abaixo descreve uma tecnologia nativa Apple como "ativa"
ou "integrada" neste runtime. Onde uma tecnologia WWDC26 é só uma API
nativa Swift/Apple Intelligence sem caminho de acesso por
Safari/WebKit/PWA, este documento diz isso explicitamente e classifica
como `FUTURE_NATIVE` — nunca como instalada, parcial ou "em progresso
silencioso".

## As 4 camadas (visão geral)

| Camada | Nome | Status nesta versão |
|---|---|---|
| **1** | PWA Premium Atual | `IMPLEMENTADA` — já existia antes desta missão (Missões 1–7) |
| **2** | Apple-like Web Runtime | `IMPLEMENTADA NESTA MISSÃO` — Evaluations, Instruments/Métricas, Siriform 11 estados |
| **3** | Híbrida Futura | `MAPEADA (FUTURE)` — documentação apenas, nenhum código novo |
| **4** | Apple-Native AI Futura | `MAPEADA (FUTURE)` — documentação apenas, nenhum código novo |

"Apple-like" (Camada 2) significa **paridade conceitual/visual** com
convenções de design e observabilidade da Apple — continua sendo 100%
tecnologia web (CSS/JS/Web APIs padrão), sem nenhum framework Swift,
sem nenhum binário nativo, sem nenhuma dependência de iOS/iPadOS além do
que o Safari/WebKit já expõe a qualquer site.

## Camada 1 — PWA Premium Atual (já existia, não foi refeita)

Sem mudanças nesta missão. Continua sendo a base real: Siriform Avatar
(CSS-only), Siriform Voice Layer (`js/voice.js`, Web Speech API),
Vault local com SHA-256 e FAIL_CLOSED (`js/pack-manager.js`), motor WASM
de estatística descritiva (`wasm/cyborg_quant_core.wasm`), Service
Worker cache-first (`service-worker.js`), exportação com nome único
(`js/export-manifest.js`). Detalhe completo já documentado em
`docs/IPAD_PWA_VISUAL_POLISH_HANDOFF.md`,
`docs/SIRIFORM_VOICE_AND_NATIVE_COMPANION_ROUTE.md` e
`docs/READ_ONLY_MARKET_SAFETY.md` — este documento não duplica esse
conteúdo, só referencia.

## Camada 2 — Apple-like Web Runtime (implementada nesta missão)

Duas tecnologias WWDC26 mapeadas para equivalentes **reais**, rodando
hoje dentro do próprio PWA, sem rede, sem dependência nativa:

### Evaluations framework → `js/evaluations.js` (implementado)

A Apple descreveu na WWDC26 um framework para escrever testes
estruturados sobre prompts/respostas de modelos Foundation Models. Este
runtime não tem nenhum LLM embutido (ver `docs/META_LLAMA_WEBLLM_ROUTE.md`
— `status: FUTURE` em toda a família Meta Llama) — então isto **não é**
uma avaliação de modelo de linguagem. É reinterpretado honestamente como
um auto-teste comportamental real do que o runtime já faz, organizado
nos mesmos 5 grupos que aparecem no painel "Evaluations":

| Grupo (`id` do painel) | O que testa de verdade | Função chamada |
|---|---|---|
| `command_routing` (`ev-command-routing`) | Toda frase permitida resolve para o `id` certo; toda frase bloqueada retorna `blocked`; frase mista (permitida + bloqueada) permanece `blocked` (defesa em profundidade); transcrição vazia/desconhecida tratada corretamente | `voice.matchCommand()` (mesmo roteador real usado por voz) |
| `security_posture` (`ev-security-posture`) | Tag CSP presente no DOM com as 5 diretivas obrigatórias; nenhum `<script>` de origem externa; `MARKET_DATA_POLICY.execution === 'DISABLED_BY_POLICY'`; os 4 blocos obrigatórios em `MARKET_DATA_POLICY.blocked`; nenhuma chave tipo segredo/API key em `localStorage` | leitura direta do `<meta http-equiv="Content-Security-Policy">` real, `document.scripts`, `MARKET_DATA_POLICY`, `localStorage` |
| `dados_insuficientes` (`ev-data-policy`) | Análise de mercado real reporta `DADOS INSUFICIENTES`; dataset de diagnóstico marcado `usable_for_market_decision: false` | `dataPolicy.realMarketAnalysisStatus()`, `MARKET_DATA_POLICY.diagnostic_mode` |
| `read_only_fail_closed` (`ev-fail-closed`) | `packManager.reloadVaultState()` sempre resolve para `READY` ou `LOCKED` — nunca um terceiro estado indefinido | `packManager.reloadVaultState()` (mesma função real do boot) |
| `siriform_states` (`ev-siriform-states`) | Todo estado declarado em `siriform.STATES` (11 estados) é de fato alcançável via `setSiriformState()`; um estado inválido normaliza para `idle` (fail-closed visual) | `siriform.setSiriformState()`, iterando `siriform.STATES` |

Cada checagem chama código vivo do app nesta sessão — nenhum resultado é
hardcoded ou decorativo; "PASS" só aparece quando a função real devolveu
o valor esperado. Acionável por botão (`btn-run-evaluations`, em
Manutenção/Técnico), por comando de voz/texto ("rodar evaluations" /
"rodar auto teste local" / "rodar avaliacoes") e termina o Siriform em
`protected` (tudo passou — confirmação ambiente de que READ_ONLY/
FAIL_CLOSED seguem intactos) ou `warning` (alguma falha — ver Telemetria
ao Vivo para o detalhe linha a linha). Relatório agregado renderizado no
painel `#evaluations-panel` (`renderEvaluationsPanel()` em `js/app.js`).

### Instruments/profiling → `js/metrics.js` (implementado)

A Apple usa o Instruments para perfilar apps nativos (tempo de
lançamento, uso de CPU/memória, hitches de animação). Não existe processo
nativo equivalente para inspecionar uma página web — então este módulo
registra, no próprio navegador, os sinais que um profiler nativo
mostraria, reaproveitando APIs já existentes em vez de duplicar lógica:

| Campo (painel `#metrics-panel`) | Fonte real | Observação honesta |
|---|---|---|
| `mx-load-time` | Navigation Timing Level 2 (`performance.getEntriesByType('navigation')`), com fallback para `performance.timing` | Tempo de carregamento desta sessão de página, não uma média histórica |
| `mx-prep-time` | `metrics.recordPrepDuration()`, chamado em `finally` ao redor de `handlePrepareCyborg()` | "Ainda não executado nesta sessão" até o botão principal rodar pelo menos uma vez |
| `mx-cache` | `getActiveCacheInfo()` (mesma sondagem do painel Vault Local) | Reaproveitada, não recalculada de outro jeito |
| `mx-storage` | `storage.storageEstimate()` (mesma sondagem do painel Vault Local) | idem — evita duas fontes divergentes para o mesmo número |
| `mx-siriform-events` | `MutationObserver` em `data-state` do avatar, instalado por `metrics.initMetrics()` | Conta transições de estado nesta sessão; não toca `siriform.js`, que permanece puramente visual |
| `mx-diag-fails` | `metrics.recordDiagnosticsReport()`, chamado ao fim de `handleRunDiagnostics()` | "Falhas **desde o último diagnóstico**", não um monitor contínuo |
| `mx-eval-fails` | `metrics.recordEvaluationsReport()`, chamado ao fim de `handleRunEvaluations()` | "Falhas **desde o último Evaluations**", mesma honestidade de escopo |
| `mx-reduced-motion` | `window.matchMedia('(prefers-reduced-motion: reduce)')` | Lido em tempo real, não cacheado |

Painel atualizado sempre que o Modo avançado é aberto
(`refreshMetricsPanel()` chamado dentro de `wireAdvancedToggle()`). Sem
`fetch`, sem `XHR`, sem envio de telemetria a terceiros — toda leitura é
local e nada sai do dispositivo, consistente com `connect-src 'self'`.

### Siriform Avatar — vocabulário expandido de 9 para 11 estados

Dois estados novos, ambos transientes (revertem para `idle` após
3.6s, exceto `blocked` que é deliberadamente persistente):

| Estado novo | Mapeia para (WWDC26) | Gatilho real |
|---|---|---|
| `diagnosing` | RUNNING_DIAGNOSTIC | Início de `handleRunDiagnostics()` e `handleRunEvaluations()` |
| `protected` | READ_ONLY_PROTECTED | Fim de `handleRunEvaluations()` quando `report.fail === 0` |

Visual: anel `::after` com gradiente cyan/branco e dupla animação
(`siriformRing` + `siriformScanPulse`, radar-sweep) para `diagnosing`;
gradiente verde/cyan calmo com `siriformRipple` lento (3.2s) para
`protected`. Reforços menores em estados já existentes (`thinking` ganha
shimmer via `siriformScanPulse`; `updating` ganha borda tracejada
simulando progresso; `success` ganha `siriformRipple` rápido). Toda
animação nova é neutralizada pela regra universal
`prefers-reduced-motion: reduce` já existente em
`ipad_runtime/css/ipad-runtime.css` — verificado antes de adicionar
qualquer `@keyframes` novo, não depois.

Emoji tatuado nas legendas (✅⚠️🔒🧠✨📡🧩🛡️) é deliberadamente limitado a
um por legenda, nunca decorativo em excesso — segue o mesmo princípio de
"nenhum elemento visual sem função informativa" já estabelecido em
`docs/IPAD_PWA_VISUAL_POLISH_HANDOFF.md`.

## Camada 3 — Híbrida Futura (somente mapeada, nada implementado)

As quatro tecnologias abaixo **não têm caminho de acesso desde
JavaScript/Safari/PWA hoje** — são APIs nativas Swift/Apple
Intelligence, ou infraestrutura de servidor da própria Apple. Nenhuma
delas foi chamada, importada, simulada ou parcialmente implementada
nesta versão. Status de todas: `FUTURE_NATIVE`.

| Tecnologia WWDC26 | O que é | Por que não é acessível de um PWA hoje | O que seria necessário |
|---|---|---|---|
| **Foundation Models framework** | API Swift da Apple para usar o modelo de linguagem on-device do sistema (o mesmo que alimenta a Apple Intelligence) diretamente em apps | Não existe binding WebKit/JavaScript público para este framework — é Swift-only, parte do SDK nativo do iOS/iPadOS | Um app nativo (Swift/SwiftUI) que importe `FoundationModels` e exponha o resultado de volta ao PWA via alguma ponte local (ver Camada 4) |
| **Core AI** | Termo guarda-chuva da Apple para o conjunto de frameworks de ML/IA nativos (Foundation Models, Vision, Core ML, etc.) anunciado/consolidado na WWDC26 | Mesma limitação: são APIs nativas Swift/Objective-C, não expostas a conteúdo web | Mesmo pré-requisito: app nativo companion |
| **MLX** | Framework de arrays/ML da Apple voltado para Apple Silicon (uso típico: Python/Swift/C++ em pesquisa e apps nativos) | Sem porta WebAssembly oficial nem binding WebGPU/WebKit estável; é uma biblioteca nativa compilada para Apple Silicon, não um runtime de navegador | Um app nativo ou serviço local que rode MLX e exponha resultados via alguma ponte local — nunca substituiria o motor WASM atual (`cyborg_quant_core.wasm`), que já é real, leve e roda hoje em qualquer Safari |
| **Private Cloud Compute** | Arquitetura de servidor da Apple para processar pedidos de Apple Intelligence que excedem a capacidade on-device, com garantias de privacidade verificáveis (sem retenção de dados, atestação de hardware) | É infraestrutura de backend da própria Apple, acoplada à pilha nativa de Apple Intelligence — não existe (e não é esperado que exista) uma API pública para um site/PWA de terceiros invocar Private Cloud Compute diretamente | Só seria relevante **através** de um app nativo que já use Foundation Models/Apple Intelligence e que a própria Apple decida rotear para PCC — nunca uma chamada direta deste PWA |

### Ponte de acesso, se/quando existir um app nativo

As quatro linhas acima convergem para o mesmo pré-requisito: **um app
nativo companion real**, exatamente o já descrito em
`docs/SIRIFORM_VOICE_AND_NATIVE_COMPANION_ROUTE.md` (seção "Camada 2 —
Native Companion Route") para App Intents/Siri. Este documento não cria
uma segunda rota nativa paralela — reaproveita a mesma rota futura já
mapeada, agora também como o único caminho honesto para Foundation
Models/Core AI/MLX/Private Cloud Compute chegarem perto deste produto.

## Camada 4 — Apple-Native AI Futura (mapeamento, nenhum código novo)

Cenário hipotético de "se existisse um app nativo Swift/SwiftUI
companion", só para deixar explícito o que mudaria e o que **nunca**
mudaria — não é um compromisso de prazo nem uma promessa de entrega.

| Uso hipotético | Tecnologia | Substitui o quê hoje | Status |
|---|---|---|---|
| Explicar `AnalysisFrame`/transcrição de voz em linguagem natural mais rica | Foundation Models framework | A explicação determinística atual de `handleExplainAnalysis()` (texto fixo interpolado, sem modelo) | `FUTURE_NATIVE` |
| Orquestração geral de IA on-device do app nativo | Core AI | Nada — não há orquestrador de IA nesta versão PWA | `FUTURE_NATIVE` |
| Backend numérico alternativo para um eventual motor quant nativo | MLX | **Nunca** o motor WASM atual em produção PWA — WASM continua sendo a única via real em Safari/iPadOS | `FUTURE_NATIVE`, `REFERENCE_ONLY` |
| Pedidos que excedam capacidade on-device do app nativo | Private Cloud Compute | Nada nesta versão (não há nenhum pedido de IA, on-device ou não) | `FUTURE_NATIVE` |

### O que nunca muda, nem na Camada 4 (sem exceção)

As 14 leis de segurança (`READ_ONLY`, `FAIL_CLOSED`, `LOCAL_FIRST`,
`NO_REAL_TRADING`, `NO_ORDER_EXECUTION`, `NO_API_SECRET`,
`NO_PRIVATE_KEYS`, `NO_MEXC_PRIVATE`, `NO_MT5_ORDER_SEND`,
`NO_ORDER_BY_LLM`, `NO_ORDER_BY_VOICE`, `NO_SECRET_IN_LOCALSTORAGE`,
`NO_FAKE_DATA`, `NO_FAKE_LOCAL_AI_CLAIMS` — texto vinculante completo em
`docs/READ_ONLY_MARKET_SAFETY.md`) aplicam-se identicamente a qualquer
camada futura. Nenhuma tecnologia WWDC26 — nativa ou web — pode, por
construção, executar ordem, abrir/fechar posição, usar chave privada ou
contornar FAIL_CLOSED. Trocar o "motor" de explicação de texto
determinístico para um LLM on-device não muda o que esse motor tem
permissão de fazer.

## Carta branca controlada — decisões técnicas desta missão

| Decisão | Tecnologia escolhida | Por quê | Alternativa rejeitada | Risco | Rollback | Impacto no iPad | Impacto na URL | Impacto de segurança | Arquivos alterados |
|---|---|---|---|---|---|---|---|---|---|
| Equivalente de Evaluations | Módulo dedicado `js/evaluations.js`, importando `voice.js`/`siriform.js`/`data-policy.js` | Mantém separação de responsabilidades (uma preocupação por módulo, já é o padrão do repo); reusa funções reais em vez de duplicar lógica | Estender `diagnostics.js` existente | Baixo — só leitura/chamadas a funções puras já testadas | Remover import + painel; nenhum estado persistente criado | Nenhum (mesma página, mesmo scroll) | Nenhum | Nenhum — não adiciona rede, não adiciona storage, só lê estado já público no DOM/JS |
| Equivalente de Instruments | Módulo dedicado `js/metrics.js`, `MutationObserver` + Navigation Timing | Não invasivo: não exige editar `siriform.js` nem instrumentar dezenas de call sites | Bus de eventos global always-on | Baixo — `MutationObserver` é padrão, sem polling | Remover import + painel; métricas são só leitura em memória (não persistem em storage) | Nenhum | Nenhum | Nenhum — sem `fetch`, sem terceiros |
| Expansão Siriform 9→11 estados | `diagnosing` + `protected`, CSS via `--siriform-ring-color` custom property | Vocabulário consistente (lowercase, um substantivo/gerúndio), evita 6ª trilha/estado paralelo | Reaproveitar `checking`/`success` sem estados novos | Baixo — puramente visual, sem lógica nova | Remover 2 entradas de `STATES`/`DEFAULT_CAPTIONS`/CSS; nenhum dado persistido | Nenhum | Nenhum | Nenhum |
| Cache rollback (#15 da checklist) | Nenhuma UI nova — depende da atomicidade nativa do ciclo de vida do Service Worker | `cache.addAll(PRECACHE_URLS)` em `install` é tudo-ou-nada: se qualquer URL falhar, o `install` falha, `activate` nunca roda, e o cache/SW **anterior** continua ativo — rollback automático já existe por construção, sem código adicional | Construir um seletor manual de "versão de cache anterior" na UI | Médio se ignorado sem documentar — por isso esta linha existe | N/A (é o próprio mecanismo de rollback) | Nenhum | Nenhum | Ver "Por que não" abaixo |

### Cache rollback — por que não foi construído um seletor manual

Avaliado e descartado deliberadamente, não esquecido. Três motivos:

1. **O risco real não está no shell do Service Worker.** O cache do SW
   contém só HTML/CSS/JS/WASM estáticos do próprio build — pequeno,
   determinístico, e já protegido pela atomicidade de `cache.addAll()`
   descrita acima. O risco prático de corrupção está no **Vault local**
   (pacote instalado, checksums), que já tem sua própria rede de
   segurança dedicada: `verifySha256()` + `FAIL_CLOSED` +
   `autoRepairVault()` + "Limpar/Reinstalar" como último recurso — uma
   segunda forma de "rollback" para o mesmo problema só criaria
   divergência entre duas redes de segurança.
2. **Não existe um segundo artefato de versão para "voltar" a partir do
   PWA.** Este repositório/deploy do GitHub Pages publica uma versão de
   código por vez; manter múltiplos conjuntos completos de assets
   cacheados simultaneamente (para permitir "downgrade" de versão de
   shell) multiplicaria o uso de armazenamento sem um pedido real do
   usuário para isso.
3. **Escopo/risco desproporcional ao item da checklist.** Construir essa
   feature exigiria versionamento paralelo de cache + lógica de seleção
   de versão na UI — uma mudança estrutural maior do que o resto desta
   missão, sem necessidade demonstrada (nenhuma falha de upgrade de
   Service Worker foi reportada nas missões anteriores).

Bumped `CACHE_VERSION` de `cyborg-ipad-runtime-v7` para
`cyborg-ipad-runtime-v8` nesta missão (novos arquivos `js/evaluations.js`
e `js/metrics.js` adicionados a `PRECACHE_URLS`) — o próprio bump é a
prova viva de que o mecanismo de instalação atômica já documentado acima
é o que protege upgrades de versão, nesta missão como em todas as
anteriores (v1→v7).

## O que NÃO foi usado e por quê (sem claim falso)

| Tecnologia | Usada nesta versão? | Motivo |
|---|---|---|
| Foundation Models framework | Não | API Swift nativa, sem binding para Safari/PWA |
| Core AI | Não | Mesma limitação — guarda-chuva de frameworks nativos |
| MLX | Não | Biblioteca nativa para Apple Silicon, sem porta WASM/WebGPU estável; motor quant real desta versão continua sendo WASM (`cyborg_quant_core.wasm`) |
| Private Cloud Compute | Não | Infraestrutura de servidor da Apple, inacessível a um PWA de terceiros |
| Registro de App Intents/Siri nativo | Não | PWA não pode registrar intents do sistema — mesma conclusão já documentada em `docs/SIRIFORM_VOICE_AND_NATIVE_COMPANION_ROUTE.md` |

Nenhuma das cinco linhas acima aparece em nenhum painel da UI como
`AVAILABLE`, `INSTALLED` ou `OK` — todas, onde mencionadas, usam
`FUTURE`/`FUTURE_NATIVE`, consistente com `NO_FAKE_LOCAL_AI_CLAIMS`.

## Testes feitos nesta missão

- `node --check` em todos os arquivos JS novos/alterados
  (`js/evaluations.js`, `js/metrics.js`, `js/app.js`, `js/siriform.js`,
  `js/voice.js`, `service-worker.js`) — sem erro de sintaxe.
- Conferência manual de todo `id` novo referenciado por `js/app.js`
  contra `index.html` (`ev-*`, `mx-*`, `btn-run-evaluations`) — todos
  presentes, sem duplicata.
- Conferência de que `prefers-reduced-motion` neutraliza as duas
  animações novas (`siriformScanPulse`, `siriformRipple`) antes de
  adicioná-las (regra universal já existente, não precisou de exceção).
- Leitura completa de `service-worker.js` antes e depois do bump de
  versão, confirmando que `PRECACHE_URLS` lista os 2 arquivos novos e
  que `CACHE_VERSION` mudou de `v7` para `v8`.

## Relação com outros documentos

| Documento | Relação |
|---|---|
| `docs/READ_ONLY_MARKET_SAFETY.md` | Fonte única das 14 leis citadas na Camada 4 — este documento não as redefine. |
| `docs/SIRIFORM_VOICE_AND_NATIVE_COMPANION_ROUTE.md` | A "ponte de acesso nativa" da Camada 3 reaproveita a mesma rota App Intents/Siri já mapeada lá — não cria uma segunda rota nativa paralela. |
| `docs/META_LLAMA_WEBLLM_ROUTE.md` | Confirma por que não há LLM embutido nesta versão — premissa usada aqui para reinterpretar Evaluations como auto-teste comportamental, não avaliação de modelo. |
| `docs/IPAD_PWA_VISUAL_POLISH_HANDOFF.md` | Tabela de vocabulário de estado do Siriform (11 estados) atualizada nesta missão para refletir `diagnosing`/`protected`. |
