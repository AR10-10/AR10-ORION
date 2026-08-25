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

1. Abra <https://github.com/AR10-10/AR10-ORION>
2. Clique no botão verde **`< > Code`**
3. Clique em **Download ZIP**
4. Ache o arquivo na sua pasta de Downloads e **descompacte** (dois cliques no
   Windows; dois cliques no Mac)

Vai aparecer uma pasta chamada **`AR10-ORION-main`**. Arraste ela para a Área
de Trabalho, para achar fácil depois.

> **Se você já tornou o repositório privado**, o GitHub vai pedir para você
> entrar na sua conta antes de mostrar o botão verde. É o esperado — é sinal
> de que a privacidade está funcionando.

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

## Depois

- **Para ligar de novo:** dois cliques no mesmo arquivo. Só isso.
- **Para desligar:** feche a janela preta.
- **Para trocar a senha:** dois cliques no arquivo e escolha outra.

---

## Se algo der errado

| O que aparece | O que fazer |
|---|---|
| "o Node não está instalado" | Faça o Passo 1 e clique no arquivo de novo |
| "o Node é antigo demais" | Instale a versão **LTS** do Passo 1 por cima |
| "a instalação das dependências falhou" | Confira a internet e clique de novo |
| "Acesso não configurado" no navegador | Feche a janela preta e clique no arquivo de novo |
| Gráfico vazio | Abra <https://api.binance.com/api/v3/ping> no navegador. Se não abrir, sua rede bloqueia a Binance |

---

## O que você ganha rodando assim

- **Ninguém mais tem acesso.** O painel existe só na sua máquina — não há
  endereço na internet para alguém abrir.
- **Dados reais.** Mercado ao vivo direto da Binance.
- **A taxa de acerto de verdade.** Aba **RISK** → botão **MEDIR**. Ele busca
  2000 candles reais e conta os desfechos.

Detalhes técnicos, o que roda e o que não roda, e como tirar do ar o site que
está publicado hoje: **`docs/RODAR_LOCAL.md`**.
