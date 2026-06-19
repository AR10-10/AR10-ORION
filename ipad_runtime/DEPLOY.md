# Deploy — AR10 Cyborg 2.0 iPad Runtime

Este runtime é um conjunto de arquivos estáticos (HTML/CSS/JS/WASM/JSON).
Qualquer host HTTPS estático serve. Abaixo, a rota principal (já automatizada
neste repositório) e rotas alternativas manuais.

## Rota principal: GitHub Pages via GitHub Actions

`.github/workflows/deploy-ipad-pwa.yml` publica a pasta `ipad_runtime/` como
site do GitHub Pages a cada push em `main` ou `claude/eloquent-cannon-qyt86y`
que toque `ipad_runtime/**` (ou via execução manual em Actions →
"Deploy iPad Runtime (GitHub Pages)" → Run workflow).

URL resultante (padrão GitHub Pages para repositório de organização/usuário):

```
https://<owner>.github.io/<repo>/
```

Para este repositório: `https://ar10-10.github.io/ar10-orion/`.

### Pré-requisito único (uma vez por repositório)

Se o repositório nunca usou GitHub Pages antes, o primeiro deploy pode
precisar que **Settings → Pages → Build and deployment → Source** esteja em
**"GitHub Actions"**. A action `actions/configure-pages` tenta habilitar isso
automaticamente (ela chama a API de criação do site do Pages quando o
workflow tem permissão `pages: write`); se essa chamada falhar por falta de
permissão de administração do token, basta habilitar manualmente uma única
vez — depois disso todo push futuro publica sem nenhum passo manual.

### Por que GitHub Pages (e não Cloudflare/Vercel/Netlify) como rota automatizada

As rotas Cloudflare Pages, Vercel e Netlify exigem uma conta + token de API
de terceiro configurado como secret do repositório (`CLOUDFLARE_API_TOKEN`,
`VERCEL_TOKEN`, `NETLIFY_AUTH_TOKEN`) — nenhum existe neste ambiente, e criar
um exigiria uma conta externa fora do controle deste runtime. GitHub Pages
usa apenas o `GITHUB_TOKEN` que a própria Action já recebe automaticamente,
então é a única rota 100% self-contained dentro do próprio repositório git,
sem novo cadastro e sem novo secret.

## Rotas alternativas manuais (caso GitHub Pages esteja indisponível)

Qualquer uma destas serve `ipad_runtime/` como root estático:

```bash
# Cloudflare Pages (precisa de `wrangler login` antes, uma vez)
npx wrangler pages deploy ipad_runtime --project-name=ar10-cyborg-ipad

# Netlify (drag-and-drop manual também funciona em app.netlify.com/drop)
npx netlify-cli deploy --dir=ipad_runtime --prod

# Vercel
npx vercel deploy ipad_runtime --prod
```

Em todos os casos: **nenhuma variável de ambiente sensível é necessária** —
apenas as chaves seguras já documentadas em `pack/runtime_config.json`
(`NODE_ENV`, `APP_MODE`, `CYBORG_RUNTIME`, `EXECUTION_LOCK`, `PWA_TARGET`,
`LOCAL_FIRST`, `NO_REAL_TRADING`, `NO_PRIVATE_KEYS`) — nenhuma é lida em
runtime pelo cliente; elas existem para documentar a postura de segurança do
pacote, não para configurar o host.

## Testar localmente antes de publicar

```bash
cd ipad_runtime
python3 -m http.server 8080
# abrir http://localhost:8080/ — Safari real testa melhor o comportamento de
# Add to Home Screen / standalone, mas qualquer navegador valida o resto.
```

## Checklist pós-deploy

1. Abrir a URL HTTPS publicada no Safari do iPad.
2. **Verificar Safari** → todas as linhas relevantes devem ficar `OK`.
3. **Baixar Pacote Local** → **Verificar SHA256** → todos os arquivos `OK`.
4. **Instalar no Safari Storage** → Vault muda para `READY`.
5. **Rodar Diagnóstico Offline** e **Rodar Replay BTC/USDT** → sem erros.
6. **Adicionar à Tela de Início** → abrir o ícone instalado → deve abrir em
   modo standalone e funcionar com o Wi-Fi desligado (offline-first real).
