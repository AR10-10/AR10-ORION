# TRABALHAR COMIGO NA SUA MÁQUINA

Pedido do Operador: *"qual a forma correta adiciono ele pra você começar a
trabalhar na parte local do meu computador"*, com o GitHub servindo **só como
lugar salvo**.

---

## Parte 1 — Onde cada coisa fica

Verificado no código, não suposto (`nexus/persistence.ts`).

**O sistema inteiro mora em `Documentos/AR10-CYBORG`** — é lá que o instalador
o coloca e é de lá que ele roda. Mas nem tudo que o painel guarda fica *dentro
dessa pasta*, e isso precisa estar dito com todas as letras:

| O quê | Onde fica de verdade | Está em Documentos? | Vai para o GitHub? |
|---|---|---|---|
| Código, motores, gráficos | `Documentos/AR10-CYBORG/` | **Sim** | Sim |
| Senha do painel | `Documentos/AR10-CYBORG/ipad_runtime/ramber-ui/.env.local` | **Sim** | **Não** (está no `.gitignore`) |
| Candles do gráfico | IndexedDB do navegador (`ar10-cyborg-nexus`) | **Não** | Não |
| Track Record (seus sinais e desfechos) | IndexedDB | **Não** | Não |
| Paper trading | IndexedDB | **Não** | Não |
| Preferências dos painéis | localStorage do navegador | **Não** | Não |

**O que isso significa na prática:** o programa é seu e está nos seus
Documentos. O **histórico de operações** ainda não — ele fica no banco interno
do navegador, que é na sua máquina, mas num lugar que você não abre pelo
Explorador nem copia num pen drive.

> **Isso é uma limitação real, não uma escolha.** Uma página no navegador não
> tem permissão para escrever em qualquer pasta do computador — é o próprio
> navegador que proíbe. Para o Track Record cair como arquivo dentro de
> `Documentos/AR10-CYBORG/dados/`, é preciso uma peça a mais: uma rota de
> gravação no servidor local que já sobe junto com o painel. **Isso ainda não
> está construído.** Me peça e eu construo — é um passo real, não um "talvez".

> **Um segundo detalhe honesto:** o IndexedDB é separado por endereço. O
> histórico que você acumulou no site antigo (GitHub Pages) **não vem junto**
> para o `localhost` — são bancos diferentes, do ponto de vista do navegador.
> O Track Record local começa do zero, e vai enchendo conforme você usa.

---

## Parte 2 — Como me adicionar na sua máquina

Eu sou o **Claude Code**. Instalar é rápido, e o pré-requisito você já vai
ter: o **Node**, que o instalador do painel já pediu.

### Jeito mais fácil: o aplicativo

1. Baixe em <https://claude.ai/download>
2. Instale (é só ir avançando)
3. Abra e entre com sua conta Claude
4. Aponte para a pasta do sistema — a que o instalador criou, normalmente
   `Documentos/AR10-CYBORG`

Pronto. A partir daí você conversa comigo ali, e eu mexo direto nos arquivos
da sua máquina.

### Jeito do terminal (se o Jean preferir)

```sh
npm install -g @anthropic-ai/claude-code
cd ~/Documents/AR10-CYBORG
claude
```

No Windows, o caminho é `%USERPROFILE%\Documents\AR10-CYBORG` — ou, se o seu
Documentos estiver no OneDrive, o caminho dentro dele. O instalador mostra na
tela o caminho que usou de verdade; é esse que vale.

---

## Parte 3 — Por que isso muda o que eu consigo fazer

Trabalhando na sua máquina, eu passo a ter o que **nunca tive aqui**:

| | Aqui (nuvem) | Na sua máquina |
|---|---|---|
| Acesso à Binance | **Bloqueado** (HTTP 000, medido) | **Funciona** |
| Rodar o backtest de verdade | Não | **Sim** |
| Ver o painel rodando | Não | **Sim** |
| Testar mudança visual no gráfico real | Não | **Sim** |

Isso destrava o que ficou pendente esta trilha inteira: **a taxa de acerto
real**. Lá eu rodo o backtest, olho o resultado e analiso com dado de verdade,
em vez de te pedir para rodar e me mandar a saída.

> **As regras do projeto viajam junto.** O arquivo `CLAUDE.md` está dentro da
> pasta — quando eu abrir ali, já leio as Regras de Ouro, a LEI 24, o
> READ_ONLY e toda a disciplina. Não preciso ser reensinado, e não vou
> afrouxar nada por estar em outro lugar.

---

## Parte 4 — Como o GitHub continua sendo seu lugar salvo

Trabalhando local, o fluxo fica:

1. Eu (ou você) mudo algo na pasta do seu computador
2. Testo ali mesmo
3. **Salvo no GitHub** com `git push` — vira sua cópia de segurança privada

Se o computador der problema, você reinstala com o mesmo instalador de um
arquivo e recupera tudo.

**Com o repositório privado**, essa cópia é só sua: ninguém vê, ninguém baixa.

> **Importante:** o `git push` salva o **código**. Seu histórico de operações
> (Track Record) fica no navegador e **não** é enviado — o que é justamente o
> que você quer. Se algum dia quiser guardar esse histórico também, dá para
> exportar; me peça na hora.

---

## Ordem recomendada

1. **Instale o painel** com o `AR10-INSTALADOR` (enquanto o repositório ainda
   é público — mais fácil, sem login)
2. **Confirme que abre** e que o gráfico carrega
3. **Instale o Claude Code** e aponte para a pasta
4. **Feche o acesso público** (os 3 passos de `FECHAR-ACESSO-PUBLICO.md`)
5. Me chame lá e a gente continua — começando pelo backtest real

Fazer nessa ordem garante que você nunca fica travado no meio: se algo der
errado no passo 4, o passo 1 já está funcionando.
