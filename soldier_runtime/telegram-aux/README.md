# Telegram AUX/Quarantine (NOT_CONNECTED)

Codinome interno: `AR10_CYBORG_TELEGRAM_AUX_SCAFFOLD_V1`.

**Status: `NOT_CONNECTED`.** Mesmas garantias dos demais scaffolds desta
pasta: sem `package.json`, sem build, sem import por `ipad_runtime/`, sem
presença em `.github/workflows/deploy-ipad-pwa.yml`. Varredura confirmada:
zero ocorrências de "telegram" em qualquer arquivo de `ipad_runtime/` hoje.

## O que isto é (e o que isto nunca pode ser)

Um contrato para notificação de saída (outbound-only): o app poderia um dia
*avisar* um chat do Telegram sobre eventos (ex.: kill-switch acionado,
fonte de dado degradada) — puramente informativo, para o usuário ver no
celular sem abrir o app.

Isto nunca pode ser um canal de comando. A garantia não é uma promessa em
texto — é estrutural em `types.ts`:

- Não existe nenhum tipo "comando recebido do Telegram" no arquivo. Só
  existe `TelegramAuxMessage`, com `direction` fixado no literal
  `'OUTBOUND_ONLY'`.
- `TelegramAuxQuarantinePolicy` fixa quatro literais `false` —
  `accepts_inbound_commands`, `can_engage_or_disengage_kill_switch`,
  `can_submit_orders`, `treated_as_signal_source` — não são booleanos que
  uma implementação futura poderia setar `true` por engano; são o próprio
  tipo negando o uso perigoso.

Quem quiser um dia aceitar comando vindo do Telegram precisa editar este
arquivo de propósito, criando um tipo novo num diff revisável — nunca por
acidente ou por reuso de um tipo existente.

## Credencial

`TelegramAuxSecretPolicy` espelha `WindowsLocalSecretPolicy`
(`../windows/types.ts`): bot token nunca no frontend, nunca no repositório,
nunca no storage do PWA. Hoje irrelevante porque não há bot configurado.

## Conteúdo

```
telegram-aux/
├── README.md   este arquivo
└── types.ts    TelegramAuxSecretPolicy, TelegramAuxStatus, TelegramAuxConfig,
                 TelegramAuxMessage, TelegramAuxQuarantinePolicy
```

## O que falta para isto deixar de ser scaffold (Tier 3 — não iniciado)

Em adição aos 5 itens já listados em [`../README.md`](../README.md):

1. Criar o bot no Telegram (BotFather) e decidir o `chat_id` real — hoje
   `chat_id_placeholder` é literalmente nomeado como placeholder.
2. Implementar o armazenamento real do token via `TelegramAuxSecretPolicy`
   — hoje só a forma existe, nenhum token foi gerado ou guardado.
3. Implementar o transporte HTTP real para a API do Telegram (exigiria
   adicionar `api.telegram.org` à CSP `connect-src` de
   `ipad_runtime/index.html` — mesma disciplina de diff explícito descrita
   em `../domain-tunnel/README.md`).
4. Decidir quais eventos reais disparam notificação (provavelmente um
   subconjunto de `ipad_runtime/js/core/event-bus.js`) — hoje nenhum evento
   está mapeado.

Nenhum destes itens está implementado. Nenhum bot, token ou mensagem real
existe neste código.
