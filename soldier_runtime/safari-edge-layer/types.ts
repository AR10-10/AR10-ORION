// types.ts — Contrato de tipos do Safari Assisted Edge Layer.
// NOT_WIRED: este arquivo não é compilado, importado ou executado por
// nenhum runtime real neste repositório. Nenhuma "edge layer" existe hoje —
// o iPad (Commander) só lê os conectores públicos já cadastrados em
// ipad_runtime/js/real-data/registry.js. Este contrato descreve a forma de
// um auxiliar opcional baseado em mecanismos nativos do Safari/iPadOS (Share
// Sheet, colar do clipboard, nota manual) que o usuário poderia trazer PARA
// dentro do app como contexto extra — nunca como dado de mercado, nunca como
// sinal, nunca como algo que o risk-gate ou qualquer execução leem.
//
// "Non-authoritative" não é um adjetivo solto aqui: CONTEXT_ONLY já existe
// como data_mode real em ipad_runtime/js/core/data-mode-labels.js
// ("SÓ CONTEXTO — NÃO É SINAL DE MERCADO"). Qualquer EdgeHint real
// implementado a partir deste contrato precisa usar exatamente esse modo —
// nunca REAL, PAPER, SIM, REPLAY ou SYNTHETIC.

/**
 * Mecanismo nativo do Safari/iPadOS pelo qual um EdgeHint chegaria ao app.
 * Todos são ações explícitas do usuário (compartilhar, colar, digitar) —
 * nenhuma leitura automática de outra aba, histórico ou clipboard sem gesto
 * do usuário é um valor válido aqui, porque isso nem é possível dentro do
 * sandbox de um PWA no Safari, e não seria desejável mesmo que fosse.
 */
export type EdgeHintSource =
    | 'SAFARI_SHARE_SHEET_TEXT'
    | 'SAFARI_CLIPBOARD_PASTE_EXPLICIT'
    | 'MANUAL_USER_NOTE';

/**
 * Um hint de contexto único. `authoritative` é fixado em `false` no tipo —
 * não é um campo que algum código possa setar `true` por engano — e
 * `data_mode` é fixado em `'CONTEXT_ONLY'` pelo mesmo motivo: o próprio tipo
 * impede que isto seja confundido com dado real.
 */
export interface EdgeHint {
    hint_id: string;
    source: EdgeHintSource;
    text: string;
    captured_at: string; // ISO 8601
    authoritative: false;
    data_mode: 'CONTEXT_ONLY';
}

/**
 * Política que qualquer implementação real precisaria respeitar. Os quatro
 * campos são todos `true`/`false` fixos no tipo (não booleanos livres) —
 * o contrato em si já nega os usos perigosos, em vez de depender de uma
 * implementação futura "lembrar" de negá-los.
 */
export interface EdgeHintAdvisoryPolicy {
    never_feeds_risk_gate: true;
    never_feeds_order_execution: true;
    never_elevates_data_mode: true;
    never_shown_as_market_signal: true;
}

/** Status declarado deste scaffold — nunca lido por nenhum runtime real. */
export const SAFARI_EDGE_LAYER_STATUS = 'NOT_WIRED' as const;
