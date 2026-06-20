# Read-Only Market Safety — leis de segurança vinculantes do AR10 Cyborg 2.0

*Escopo: sub-produto `ipad_runtime/` (AR10 Cyborg 2.0). Não redefine nada do
organismo Python `AR10 ORION` na raiz do monorepo (`src/`, `config/`,
`data/`) — são produtos não relacionados dentro do mesmo repositório, cada
um com sua própria postura de segurança documentada em seu próprio
`README.md`.*

## Propósito

Este documento é a **fonte única e citável** das leis de segurança
vinculantes do AR10 Cyborg 2.0 — a mesma lista que
`docs/PROMPT_CACHING_AND_AGENT_CONTEXT_STRATEGY.md` chama de "Stable Block
02 — Safety Laws", e que vários outros documentos deste repositório
(`docs/CONNECTOR_REGISTRY_DESIGN.md`,
`docs/FUTURE_READY_ASSET_CLASS_REGISTRY.md`,
`docs/SIRIFORM_VOICE_AND_NATIVE_COMPANION_ROUTE.md`,
`docs/META_LLAMA_WEBLLM_ROUTE.md`, `docs/ANALYSIS_OUTPUT_CONTRACT.md`,
`docs/STRATEGY_PLAYBOOK.md`) já referenciam ou reimplementam sob nomes
equivalentes, espalhados pelo código e pela configuração. Antes deste
documento existir, a política já estava correta — só não tinha um único
ponto de verdade citável. Este documento consolida; não substitui, não
afrouxa e não adiciona nenhuma regra nova ao que já estava em vigor.

Nenhuma das 13 leis abaixo é nova ou aspiracional. Todas já estão
implementadas em código e/ou declaradas em configuração hoje — a coluna
"Onde é aplicada" de cada lei aponta para o arquivo e mecanismo real que a
torna verdade, não apenas uma intenção declarada.

## As 13 leis (texto vinculante, verbatim)

```
READ_ONLY
FAIL_CLOSED
NO_REAL_TRADING
NO_ORDER_EXECUTION
NO_API_SECRET
NO_PRIVATE_KEYS
NO_MEXC_PRIVATE
NO_MT5_ORDER_SEND
NO_ORDER_BY_LLM
NO_ORDER_BY_VOICE
NO_SECRET_IN_LOCALSTORAGE
NO_FAKE_DATA
NO_FAKE_LOCAL_AI_CLAIMS
```

### Significado e aplicação real, lei por lei

