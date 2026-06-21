# Local Soldier — host Windows (NOT_DEPLOYED)

Codinome interno: `AR10_CYBORG_LOCAL_SOLDIER_WINDOWS_SCAFFOLD_V1`.

**Status: `NOT_DEPLOYED`.** Subpasta de [`../`](../README.md) (o contrato
genérico Commander↔Soldier) específica para o host mais provável de um
Local Soldier real: um PC Windows que o próprio usuário já possui. Mesmas
garantias do scaffold pai: sem `package.json`, sem build, sem import por
`ipad_runtime/`, sem presença em `.github/workflows/deploy-ipad-pwa.yml`.

## Por que Windows

`ipad_runtime/README.md` já declara que o PWA não depende de Mac Mini,
MacBook, servidor local ou terminal como fluxo principal — o iPad é
autossuficiente. Mas o card Commander/Soldier
(`ipad_runtime/js/core/commander-soldier.js`) relata honestamente que um
Soldier headless 24/7 não existe. Se um dia existir, o host mais realista
é um Windows local do próprio usuário (sem custo de cloud novo, sem
depender de infraestrutura de terceiros). Este scaffold registra esse
contrato agora, sem implementá-lo.

## Conteúdo

```
windows/
├── README.md   este arquivo
└── types.ts    WindowsHostMode, WindowsServiceManifest,
                 WindowsLocalSecretPolicy, WindowsSoldierStatusReport
```

`types.ts` estende `../src/types.ts` (nunca duplica `SoldierStatusReport`
ou `RiskGateConfig` — importa e compõe).

## O que falta para isto deixar de ser scaffold (Tier 3 — não iniciado)

Em adição aos 5 itens já listados em [`../README.md`](../README.md):

1. Decidir `WindowsHostMode` de fato (processo em foreground vs. Windows
   Service vs. tarefa agendada) — hoje os três são só enum, nenhum
   escolhido.
2. Implementar o instalador real do serviço (`sc.exe create` ou NSSM) —
   hoje `WindowsServiceManifest` é só a forma dos campos que esse passo
   exigiria, com `executable_path_placeholder`/`log_dir_placeholder`
   literalmente nomeados como placeholder.
3. Decidir armazenamento de credencial real via
   `WindowsLocalSecretPolicy` (`WINDOWS_CREDENTIAL_MANAGER` é a opção mais
   segura nativa do SO) — só relevante quando/se um conector exigir chave,
   o que não é o caso de nenhum conector ativo hoje
   (`ipad_runtime/js/real-data/registry.js`).
4. Todos os pré-requisitos de transporte/autenticação do Sync Bridge já
   listados no README pai — um host Windows não resolve isso por si só.

Nenhum destes itens está implementado. Nenhuma rota de execução real,
ordem ou credencial existe neste código.
