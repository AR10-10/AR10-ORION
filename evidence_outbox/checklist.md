# Checklist de Evidência — AR10_CYBORG_2_VISUAL_POLISH_MULTI_ASSET_RESEARCH_AND_CONNECTOR_ARCHITECTURE_V1

Continuação direta de `AR10_CYBORG_2_FINAL_IPAD_ONE_LINK_SIRIFORM_LLAMA_DEPLOY_V1`
— mesmo branch (`claude/eloquent-cannon-qyt86y`), mesmo PR (#3), sem
reinício. Esta missão é de **polimento visual, arquitetura analítica,
módulos de pesquisa, scaffolding de conectores e planejamento de
estratégia futura** — explicitamente não é uma fase de live trading.
Marcado apenas o que foi de fato executado e verificado nesta sessão —
nenhum item abaixo é "assumido como passando".

## Visual Polish (Fase A) + Cyborg Readiness Panel

- [x] Painel `cyborg-readiness-panel` adicionado logo após o Siriform —
      resumo unificado de 14 campos (`cr-pwa`...`cr-safety`), todos
      alimentados por sondagens já existentes (nenhuma sondagem nova).
      Documentado campo a campo em `docs/IPAD_PWA_VISUAL_POLISH_HANDOFF.md`.
- [x] `refreshCyborgReadiness(f, voiceStatus)` (`js/app.js`) chamada nos 4
      pontos do fluxo (`handleCheckSafari`, `boot`,
      `refreshVaultAndReplayStatus`, `handleRunReplay`).
- [x] Parágrafo `.onboarding-hint` adicionado acima do Local Pack Manager
      — não esconde nem reordena os 10 botões existentes.
- [x] `classFor()` (`js/app.js`) ramo `v-limited` confirmado como
      `else` aberto (não lista fechada) — nenhuma sexta classe de status
      introduzida.
- [x] Nenhum card promovido a página separada, nenhuma rota nova, nenhum
      `id` existente removido ou renomeado — confirmado via `git diff`
      linha a linha antes de qualquer escrita de doc sobre o assunto.

## Documentação consolidada (11 documentos em `docs/`)

- [x] `docs/READ_ONLY_MARKET_SAFETY.md` (novo) — índice citável das 12
      leis vinculantes, lei por lei, com aplicação real (arquivo +
      mecanismo), incluindo a categoria "ausência por design" para
      `NO_SECRET_IN_LOCALSTORAGE` (confirmado via grep: zero usos de
      `localStorage` em todo `ipad_runtime/`).
- [x] `docs/IPAD_PWA_VISUAL_POLISH_HANDOFF.md` (novo) — handoff visual
      completo, com rastreabilidade por commit (`bbbc622`, `adce9b3`,
      pós-`adce9b3`) distinguindo trabalho já mesclado de diff atual.
- [x] `docs/PROMPT_CACHING_AND_AGENT_CONTEXT_STRATEGY.md` (novo) — 5
      blocos estáveis para contexto de agente, com referência cruzada
      adicionada para `READ_ONLY_MARKET_SAFETY.md` nesta sessão.
- [x] `docs/CONNECTOR_REGISTRY_DESIGN.md`, `docs/DATA_SOURCE_MATRIX.md`,
      `docs/FUTURE_READY_ASSET_CLASS_REGISTRY.md`,
      `docs/MULTI_ASSET_RESEARCH_LIBRARY.md`, `docs/STRATEGY_PLAYBOOK.md`,
      `docs/ANALYSIS_OUTPUT_CONTRACT.md` (novos) — confirmados presentes,
      bem formados (primeira linha = título esperado), sem alteração
      necessária nesta sessão.
- [x] `docs/META_LLAMA_WEB_NATIVE_ROUTE.md` → renomeado para
      `docs/META_LLAMA_WEBLLM_ROUTE.md`; `docs/APPLE_INTELLIGENCE_AND_SIRI_ROUTE.md`
      → renomeado para `docs/SIRIFORM_VOICE_AND_NATIVE_COMPANION_ROUTE.md`
      (via `git mv`-equivalente, conteúdo expandido). Referências
      cruzadas antigas corrigidas nos arquivos que apontavam para os
      nomes antigos.
- [x] `docs/DATA_SOURCE_MATRIX.md` — seção "Ver também" atualizada para
      citar `data-sources.readonly.json` e `READ_ONLY_MARKET_SAFETY.md`.

## Configuração / scaffolding (`ipad_runtime/configs/`, `ipad_runtime/src/`)

- [x] `ipad_runtime/configs/asset-universe.default.json` +
      `asset-universe.schema.json` — universo de classes de ativo
      (crypto_spot, crypto_futures, stock_futures_synthetic,
      equities_real, etf, index, fx, custom_user_defined), todos com
      `security_posture` idêntico, byte-a-byte, a `manifest.pack.json`.
- [x] `ipad_runtime/configs/connector-registry.default.json` — 14
      entradas de conector, `global_invariants.execution_supported_must_always_be_false: true`
      sem exceção, `enabled_now: false` nas 14.
- [x] `ipad_runtime/configs/data-sources.readonly.json` (novo) — view
      derivada e gerada programaticamente do registro acima (zero
      transcrição manual), explicitamente rotulada como não-fonte-de-
      verdade (`derived_from`, `format_note`).
- [x] `ipad_runtime/configs/strategy-playbook.default.json` — espelha
      `docs/STRATEGY_PLAYBOOK.md`.
- [x] `ipad_runtime/src/research/connectors/` — 12 stubs de conector +
      `registry/index.js` agregador (13 arquivos `index.js`).
- [x] `ipad_runtime/src/research/engines/` — 13 motores de análise
      descritiva + `index.js` agregador (14 arquivos).

## Verificação técnica local (sem rede, sem browser real) — refeita nesta sessão

- [x] `node --input-type=module --check` em todos os 39 arquivos `.js`
      sob `ipad_runtime/` (runtime + workers + `src/research/**`) —
      sintaxe OK, zero falhas.
- [x] `python3 -m json.tool` (via `json.load`) em todos os 8
      configs/manifestos JSON relevantes
      (`asset-universe.default.json`, `asset-universe.schema.json`,
      `connector-registry.default.json`, `data-sources.readonly.json`,
      `strategy-playbook.default.json`, `manifest.models.json`,
      `manifest.pack.json`, `runtime_config.json`) — todos válidos.
- [x] CSS: chaves `{`/`}` balanceadas (140/140) em
      `css/ipad-runtime.css` (subiu de 136 com os novos seletores do
      Cyborg Readiness Panel).
- [x] `<section>` balanceado (13/13), `<div>` balanceado (63/63),
      `<button>` balanceado (19/19) em `index.html`.
- [x] Cross-check programático: todos os ids referenciados em `els{}` e
      em `getElementById()` direto de `js/app.js` existem em
      `index.html` — 0 ausentes (90 ids declarados, 53+15 referenciados).
- [x] Todos os 22 arquivos do precache do Service Worker existem em
      disco — checado um a um nesta sessão.
- [x] `CACHE_VERSION` incrementado `v3` → `v4` em `service-worker.js` —
      necessário porque `index.html`/`css/ipad-runtime.css`/`js/app.js`/
      `js/voice.js` mudaram de conteúdo nesta entrega e o Service Worker
      é cache-first puro (sem essa mudança de byte no próprio
      `service-worker.js`, clientes já instalados nunca detectariam a
      atualização — o navegador só re-verifica o SW por comparação byte
      a byte do próprio arquivo).
- [x] `tools/build_pack.py` re-executado: `AR10_CYBORG_LOCAL_PACK_V1.ar10pack`
      reempacotado para incluir o `manifest.models.json` corrigido (link
      de doc renomeado); `models_manifest` embutido confirmado
      byte-idêntico ao arquivo em disco após a regeneração.
- [x] `pack/checksums.sha256` regenerado — hashes de `wasm/` e
      `data/btcusdt_replay.json` confirmados **inalterados** (nenhum dos
      dois payloads binários mudou nesta missão).
- [x] `evidence_outbox/manifest.sha256.json` regenerado
      programaticamente (22 entradas, mesmo escopo de arquivos da
      entrega anterior) — hashes recalculados para os 5 arquivos que
      mudaram de conteúdo (`index.html`, `css/ipad-runtime.css`,
      `js/app.js`, `js/voice.js`, `pack/manifest.models.json`) mais o
      efeito em cascata sobre `service-worker.js` e `.ar10pack`.

## Segurança (12 leis) — confirmação cruzada nesta sessão

- [x] `execution_supported: false` confirmado nas 14 entradas de
      `connector-registry.default.json` (script de verificação, não
      leitura manual).
- [x] `grep -rn "localStorage"` em `js/` e `index.html` — zero
      ocorrências, base real de `NO_SECRET_IN_LOCALSTORAGE`.
- [x] `security_posture` confirmado byte-idêntico entre
      `manifest.pack.json` e `asset-universe.default.json`.
- [x] `capabilities_never` de `manifest.models.json` confirmado como a
      base verbatim de `NO_ORDER_BY_LLM` em `READ_ONLY_MARKET_SAFETY.md`.
- [x] Nenhuma nova rota de rede, campo de chave/segredo, ou função de
      ordem foi introduzida por nenhum arquivo criado ou editado nesta
      sessão — confirmado por leitura completa de cada diff antes do
      commit.

## Deploy / HTTPS

- [x] Branch `claude/eloquent-cannon-qyt86y` é a branch de trabalho ativa
      (confirmado via `git branch --show-current`).
- [x] PR #3 reconfirmado **aberto (draft)** via API nesta sessão.
- [x] Histórico de runs do workflow `Deploy iPad Runtime (GitHub Pages)`
      para esta branch consultado via API: a run mais recente antes
      desta entrega (`27853556843`, commit `02712a5`, `workflow_dispatch`)
      terminou **success** — confirma que o bloqueio de Pages relatado
      em entregas anteriores (`docs/GITHUB_PAGES_FIX.md`) já foi
      superado antes do início desta missão.
- [x] Verificação direta de `https://ar10-10.github.io/AR10-ORION/` via
      `curl`/WebFetch nesta sessão retornou `403` com
      `x-deny-reason: host_not_allowed` — confirmado que é a política de
      saída de rede deste sandbox de execução bloqueando o acesso, não
      uma resposta real do servidor (cabeçalho é do proxy local, não do
      GitHub Pages). Verificação real do status pós-push depende da run
      do workflow disparada pelo push desta sessão (ver próxima seção).
- [ ] Run do workflow disparada pelo push desta sessão — ver
      `main_files.md` / resposta final para o resultado.

## Não verificado nesta sessão (honestidade operacional)

- [ ] Teste manual no Safari real de iPad físico — ambiente de execução
      não tem iPad/Safari real disponível, nem ferramenta de
      browser/screenshot.
- [ ] Validação visual do Cyborg Readiness Panel em viewport real de
      iPad (grid 2/3 colunas) — risco cosmético assumido, não testado
      visualmente; estrutura de `grid-column` por id confirmada por
      leitura de CSS, não por renderização real.
- [ ] Teste de microfone físico real — `voice.js` inalterado nesta
      missão (não fazia parte do escopo de Fase B desta entrega);
      mesma limitação já registrada na entrega anterior permanece.
