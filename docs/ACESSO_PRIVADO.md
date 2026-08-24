# ACESSO PRIVADO — deixar o painel só seu

Pedido do Operador: *"eu quero o que eu uso só eu usar... tem uma senha, como
que nós faz pra deixar só pra mim acessar, e pra deixar outras pessoa acessar
só se eu autorizar."*

Este documento é a parte que **só o Operador pode executar** (envolve contas,
chaves e configurações fora do repositório). A parte de código já está feita.

---

## 1. A situação real hoje — sem suavizar

Auditoria feita antes de qualquer mudança:

| O que foi verificado | Resultado |
|---|---|
| Visibilidade do repositório | **`private: false` — PÚBLICO** |
| GitHub Pages | **ativo**, site público por URL |
| Senha do portão no código | hash SHA-256 era um literal no fonte |
| Senha em texto puro | **estava por extenso** no arquivo de teste, no repositório público |
| Forks | permitidos |

**Conclusão honesta: o projeto inteiro está público na internet, e a senha
não impede nada.** Qualquer pessoa podia:

1. abrir o repositório e ler a senha em texto puro no arquivo de teste;
2. abrir o site e rodar `localStorage.setItem("ar10cyborg_access_unlocked","1")`
   no console do navegador para entrar sem senha nenhuma;
3. clonar todo o código.

O portão em JavaScript **nunca teve como** resolver isso — num site estático
ele só roda depois de o app inteiro já ter sido entregue ao navegador. O
próprio arquivo já dizia isso no cabeçalho desde que foi escrito.

> **Fato desconfortável, mas necessário:** o repositório foi público até
> agora. Quem já clonou, forkou ou leu, **continua com o código e com a
> senha antiga**. Tornar privado agora impede acessos *futuros* — não
> desfaz o que já saiu. Por isso o passo 4 (trocar a senha) não é opcional.

---

## 2. O caminho escolhido: Cloudflare Pages + Cloudflare Access

Por que não basta tornar o repositório privado: no plano Free/Pro do GitHub,
**um site do GitHub Pages continua público mesmo com o repositório privado**
(Pages de visibilidade restrita só existe no GitHub Enterprise Cloud).

Com **Cloudflare Access**, a autenticação acontece **no servidor, antes de
qualquer byte do app ser entregue**. Quem não está na lista de e-mails
autorizados nunca recebe nem o HTML. É essa a diferença entre uma trava real
e uma cortina.

Gratuito até 50 pessoas autorizadas.

---

## 3. Passo a passo

### 3.1 Tornar o repositório privado

`Settings` → role até **Danger Zone** → **Change repository visibility** →
**Make private**.

> Isso esconde o código. Não tira o site do ar (passo 3.2).

### 3.2 Desativar o GitHub Pages

`Settings` → **Pages** → em **Build and deployment**, mudar Source para
**None**.

> **Este é o passo que efetivamente tira o site público do ar.** Desligar a
> publicação automática no workflow (já feito no código) impede *novas*
> publicações, mas o site já publicado continua no ar até aqui.

### 3.3 Criar o projeto no Cloudflare Pages

1. Criar conta em `dash.cloudflare.com` (gratuita).
2. **Workers & Pages** → **Create** → **Pages** → **Direct Upload** (o deploy
   vem do GitHub Actions, não da integração automática).
3. Nome do projeto: **`ar10-cyborg`** — precisa ser exatamente este, é o que
   está em `deploy-cloudflare-pages.yml` (`--project-name=ar10-cyborg`).

### 3.4 Gerar as chaves e cadastrar no GitHub

No Cloudflare:

- **Account ID**: aparece na barra lateral de Workers & Pages.
- **API Token**: `My Profile` → `API Tokens` → `Create Token` → modelo
  **Edit Cloudflare Workers**, ou um token personalizado com a permissão
  `Account · Cloudflare Pages · Edit`.

No GitHub, em `Settings` → `Secrets and variables` → `Actions` →
**New repository secret**, criar os três:

| Segredo | Valor |
|---|---|
| `CLOUDFLARE_API_TOKEN` | o token gerado acima |
| `CLOUDFLARE_ACCOUNT_ID` | o Account ID |
| `VITE_ACCESS_HASH` | o SHA-256 da senha nova (passo 4) |

### 3.5 Ligar o Cloudflare Access — a trava de verdade

`Zero Trust` → `Access` → `Applications` → **Add an application** →
**Self-hosted**:

- **Application domain**: o domínio do seu Pages (`ar10-cyborg.pages.dev`).
- **Policy**: `Action: Allow`, e em **Include** escolher
  **Emails** → adicionar **o seu e-mail**.

Pronto: só quem estiver nessa lista entra. Cada pessoa recebe um código de
uso único por e-mail — **não existe senha compartilhada**.

### Autorizar alguém depois

`Zero Trust` → `Access` → `Applications` → sua aplicação → `Policies` →
adicionar o e-mail da pessoa. Para remover o acesso, apague o e-mail da
lista. **É essa a autorização individual que você pediu.**

---

## 4. Trocar a senha do portão — obrigatório

A senha antiga esteve pública em repositório aberto. Considere-a queimada.

Para gerar o hash da senha nova, no terminal:

```sh
printf '%s' 'SUA_SENHA_NOVA_AQUI' | shasum -a 256
```

Copie os 64 caracteres hexadecimais para o segredo `VITE_ACCESS_HASH`.

> **Nunca** comite a senha nem o hash. O build injeta o hash a partir do
> segredo; o código-fonte não contém nenhum dos dois, e há teste travando
> isso (`tests/access-gate.test.ts`).

---

## 5. O que o portão de senha ainda NÃO faz

Dito de forma direta para nenhuma sessão futura se enganar:

- O Vite **inlina** variáveis `VITE_*` no bundle publicado. O hash sai do
  código-fonte versionado, mas **continua legível no JavaScript servido**.
  Isso é inevitável em site estático.
- Quem já passou pelo Cloudflare Access e abriu o DevTools ainda pode pular
  o portão pelo `localStorage`.

**Isso é aceitável porque o portão não é a trava** — é a segunda camada,
contra abertura acidental por alguém que já está autorizado. A trava real é
o Access, no servidor.

---

## 6. Estado da configuração

- [x] Hash fora do código-fonte, vindo de segredo de build
- [x] Senha em texto puro removida de todos os arquivos versionados
- [x] Portão fail-closed: build sem segredo → painel fechado, com a causa dita
- [x] Workflow do Cloudflare Pages criado
- [x] Publicação automática do GitHub Pages desligada (reversível)
- [ ] **Repositório tornado privado** (passo 3.1 — só o Operador)
- [ ] **GitHub Pages desativado** (passo 3.2 — só o Operador)
- [ ] **Projeto Cloudflare Pages criado** (passo 3.3)
- [ ] **Três segredos cadastrados** (passo 3.4)
- [ ] **Política do Access com sua lista de e-mails** (passo 3.5)
- [ ] **Senha trocada** (passo 4 — a antiga esteve pública)
