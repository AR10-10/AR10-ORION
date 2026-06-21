# AR10 Cyborg 1.0 PRO — iPad One-Tap Cloud Runtime

*Codinome interno: `AR10_CYBORG_2_IPAD_ONE_TAP_CLOUD_RUNTIME_V1` · sub-produto iPad/PWA
dentro do monorepo `AR10-ORION` (ver `../README.md` para a visão geral do
organismo AR10 ORION V5.0).*

PWA iPad-first do AR10 Cyborg 1.0 PRO. Abre direto no Safari do iPad via HTTPS,
sem depender de Mac Mini, MacBook, servidor local, terminal ou ZIP como
fluxo principal. **READ_ONLY / FAIL_CLOSED sempre. Sem execução real, sem
API secret, sem ordem, sem live trading.**

## Como abrir no iPad

1. Abra a URL HTTPS publicada (ver `DEPLOY.md` ou o link entregue) no Safari.
2. Toque em **Verificar Safari** para ver o relatório de capacidades.
3. Toque em **Baixar Pacote Local** (ou **Importar Pacote do Arquivos** se já
   tiver um `.ar10pack` salvo) e depois em **Verificar SHA256**.
4. Toque em **Instalar no Safari Storage**. O *Vault* muda para `READY`.
5. Toque em **Rodar Diagnóstico Offline** e **Rodar Replay BTC/USDT** para
   validar tudo localmente.
6. Toque em **Adicionar à Tela de Início** e siga as instruções do Safari
   (Compartilhar → Adicionar à Tela de Início). A partir daí o app abre em
   modo standalone e continua funcionando offline.

## Arquitetura

```
ipad_runtime/
├── index.html              tela unica: Safari Local Runtime / Instalacao Local
├── manifest.webmanifest    metadados PWA (icones, display standalone)
├── service-worker.js       cache-first, offline-first, mesma origem apenas
├── css/ipad-runtime.css    tema "Ciborgue" + safe-area (env(safe-area-inset-*))
├── js/
│   ├── app.js               orquestrador da tela e dos botoes
│   ├── siriform.js          maquina de estados do Siriform Avatar (so visual/UI)
│   ├── feature-detect.js    sondas funcionais (nao so "typeof") de cada API
│   ├── crypto-utils.js      SHA-256 via Web Crypto, base64, checksum agregado
│   ├── storage.js           OPFS com fallback automatico para IndexedDB
│   ├── pack-manager.js       download/import/verify/install/clear do .ar10pack
│   ├── replay-engine.js      replay BTC/USDT (canvas) usando o worker
│   ├── diagnostics.js       diagnostico 100% offline
│   └── worker-client.js     RPC promise<->postMessage com o Web Worker
├── workers/quant-worker.js  carrega o WASM e roda os indicadores fora da UI thread
├── wasm/cyborg_quant_core.wasm   motor real, compilado de Rust (ver wasm-src/)
├── wasm-src/cyborg_quant_core/   fonte Rust do motor (cdylib, wasm32-unknown-unknown)
├── data/btcusdt_replay.json      dataset SINTETICO offline (ver aviso abaixo)
├── pack/                    fontes legiveis do pacote (manifests + checksums.sha256)
├── icons/                   icones PWA/Apple touch gerados localmente (Pillow)
├── tools/                   scripts de build (replay, icones, .ar10pack)
└── AR10_CYBORG_LOCAL_PACK_V1.ar10pack   pacote final, gerado por tools/build_pack.py
```

## Nebula Core / Siriform Avatar (painel premium)

O painel principal (`index.html`) é organizado em volta de um **Siriform
Avatar** — orbe central CSS-only (sem canvas, sem imagem, sem dependência
externa) controlado por `js/siriform.js`. É puramente informativo: nenhum
estado do avatar dispara rede, ordem ou execução, apenas reflete o que o
runtime local está fazendo.

Estados possíveis (`data-state` no `#siriform-avatar`):

| Estado       | Quando aparece                                              |
|--------------|--------------------------------------------------------------|
| `idle`       | Em repouso, aguardando toque.                                 |
| `listening`  | Toque recebido (abrir importação, abrir modal Home Screen).    |
| `thinking`   | Operação local em andamento (boot, download, importação).     |
| `analyzing`  | Verificação SHA256, diagnóstico offline, replay BTC/USDT.      |
| `responding` | Resultado pronto, com legenda contextual.                      |
| `installing` | Gravando o pacote local no Safari Storage (OPFS/IndexedDB).    |
| `read_only`  | Estado de repouso "de lei" — sempre mostrado após 3.6s parado. |
| `fail_closed`| Falha de segurança real (checksum divergente, instalação bloqueada). |

