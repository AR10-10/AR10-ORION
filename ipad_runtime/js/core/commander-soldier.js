// commander-soldier.js — status honesto da arquitetura Commander/Soldier.
// Commander = este PWA/iPad (sempre ONLINE enquanto a aba estiver aberta).
// Soldier = processo headless 24/7 fora do navegador — ainda NOT_DEPLOYED
// nesta versão; existe só como scaffold de tipos em soldier_runtime/ (nunca
// instalado, nunca executado, nunca parte do build deste PWA). Sync Bridge =
// canal de eventos/estado/comandos entre os dois — NOT_CONNECTED porque não
// há Soldier real para conectar. Ver soldier_runtime/README.md.

export function getCommanderSoldierStatus() {
    return {
        commander: {
            status: 'ONLINE',
            detail: 'Este PWA/iPad é o Commander — única parte realmente em execução nesta versão.',
        },
        soldier: {
            status: 'NOT_DEPLOYED',
            detail: 'Soldier Headless 24/7 ainda não existe como processo real. Scaffold de contrato (tipos/interfaces) vive em soldier_runtime/, nunca instalado nem executado.',
        },
        sync_bridge: {
            status: 'NOT_CONNECTED',
            detail: 'Sem Soldier real, não há o que sincronizar. Quando existir, o contrato de evento já está desenhado em soldier_runtime/src/types.ts.',
        },
        event_ledger_source_of_truth: 'js/memory/event-log.js (Commander) — será o consumidor do mesmo contrato quando o Soldier existir.',
        siriform_summary: 'Commander (este iPad) está ONLINE. Soldier 24/7 ainda não foi implantado — arquitetura preparada, não ativa.',
    };
}
