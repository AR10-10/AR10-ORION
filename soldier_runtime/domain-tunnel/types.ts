// types.ts — Contrato de tipos do Domain Tunnel Layer.
// NOT_ACTIVE: este arquivo não é compilado, importado ou executado por
// nenhum runtime real neste repositório. Nenhum túnel existe hoje — o iPad
// fala diretamente com os endpoints públicos já declarados na CSP de
// ipad_runtime/index.html (connect-src: api.coingecko.com, api.binance.com,
// api.mexc.com). Este contrato só registra a forma que uma camada de túnel
// teria SE um dia o Commander precisasse alcançar um Local Soldier (ver
// ../README.md) por um domínio próprio em vez de IP/porta direto — sem
// implementar, escolher provedor ou ativar nada agora.
//
// Por que isto importa para a CSP: qualquer túnel real exigiria adicionar o
// domínio dele a connect-src de ipad_runtime/index.html. Essa edição NUNCA
// deve ser silenciosa — precisa ser um diff revisável e intencional, nunca
// um efeito colateral de ligar o túnel. Este contrato existe para que essa
// decisão, quando vier, tenha um formato pronto em vez de inventado na hora.

import type { RiskGateConfig } from '../src/types.js';

/**
 * Provedor de túnel candidato — só os nomes, nenhum SDK, conta ou
 * configuração real associada a nenhum deles ainda.
 */
export type TunnelProvider = 'CLOUDFLARE_TUNNEL' | 'TAILSCALE' | 'NGROK' | 'CUSTOM_REVERSE_PROXY';

/**
 * Estado do túnel — hoje sempre seria 'NOT_CONFIGURED' em qualquer leitura
 * real, porque nenhum túnel foi configurado. Os outros valores existem só
 * para o contrato ser completo, não porque algum código os produz.
 */
export type TunnelStatus = 'NOT_CONFIGURED' | 'CONFIGURED_INACTIVE' | 'ACTIVE' | 'DEGRADED' | 'ERROR';

/**
 * Forma da configuração de túnel, se um dia existir. `domain` e
 * `csp_connect_src_entry` são deliberadamente o mesmo conceito repetido em
 * dois campos: o segundo documenta explicitamente que ativar isto exige
 * editar a CSP de ipad_runtime/index.html — nunca é automático.
 */
export interface TunnelConfig {
    provider: TunnelProvider;
    domain_placeholder: string;
    csp_connect_src_entry_placeholder: string;
    requires_explicit_csp_edit: true;
    requires_human_approval: true;
    status: TunnelStatus;
}

/**
 * Checagem de saúde do túnel, espelhando o padrão de
 * ipad_runtime/js/real-data/source-health.js (status declarado, nunca
 * inferido por heurística) — mas para o transporte, não para a fonte de
 * dados.
 */
export interface TunnelHealthCheck {
    checked_at: string; // ISO 8601
    status: TunnelStatus;
    latency_ms: number | null;
    last_error: string | null;
}

/**
 * Decisão completa que um humano precisaria aprovar explicitamente antes de
 * qualquer túnel real existir — agrupa config + o gate de risco já em vigor
 * no Soldier (../src/types.ts), para que ativar túnel nunca seja decisão
 * isolada da postura de risco geral.
 */
export interface DomainTunnelActivationProposal {
    config: TunnelConfig;
    risk_gate_config: RiskGateConfig;
    approved_by_human: boolean;
    approved_at: string | null; // ISO 8601, null enquanto approved_by_human === false
}

/** Status declarado deste scaffold — nunca lido por nenhum runtime real. */
export const DOMAIN_TUNNEL_STATUS = 'NOT_ACTIVE' as const;