Cards do painel (todos dentro da mesma página, sem rota nova). Em iPad
paisagem (≥900px) os cards fluem num **bento de colunas balanceadas**
(`.bento` em multicoluna) que preenche a tela larga sem zonas pretas
vazias; o banner READ_ONLY/FAIL_CLOSED, o header, a Telemetria e o rodapé
ficam fora do fluxo de colunas (largura total). Em retrato, coluna única na
ordem natural:
`siriform-card` → `cyborg-executive-panel` (**Resumo Executivo**, FOCO3 da
fase de polimento visual — leitura "tudo pronto?" em 1 olhar: Estado do
Cyborg, fonte real ativa ou `DADOS_INSUFICIENTES`, timestamp de freshness,
Paper Trading, Risk Gate, Live Trading sempre `LIVE_LOCKED`, Vault/Evidence
e último relatório, com os mesmos 4 botões de ação do topbar — Preparar/
Atualizar, Analisar Sistema, Relatório, Modo Avançado — espelhados aqui) →
`cyborg-readiness-panel` (checklist técnico detalhado de capacidades do
Safari/iPadOS) → `commander-soldier-panel` (Commander = este iPad, sempre `ONLINE`;
Soldier headless 24/7 ainda `NOT_DEPLOYED` — só existe como contrato de
tipos em `soldier_runtime/`, nunca instalado nem executado) →
`safari-edge-layer-panel` (Safari Assisted Edge Layer — telemetria local
real de sessão/render deste iPad/Safari: latência, frames perdidos, foco
de tela, estado de conexão/armazenamento; nunca decide trade, nunca
substitui o Soldier, `is_authoritative` sempre `FALSE`) →
`voice-status-panel` (estado do microfone/Siriform Voice Layer) →
`runtime-status-panel` → `feature-detect-panel` →
`quant-engine-widget` → `ai-models-panel` (WebLLM/Transformers/ONNX,
`FUTURE`) → `replay-wrap` (com `profile-toggle` Light/Balanced/Heavy,
genuinamente muda a janela SMA/EMA usada no WASM; rotulado **Modo de
Diagnóstico Técnico — dados sintéticos, não usar para decisão de mercado**)
→ `analysis-frame-panel` (estatística descritiva sobre o dataset sintético,
"não é recomendação") → `real-data-layer-panel` (conectores públicos reais
sem chave de API — MEXC/CoinGecko/Binance Spot + import local de CSV/JSON;
cada sonda é um Connector State Machine real, ver
`docs/AR10_CYBORG_2_REAL_DATA_LAYER_RUNTIME_PROBE_V1.md`) →
`source-health-panel` (funde o roteiro estático de conectores com o estado
vivo desta sessão — nunca promove um conector a `ACTIVE_READ_ONLY` por
conta própria) → `real-analysis-frame-panel` (leitura sobre candle real —
"não é recomendação") → `real-evidence-panel` (Evidence Object —
evidence-first, nunca inventado: ou dado real ou
`DADOS_INSUFICIENTES`/`NAO_APLICAVEL`) → `research-engine-panel` (ROTA
A/B/C sempre presentes, nunca um caminho silenciosamente vazio) →
`siriform-explanation-panel` (explica em português o que os Dados Reais
acima significam) → `memory-alive-panel` (Memória Viva — Event Log
persistido, snapshot a cada boot, Last Good State e Recovery/Hydration
Reports honestos sobre o que foi de fato restaurado) → `data-policy-panel`
(Política de Dados de Mercado — sintético = diagnóstico; análise real exige
fonte pública/somente-leitura ou mostra `DADOS INSUFICIENTES`) →
`evaluations-panel` (equivalente local do framework Apple de Evaluations,
WWDC26) → `local-intelligence-panel` (**AR10 Local Intelligence Engine** —
SetupScore/MemoryMatch/ReflectionReport calculados localmente, sem API
paga, gravados no Evidence Ledger; nunca um sinal, nunca uma ordem) →
`decision-frame-panel` (**`STUB CONTROLLED`**, sem lógica de
decisão, sem sinal de ordem) → `risk-gate-panel` (Kill Switch +
`NO_STOP_NO_TRADE` — bloqueia qualquer ordem, mesmo Paper, sem stop loss,
com drawdown acima do limite ou fonte de dados abaixo da qualidade mínima)
→ `paper-trading-panel` (book de posições simuladas com preço real da
fonte ativa, roteado pelo Risk Gate, nunca envia ordem a uma exchange) →
`live-status-panel` (explica por que Live Trading é `LIVE_LOCKED` por
estrutura — sem rota de execução real no código, não uma flag) →
`telegram-aux-panel` (Telegram AUX/Quarantine — política declarada desta
fase: token `NOT_CONFIGURED`, webhook `DISABLED`, execução `FORBIDDEN`,
sem rede/bot real; espelha `soldier_runtime/telegram-aux/types.ts`) →
`vault-evidence-panel` (Vault/Evidence — reabre e re-verifica o SHA-256 a
cada boot) → `vault-local-panel` (Vault Local do iPad — 16 campos de
status; com auto-reparo seguro: reindexa do armazenamento ou reinstala,
nunca apaga como primeiro recurso) → `metrics-panel` (equivalente leve do
Instruments, WWDC26) → `local-pack-manager` (os 13 botões do Local Pack
Manager) → `export-panel` (Arquivos Exportados — exportações com nome único
carimbado, sem prompt de "substituir") → `backup-recovery-panel` (exporta/
restaura a Memória Viva inteira num único `.json` com hash verificado,
`FAIL_CLOSED` se corrompido ou adulterado). A antiga "Logs do Sistema"
virou `telemetry-card` (**Telemetria ao Vivo** — último evento sempre
visível + caixa preta rolável, eventos reais, nunca um muro de terminal —
com sub-bloco **Activity Log** listando o histórico persistido de
`memory/event-log.js`). Todo card com `tabindex` é tocável: abre um resumo
em português gerado a partir do estado real do próprio card
(`wireStatusCardModal()` em `app.js`), nunca um texto estático.