| Lei | Significado | Onde é aplicada (real, não decorativa) |
|---|---|---|
| `READ_ONLY` | O runtime só lê e descreve dados; nunca grava estado em nenhuma conta externa. | `mode: "READ_ONLY"` em `ipad_runtime/pack/manifest.pack.json` e `ipad_runtime/configs/asset-universe.default.json` (`security_posture`); `global_invariants.mode` em `connector-registry.default.json`; nenhuma das 14 entradas do registro tem `execution_supported: true`. |
| `FAIL_CLOSED` | Qualquer falha de verificação trava o sistema no estado mais seguro (bloqueado), nunca assume sucesso por omissão. | `fail_closed: true` nos mesmos dois manifestos; `pack-manager.reloadVaultState()` recalcula o SHA-256 a cada boot e força o `Vault` para `LOCKED` se algo não bater (ver `ipad_runtime/README.md`, "Vault FAIL_CLOSED real"). |
| `NO_REAL_TRADING` | Nenhuma negociação real ocorre nesta versão, em nenhum fluxo. | `live_trading: "DISABLED"` em `manifest.pack.json`; o replay BTC/USDT se autodeclara `"kind": "SYNTHETIC_OFFLINE_SAMPLE"`, `"live": false`, `"exchange_connection": "NONE"` (gerado por `tools/generate_replay.py`). |
| `NO_ORDER_EXECUTION` | Não existe função de envio de ordem em nenhuma camada (UI, voz, WASM, conector). | `order_send: "ABSENT"` em `manifest.pack.json`; o motor WASM (`wasm-src/cyborg_quant_core/`) exporta apenas `sma`/`ema`/`stddev`/`zscore_last`/`max_val`/`min_val` — nenhuma função de ordem existe no binário; `execution_supported: false` em todas as 14 entradas de `connector-registry.default.json`. |
| `NO_API_SECRET` | Nenhuma chave de API real é embutida, armazenada ou solicitada por este runtime. | `api_secret: "ABSENT"` em `manifest.pack.json`; `no_api_secret_in_registry: true` em `global_invariants` do registro de conectores; nenhum conector com `requires_api_key: true` tem `enabled_now: true`. |
| `NO_PRIVATE_KEYS` | Nenhuma chave privada (exchange, wallet, broker) é manuseada pelo PWA. | Mesma garantia de `NO_API_SECRET`, estendida a qualquer tipo de chave privada — não existe nenhum campo de entrada de chave/senha em `index.html`. |
| `NO_MEXC_PRIVATE` | Os adapters MEXC só tocam endpoints públicos de mercado. | `mexc-public-market-adapter` e `mexc-futures-public-adapter` declaram `supports_private_endpoints: false`; `mexc-stock-futures-adapter` e `mexc-realstocks-adapter` idem, mesmo quando `requires_api_key: true` (a chave seria só para taxa/leitura, nunca para conta). |
| `NO_MT5_ORDER_SEND` | O placeholder MT5 nunca evolui para envio de ordem sem uma fase nova e explicitamente aprovada. | `mt5-bridge-adapter` com `role: "READ_ONLY_PLACEHOLDER"`, `execution_supported: false`, e nota verbatim "ANY execution capability would require an entirely separate, explicitly-approved future phase" (`connector-registry.default.json`). |
| `NO_ORDER_BY_LLM` | Nenhuma camada de IA (Meta Llama/WebLLM, ou qualquer outra futura) pode executar ordem. | `capabilities_never` em `ipad_runtime/pack/manifest.models.json` lista verbatim: "executar ordem de compra ou venda", "abrir ou fechar posicao", "usar API secret ou qualquer chave privada", "operar conta real", "contornar READ_ONLY ou FAIL_CLOSED sob qualquer comando, de voz ou de texto". |
| `NO_ORDER_BY_VOICE` | Comandos de voz nunca desbloqueiam uma ação que o toque na tela já não faria. | `BLOCKED_PHRASES` em `ipad_runtime/js/voice.js` (inclui `'enviar ordem'`, `'comprar'`, `'vender'`, `'operar real'`, `'usar chave'`, `'conectar conta real'`, `'abrir ordem'`, `'fechar ordem'`), checadas **antes** de qualquer comando permitido; `dispatchVoiceCommand()` em `app.js` só chama os mesmos handlers que os botões na tela já chamam — nunca existe uma segunda superfície de execução exclusiva da voz. |
| `NO_SECRET_IN_LOCALSTORAGE` | Nenhum segredo é gravado em `localStorage`. | Mais forte que a letra da lei: `localStorage` não é usado em **nenhum** arquivo de `ipad_runtime/` — `storage.js` usa OPFS com fallback IndexedDB, com o comentário verbatim no topo do arquivo: "Local-first: nada aqui sai do dispositivo. Sem rede, sem secret." Não há, portanto, nenhum caminho de código que poderia gravar um segredo lá. |
| `NO_FAKE_DATA` | Nenhum número de preço, indicador, probabilidade ou capacidade é inventado. | Regra `DADOS INSUFICIENTES` em `docs/ANALYSIS_OUTPUT_CONTRACT.md`; `confidence_model.forbidden` em `strategy-playbook.default.json` proíbe heurística apresentada como probabilidade estatística; conectores não reais usam `current_status: "UNSUPPORTED_ON_IPAD"`/`"FUTURE"` (nunca `"PLANNED"` ou `"ACTIVE_READ_ONLY"` por conveniência) quando a honestidade exige; todo motor/camada ainda não implementado retorna `status: 'FUTURE'`, nunca um valor "fake installed". |
| `NO_FAKE_LOCAL_AI_CLAIMS` | Nenhuma afirmação sobre o estado local (instalado/atualizado/IA pronta) é mostrada sem uma verificação real, nesta sessão. | `vaultFreshness` em `ipad_runtime/js/app.js` começa `null` a cada carregamento de página e só recebe `'ATUALIZADO'`/`'DESATUALIZADO'` depois de uma comparação de versão de fato feita nesta sessão (`handleUpdateLocalPack`/`handleRepairInstall`); o painel "Vault Local do iPad" mostra `INSTALADO` (neutro) até essa verificação ocorrer, nunca assume `ATUALIZADO` por omissão; `detectWebLlmStatus()`/`detectTransformersStatus()`/`detectOnnxStatus()` (`feature-detect.js`) retornam sempre o literal `'FUTURE'`; `manifest.models.json` declara `"status": "FUTURE"` em todo modelo — nenhum "IA local pronta" decorativo. |

