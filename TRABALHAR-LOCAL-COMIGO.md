# TRABALHAR COMIGO NA SUA MÁQUINA

Pedido do Operador: *"qual a forma correta adiciono ele pra você começar a
trabalhar na parte local do meu computador"*, com o GitHub servindo **só como
lugar salvo**.

---

## Parte 1 — Onde seus dados ficam (já é como você quer)

Verificado no código, não suposto (`nexus/persistence.ts`):

| O quê | Onde fica | Vai para o GitHub? |
|---|---|---|
| Candles do gráfico | IndexedDB do navegador (`ar10-cyborg-nexus`) | **Não** |
| Track Record (seus sinais e desfechos) | IndexedDB | **Não** |
| Paper trading | IndexedDB | **Não** |
| Preferências dos painéis | localStorage do navegador | **Não** |
| Senha do painel | `.env.local`, na sua pasta | **Não** (está no `.gitignore`) |
| **Só o código** | GitHub | Sim |

**Ou seja: já está do jeito que você pediu.** Roda no navegador, salva tudo no
seu computador, e o GitHub serve só de cópia de segurança do código.

> **Um detalhe honesto:** o IndexedDB é separado por endereço. O histórico que
> você acumulou no site antigo (GitHub Pages) **não vem junto** para o
> `localhost` — são bancos diferentes, do ponto de vista do navegador. O
> Track Record local começa do zero, e vai enchendo conforme você usa.

---

## Parte 2 — Como me adicionar na sua máquina

Eu sou o **Claude Code**. Instalar é rápido, e o pré-requisito você já vai
ter: o **Node**, que o instalador do painel já pediu.

### Jeito mais fácil: o aplicativo

1. Baixe em <https://claude.ai/download>
2. Instale (é só ir avançando)
3. Abra e entre com sua conta Claude
4. Aponte para a pasta do sistema — a que o instalador criou, normalmente
   `AR10-CYBORG`

Pronto. A partir daí você conversa comigo ali, e eu mexo direto nos arquivos
da sua máquina.

### Jeito do terminal (se o Jean preferir)

```sh
npm install -g @anthropic-ai/claude-code
cd ~/AR10-CYBORG
claude
```

No Windows, o caminho é `%USERPROFILE%\AR10-CYBORG`.

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