## Decisões técnicas (liberdade técnica usada nesta entrega)

### Por que `.ar10pack` é JSON e não ZIP

Um ZIP real exigiria um descompressor (DEFLATE) em JavaScript — ou uma lib de
terceiros (violaria "sem CDN para núcleo sensível") ou um inflate escrito à
mão sob pressão de tempo (superfície de bug maior que o benefício). O
`.ar10pack` é um **container JSON UTF-8** com:

```json
{
  "format": "AR10PACK_JSON_V1",
  "manifest": { ... manifest.pack.json ... },
  "models_manifest": { ... manifest.models.json ... },
  "runtime_config": { ... },
  "checksums": { "<path>": "<sha256 hex>", "_package": "<sha256 agregado>" },
  "files": { "<path>": "<base64>", ... }
}
```

Vantagens: parsing nativo (`JSON.parse`), zero dependência externa, zero
`eval()`, auditável a olho nu, e ainda assim verificável por linha de
comando com `sha256sum -c pack/checksums.sha256` (ver abaixo). Não é um
executável Windows — é um pacote de instalação local inerte para o
Local Pack Manager do PWA.

### Por que Rust → WASM (e não C/AssemblyScript)

`wasm-src/cyborg_quant_core/` é um crate Rust real (`cdylib`,
`wasm32-unknown-unknown`, `panic=abort`, `opt-level=z`, `lto=true`),
compilado neste ambiente (`rustup target add wasm32-unknown-unknown`) e
testado via Node antes de entrar no pacote. Resultado: **3.6&nbsp;KB**.
Exporta só estatística descritiva (`sma`, `ema`, `stddev`, `zscore_last`,
`max_val`, `min_val`) sobre um buffer compartilhado — nenhuma função de
ordem, sinal de execução ou rede existe no binário. Para recompilar:

```bash
cd wasm-src/cyborg_quant_core
cargo build --release --target wasm32-unknown-unknown
cp target/wasm32-unknown-unknown/release/cyborg_quant_core.wasm ../../wasm/
cd ../.. && python3 tools/build_pack.py   # re-empacota com o novo binario
```

### Por que o Replay BTC/USDT é sintético

