# RODAR NO SEU COMPUTADOR

Pedido do Operador: *"a gente consegue abaixar o projeto tudinho pro meu
computador e rodar localmente... e queria tudo ativado com dados reais."*

**Sim, e essa é a melhor decisão do projeto até agora.** Ela resolve dois
problemas de uma vez.

---

## Por que rodar local é melhor do que qualquer hospedagem

### 1. Privacidade — resolvida por completo

Rodando em `localhost`, o painel **não está publicado em lugar nenhum**. Não
existe URL para alguém abrir, não existe site para indexar, não existe senha
para vazar.

Isso é mais forte que Cloudflare Access: lá você confia numa lista de e-mails;
aqui **a pessoa precisa do seu computador**. Não existe controle de acesso
mais forte que esse.

> **O Cloudflare passa a ser opcional.** Só vale a pena se você quiser abrir
> o painel do celular, de outro lugar. Se for só você, na sua máquina, não
> precisa de nada disso — e `docs/ACESSO_PRIVADO.md` vira plano B.
>
> **Mas o que já está publicado continua no ar** até você desativar — ver a
> seção "Tirar do ar o que já está publicado" logo abaixo.

### 2. Dado real — destravado

O ambiente onde eu trabalho **não tem saída para exchange** (medido: HTTP 000
em Binance, Binance Futures, Bybit e MEXC). Por isso nunca consegui te dar
uma taxa de acerto real.

**Seu computador tem internet normal.** Lá as chamadas públicas de mercado
funcionam — inclusive o executor de backtest.

---

## Tirar do ar o que já está publicado

Esta é a parte que **só você pode fazer**, e é a única que realmente fecha o
acesso. Eu já desliguei a publicação automática (nenhum push publica mais
nada), mas **o site que já foi publicado continua no ar até você desativar**.

São três coisas, em ordem de importância:

| # | O quê | Onde | Efeito |
|---|---|---|---|
| 1 | **Desativar o Pages** | `Settings` → `Pages` → Build and deployment → Source: **None** | **Tira o site do ar.** É este que fecha o acesso de quem tem o link |
| 2 | **Tornar o repositório privado** | `Settings` → Danger Zone → **Change repository visibility** → Make private | Esconde o código-fonte |
| 3 | **Trocar a senha do portão** | `node ipad_runtime/tools/setup-local.mjs "nova-senha"` | A antiga esteve pública em repositório aberto |

> **O que isso não desfaz:** o repositório foi público até agora. Quem já
> clonou ou forkou continua com aquela cópia. Fechar agora impede acesso
> *futuro* — por isso o passo 3 não é opcional.

Depois disso, o painel existe **só na sua máquina**.

---

## Passo a passo

### 1. Instalar o Node

Baixe a versão **LTS** em <https://nodejs.org> (precisa ser 20 ou maior).
Instale normalmente, avançando.

### 2. Baixar o projeto

Se você tem o Git instalado:

```sh
git clone https://github.com/AR10-10/AR10-ORION.git
cd AR10-ORION
```

Se não tem: abra o repositório no navegador, botão verde **Code** →
**Download ZIP**, e descompacte.

> Se você já tornou o repositório privado, o `git clone` vai pedir login —
> é o esperado, e é sinal de que a privacidade funcionou.

### 3. Preparar

Dentro da pasta do projeto:

```sh
node ipad_runtime/tools/setup-local.mjs "escolha-uma-senha-aqui"
```

Isso confere a versão do Node e cria o `.env.local` com o **hash** da senha
(a senha em si nunca é gravada, e o arquivo está no `.gitignore`).

### 4. Instalar as dependências — uma vez só

```sh
cd ipad_runtime/ramber-ui
npm ci
```

Demora alguns minutos na primeira vez.

### 5. Ligar

```sh
npm run dev
```

Abra o endereço que aparecer — normalmente <http://localhost:5173> — e use a
senha do passo 3.

> Para abrir do iPad na mesma rede de casa: `npm run dev -- --host`, e use o
> endereço "Network" que aparecer. Aí o painel fica visível para quem está na
> sua rede — só faça isso se a rede for de sua confiança.

---

## A taxa de acerto real — agora dentro do app

