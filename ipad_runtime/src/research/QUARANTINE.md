# Fusion Research Quarantine

Codinome interno: `AR10_CYBORG_FUSION_RESEARCH_QUARANTINE_V1`.

**Status desta árvore inteira: `FUTURE` / `PLANNED`, em quarentena.** Este
arquivo é a declaração explícita de quarentena para tudo dentro de
`ipad_runtime/src/research/` — conectores (`connectors/*/index.js`) e
motores de fusão de sinal (`engines/*.js`), incluindo
`engines/signal-fusion-engine.js` especificamente.

## Fatos confirmados (não inferidos)

- **Zero import real.** Nenhum arquivo em `ipad_runtime/js/**` importa
  qualquer coisa de `src/research/`. O fecho transitivo de módulos a partir
  de `js/app.js` (o único `<script type="module">` de `index.html`) não
  toca esta árvore — confirmado por varredura de grafo de import ao corrigir
  `service-worker.js` em 2026-06-21.
- **Zero rede real.** Nenhum arquivo desta árvore faz `fetch()`/XHR/
  WebSocket real. Onde a palavra "fetch" aparece, é só dentro de um
  comentário do tipo "Não faz fetch()/XHR" — confirmado lendo todos os 13
  `connectors/*/index.js` e os 12 `engines/*.js`.
  Conferir: `grep -rn "fetch(" ipad_runtime/src/research` sempre cai dentro
  de comentário, nunca dentro de código executável.
- **Zero chave/credencial.** Todo `meta.requires_api_key` é `false`; todo
  `meta.supports_private_endpoints` é `false`.
- **Zero execução.** Todo `execution_supported`/`order_send_supported`
  presente é `false`. `pack/manifest.pack.json` →
  `security_posture.mt5_bridge` já declara `"ABSENT"`, consistente com o
  stub de `connectors/mt5/index.js`.
- **Todo `current_status` é `'FUTURE'` ou `'PLANNED'`.** Nenhum conector ou
  motor se declara pronto.

## A única ressalva real: bytes estáticos vs. execução

`.github/workflows/deploy-ipad-pwa.yml` publica o diretório `ipad_runtime/`
inteiro como artefato do GitHub Pages. Isso significa que os arquivos desta
árvore **são servidos como bytes estáticos** na URL pública (alcançáveis
por quem souber/adivinhar o caminho direto), mesmo nunca sendo importados,
executados ou linkados pela página real. Isto é diferente de "rodar" —
nenhum destes arquivos é avaliado, importado ou referenciado pelo HTML/JS
que o usuário real carrega — mas é diferente o suficiente de "não existe no
deploy" para registrar aqui com precisão, sem eufemismo.

## Regra de quarentena daqui para frente

Nenhum arquivo de `src/research/**` pode ser importado por `js/**` sem,
no mesmo commit:

1. Atualizar `current_status` daquele conector/motor de `'FUTURE'`/
   `'PLANNED'` para um valor real e implementar a lógica de verdade (não só
   trocar o status com o stub por baixo).
2. Adicionar o(s) arquivo(s) a `PRECACHE_URLS` em
   `ipad_runtime/service-worker.js` — um import novo sem precache quebra a
   1ª navegação offline (mesma classe de risco corrigida nesta sessão para
   `js/trading/*`, `js/core/*`, `js/real-data/source-health.js`,
   `js/memory/*`).
3. Se o conector exigir rede real, adicionar o domínio à CSP `connect-src`
   de `ipad_runtime/index.html` como diff isolado e revisável — nunca
   efeito colateral de outra mudança (mesma disciplina de
   `soldier_runtime/domain-tunnel/README.md`).
4. Se o conector exigir credencial, resolver isso via política equivalente
   a `WindowsLocalSecretPolicy`/`TelegramAuxSecretPolicy`
   (`soldier_runtime/windows/types.ts`,
   `soldier_runtime/telegram-aux/types.ts`) — nunca no frontend, nunca no
   repositório, nunca no storage do PWA.

Referências de design já existentes (não duplicadas aqui):
`docs/CONNECTOR_REGISTRY_DESIGN.md`,
`docs/SIRIFORM_VOICE_AND_NATIVE_COMPANION_ROUTE.md`,
`configs/connector-registry.default.json`.
