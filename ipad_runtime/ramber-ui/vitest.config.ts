import { defineConfig } from 'vitest/config';

// Suite de testes permanente e versionada (Caminho 3 — "Robustez", a
// alavanca mais citada nas 3 auditorias desta sessão). Config TOTALMENTE
// separada de vite.config.ts de propósito: `vitest` roda só via
// `npm run test`, nunca via `npm run build` — nada aqui influencia o
// bundle de produção, e vite.config.ts não precisa saber que testes
// existem. Os arquivos em tests/*.test.ts importam os módulos reais dos
// motores pelos mesmos caminhos relativos que engine-bridge.ts já usa —
// nunca uma cópia, nunca um mock do motor.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