**Novidade desta rodada:** não precisa mais de terminal. Com o painel aberto,
vá na aba **RISK** e clique em **MEDIR BTCUSDT 15m**.

Ele captura 2000 candles reais da Binance e mede os desfechos num **Web
Worker** — a thread principal fica livre, o gráfico não trava (Regra de Ouro
6). O resultado mostra:

- **Alvo antes do stop** sobre a amostra resolvida
- **Quantos cenários** foram medidos, resolvidos e não resolvidos
- **Empates contados como STOP** (o motor é conservador: empate nunca é acerto)
- **MFE / MAE médios** em R-múltiplo
- E, sempre visível, o aviso do que a medida **não** é

Se a amostra resolvida for menor que 30, o número real continua aparecendo —
mas com a ressalva de que ainda é instável. Esconder seria tão desonesto
quanto apresentar como sólido.

### Pelo terminal, se preferir

É aqui que a sua máquina faz o que a minha não podia:

```sh
node ipad_runtime/tools/run-backtest.mjs --symbol BTCUSDT --timeframe 15m --candles 5000
```

**READ_ONLY:** só lê klines públicas. Sem chave de API, sem ordem, nunca.

Antes de olhar o resultado, duas coisas que o próprio motor declara:

- Ele mede o **subconjunto estrutural candle-only** — não o sistema vivo
  inteiro, que inclui Conselho, fluxo de ordens e livro (nenhum deles existe
  numa série de candles histórica).
- É **conservador no empate**: se stop e alvo são tocados no mesmo candle,
  conta **stop**, nunca acerto.

E o mais importante: **o número vai ser o que for.** Se der 45%, o valor está
em saber que dá 45%. Ajustar parâmetros até chegar num alvo (70%, 100%) é
*curve-fitting* — produz exatamente o número desejado no histórico e falha ao
vivo. Não faço isso, e você não deve querer que eu faça.

Me mande a saída que eu analiso de verdade.

---

## O que roda com dado real, e o que não roda — mapa honesto

| Parte | Local, com internet | Observação |
|---|---|---|
| Candles, preço, ticker | **Real** | Binance pública |
| Livro de ofertas / profundidade | **Real** | |
| Fluxo de ordens / CVD | **Real** | Enche a ~4s por ciclo: 1 h de fluxo exige a aba aberta 1 h |
| Motores estruturais (S/R, BOS/CHOCH, FVG/OB, Fibonacci, zonas) | **Real** | Puros, sobre candles reais |
| Backtest / taxa de acerto | **Real** | Botão **MEDIR** na aba RISK, dentro do próprio app — ou o comando acima |
| Liquidações | **Real** | |
| Neural Core (LLM) | **Real, com ressalva** | Precisa de **WebGPU** — Chrome ou Edge. No Safari não liga. Baixa ~1 GB de pesos na primeira vez |
| Divergência de delta | **Ainda não** | Em quarentena: precisa cobrir 12 velas de CVD. Com 1 h de retenção funciona em 1m e 5m, não em 15m+ |
| Perfil TPO, ZigZag, SuperTrend, Padrões de vela | **Real** | Todos graduados e ligados |

**Sobre "100 por cento":** o mapa acima é o que existe de verdade. Um item
está fora (divergência de delta) e um depende do navegador (LLM). Prometer
100% seria contar a você que algo funciona quando não funciona — e é
justamente esse tipo de afirmação que este projeto inteiro foi construído
para não fazer.

---

## Se der problema

| Sintoma | Causa provável |
|---|---|
| "Acesso não configurado" na tela | O `.env.local` não foi criado — rode o passo 3 e ligue o servidor de novo |
| `npm ci` falha | Node antigo demais — confira com `node --version`, precisa ser 20+ |
| Gráfico vazio | Sem internet, ou a exchange bloqueou o IP; confira abrindo <https://api.binance.com/api/v3/ping> no navegador |
| Backtest aborta com `BLOCKED_BY_POLICY` | A máquina não alcança a Binance (rede corporativa, VPN, firewall) |
| Backtest aborta com "proveniência não confere" | Está tentando rodar sobre dado sintético — é a trava funcionando, e é proposital |