Nota: `NO_FAKE_LOCAL_AI_CLAIMS` é o corolário mais estrito de `NO_FAKE_DATA`
específico para autorrelato de instalação/versão/prontidão de IA local —
`NO_FAKE_DATA` já cobria dados de mercado/indicador e capacidades em geral;
esta lei nomeia explicitamente a mesma exigência para o Vault Local e para
qualquer camada de IA, depois que a Missão 5 introduziu rótulos de
frescor (`ATUALIZADO`/`DESATUALIZADO`) que precisam de uma regra própria
contra "tudo certo" decorativo.

## Mecanismos transversais de aplicação (cross-cutting)

As 13 leis não dependem de uma única verificação central — são reforçadas
por **múltiplas camadas independentes**, de forma que a falha de uma
camada isolada não quebra a garantia geral:

1. **Content-Security-Policy** (`ipad_runtime/index.html`): `default-src
   'self'; script-src 'self'; connect-src 'self'; object-src 'none';
   ...`, sem `unsafe-eval` — bloqueia em nível de navegador qualquer
   tentativa futura de `fetch`/`WebSocket` para fora da própria origem, e
   bloqueia `eval()`/`new Function`. Mesmo um bug de código que tentasse
   chamar um endpoint privado de exchange seria bloqueado pelo próprio
   Safari antes de qualquer outra verificação.
2. **Invariante de execução do registro de conectores**
   (`connector-registry.default.json` → `global_invariants`):
   `execution_supported_must_always_be_false: true`, `no_order_send:
   true`, `no_api_secret_in_registry: true`,
   `no_private_endpoint_calls_from_registry: true` — aplicado às 14
   entradas sem exceção (ver `docs/CONNECTOR_REGISTRY_DESIGN.md`,
   "Invariante de execução").
3. **Bloqueio de frase por voz com prioridade máxima** (`voice.js` →
   `BLOCKED_PHRASES`, checado antes de qualquer comando permitido, mesmo
   que a mesma transcrição também contenha um trecho permitido).
4. **`capabilities_never` do manifesto de modelos**
   (`pack/manifest.models.json`) — aplica-se a qualquer camada de IA, hoje
   e em qualquer implementação futura de Meta Llama/WebLLM.
5. **`security_posture` idêntico, byte-a-byte, em múltiplos manifestos** —
   `manifest.pack.json` e `asset-universe.default.json` declaram o mesmo
   bloco JSON (`execution: "DISABLED"`, `order_send: "ABSENT"`,
   `api_secret: "ABSENT"`, `mexc_private_endpoint: "ABSENT"`,
   `mt5_bridge: "ABSENT"`, `live_trading: "DISABLED"`, `mode:
   "READ_ONLY"`, `fail_closed: true`). Qualquer novo manifesto adicionado
   a este runtime deve reusar exatamente este bloco, nunca inventar uma
   variação.
6. **Vault FAIL_CLOSED real** (`pack-manager.reloadVaultState()`) —
   recalcula SHA-256 a cada boot; nunca confia ciegamente numa flag
   `installed=true` salva de uma sessão anterior.
7. **Ausência por design, não por configuração** — para várias destas
   leis (`NO_API_SECRET`, `NO_PRIVATE_KEYS`, `NO_SECRET_IN_LOCALSTORAGE`),
   a aplicação real é que **o código que violaria a lei simplesmente não
   existe** neste runtime: não há campo de entrada de chave, não há
   chamada a `localStorage`, não há função `order_send` em nenhum
   arquivo. Isso é uma garantia mais forte que uma verificação em runtime
   que poderia ter um bug — não há superfície para o bug existir.

