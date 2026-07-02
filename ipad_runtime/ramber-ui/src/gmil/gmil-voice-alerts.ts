// gmil-voice-alerts.ts — GMIL LEI 08 (Voice Intelligence): texto de alerta
// falado para transições reais de saúde de provedor ("Perda de provider").
// Função PURA — quem chama (App.tsx, assinando gmilBus) decide se/quando
// repassar ao voiceEngine.speak(). Mantém a camada de voz existente
// (voice-dispatcher.ts) intocada: aquela já cobre os eventos do Core
// Engine/order flow/liquidações; esta cobre especificamente os eventos do
// GMIL, sem fundir os dois domínios num único tipo.
import type { CircuitState } from './circuit-breaker';

export function describeProviderHealthChange(
  label: string,
  from: CircuitState,
  to: CircuitState,
): string | null {
  if (to === 'OPEN' && from !== 'OPEN') {
    return `Perda de provedor de contexto: ${label} indisponível.`;
  }
  if (from === 'OPEN' && to !== 'OPEN') {
    return `Provedor de contexto recuperado: ${label}.`;
  }
  return null;
}
