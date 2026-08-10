# iPad Direct Guide — usando o runtime no Safari do iPad

Guia de uso final, para quem vai abrir o painel **no iPad de verdade**.
Não exige Mac Mini, MacBook, terminal, Xcode ou ZIP.

> **Caminho recomendado:** desde a entrega `..._FINAL_IPAD_ONE_LINK_...`,
> existe um botão único — **"Preparar Cyborg neste iPad"** — que
> automatiza os passos 3 a 6 abaixo numa só ação, com o mesmo
> comportamento `FAIL_CLOSED` em caso de falha. Ver
> `docs/FINAL_IPAD_ONE_LINK_GUIDE.md` para o fluxo de um toque (e a
> opção de comando de voz equivalente). Este documento continua válido
> como referência detalhada, botão por botão, do que cada etapa faz por
> baixo do automatismo.

## Pré-requisito

Uma URL HTTPS publicada (ver `docs/DEPLOY_GUIDE.md`). Sem essa URL, este
guia não pode ser executado ponta-a-ponta no iPad — é exatamente o motivo
do `STATUS: HOLD` registrado no handoff canônico desta entrega.

## Passo a passo no iPad

1. Abrir a URL HTTPS no **Safari** (não funciona em outro navegador
   instalado no iPad por política da Apple — todos usam o motor do
   Safari, então o resultado é o mesmo, mas o app só foi desenhado/testado
   contra o Safari/WebKit).
2. Tocar em **Verificar Safari** — primeiro contato com o Siriform Avatar,
   que entra em estado `listening` → `thinking` → `responding` e mostra
   o relatório de capacidades (PWA HTTPS, Service Worker, Cache API,
   IndexedDB, OPFS, Web Crypto, WASM, Workers, WebGPU, WebGL/Canvas).
3. Tocar em **Baixar Pacote Local** (ou **Importar Pacote do Arquivos**
   se já tiver um `.ar10pack` salvo no app Arquivos do iPad).
4. Tocar em **Verificar SHA256** — confirma que o pacote baixado bate com
   os hashes esperados antes de instalar qualquer coisa.
5. Tocar em **Instalar no Safari Storage** — grava no OPFS (ou IndexedDB,
   conforme suporte do iOS/iPadOS) e o card **Vault/Evidence** passa a
   `READY`, com backend, contagem de arquivos, timestamp e hash por
   arquivo.
6. Tocar em **Rodar Diagnóstico Offline** e depois **Rodar Replay
   BTC/USDT** — o card **AnalysisFrame** se preenche com estatística
   descritiva real (candles, último preço, SMA, EMA, desvio padrão,
   Z-score, máximo, mínimo, versão do engine WASM e tempo de execução).
7. Tocar em **Adicionar à Tela de Início** — segue o modal com o passo a
   passo do botão Compartilhar do Safari. Depois disso o ícone abre em
   modo standalone (sem a barra do Safari) e continua funcionando com o
   Wi-Fi desligado.

## Perfis de processamento (Light / Balanced / Heavy)

No card do Replay, o seletor **Light/Balanced/Heavy** muda a janela usada
pelo motor WASM para SMA/EMA (10/20/40 candles) antes de rodar o replay —
não é um rótulo decorativo. Use **Light** em hardware mais antigo,
**Heavy** para ver a estatística com mais suavização.

## O que o app nunca vai fazer (por design, e isso é esperado)

Nenhum botão envia ordem, abre posição, conecta em corretora ou guarda
segredo. O card **DecisionFrame** existe só para deixar isso explícito —
está rotulado `STUB CONTROLLED` de propósito. Os badges
`READ_ONLY` / `FAIL_CLOSED` / `Execution Lock: ACTIVE` /
`Private Keys: DISABLED` / `Live Trading: BLOCKED` ficam visíveis o tempo
todo, inclusive quando o Siriform Avatar volta ao estado de repouso
`read_only` após qualquer ação.

## Se algo aparecer como `FAIL_CLOSED` (estado vermelho do avatar)

Significa uma falha real de integridade — por exemplo, o checksum do
pacote local não bateu, ou a gravação no Safari Storage falhou. Não é um
bug visual: é o comportamento correto de segurança. Toque em **Limpar/
Reinstalar** e repita a partir do passo 3.
