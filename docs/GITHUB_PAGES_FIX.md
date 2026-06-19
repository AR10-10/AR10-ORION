# GitHub Pages Fix — por que o deploy ainda falha e como destravar

Documento técnico de apoio a `AR10_CYBORG_2_PANEL_DEPLOY_AND_REPOSITORY_ALIGNMENT_V1`.
Cobre exclusivamente o bloqueio de publicação HTTPS do sub-produto iPad
(`ipad_runtime/`) via GitHub Pages.

## Estado real, reconfirmado nesta sessão

| Item | Valor |
|---|---|
| Repositório | `AR10-10/AR10-ORION` (**público** — alterado manualmente; era privado quando este documento foi escrito originalmente) |
| `has_pages` (API) | **`true`** (mudou de `false` para `true` depois que um humano com permissão de admin configurou manualmente Settings → Pages → Source → "GitHub Actions" — ver seção abaixo) |
| Workflow | `.github/workflows/deploy-ipad-pwa.yml` |
| Último check run (`deploy`) no PR #3 | `completed` / **`failure`** — mas agora por uma causa diferente da original (ver "Nova falha" abaixo); a falha original ("Resource not accessible by integration") não se repete depois que `has_pages` virou `true` |

Log real do passo que falha (`actions/configure-pages@v5`, capturado nesta
sessão via `get_job_logs`, **depois** de o repositório já estar público):

```
##[warning]Get Pages site failed. Error: Not Found
##[error]Create Pages site failed. Error: Resource not accessible by integration
##[error]HttpError: Resource not accessible by integration
```

### Visibilidade pública não resolveu — e por quê

A hipótese de que o bloqueio fosse causado pela visibilidade `privado` do
repositório foi testada diretamente: o repositório foi tornado `público`,
o workflow foi reexecutado do zero (`run_workflow` via API, não apenas um
re-run do job antigo), e o erro veio **byte-a-byte idêntico** ao já
registrado acima. Isso confirma que a causa raiz nunca foi a visibilidade
— é a permissão da chamada `POST /repos/{owner}/{repo}/pages` (criar o
site do Pages pela primeira vez), que o `GITHUB_TOKEN` automático de uma
Action não tem em nenhum dos dois casos (privado ou público). A correção
abaixo continua sendo a única rota.

## Nova falha depois que o site do Pages passou a existir (não confirmada por log)

Depois que o site do Pages foi criado manualmente (Settings → Pages → Source
→ "GitHub Actions", feito por um humano com permissão de admin), `has_pages`
confirmou `true` pela API. O workflow foi reexecutado duas vezes a partir
daí — uma vez via `workflow_dispatch` (run `27851874392`, attempt 1, job
`82432291139`) e uma vez via re-run dos jobs que falharam no mesmo run
(attempt 2, job `82432425318`). Ambas as tentativas terminaram
`completed`/**`failure`** em ~2 segundos cada (criado às 22:48:39/22:50:20,
completo às 22:48:41/22:50:22) — tempo incompatível com uma execução real
dos passos `upload-pages-artifact`/`deploy-pages`, que fazem upload de
arquivo e normalmente levam bem mais que 2 segundos.

**O texto exato do log dessas duas falhas não pôde ser obtido nesta sessão**,
apesar de esgotadas todas as rotas disponíveis:

- `get_job_logs` (`return_content: true`) → HTTP 404 para os dois job IDs.
- `get_job_logs` (`return_content: false`, retorna só a URL assinada) →
  URL válida obtida, mas o download direto (`curl`) é bloqueado pela
  allowlist de rede do ambiente (`results-receiver.actions.githubusercontent.com`
  e depois `productionresultssa18.blob.core.windows.net`, em duas tentativas
  com hosts diferentes).
- A mesma URL assinada via `WebFetch` (caminho de rede diferente do `curl`)
  → HTTP 403 do próprio Azure Blob Storage.
- `get_workflow_run_logs_url` (ZIP do run completo) → mesma allowlist de rede.
- `get_check_runs` (API do PR) → não inclui texto de log, só metadados.
- `get_workflow_job` → não inclui array `steps` nesta versão do servidor MCP.
- Não existe, nas ferramentas MCP do GitHub carregadas nesta sessão, um
  método para listar as deployment branch policies do environment
  `github-pages` (o bloco `environment:` declarado no workflow).

**Hipótese não confirmada** (claramente rotulada como inferência, não fato):
a duração de ~2 segundos em ambas as tentativas sugere que o job está
falhando muito antes de `upload-pages-artifact`/`deploy-pages` rodarem de
fato — possivelmente no gate do `environment: github-pages` declarado no
workflow. Quando o GitHub cria esse environment automaticamente (o que
`actions/deploy-pages@v4` faz na primeira execução), ele normalmente vem
com uma "deployment branch policy" default que restringe deploys à branch
padrão do repositório (`main`). Esse workflow roda em `push` tanto para
`main` quanto para `claude/eloquent-cannon-qyt86y`, mas se essa policy
default estiver ativa, qualquer execução fora de `main` seria rejeitada
nesse gate — o que bateria com o tempo de ~2 segundos observado. Isso
**não foi confirmado por log** e não deve ser tratado como causa raiz
definitiva até ser verificado diretamente (Settings → Environments →
`github-pages` → Deployment branches, ou testar o mesmo workflow já
mesclado em `main`).

## Por que isso não é um bug no workflow

O workflow já declara a permissão correta:

```yaml
permissions:
  pages: write
  id-token: write
```

E `actions/configure-pages@v5` já é chamado com `enablement: true` (tenta
criar o site do Pages automaticamente se ele não existir). O problema é
que a API REST `POST /repos/{owner}/{repo}/pages` — criar um site do Pages
**pela primeira vez** — exige permissão de **administração** do
repositório que o `GITHUB_TOKEN` automático de uma Action nunca tem,
mesmo com `pages: write` declarado. Essa é uma trava do próprio GitHub,
não uma falha de configuração deste repositório. Depois que o site existe
(criado uma única vez por um humano com permissão de admin), todo deploy
futuro via Action funciona sem nenhum passo manual adicional.

## Correção (passo manual único, exige permissão de admin do repositório)

1. Abrir `https://github.com/AR10-10/AR10-ORION/settings/pages`.
2. Em **Build and deployment → Source**, selecionar **"GitHub Actions"**
   (não "Deploy from a branch").
3. Salvar. Isso cria o site do Pages uma única vez.
4. Reexecutar o workflow: **Actions → "Deploy iPad Runtime (GitHub
   Pages)" → Run workflow** (ou apenas dar push de novo em
   `claude/eloquent-cannon-qyt86y`/`main` tocando `ipad_runtime/**`).
5. URL resultante: `https://ar10-10.github.io/ar10-orion/`.

Nenhuma ferramenta disponível nesta sessão (incluindo todas as ferramentas
MCP do GitHub carregadas) consegue executar esse passo de forma
automática — foi reconfirmado via busca de ferramentas antes deste
documento ser escrito. Não existe rota de API que um `GITHUB_TOKEN` de
Action possa usar para contornar isso.

## Alternativa se Pages continuar indisponível

Ver `docs/DEPLOY_GUIDE.md` → rotas manuais Cloudflare Pages / Vercel /
Netlify. Todas exigem uma conta de terceiro + token configurado como
secret do repositório (fora do alcance deste ambiente), mas não dependem
de nenhum toggle de admin do GitHub.
