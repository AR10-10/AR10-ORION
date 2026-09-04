// alert-voice-wiring.test.ts — achado da auditoria de evolução (voz
// contínua, pedido direto do Operador): voice-dispatcher.ts já narra
// eventos institucionais proativamente, mas nunca lia de nexus/
// alert-center.ts — o Sweep (deriveSweepAlert) era só toast, nunca falado.
// Source-level wiring lock, mesma disciplina de ciborgue-vivo-wiring.test.ts
// (fiação entre módulos, o bug mais provável é "esqueceram de conectar A
// com B", não "a matemática está errada").
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');

describe('App.tsx: assinatura de BRAIN.TRAPS.UPDATED fala alert.speech quando presente', () => {
  it('chama voiceEngine.speak(alert.speech, "ALERT") dentro do MESMO handler que já faz setAlerts', () => {
    const app = read('../src/App.tsx');
    const idx = app.indexOf('core.bus.on("BRAIN.TRAPS.UPDATED"');
    expect(idx, 'assinatura de BRAIN.TRAPS.UPDATED não encontrada').toBeGreaterThan(-1);
    const end = app.indexOf('}, []);', idx);
    const handler = app.slice(idx, end);
    expect(handler).toContain('if (alert.speech) voiceEngine.speak(alert.speech, "ALERT");');
    // A fala vem DEPOIS do toast (setAlerts) no mesmo handler — nunca um
    // segundo useEffect/assinatura separada pro mesmo evento real.
    expect(handler.indexOf('setAlerts')).toBeLessThan(handler.indexOf('voiceEngine.speak'));
  });
});

describe('alert-center.ts: AlertEvent.speech é campo consumidor-agnóstico (nunca importa voice/)', () => {
  it('nexus/alert-center.ts não importa nada de voice/ — speech é só um campo de string opcional', () => {
    const src = read('../src/nexus/alert-center.ts');
    expect(src).not.toMatch(/from ["']\.\.\/voice/);
    expect(src).toContain('speech?: string;');
  });
});
