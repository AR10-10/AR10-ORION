// types.ts — Contrato de tipos do host Windows do Local Soldier.
// NOT_DEPLOYED: este arquivo não é compilado, importado ou executado por
// nenhum runtime real neste repositório. Estende ../src/types.ts (o
// contrato genérico Commander<->Soldier) só com o que é específico de um
// host Windows local — nunca duplica os tipos genéricos.
//
// Por que Windows especificamente: ipad_runtime/README.md já declara que o
// PWA não depende de Mac Mini, MacBook, servidor local ou terminal como
// fluxo principal. Um "Local Soldier" headless 24/7 (ver
// ../README.md) precisa rodar em algum host real fora do iPad — Windows é
// o host mais provável para o usuário deste projeto (PC local já existente,
// sem custo de cloud novo). Este contrato assume esse host específico sem
// assumir nenhum transporte, credencial ou execução real ainda.

import type { SoldierStatusReport, RiskGateConfig } from '../src/types.js';

/** Como o processo Windows real seria hospedado — só o contrato, nenhuma
 *  das opções abaixo está implementada ou escolhida definitivamente. */
export type WindowsHostMode = 'FOREGROUND_PROCESS' | 'WINDOWS_SERVICE' | 'SCHEDULED_TASK';

/**
 * Descreve como o Local Soldier se registraria no Windows, se um dia for
 * implementado. Espelha os campos que `sc.exe create` / NSSM exigiriam,
 * para que a decisão de packaging não precise ser inventada na hora — mas
 * nenhum destes valores corresponde a um serviço real instalado hoje.
 */
export interface WindowsServiceManifest {
    service_name: string;
    display_name: string;
    description: string;
    host_mode: WindowsHostMode;
    start_type: 'MANUAL' | 'AUTOMATIC_DELAYED';
    executable_path_placeholder: string;
    log_dir_placeholder: string;
    requires_admin_install: boolean;
}

/**
 * Política de onde o host Windows pode guardar segredo/credencial real,
 * caso algum conector exija autenticação no futuro. Hoje nenhum conector
 * ativo (ver ipad_runtime/js/real-data/registry.js) exige chave — isto é
 * só o contrato para quando/se isso mudar, com aprovação humana explícita.
 */
export interface WindowsLocalSecretPolicy {
    storage: 'WINDOWS_CREDENTIAL_MANAGER' | 'ENV_FILE_LOCAL_ONLY';
    never_in_frontend: true;
    never_in_repo: true;
    never_in_pwa_storage: true;
}

/** Heartbeat específico do host Windows — estende o genérico do Soldier
 *  (../src/types.ts) só com metadados de SO, sem redefinir os campos
 *  que já existem lá. */
export interface WindowsSoldierStatusReport {
    base: SoldierStatusReport;
    os_version: string;
    host_mode: WindowsHostMode;
    service_manifest: WindowsServiceManifest;
    risk_gate_config: RiskGateConfig;
}

/** Status declarado deste scaffold — nunca lido por nenhum runtime real. */
export const WINDOWS_SOLDIER_STATUS = 'NOT_DEPLOYED' as const;
