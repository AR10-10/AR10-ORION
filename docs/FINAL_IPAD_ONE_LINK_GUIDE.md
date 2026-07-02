# Final iPad One-Link Guide — AR10 Cyborg 2.0

Guia de uso final, centrado no fluxo **ONE-LINK**: um único link HTTPS,
aberto no Safari do iPad, até o Cyborg pronto para uso — sem Mac Mini,
sem MacBook, sem terminal, sem ZIP. Este documento substitui o passo a
passo manual de `docs/IPAD_DIRECT_GUIDE.md` como **caminho principal**;
o guia manual continua válido como detalhe botão-a-botão e como
alternativa caso o fluxo automático pare em qualquer etapa.

## Pré-requisito

Uma URL HTTPS publicada (ver `docs/DEPLOY_GUIDE.md` e
`docs/GITHUB_PAGES_FIX.md`). Sem essa URL, este guia não pode ser
executado ponta-a-ponta num iPad físico — é exatamente o motivo do
`PASS TÉCNICO / HOLD OPERACIONAL` registrado no handoff canônico desta
entrega (`docs/AR10_CYBORG_2_FINAL_IPAD_ONE_LINK_SIRIFORM_LLAMA_DEPLOY_V1.html`).

## O fluxo de um toque

1. **Abrir o link HTTPS no Safari** do iPad. A página carrega o painel
   Nebula Core/Siriform e dispara automaticamente o primeiro
   auto-diagnóstico (feature detection + READ_ONLY/FAIL_CLOSED) — nenhum
   toque é necessário só para ver o estado inicial do runtime.
2. **Tocar em "Preparar Cyborg neste iPad"** (`btn-prepare-cyborg`,
   segundo botão do Local Pack Manager). Esse único toque executa, em
   sequência, e sempre nesta ordem:
   - Baixa o pacote local (`AR10_CYBORG_LOCAL_PACK_V1.ar10pack`), se
     ainda não estiver carregado nesta sessão.
   - Verifica o SHA-256 de cada arquivo do pacote — se qualquer hash não
     bater, o processo **para imediatamente** (`FAIL_CLOSED`), nada é
     instalado, e o avatar Siriform mostra o estado vermelho
     `fail_closed` com o motivo real na legenda e no log.
   - Instala no Safari Storage (OPFS, com fallback automático para
     IndexedDB).
   - Inicializa o motor WASM dentro do Web Worker.
   - Roda o Replay BTC/USDT (preenche o `AnalysisFrame` com estatística
     descritiva real).
   - Roda o Diagnóstico Offline.
   - Reporta sucesso na legenda do Siriform e no log do sistema.
3. **Tocar em "Adicionar à Tela de Início"** — segue o modal com o passo
   a passo do botão Compartilhar do Safari. Depois disso o ícone abre em
   modo standalone e continua funcionando com o Wi-Fi desligado.

Se qualquer etapa do passo 2 falhar, o painel nunca finge sucesso — o
estado `fail_closed` (vermelho) e a mensagem real do erro aparecem no
log do sistema e na legenda do Siriform. Use **Limpar/Reinstalar** e
repita o passo 2.

## Alternativa: falar com o Siriform em vez de tocar

A partir desta versão, o botão de microfone (acima das ações rápidas)
aceita comandos de voz em português para as mesmas ações — por exemplo,
dizer "Preparar Cyborg" dispara exatamente `handlePrepareCyborg()`, a
mesma função do toque no botão. Lista completa de frases permitidas,
frases bloqueadas por política e o motivo arquitetural de por que "ordem
por voz" nunca é possível aqui: ver
`docs/SIRIFORM_VOICE_AND_NATIVE_COMPANION_ROUTE.md`.

## Ações rápidas (quick actions)

Abaixo do microfone, quatro botões dão acesso direto a leituras que
também podem ser pedidas por voz: **Diagnóstico**, **Replay BTC/USDT**,
**Análise** (explica o último `AnalysisFrame` em português, em texto e
voz) e **Relatório** (resumo combinando modo de segurança + última
análise, no log do sistema).

## Perfis de processamento (Light / Balanced / Heavy)

No card do Replay, o seletor **Light/Balanced/Heavy** muda a janela
usada pelo motor WASM para SMA/EMA (10/20/40 candles) antes de rodar o
replay — única aplicação real hoje. O antigo painel Meta Llama/WebLLM
que espelhava essa preferência num campo próprio foi removido na
ruthless pruning do Engine Room (nenhum runtime de Llama existe para
consumi-la); o plano de reaproveitar este mesmo seletor quando um
runtime real existir continua documentado em
`docs/META_LLAMA_WEBLLM_ROUTE.md`.

## Passo a passo manual (fallback, botão por botão)

Se preferir não usar o botão único, ou quiser entender/auditar cada
etapa separadamente, o passo a passo manual completo continua em
`docs/IPAD_DIRECT_GUIDE.md` — cobre exatamente as mesmas operações que
"Preparar Cyborg" automatiza, uma por vez.

## O que o app nunca vai fazer (por design, e isso é esperado)

Nenhum botão, comando de voz ou atalho futuro envia ordem, abre posição,
conecta em corretora ou guarda segredo. O card **DecisionFrame** existe
só para deixar isso explícito — está rotulado `STUB CONTROLLED` de
propósito. Os badges `READ_ONLY` / `FAIL_CLOSED` /
`Execution Lock: ACTIVE` / `Private Keys: DISABLED` /
`Live Trading: BLOCKED` ficam visíveis o tempo todo.

## Se algo aparecer como `FAIL_CLOSED` (estado vermelho do avatar)

Significa uma falha real de integridade — por exemplo, o checksum do
pacote local não bateu, ou a gravação no Safari Storage falhou. Não é um
bug visual: é o comportamento correto de segurança. Toque em **Limpar/
Reinstalar** e repita a partir do passo 2 deste guia.
