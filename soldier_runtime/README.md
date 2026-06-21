# Soldier Runtime — scaffold de contrato (NOT_DEPLOYED)

Codinome interno: `AR10_CYBORG_SOLDIER_RUNTIME_SCAFFOLD_V1`.

**Status: `NOT_DEPLOYED`.** Este diretório não é instalado, não é
executado, não tem `package.json`, não tem passo de build, e não é
referenciado por nenhum import de `ipad_runtime/`. Não existe em
`.github/workflows/deploy-ipad-pwa.yml`, que só publica `ipad_runtime/` no
GitHub Pages — então nada aqui chega ao link live por nenhuma rota,
acidental ou intencional. É puramente um **contrato de tipos**, escrito
agora para que, quando um Soldier real existir, ele implemente este
contrato em vez de um desenhado às pressas naquele momento.

## Por que isso existe

O painel do AR10 Cyborg 1.0 PRO (`ipad_runtime/js/core/commander-soldier.js`)
já relata honestamente três coisas:

- **Commander** = o próprio PWA/iPad, `ONLINE` enquanto a aba estiver aberta.
- **Soldier** = processo headless 24/7 fora do navegador. `NOT_DEPLOYED`.
- **Sync Bridge** = canal entre os dois. `NOT_CONNECTED`, porque não há
  Soldier real para conectar.

Esse relatório seria uma promessa vazia se não houvesse nada concreto por
trás do nome "Soldier" — qualquer pessoa lendo o código poderia perguntar
"esse contrato existe ou é só um nome no card?". Este scaffold responde:
existe, é real, está em `src/types.ts`, e é modelado diretamente sobre o
que o Commander já faz internamente (não é um design especulativo
desconectado do código vivo):

- `SyncEvent` espelha exatamente o formato de evento de
  `ipad_runtime/js/core/event-bus.js` (`emit()`), com `source` estendido
  para incluir `SOLDIER` — o `event-bus.js` real do Commander
  deliberadamente **não** inclui `SOLDIER` no seu enum `SOURCE`, porque
  nenhum processo Soldier real existe nesta versão para emitir nada. Este
  contrato é o lugar certo para esse terceiro valor existir primeiro.
- `StateSnapshot` espelha `ipad_runtime/js/memory/snapshot-manager.js`.
- `RecoveryReport` espelha `ipad_runtime/js/memory/recovery-report.js`.
- `RiskGateConfig`/`RiskGateDecision` espelham
  `ipad_runtime/js/trading/risk-gate.js`.
- `SoldierStatusReport` e `SyncBridgeCommand` são os dois tipos
  genuinamente novos deste scaffold — o heartbeat que um Soldier real
  enviaria, e os comandos que o Commander poderia emitir de volta (pedir
  status, pedir snapshot, acionar/desacionar kill switch).

Quando o Soldier real for implementado, ele deve consumir/produzir essas
formas — assim o Sync Bridge não precisa de tradução ad hoc entre "o que o
Commander já entende" e "o que o Soldier inventou sozinho".

## Conteúdo

```
soldier_runtime/
├── README.md             este arquivo
├── src/
│   ├── types.ts          contrato de tipos (Event/Command/StateSync/Status) — só tipos, zero lógica
│   └── index.ts           esqueleto de entrypoint — NOT_DEPLOYED, nunca importado, nunca executado
├── windows/               host Windows do Local Soldier (NOT_DEPLOYED) — ver windows/README.md
├── domain-tunnel/         Domain Tunnel Layer entre Commander e Soldier (NOT_ACTIVE) — ver domain-tunnel/README.md
├── safari-edge-layer/     hints de contexto não-autoritativos via Safari (NOT_WIRED) — ver safari-edge-layer/README.md
└── telegram-aux/          notificação outbound-only no Telegram (NOT_CONNECTED) — ver telegram-aux/README.md
```

Nenhum arquivo `.ts` de nenhuma destas subpastas é compilado, testado ou
executado neste repositório hoje. Não há `tsconfig.json` em nenhuma delas
de propósito — adicionar um seria sinalizar "isto faz parte do build", o
que ainda não é verdade. Todas seguem a mesma garantia desta pasta: sem
`package.json`, sem build, sem import por `ipad_runtime/`, sem presença em
`.github/workflows/deploy-ipad-pwa.yml`.

## O que falta para isto deixar de ser scaffold (Tier 3 — não iniciado)

Implantar um Soldier real exigiria, no mínimo:

1. Um processo host real fora do navegador (Node/Deno/etc.), supervisionado
   (restart automático, logs persistentes, não um script solto).
2. Um transporte real para o Sync Bridge (ex.: WebSocket ou SSE com
   autenticação) — hoje não existe nenhum servidor para conectar; o
   `connect-src` do CSP do PWA (`ipad_runtime/index.html`) também precisaria
   ser revisto deliberadamente para permitir esse host específico, em vez
   de continuar restrito a hosts públicos somente-leitura.
3. Autenticação/autorização desse canal (o Commander não deve aceitar
   comando de qualquer processo que apareça na rede alegando ser o Soldier).
4. Política de onde o Soldier guarda qualquer credencial real — nunca no
   frontend, nunca em `localStorage`/IndexedDB do PWA (ver
   `ipad_runtime/js/trading/live-status.js` para os motivos estruturais
   atuais do bloqueio de Live Trading).
5. Decisão explícita e documentada de quando/se Live Trading deixa de ser
   `LIVE_LOCKED` — isto nunca deve acontecer como efeito colateral de
   implantar o Soldier; é uma decisão separada, com aprovação humana
   explícita, conforme `ipad_runtime/js/trading/live-status.js`.

Nenhum destes cinco itens está implementado. Este scaffold só garante que,
quando chegar a hora, o ponto de partida é um contrato pensado — não uma
folha em branco.
