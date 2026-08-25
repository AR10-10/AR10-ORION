# COMECE AQUI

**Você não precisa saber programar.** São 3 passos e nenhum comando para digitar.

---

## Passo 1 — Instalar o Node (uma vez só)

O Node é o motor que faz o sistema rodar. É um instalador comum, igual a
qualquer programa.

1. Abra <https://nodejs.org>
2. Clique no botão grande que diz **LTS**
3. Abra o arquivo baixado e vá clicando em **Avançar / Continuar** até o fim

> Já tem Node? Pode pular. O instalador do passo 3 confere sozinho e avisa se
> a versão for antiga.

---

## Passo 2 — Baixar o sistema

**Há dois jeitos. O primeiro é melhor — e é o que faz tudo virar automático.**

### Jeito recomendado: `git clone` (uma vez só, e nunca mais baixa nada)

Quem entende de computador faz isso em 30 segundos. Abra o Terminal (Mac) ou
o Prompt de Comando (Windows), vá até onde quer guardar o sistema, e rode:

```sh
git clone https://github.com/AR10-10/AR10-ORION.git
```

**Por que este é o jeito certo:** instalado assim, o sistema **se atualiza
sozinho** toda vez que você clica no arquivo do Passo 3. Quando eu melhorar
alguma coisa, ela chega na sua máquina sem você baixar nada.

> Precisa do Git instalado: <https://git-scm.com/downloads>. Se der erro
> dizendo que o repositório é privado, é só entrar com a sua conta do GitHub
> — e é sinal de que a privacidade está funcionando.

### Jeito simples: ZIP (funciona, mas não atualiza sozinho)

1. Abra <https://github.com/AR10-10/AR10-ORION>
2. Botão verde **`< > Code`** → **Download ZIP**
3. Descompacte (dois cliques)

Vai aparecer a pasta **`AR10-ORION-main`**. O painel roda igual, mas a cada
melhoria você teria que baixar o ZIP de novo — por isso o jeito de cima é
melhor. O próprio instalador avisa na tela quando percebe que a pasta veio
de ZIP, e mostra o comando para trocar.

---

## Passo 3 — Clicar duas vezes

Entre na pasta e dê **dois cliques** no arquivo do seu sistema:

| Seu computador | Arquivo |
|---|---|
| **Windows** | `INSTALAR-E-RODAR.bat` |
| **Mac** | `INSTALAR-E-RODAR.command` |

Ele faz o resto sozinho: confere o Node, pede uma senha, instala as peças e
liga o painel. **A primeira vez demora alguns minutos** — é normal, não feche
a janela.

Quando terminar, o navegador abre em `http://localhost:5173`. Digite a senha
que você escolheu e pronto.

### No Mac, se aparecer "não pode ser aberto"

O Mac bloqueia arquivos baixados da internet na primeira vez. Faça assim:

- **Clique com o botão direito** no arquivo → **Abrir** → **Abrir** de novo na
  caixa que aparecer.

Só precisa disso uma vez.

---

## Usar do iPad e do celular

Quando o painel liga, a janela mostra **dois endereços**:

```
Neste computador:  http://localhost:5173
No iPad/celular:   http://192.168.x.x:5173
```

Digite o segundo no navegador do iPad, **na mesma rede de casa**. Mesma senha.

> **Quem alcança:** qualquer aparelho ligado na sua rede consegue abrir esse
> endereço, e a senha é a única barreira. Em rede de casa está ok. Em rede de
> hotel, aeroporto ou trabalho compartilhado, **não use** — ali o computador
> deve ficar só no `localhost`.

---

## Depois

- **Para ligar de novo:** dois cliques no mesmo arquivo. **Ele já busca as
  atualizações sozinho** antes de ligar — você não precisa baixar nada.
- **Para desligar:** feche a janela preta.
- **Para trocar a senha:** apague o arquivo
  `ipad_runtime/ramber-ui/.env.local` e clique no instalador de novo.

> **Se você tiver mexido em algum arquivo do sistema**, o instalador percebe
> e **não atualiza por cima** — ele avisa e roda com o que já está aí. Seu
> trabalho nunca é sobrescrito sem você saber.

---

## Se algo der errado

| O que aparece | O que fazer |
|---|---|
| "o Node não está instalado" | Faça o Passo 1 e clique no arquivo de novo |
| "o Node é antigo demais" | Instale a versão **LTS** do Passo 1 por cima |
| "a instalação das dependências falhou" | Confira a internet e clique de novo |
| "Acesso não configurado" no navegador | Feche a janela preta e clique no arquivo de novo |
| "esta pasta veio de ZIP" | Normal — o painel roda igual. Para virar automático, use o `git clone` do Passo 2 |
| "há mudanças locais não salvas" | Alguém editou um arquivo do sistema. O painel roda; a atualização fica para depois |
| O endereço do iPad não abre | O iPad está em outra rede (dados móveis, ou outro Wi-Fi) |
| Gráfico vazio | Abra <https://api.binance.com/api/v3/ping> no navegador. Se não abrir, sua rede bloqueia a Binance |

---

## O que você ganha rodando assim

- **Ninguém de fora tem acesso.** O painel existe só na sua máquina e na sua
  rede — não há endereço na internet para alguém abrir.
- **Dados reais.** Mercado ao vivo direto da Binance.
- **A taxa de acerto de verdade.** Aba **RISK** → botão **MEDIR**. Ele busca
  2000 candles reais e conta os desfechos.

Detalhes técnicos, o que roda e o que não roda, e como tirar do ar o site que
está publicado hoje: **`docs/RODAR_LOCAL.md`**.
