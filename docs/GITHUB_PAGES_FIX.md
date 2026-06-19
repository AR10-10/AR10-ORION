# GitHub Pages Fix — por que o deploy ainda falha e como destravar

Documento técnico de apoio a `AR10_CYBORG_2_PANEL_DEPLOY_AND_REPOSITORY_ALIGNMENT_V1`.
Cobre exclusivamente o bloqueio de publicação HTTPS do sub-produto iPad
(`ipad_runtime/`) via GitHub Pages.

## Estado real, reconfirmado nesta sessão

| Item | Valor |
|---|---|
| Repositório | `AR10-10/AR10-ORION` (privado) |
| `has_pages` (API) | `false` |
| Workflow | `.github/workflows/deploy-ipad-pwa.yml` |
| Último check run (`deploy`) no PR #3 | `completed` / **`failure`** |

Log real do passo que falha (`actions/configure-pages@v5`, capturado nesta
sessão via `get_job_logs`):

```
##[warning]Get Pages site failed. Error: Not Found
##[error]Create Pages site failed. Error: Resource not accessible by integration
##[error]HttpError: Resource not accessible by integration
```

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
