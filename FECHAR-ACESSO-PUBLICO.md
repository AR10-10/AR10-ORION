# FECHAR O ACESSO PÚBLICO

Pedido do Operador: *"tira aquele acesso público que tava tendo, todo mundo,
meus amigo tendo. Eu quero que ninguém consegue. Deixar ele lá salvo só no
privado, porque a gente vai rodar ele agora localmente."*

---

## Auditoria — o que está exposto hoje

Verificado agora, não de memória:

| O quê | Estado | Significa |
|---|---|---|
| Repositório | **público** (`private: false`) | Qualquer pessoa lê todo o código |
| GitHub Pages | **ativo** | O painel está no ar por URL |
| Forks | **0** | **Ninguém copiou o repositório** |
| Colaboradores | **só você** (`AR10-10`, admin) | Ninguém tem permissão de escrita |
| Estrelas | **2** | Pelo menos 2 pessoas acharam o repositório |

**Como seus amigos entram hoje:** pela **URL do site + a senha** que você
passou. Não é permissão do GitHub — é o link estar no ar.

**A boa notícia:** ninguém forkou e ninguém tem acesso de escrita. Fechar
resolve de verdade.

---

## Os 3 passos — nesta ordem

Eu **não tenho** como fazer nenhum destes: não existe ferramenta no meu
acesso para mudar visibilidade de repositório nem desligar Pages. São cliques
no site do GitHub, na sua conta.

### 1º — Desligar o site (é este que fecha o acesso)

**`Settings` → `Pages` → em "Build and deployment", Source: `None`**

Este é o passo que tira o painel do ar. **Enquanto não fizer isso, quem tem o
link continua entrando**, mesmo com tudo o mais fechado.

> Eu já desliguei a publicação automática nos dois workflows — nenhum push
> republica nada. Mas o que já está publicado só sai daqui.

### 2º — Tornar o repositório privado

**`Settings` → role até o fim → `Danger Zone` → `Change repository
visibility` → `Make private`**

Esconde todo o código. Depois disso, só quem estiver logado na sua conta vê.

### 3º — Trocar a senha do painel

A senha antiga esteve num repositório **público** — considere queimada.
Quando o sistema estiver instalado na sua máquina, apague o arquivo
`ipad_runtime/ramber-ui/.env.local` e clique no instalador: ele pede uma nova.

---

## O que fechar NÃO desfaz — dito sem suavizar

O repositório foi público desde 12/06. Quem clonou ou copiou naquele período
**continua com aquela cópia**, e nada torna isso reversível. Fechar impede
acesso **de agora em diante**.

Os dados que importam nunca estiveram lá: **não há chave de exchange, não há
credencial de corretora, não há dado pessoal seu** — o sistema é read-only por
projeto e nunca guardou nada disso. O que vazou foi **código** e a **senha do
portão**, e é por isso que o passo 3 não é opcional.

---

## Efeito colateral que eu já resolvi

Tornar o repositório privado **quebra o download por ZIP** do instalador —
ZIP anônimo só existe em repositório público. Sem tratamento, o instalador
diria "verifique a internet" e você procuraria no lugar errado.

**Já corrigido:** os dois instaladores agora dizem a causa certa e a saída:

```
[X] PAROU AQUI: o download do ZIP falhou.

    Se o repositório JA FOI TORNADO PRIVADO, este caminho nao
    funciona mais -- ZIP anonimo so existe em repositorio publico.
    A saida e instalar o Git (https://git-scm.com/downloads) e rodar
    este instalador de novo: ele pede seu login e funciona normal.
```

**Na prática, depois de fechar:** instale o **Git** na máquina onde for usar.
O instalador avisa antes que o GitHub vai pedir login, e a partir daí funciona
igual — inclusive a atualização automática.

- **Windows:** o Git abre uma janela do navegador para entrar na conta. Se não
  abrir, reinstale o Git marcando **Git Credential Manager**.
- **Mac/Linux:** o Git costuma pedir usuário e um **token**, não a senha da
  conta. Crie em `github.com` → Settings → Developer settings → Personal
  access tokens, com permissão `repo`.

---

## Ordem recomendada

1. **Instale o sistema na sua máquina primeiro** (com o repositório ainda
   público — é o caminho mais fácil, sem login).
2. Confirme que o painel abre e funciona localmente.
3. **Só então** faça os 3 passos acima.

Assim você nunca fica sem o sistema no meio do processo.

---

## Depois de fechar

- O painel existe **só na sua máquina e na sua rede local**.
- Ninguém de fora tem endereço para abrir.
- Para autorizar alguém: essa pessoa precisa do seu computador, ou de estar na
  sua rede com a senha. Não há mais link para passar adiante.