`tools/generate_replay.py` gera um random-walk determinístico (seed fixa),
sem chamar nenhuma API/exchange. O JSON resultante se autodeclara
`"kind": "SYNTHETIC_OFFLINE_SAMPLE"`, `"live": false`,
`"exchange_connection": "NONE"`. Isso elimina qualquer dependência de rede
para a demo funcionar 100% offline e remove qualquer ambiguidade sobre
"dado real de mercado" dentro de uma entrega que precisa ser auditável como
READ_ONLY/FAIL_CLOSED. Trocar por um CSV/JSON histórico real é só substituir
o arquivo e rodar `tools/build_pack.py` de novo — a UI não muda.

### Por que sem Google Fonts / sem qualquer CDN

O CSS original do Cockpit ("Ciborgue") importava Orbitron/Share Tech Mono do
Google Fonts. Aqui isso foi trocado por pilhas de fontes de sistema
(`ui-sans-serif`/`ui-monospace` com fallback Apple). Resultado: zero
requisição de rede além do próprio HTTPS do app — o runtime fica
genuinamente local-first mesmo na primeira instalação em rede instável, e
não há nenhum host de terceiros no Content-Security-Policy.

### Content-Security-Policy como aplicação técnica das leis obrigatórias

`index.html` define:

```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
img-src 'self' data:; connect-src 'self'; worker-src 'self';
object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none';
```

Isso não é só convenção de código — é o **browser bloqueando em runtime**
qualquer tentativa futura de `fetch`/`WebSocket` para fora da própria
origem (logo, sem rota técnica para MEXC private endpoint, MT5, ou qualquer
"ordem por LLM" via rede), e bloqueia `eval()`/`new Function` por não haver
`unsafe-eval` em `script-src`.

### Vault FAIL_CLOSED real (não é só uma flag salva)

`pack-manager.reloadVaultState()` reabre o app e **recalcula o SHA-256**
dos arquivos já instalados, comparando com os checksums gravados. Se algo
não bater, o Vault volta para `LOCKED` e a UI mostra a falha — em vez de
confiar ciegamente numa flag `installed=true` salva da sessão anterior.

### WebLLM / Transformers.js / ONNX Runtime Web — por que `FUTURE` e não "fake installed"

Nenhum modelo de linguagem está embutido nesta V1 (ver
`pack/manifest.models.json`). Empacotar um modelo Llama quantizado
(centenas de MB a poucos GB) dentro do `.ar10pack` base — ou buscá-lo de um
CDN de modelos em runtime — violaria tanto "sem CDN para núcleo sensível"
quanto o orçamento de armazenamento realista do Safari/iPadOS sem um fluxo
de consentimento explícito de download incremental (ainda não
implementado). O painel mostra **FUTURE** de forma honesta, com o plano de
entrega documentado no manifesto de modelos — não finge que está instalado.

### AR10 Local Intelligence Engine (sem API paga)

`js/calc/feature-extractor.js` + `js/intelligence/{scoring-engine,memory-store,
scenario-matcher,reflection-engine,siriform-explainer,local-brain}.js`
formam uma camada de inteligência 100% local: estatística sobre o
CalculationFrame que já existe (`RealAnalysisFrame` real ou meta do replay
sintético), comparação geométrica simples com leituras passadas, e
explicação em português — tudo gravado como entradas marcadas
(`kind: local_setup_score` / `local_reflection_report`) no mesmo Evidence
Ledger que já existe, sem segunda fonte de memória. `liquidity_score` é
sempre `null` (nenhum conector de profundidade/volume existe ainda) e todo
resultado carrega `is_authoritative: false`, `is_recommendation: false`,
`is_signal: false`, `requires_risk_gate: true` — nunca substitui o Risk
Gate real (`js/trading/risk-gate.js`), que continua sendo o único portão
de ordens (mesmo Paper).

## Verificação manual do pacote (sem abrir o Safari)

```bash
cd ipad_runtime
sha256sum -c pack/checksums.sha256
python3 -c "import json; d=json.load(open('AR10_CYBORG_LOCAL_PACK_V1.ar10pack')); print(d['checksums'])"
```

## Rodar localmente antes de publicar

```bash
cd ipad_runtime
python3 -m http.server 8080      # ou: npx http-server -p 8080
# abrir http://localhost:8080/ num navegador (Safari real testa melhor; ver DEPLOY.md)
```

## O que continua bloqueado (por design, sem exceção)

MT5, `order_send`, bridge local, MEXC private endpoint, API secret, live
trading, execução real, ordem por LLM, ordem sem Risk Gate, segredo em
`localStorage`. Nenhuma dessas rotas existe neste código — não é apenas
uma flag desligada.
