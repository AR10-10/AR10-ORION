# Checklist de Evidência — AR10_CYBORG_2_IPAD_LANDSCAPE_VAULT_AUTOSAVE_EXPORT_AND_REAL_DATA_POLICY_FIX_V1

Continuação direta de
`AR10_CYBORG_2_IPAD_LOCAL_VAULT_SAFE_AUTOMATION_POLISH_V1` — mesmo branch
(`claude/eloquent-cannon-qyt86y`), mesmo PR (#3), sem reinício. Esta missão
(Mission 6) cobre: paisagem do iPad (bento), auto-reparo do Vault,
princípio de armazenamento automático, política de exportação com nome
único, telemetria legível e política de dados reais. Não é fase de live
trading; nenhuma capacidade de execução foi adicionada. Marcado apenas o
que foi de fato executado e verificado nesta sessão.

## Fase 1 — iPad paisagem (bento de colunas balanceadas)

- [x] Cards do painel agrupados em um wrapper `.bento` em `index.html`
      (entre o header e a Telemetria), sem reordenar o DOM.
- [x] CSS de paisagem reescrito: a grade explícita 2/3-colunas (que deixava
      uma coluna curta com "vazio preto" e a outra com pilha enorme) foi
      substituída por **multicoluna balanceada** (`column-count: 2` a
      partir de 900px, `3` a partir de 1280px), que equaliza a altura das
      colunas e preenche a tela larga sem zonas mortas.
- [x] `break-inside: avoid` (+ `-webkit-column-break-inside`) em todo
      `.bento > section.card` — nenhum card é cortado entre colunas.
- [x] Banner READ_ONLY/FAIL_CLOSED, header, Telemetria e rodapé ficam
      **fora** do fluxo de colunas (largura total) — o banner sticky
      continua funcionando exatamente como em retrato (não está dentro da
      multicoluna).
- [x] Retrato preservado: abaixo de 900px nada muda (coluna única, ordem
      natural, Siriform/orb primeiro).
- [x] Sem overflow horizontal: multicoluna quebra na vertical; `word-break`
      em nomes de arquivo exportado; valores de status `nowrap` curtos.
      Chaves CSS balanceadas (147/147).

## Fase 2 — Auto-reparo do Vault

- [x] `pack-manager.rebuildIndexFromStorage()` (novo): valida os arquivos já
      gravados (OPFS/IndexedDB) contra os checksums do meta salvo e restaura
      `READY` sem reinstalar quando os bytes continuam íntegros — resolve o
      caso "corrompido/ausente após girar a tela ou reabrir".
- [x] `pack-manager.autoRepairVault()` (novo) na ordem pedida: (1)
      re-verifica → (2) reindexa do armazenamento se os arquivos existem →
      (3) re-checa SHA256 → (4) restaura `READY` se válido → (5) se
      faltam/diferem, reinstala com segurança a partir do pacote do app
      (mesma origem, já em cache do SW — funciona offline), sempre
      `FAIL_CLOSED` se o checksum do pacote falhar → (6) Limpar/Reinstalar
      continua sendo o último recurso **manual, com confirmação**.
- [x] Auto-reparo nunca apaga dados como primeiro recurso (confirmado por
      leitura: só `installToSafariStorage()`, que grava o novo validado
      antes de remover obsoleto, e aborta sem tocar nada se checksum falhar).
- [x] `handleRepairInstall()` reescrito para usar `autoRepairVault()` —
      tenta a recuperação barata (reindex) antes de rebaixar; mensagens
      claras de qual caminho recuperou.
- [x] Boot dispara auto-reparo **automático** só quando havia instalação
      anterior (existe meta com checksums) e o estado agora não é `READY` —
      numa primeira visita não auto-instala nada.
- [x] "Reparar instalação" permanece como ação primária clara quando o
      auto-reparo não conclui.

## Fase 3 — Armazenamento local automático

- [x] Fluxos internos (preparar/atualizar/reparar/auto-reparo) passaram a
      usar `pack-manager.fetchLocalPack()` (carrega em memória, **sem**
      disparar download para o app Arquivos). Antes, cada um desses fluxos
      chamava `downloadLocalPack()` e despejava o mesmo arquivo no app
      Arquivos a cada toque — provável origem do prompt de "substituir"
      relatado. Agora o armazenamento interno é 100% automático.
- [x] Texto do princípio mantido no painel Vault Local e repetido no painel
      Arquivos Exportados (o usuário não procura pasta raiz).

## Fase 4 — Exportação com nome único + EXPORT_MANIFEST + painel

- [x] `js/export-manifest.js` (novo): `uniqueName(type,version,ext)` produz
      `AR10_CYBORG_[TYPE]_[VERSION]_[YYYYMMDD_HHMMSS].[ext]`;
      `downloadArtifact()` dispara o download nativo com esse nome e
      registra o evento.
- [x] "Baixar Pacote Local" agora usa nome único carimbado (antes era o
      nome genérico fixo `AR10_CYBORG_LOCAL_PACK_V1.ar10pack` → colisão).
- [x] Painel "Arquivos Exportados" (`#export-panel`): lista pacote local,
      relatório, evidência e deckap com tag BAIXÁVEL/SOB DEMANDA/INTERNO/
      FUTURO; exportações da sessão aparecem no topo com o nome real usado.
- [x] Botões "Exportar Relatório (.md)" e "Exportar Evidência (.json)" geram
      artefatos reais a partir do estado da sessão, com nome único.
- [x] `evidence_outbox/EXPORT_MANIFEST.json` (novo): tipo, filename/padrão,
      versão, generated_for, purpose, sha256 (quando disponível), caminho
      interno e padrão de export visível.
- [x] Nenhum export contém segredo/chave/credencial/dado de conta — o
      relatório e a evidência só carregam feature-detect, estado do Vault,
      estimativa de storage e a política de dados (confirmado por leitura).

## Fase 5 — Telemetria (logs legíveis, não muro de terminal)

- [x] "Logs do Sistema" → **"Telemetria ao Vivo"** (sub-rótulo "Caixa Preta
      do Cyborg — eventos reais").
- [x] Linha de "último evento" sempre visível no topo do card
      (`#telemetry-latest`), atualizada a cada `log()`; a caixa preta
      completa continua rolável dentro do card (altura reduzida para 200px).
- [x] Nenhum evento falso: `telemetry-latest` espelha exatamente a última
      linha real de `log()`.

## Fase 6 — Política de dados reais

- [x] Replay e AnalysisFrame rotulados na UI com o texto verbatim "Teste
      técnico offline — dados sintéticos, não usar para decisão de mercado."
      (`.diagnostic-note`).
- [x] Painel "Política de Dados de Mercado" (`#data-policy-panel`):
      diagnóstico = sintético/offline; modo de dados reais e análise real =
      `DADOS INSUFICIENTES` (honesto — nenhum conector ao vivo habilitado);
      dados públicos read-only = PERMITIDO; dados privados / conta privada /
      execução = BLOQUEADO / DISABLED_BY_POLICY.
- [x] `js/data-policy.js` (runtime) + `configs/market-data-policy.json`
      (declarativo) com conteúdo idêntico: PUBLIC_DATA_ALLOWED,
      READ_ONLY_CONNECTORS_ALLOWED, lista de fontes públicas permitidas,
      bloqueios e `status_when_unavailable: 'DADOS INSUFICIENTES'`.
- [x] `realMarketAnalysisStatus()` retorna honestamente
      `DADOS INSUFICIENTES` porque nenhum conector real está habilitado
      (NO_FAKE_DATA — nenhum número de mercado inventado).
- [x] `docs/REAL_DATA_POLICY.md` (novo) documenta os dois modos e o
      permitido/bloqueado.

## Segurança (14 leis) — confirmação cruzada nesta sessão

- [x] 14ª lei `LOCAL_FIRST` adicionada a `docs/READ_ONLY_MARKET_SAFETY.md`
      (bloco verbatim + linha de tabela com aplicação real) e propagada:
      contagem "13 leis" → "14 leis" em `READ_ONLY_MARKET_SAFETY.md`,
      `PROMPT_CACHING_AND_AGENT_CONTEXT_STRATEGY.md` (+ bloco de leis),
      `DATA_SOURCE_MATRIX.md`, `IPAD_PWA_VISUAL_POLISH_HANDOFF.md`. Grep
      confirma zero "13 leis" restante em `docs/`.
- [x] `grep -rn "localStorage"` em `js/`, `index.html`, `service-worker.js`
      — zero ocorrências (base real de `NO_SECRET_IN_LOCALSTORAGE`).
- [x] `grep` por `order_send|placeOrder|sendOrder|api_secret|private_key`
      nos arquivos novos/editados — zero ocorrências.
- [x] `grep` por `fetch(|XMLHttpRequest|WebSocket(` nos dois módulos novos
      (`export-manifest.js`, `data-policy.js`) — zero (são puros, sem rede).
- [x] Execução permanece `DISABLED_BY_POLICY` (manifestos inalterados;
      painel de política mostra explicitamente).

## Verificação técnica local (sem rede, sem browser real)

- [x] `node --input-type=module --check` em todos os `.js` sob
      `ipad_runtime/` — OK, incluindo `export-manifest.js`, `data-policy.js`,
      `app.js`, `pack-manager.js`, `service-worker.js`.
- [x] `json.load` em todos os JSON sob `ipad_runtime/` — válidos, incluindo
      `configs/market-data-policy.json`.
- [x] CSS chaves balanceadas (147/147); HTML balanceado (16 `<section>`,
      92 `<div>` incluindo `.bento`, 24 `<button>`).
- [x] Cross-check de ids: 73 ids em `els{}` + 20 `getElementById` diretos —
      todos existem em `index.html` (0 ausentes), incluindo
      `telemetry-latest`, `dp-realmode`, `dp-analysis`, `export-list`,
      `btn-export-report`, `btn-export-evidence`.
- [x] 24 entradas do precache do Service Worker existem em disco (inclui os
      2 módulos novos); `CACHE_VERSION` `v5` → `v6`.
- [x] Exatamente 5 classes de status (`v-ok`/`v-fail`/`v-limited`/
      `v-pending`/`v-info`) — nenhuma 6ª classe.
- [x] `tools/build_pack.py` re-executado: payload do `.ar10pack` byte-
      idêntico (wasm/dataset/manifestos inalterados nesta missão) — o
      `.ar10pack` e `pack/checksums.sha256` não aparecem no `git status`.
- [x] `evidence_outbox/manifest.sha256.json` regenerado (24 entradas, +2
      módulos novos); `EXPORT_MANIFEST.json` criado.

## Não verificado nesta sessão (honestidade operacional)

- [ ] Teste em Safari real de iPad físico (paisagem e retrato) — ambiente
      sem iPad/Safari/screenshot. O bento de multicoluna foi validado por
      leitura de CSS e balanceamento de regras, não por renderização real.
- [ ] Comportamento real de `position: sticky` do banner com o layout em
      multicoluna do `.bento` — o banner foi mantido FORA da multicoluna
      justamente para evitar esse risco, mas não foi confirmado em
      dispositivo real.
- [ ] Prompt de "substituir" do Safari ao exportar — a correção (nomes
      únicos + fluxos internos sem download) foi confirmada por leitura de
      código, não por teste no app Arquivos real.
