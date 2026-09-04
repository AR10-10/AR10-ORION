# Alinhamento Local × Nuvem — qual é a base correta

Documento de memória evolutiva. Existe porque o Operador perguntou "qual o
correto da base?" depois de perceber que o ambiente local não batia com o
que estava rodando na nuvem. A resposta não era "um dos dois está velho":
**eram três estados diferentes, e o `main` era o mais atrasado dos três.**

## 1. O erro de premissa: não são dois estados, são três

Medido em 2026-08-31, com `git rev-list --count` e o histórico real de
execuções do GitHub Actions (não por suposição):

| Estado | Commit | Data | Posição real |
|---|---|---|---|
| Local / `main` | `f43bbd2` | 2026-07-27 | **201 commits atrás da ponta** |
| Site publicado (GitHub Pages) | `4b9b7b3` | 2026-08-24 15:58 UTC | 186 à frente do `main`, 15 atrás da ponta |
| **Ponta real** — `claude/eloquent-cannon-qyt86y` (PR #15) | `48ff33e` | 2026-08-25 | **201 à frente, 0 atrás** |

**A base correta é `claude/eloquent-cannon-qyt86y`.** Ela está `0` commits
atrás do `main` — ou seja, contém tudo que o `main` tem, mais 201 commits.
Avançar o `main` para ela não descarta nada.

O que confundia: o site na nuvem não era o `main` nem a ponta. Era um
terceiro ponto no meio, porque o workflow de deploy disparava **também** na
branch de trabalho, não só no `main`:

```yaml
on:
  push:
    branches:
      - main
      - claude/eloquent-cannon-qyt86y   # ← a causa do terceiro estado
```

Cada push na branch de feature republicava o site. O `main`, que ninguém
tocava desde o merge da PR #14, nunca chegou perto do que estava no ar.

## 2. Qual arquivo "roda na nuvem" — e por que não se acha localmente

O site serve `ipad_runtime/index.html` + `ipad_runtime/assets/`. **Nenhum
dos dois é código-fonte.** São saída de build, gerados a cada deploy:

```yaml
- name: Build RAMBER UI (React/Vite) and place at ipad_runtime root
  working-directory: ipad_runtime/ramber-ui
  run: |
    npm run build
    cp -r dist/. ../        # ← dist/ vira a raiz de ipad_runtime/
```

A fonte real do que roda na nuvem é **`ipad_runtime/ramber-ui/`**
(`index.html` + `src/App.tsx` + `src/nexus/` + `src/chart/`), nunca
`ipad_runtime/index.html`.

Ambos os caminhos estão no `.gitignore` justamente por serem build output.

## 3. A armadilha que estava montada (corrigida neste commit)

`.gitignore` **não destraqueia arquivo já rastreado**. `ipad_runtime/index.html`
continuava versionado desde 2026-06-21 (`5d6bbb9`, "Add standalone iPad
runtime cockpit"), apesar de listado no `.gitignore`. Resultado: quem
procurasse localmente "o arquivo que roda na nuvem" encontrava um app
**diferente e obsoleto**:

- versionado no repo: `<title>AR10 Orion V5.0 - iPad Runtime</title>` — cockpit standalone de 484 linhas
- de fato no ar: `<title>AR10 CYBORG · Terminal Quantitativo</title>` — build do `ramber-ui`

Dois efeitos colaterais reais que isso já tinha produzido:

1. O comentário do próprio `deploy-ipad-pwa.yml` afirmava que
   `ipad_runtime/index.html` "is never committed (generated fresh on every
   deploy)" — **falso** enquanto o arquivo estivesse rastreado. O comentário
   passa a ser verdadeiro agora.
2. `QUARANTINE.md` instruía a adicionar domínios à CSP `connect-src` de
   `ipad_runtime/index.html`. Esse arquivo **não tem CSP nenhuma** (zero
   ocorrências). A CSP real e versionada está em
   `ipad_runtime/ramber-ui/index.html:59`. A instrução mandava editar um
   arquivo morto — corrigida.

**Correção aplicada, sem apagar nada** (Regra de Ouro 4): o cockpit V5.0 foi
*realocado*, não removido — `git mv` para
`docs/legacy/ipad-runtime-cockpit-v5.html`, registrado pelo git como rename,
conteúdo íntegro. Ficou fora de `ipad_runtime/` de propósito: aquela pasta é
o `path` do artefato de Pages, e um arquivo legado ali seria publicado junto.

## 4. Publicação na nuvem: desligada de propósito, e o que isso não faz

Os 15 commits mais recentes (2026-08-24 a 2026-08-25) desligaram a
publicação automática a pedido explícito do Operador — privacidade e
operação local. Hoje **os dois** workflows são `workflow_dispatch` apenas:

- `deploy-ipad-pwa.yml` — gatilho `push` removido (`dc8ab39`, `cca8158`)
- `deploy-cloudflare-pages.yml` — nunca teve gatilho automático

O motivo é estrutural, não preferência: em plano Free/Pro, um site do GitHub
Pages é **público por URL mesmo com o repositório privado** (Pages de
visibilidade restrita só existe no Enterprise Cloud).

**O que continua pendente, e só o Operador pode executar:** desligar o
workflow impede *novas* publicações, mas **não tira do ar o que já foi
publicado**. O build de `4b9b7b3` (2026-08-24) segue acessível por URL. Isso
só termina em `Settings → Pages → Source: None`.

Existe uma trava proposital para quem for religar o deploy: o passo
"Verificar segredo do portao" falha alto se `VITE_ACCESS_HASH` não estiver
cadastrado, em vez de publicar um build que trancaria o Operador para fora
do próprio painel.

## 5. Como não voltar a desalinhar

- **A base de qualquer trabalho novo é a ponta, não o `main`**, enquanto a
  PR #15 não for mergeada. Partir do `main` cria um quarto estado divergente.
- Para conferir a posição real, sem achismo:
  ```
  git fetch origin --prune
  git rev-list --count origin/main..origin/claude/eloquent-cannon-qyt86y   # à frente
  git rev-list --count origin/claude/eloquent-cannon-qyt86y..origin/main   # atrás
  ```
- Para saber o que está de fato no ar, a fonte autoritativa é o histórico de
  execuções do workflow (branch + SHA do último run com sucesso) — não o
  `main`, e não o que está no disco local.
