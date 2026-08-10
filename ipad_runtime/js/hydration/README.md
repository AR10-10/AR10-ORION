# Hydration Engine — `js/hydration/`

Armazenamento progressivo no iPad: hidrata o app em pacotes pequenos,
valida cada um por SHA-256, paga atenção a quota/bateria/aba em background,
e nunca baixa tudo de uma vez. "Beber água pouco a pouco", não um balde.

Único ponto de entrada para `app.js`: **`hydration-manager.js`**. Os outros
6 módulos reais são implementação interna, importados só por ele (ou entre
si). Nenhum destes módulos abre rota de rede nova, ativa live, chama
`order_send`, ou relaxa o CSP — tudo lê do `.ar10pack` same-origin já
buscado por `pack-manager.js` ou do Cache Storage já existente.

## Módulos reais (importados, testados, no precache)

| Arquivo | Papel |
| --- | --- |
| `manifest-reader.js` | Monta o `HydrationManifest` (contrato da spec) a partir do pacote local carregado + um pacote sintético `app_shell` que representa o que o Service Worker já precacheou. Puro: não escreve em nenhum storage. |
| `hash-validator.js` | Validação SHA-256 por pacote via `crypto.subtle` (mesma fonte de verdade que `pack-manager.js` e `tools/build_pack.py`). Tri-state: `PASS` / `FAIL` / `NOT_APPLICABLE` (pacote agregado sem hash individual, ex. `app_shell` — nunca um `PASS` fabricado). |
| `quota-monitor.js` | `navigator.storage.estimate()` classificado em `OK` / `LOW` / `CRITICAL`. Se a API não responder, o status é `DESCONHECIDO` — nunca um número inventado, e nunca bloqueia preventivamente por uma estimativa que o navegador não deu. |
| `hydration-checkpoint.js` | Persiste o `HydrationState` em `storage.js` sob a chave `hydration_checkpoint` — **nunca** a chave `vault_state` (exclusiva de `pack-manager.js`). É o que permite retomar uma sessão pausada sem reiniciar do zero. |
| `local-availability-map.js` | Monta o `LocalAvailabilityMap` lendo o estado já real de outros módulos (Vault, Cache Storage, Event Log, Real Data Layer). Campo que ainda não tem fonte fica `false`, com o motivo em `limitations` — nunca um valor inventado. |
| `hydration-queue.js` | Fila genérica, platform-agnostic: processa um item por vez, pausa de respiro (120ms) entre eles, checa `shouldPause` uma vez por iteração e para de forma limpa (nunca espera ativa). Não sabe o que é "bateria baixa" ou "aba em background" — isso é injetado por quem chama. |
| `hydration-manager.js` | Orquestrador. Política específica do Safari (aba em background, bateria baixa via `getBattery()` quando existe, pausa pedida pelo usuário) vive aqui. Delega a escrita final do Vault a `pack-manager.installToSafariStorage()` e a re-verificação real a `pack-manager.reloadVaultState()` — single-writer, um único dono de cada operação. |

## FUTURE / não conectado ainda

- **`storage-router.js`** — existe, passa `node --check`, exporta
  `routeAndStore()`/`readBack()` com a separação `OPFS_OR_IDB` →
  `storage.js` / `CACHE_API` → leitura-só (nunca escreve, pois o Service
  Worker é o único escritor de Cache Storage). **Não é importado por
  `hydration-manager.js` hoje** porque a escrita real do Vault já é
  single-writer via `pack-manager.installToSafariStorage()` (testado, usado
  pelo fluxo manual "Instalar") e a re-verificação real já é
  `pack-manager.reloadVaultState()` — ambos cobrem leitura/escrita correta
  sem precisar deste router. Ligá-lo hoje seria duplicar lógica que já
  existe e funciona. Reservado para um cenário futuro de escrita
  incremental por pacote (ex.: pacotes de prioridade 3/4 entregues fora do
  `.ar10pack` único, um por vez, sem reescrever o pacote inteiro). Por isso
  também não está no `PRECACHE_URLS` do service worker (mesma regra de "não
  precachear o que nenhum arquivo do fecho ainda importa", já usada para
  `src/research/**`).
- **Busca remota de pacotes** — hoje só existe um `.ar10pack` same-origin
  (`AR10_CYBORG_LOCAL_PACK_V1.ar10pack`). Buscar pacotes adicionais de uma
  origem remota (ex. GitHub Pages, conforme a seção "Integração com Local
  Soldier futuro" da spec) não está implementado — `connect-src` do CSP
  também não cobre isso hoje, e mudar CSP exige aprovação explícita.
- **Compressão de pacote** — `.ar10pack` é JSON com payloads em base64, sem
  compressão (decisão técnica documentada no `README.md` principal,
  "Por que `.ar10pack` é JSON e não ZIP"). Comprimir exigiria um
  (de)compressor em JS — terceiro ou escrito à mão — não fornecido nesta
  entrega.
- **Hashing fora da main thread** — `hash-validator.js` chama
  `crypto.subtle.digest` diretamente; não existe um Web Worker dedicado de
  hashing. Para os tamanhos atuais (pacote local pequeno) não há sinal de
  jank perceptível no iPad; um worker dedicado é uma otimização futura, não
  uma correção de um problema observado.
- **Pacotes de prioridade 3/4 adicionais** — o manifesto de hoje deriva
  inteiramente do `.ar10pack` único (2 arquivos reais: WASM + replay
  dataset) mais o `app_shell` sintético. Categorias adicionais da spec
  (snapshots avulsos, reflection reports avulsos, modelos locais opcionais,
  documentos longos) já têm memória própria persistida (`js/memory/**`),
  mas não são hoje pacotes hidratáveis independentes — entrariam como itens
  novos de `manifest-reader.js` quando/se existir um pacote dedicado para
  eles.

## Por que isto não duplica `js/memory/hydration-report.js`

São dois conceitos diferentes que só compartilham a palavra "hidratação":

- `memory/hydration-report.js` descreve o que foi **re-lido da memória já
  instalada** (Event Log, Snapshots, Evidence Ledger) ao abrir o app —
  rehydration de estado, não de armazenamento. Card `memory-alive-panel`,
  prefixo de id `mv-*`, variável `lastHydrationReport`.
- `js/hydration/**` (este diretório) decide **o que ainda falta baixar e
  gravar em disco** pela primeira vez, em pacotes, validado por hash. Card
  `hydration-engine-panel`, prefixo de id `he-*`, variável
  `lastHydrationEngineStatus`, tipo de exportação
  `HYDRATION_ENGINE_REPORT`.

Nomes deliberadamente distintos para não confundir o painel nem a
documentação — não há colisão de código, os dois módulos não se importam
um ao outro.