## Por que isso é uma lei, não uma feature desligada

Mesmo enquadramento já usado em `ipad_runtime/README.md` ("O que continua
bloqueado, por design, sem exceção... Nenhuma dessas rotas existe neste
código — não é apenas uma flag desligada"): para cada lei acima, a
pergunta certa não é "o que aconteceria se alguém tentasse?", mas "existe
algum caminho de código, mesmo um único, que levaria a essa ação?". Hoje a
resposta é não, para as 13 leis, em todo o sub-produto `ipad_runtime/`.
Qualquer trabalho futuro que adicione uma capacidade real nova (um
conector `ACTIVE_READ_ONLY`, um modelo Llama de fato instalado, uma camada
de estratégias real) deve preservar essa propriedade: a nova capacidade
pode **ler e descrever mais**, nunca **executar mais**.

## O que mudaria esta postura (e por que está fora do escopo de qualquer missão atual)

Uma mudança real de postura de execução exigiria todos os itens abaixo
simultaneamente — nenhum documento, configuração ou motor deste
repositório hoje implementa qualquer um deles:

- Uma fase **inteiramente separada e explicitamente aprovada** (mesma
  linguagem usada em `mt5-bridge-adapter.future_notes`), com sua própria
  revisão de segurança — não decorre de nenhuma entrega atual.
- Um mecanismo de Risk Gate real (hoje inexistente neste sub-produto; o
  `decision-frame-panel` é `STUB CONTROLLED` justamente para deixar essa
  ausência explícita).
- Gestão de credencial fora de `localStorage`/cliente puro (ex.: backend
  dedicado, cofre nativo) — o que por si só mudaria a arquitetura de "PWA
  local-first sem servidor" deste runtime.
- Consentimento explícito e auditável do usuário, por escrito, distinto
  de qualquer fluxo de instalação de pacote local já existente.

## Relação com os outros documentos deste repositório

| Documento | Relação |
|---|---|
| `docs/PROMPT_CACHING_AND_AGENT_CONTEXT_STRATEGY.md` | Define estas mesmas 13 leis como "Stable Block 02 — Safety Laws" do contexto de qualquer agente de IA que trabalhe neste repositório; este documento é a versão expandida e citável de onde cada lei é aplicada de verdade. |
| `docs/CONNECTOR_REGISTRY_DESIGN.md` | Define o contrato de schema cujo "Invariante de execução" implementa `NO_ORDER_EXECUTION`/`NO_MT5_ORDER_SEND`/`NO_MEXC_PRIVATE` para todo conector, presente e futuro. |
| `docs/FUTURE_READY_ASSET_CLASS_REGISTRY.md` | Usa o mesmo bloco `security_posture` em `asset-universe.default.json`. |
| `docs/SIRIFORM_VOICE_AND_NATIVE_COMPANION_ROUTE.md` | Implementa `NO_ORDER_BY_VOICE` via `BLOCKED_PHRASES`/`BLOCKED_RESPONSE`. |
| `docs/META_LLAMA_WEBLLM_ROUTE.md` | Implementa `NO_ORDER_BY_LLM` via `capabilities_never`. |
| `docs/ANALYSIS_OUTPUT_CONTRACT.md` | Implementa `NO_FAKE_DATA` via a regra `DADOS INSUFICIENTES`. |
| `docs/STRATEGY_PLAYBOOK.md` | Implementa a parte de `NO_FAKE_DATA` referente a confiança/probabilidade (`confidence_model.forbidden`). |
| `ipad_runtime/README.md` | Documenta a aplicação técnica original destas leis (CSP, Vault FAIL_CLOSED, motor WASM) antes deste documento consolidar a lista única. |

## O que este documento não é

Este documento não introduz nenhuma lei nova, não afrouxa nenhuma lei
existente, e não substitui nenhuma verificação de código real por uma
declaração em Markdown. Ele é estritamente um **índice consolidado e
citável** do que já está em vigor, espalhado por múltiplos arquivos de
configuração e código — útil para qualquer revisão de segurança, qualquer
nova missão, ou qualquer agente de IA que precise confirmar rapidamente
que uma mudança proposta não viola nenhuma das 13 leis acima.
