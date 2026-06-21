// index.ts — Esqueleto de entrypoint do Soldier Headless 24/7.
// NOT_DEPLOYED: não há package.json, tsconfig.json ou passo de build nesta
// pasta. Nada aqui é importado por ipad_runtime/ (Commander) nem por
// nenhum workflow de CI/deploy deste repositório. Rodar este arquivo
// diretamente (ex.: `ts-node index.ts`) é tecnicamente possível, mas main()
// recusa de propósito — ver corpo da função abaixo.
//
// Quando um Soldier real for implementado, este arquivo deixa de ser um
// esqueleto: ganha um host real (Node/Deno), um transporte real para o
// Sync Bridge, e conexões reais a conectores — tudo isso hoje ausente de
// propósito. Ver README.md desta pasta para a lista completa de
// pré-requisitos (Tier 3, não iniciado).

import type { SoldierStatusReport, SyncBridgeCommand, SyncBridgeMessage } from './types.js';

export const SOLDIER_RUNTIME_STATUS = 'NOT_DEPLOYED' as const;

/**
 * Construiria o heartbeat inicial de um Soldier real. Hoje só documenta a
 * forma do retorno — nunca é chamada por main(), porque main() nunca roda.
 */
export function buildBootStatusReport(): SoldierStatusReport {
    return {
        soldier_id: 'SOLDIER_NOT_DEPLOYED',
        status: 'STOPPED',
        version: '0.0.0-scaffold',
        uptime_seconds: 0,
        last_heartbeat_at: new Date().toISOString(),
        connected_connectors: [],
        risk_gate_config: {
            kill_switch_engaged: true,
            max_drawdown_pct: 0,
            max_position_size_quote: 0,
            require_stop_loss: true,
            min_source_data_quality: 'DADOS_INSUFICIENTES',
        },
    };
}

/**
 * Receberia comandos do Commander pelo Sync Bridge real. Hoje só documenta
 * a assinatura — nunca é registrada em nenhum transporte real.
 */
export function handleCommand(_command: SyncBridgeCommand): SyncBridgeMessage {
    throw new Error('SOLDIER_NOT_DEPLOYED: nenhum transporte real do Sync Bridge existe ainda.');
}

/**
 * Ponto de entrada nominal. Recusa de propósito — este scaffold nunca deve
 * rodar como processo real por engano (ex.: alguém executando `ts-node`
 * manualmente sem ler o README). Implantar o Soldier de verdade significa
 * substituir este corpo por um host real, não remover a recusa sem
 * substituí-la por algo real.
 */
export function main(): never {
    throw new Error(
        'SOLDIER_NOT_DEPLOYED: este é um scaffold de contrato (soldier_runtime/), não um processo real. ' +
            'Ver soldier_runtime/README.md.',
    );
}
