#!/usr/bin/env node
// setup-local.mjs — prepara o AR10 CYBORG para rodar NA MÁQUINA DO OPERADOR.
//
// POR QUE RODAR LOCAL RESOLVE DOIS PROBLEMAS DE UMA VEZ:
//
//   1. PRIVACIDADE. Rodando em `localhost`, o painel não está publicado em
//      lugar nenhum. Não existe URL para alguém abrir, não existe site para
//      indexar.
//
//   2. DADO REAL. O sandbox de desenvolvimento deste projeto não tem egress
//      para exchange (HTTP 000 em Binance/Bybit/MEXC, medido). A máquina do
//      Operador tem internet normal, então as chamadas públicas de mercado
//      funcionam — inclusive o executor de backtest, que é a única forma
//      honesta de obter uma taxa de acerto real.
//
// O QUE ESTE SCRIPT FAZ: confere a versão do Node, confere as dependências e
// diz os próximos passos. Não instala nada sozinho e não escreve nenhum
// arquivo — a etapa que gravava um `.env.local` com a senha do portão foi
// removida (ordem "remover password gate temporário", 2026-09-07): o portão
// em si saiu do caminho crítico (ver ipad_runtime/ramber-ui/src/main.tsx),
// então não existe mais segredo nenhum para preparar aqui.
//
// READ_ONLY, como todo o resto: nenhuma chave de exchange, nunca.

import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const UI = resolve(AQUI, '../ramber-ui');
const NODE_MINIMO = 20;

const cor = {
  ok: (t) => `\x1b[32m${t}\x1b[0m`,
  erro: (t) => `\x1b[31m${t}\x1b[0m`,
  aviso: (t) => `\x1b[33m${t}\x1b[0m`,
  forte: (t) => `\x1b[1m${t}\x1b[0m`,
  fraco: (t) => `\x1b[2m${t}\x1b[0m`,
};

function morrer(msg, detalhe) {
  console.error(`\n  ${cor.erro('PAROU AQUI')} — ${msg}`);
  if (detalhe) console.error(`  ${detalhe}`);
  console.error('');
  process.exit(1);
}

console.log(`\n  ${cor.forte('AR10 CYBORG')} — preparar para rodar nesta máquina\n`);

// ── 1. Node ────────────────────────────────────────────────────────────────
const maior = Number(process.versions.node.split('.')[0]);
if (!Number.isFinite(maior) || maior < NODE_MINIMO) {
  morrer(
    `Node ${process.versions.node} é antigo demais (mínimo ${NODE_MINIMO}).`,
    'Baixe a versão LTS em https://nodejs.org e rode este script de novo.',
  );
}
console.log(`  ${cor.ok('✓')} Node ${process.versions.node}`);

// ── 2. Dependências ────────────────────────────────────────────────────────
const temNodeModules = existsSync(resolve(UI, 'node_modules'));
console.log(
  temNodeModules
    ? `  ${cor.ok('✓')} dependências já instaladas`
    : `  ${cor.aviso('!')} dependências ainda não instaladas`,
);

// ── 3. Próximos passos ─────────────────────────────────────────────────────
console.log(`
  ${cor.forte('PRÓXIMOS PASSOS')}

  ${cor.fraco('Entre na pasta da interface:')}
    cd ipad_runtime/ramber-ui
${temNodeModules ? '' : `
  ${cor.fraco('Instale as dependências (uma vez só, demora alguns minutos):')}
    npm ci
`}
  ${cor.fraco('Ligue o painel:')}
    npm run dev

  Abra o endereço que aparecer (algo como ${cor.forte('http://localhost:5173')}).
  O painel abre direto — sem senha.

  ${cor.forte('TAXA DE ACERTO REAL')} ${cor.fraco('(precisa de internet — esta máquina tem)')}

    node ipad_runtime/tools/run-backtest.mjs --symbol BTCUSDT --timeframe 15m --candles 5000

  Ele só lê klines públicas: sem chave de API, sem ordem, nunca.

  ${cor.forte('PRIVACIDADE')}

  Rodando assim, o painel existe ${cor.forte('só nesta máquina')}. Não há URL pública,
  nada publicado, nada para alguém abrir. Para outra pessoa usar, ela precisa
  do computador — que é o controle de acesso mais forte que existe.
`);
