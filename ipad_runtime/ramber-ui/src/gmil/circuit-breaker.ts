// circuit-breaker.ts — GMIL LEI 06 (Fail Safe): um provedor degradado nunca
// derruba o sistema. Máquina de estados PURA (sem setTimeout/fetch aqui —
// quem chama decide QUANDO tentar; este módulo só decide SE deve permitir).
//
// CLOSED  → operação normal, toda tentativa permitida.
// OPEN    → provedor falhou demais; tentativas bloqueadas até o cooldown.
// HALF_OPEN → cooldown passou; UMA tentativa de sonda é permitida. Sucesso
//             fecha o circuito de volta; falha reabre imediatamente (sem
//             precisar acumular o threshold de novo — o provedor já provou
//             instabilidade recente).

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerState {
  state: CircuitState;
  consecutiveFailures: number;
  openedAt: number | null;
}

const FAILURE_THRESHOLD = 3;
const COOLDOWN_MS = 30_000;

export function createCircuitBreaker(): CircuitBreakerState {
  return { state: 'CLOSED', consecutiveFailures: 0, openedAt: null };
}

/** Chamar antes de cada tentativa real. `state` retornado já reflete a
 *  transição OPEN→HALF_OPEN quando o cooldown expirou — persista-o. */
export function beforeAttempt(
  cb: CircuitBreakerState,
  now: number,
): { allowed: boolean; state: CircuitBreakerState } {
  if (cb.state === 'CLOSED') return { allowed: true, state: cb };
  if (cb.state === 'HALF_OPEN') return { allowed: true, state: cb };
  // OPEN
  if (cb.openedAt !== null && now - cb.openedAt >= COOLDOWN_MS) {
    return { allowed: true, state: { ...cb, state: 'HALF_OPEN' } };
  }
  return { allowed: false, state: cb };
}

export function afterSuccess(_cb: CircuitBreakerState): CircuitBreakerState {
  return createCircuitBreaker();
}

export function afterFailure(cb: CircuitBreakerState, now: number): CircuitBreakerState {
  const consecutiveFailures = cb.consecutiveFailures + 1;
  // Uma falha durante a sonda HALF_OPEN reabre na hora — não espera o
  // threshold de novo, o provedor acabou de provar que ainda está instável.
  if (cb.state === 'HALF_OPEN' || consecutiveFailures >= FAILURE_THRESHOLD) {
    return { state: 'OPEN', consecutiveFailures, openedAt: now };
  }
  return { ...cb, consecutiveFailures };
}
