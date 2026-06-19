# Deploy Guide — AR10 Cyborg 2.0 iPad One-Tap Cloud Runtime

Ponto de entrada único para publicar `ipad_runtime/` em HTTPS. Para o
detalhe linha-a-linha de cada rota, ver também
`ipad_runtime/DEPLOY.md` (mantido como fonte técnica original) — este
documento é o resumo orientado a decisão, parte do kit de entrega
`AR10_CYBORG_2_PANEL_DEPLOY_AND_REPOSITORY_ALIGNMENT_V1`.

## O que está sendo publicado

Um conjunto 100% estático de arquivos (HTML/CSS/JS/WASM/JSON) dentro de
`ipad_runtime/`. Nenhum backend, nenhum banco de dados, nenhuma variável
de ambiente sensível. Qualquer host HTTPS estático serve.

## Rota 1 (primária, já automatizada): GitHub Pages

- Workflow: `.github/workflows/deploy-ipad-pwa.yml`.
- Dispara em push para `main` ou `claude/eloquent-cannon-qyt86y` que toque
  `ipad_runtime/**`, ou manualmente via Actions → Run workflow.
- URL final: `https://ar10-10.github.io/ar10-orion/`.
- **Status atual: bloqueado** por um passo manual único de admin — ver
  `docs/GITHUB_PAGES_FIX.md` para o diagnóstico completo e a correção.

## Rota 2: Cloudflare Pages / Vercel / Netlify (manuais, sem GitHub Pages)

Não dependem do toggle de admin do GitHub, mas exigem conta + token de
terceiro (fora do alcance deste ambiente de execução):

```bash
# Cloudflare Pages
npx wrangler login   # uma vez
npx wrangler pages deploy ipad_runtime --project-name=ar10-cyborg-ipad

# Netlify
npx netlify-cli deploy --dir=ipad_runtime --prod

# Vercel
npx vercel deploy ipad_runtime --prod
```

Em todos os casos: nenhuma variável de ambiente sensível é necessária —
as chaves em `pack/runtime_config.json` (`NODE_ENV`, `APP_MODE`,
`EXECUTION_LOCK`, `NO_REAL_TRADING`, `NO_PRIVATE_KEYS`, etc.) só
documentam a postura de segurança do pacote; nada é lido em runtime do
ambiente do host.

## Rota 3: teste local antes de publicar (já executado nesta entrega)

```bash
cd ipad_runtime
python3 -m http.server 8080
# abrir http://localhost:8080/
```

Confirmado nesta sessão: `index.html`, `css/ipad-runtime.css`,
`js/app.js`, `js/siriform.js`, `js/feature-detect.js`,
`service-worker.js` e `manifest.webmanifest` respondem HTTP 200; `node
--check` passou em todos os módulos JS novos/alterados.

## Caminhos relativos (por que funciona em qualquer sub-path)

`index.html`, `service-worker.js` e o manifest usam apenas caminhos
relativos (`./js/app.js`, `./css/ipad-runtime.css`, scope `./`), então o
mesmo build funciona tanto em
`https://ar10-10.github.io/ar10-orion/` (sub-path) quanto em um domínio
raiz (Cloudflare/Vercel/Netlify). Nenhum ajuste de path é necessário ao
trocar de rota de deploy.

## Checklist pós-deploy (rodar no Safari real do iPad)

1. Abrir a URL HTTPS publicada.
2. **Verificar Safari** → todas as linhas relevantes devem ficar `OK`.
3. **Baixar Pacote Local** → **Verificar SHA256** → todos os arquivos `OK`.
4. **Instalar no Safari Storage** → Vault muda para `READY` (card
   Vault/Evidence mostra backend + timestamp + hash por arquivo).
5. **Rodar Diagnóstico Offline** e **Rodar Replay BTC/USDT** → sem erros;
   AnalysisFrame deve preencher com SMA/EMA/desvio/Z-score reais.
6. **Adicionar à Tela de Início** → abrir o ícone instalado, desligar o
   Wi-Fi, confirmar que o app continua funcionando (offline-first real).

Ver `docs/PROMOTION_CHECKLIST.md` para os critérios formais de
PASS técnico vs. PASS operacional.
