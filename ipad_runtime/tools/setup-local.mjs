#!/usr/bin/env node
// setup-local.mjs — prepara o AR10 CYBORG para rodar NA MÁQUINA DO OPERADOR.
//
// POR QUE RODAR LOCAL RESOLVE DOIS PROBLEMAS DE UMA VEZ:
//
//   1. PRIVACIDADE. Rodando em `localhost`, o painel não está publicado em
//      lugar nenhum. Não existe URL para alguém abrir, não existe site para
//      indexar. É mais privado do que qualquer hospedagem com senha — e
//      torna Cloudflare Access opcional, não obrigatório.
//
//   2. DADO REAL. O sandbox de desenvolvimento deste projeto não tem egress
//      para exchange (HTTP 000 em Binance/Bybit/MEXC, medido). A máquina do
//      Operador tem internet normal, então as chamadas públicas de mercado
//      funcionam — inclusive o executor de backtest, que é a única forma
//      honesta de obter uma taxa de acerto real.
//
// O QUE ESTE SCRIPT FAZ: confere a versão do Node, gera o `.env.local` com o
// hash da senha do portão (o app é fail-closed sem ele) e diz os próximos
// passos. Não instala nada sozinho e não toca em nada fora de `.env.local`.
//
// READ_ONLY, como todo o resto: nenhuma chave de exchange, nunca.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const UI = resolve(AQUI, '../ramber-ui');
const ENV_LOCAL = resolve(UI, '.env.local');
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

// ── 2. Senha do portão ─────────────────────────────────────────────────────
// Rodando em localhost o portão não protege de ninguém (não há outra pessoa
// que alcance a sua máquina). Ele existe aqui só porque o app é fail-closed:
// sem hash configurado ele não abre. Por isso o script aceita uma senha e
// gera o hash — nunca grava a senha em lugar nenhum.
const senha = process.argv[2];
if (!senha || senha === '--help' || senha === '-h') {
  console.log(`
  ${cor.forte('Uso:')}  node ipad_runtime/tools/setup-local.mjs "sua-senha-aqui"

  A senha é a do portão do painel. Rodando local ela não protege de mais
  ninguém — o app só exige uma porque é ${cor.forte('fail-closed')} por decisão de
  projeto (sem hash configurado, ele não abre).

  ${cor.fraco('A senha em si NUNCA é gravada: só o SHA-256 dela vai para .env.local,')}
  ${cor.fraco('e .env.local está no .gitignore.')}
`);
  process.exit(senha ? 0 : 1);
}

if (senha.length < 4) morrer('senha curta demais (mínimo 4 caracteres).');

const hash = createHash('sha256').update(senha, 'utf8').digest('hex');

if (existsSync(ENV_LOCAL)) {
  const atual = readFileSync(ENV_LOCAL, 'utf8');
  if (atual.includes(hash)) {
    console.log(`  ${cor.ok('✓')} .env.local já tem exatamente esta senha`);
  } else {
    // Nunca sobrescreve em silêncio: um .env.local existente pode ter outras
    // variáveis que o Operador colocou à mão.
    console.log(`  ${cor.aviso('!')} .env.local já existe com OUTRO conteúdo — substituindo só a linha do hash`);
    const semHash = atual
      .split('\n')
      .filter((l) => !l.trim().startsWith('VITE_ACCESS_HASH='))
      .join('\n')
      .replace(/\n+$/, '');
    writeFileSync(ENV_LOCAL, `${semHash}\nVITE_ACCESS_HASH=${hash}\n`, 'utf8');
    console.log(`  ${cor.ok('✓')} hash da senha atualizado`);
  }
} else {
  writeFileSync(
    ENV_LOCAL,
    `# Gerado por tools/setup-local.mjs — NUNCA comite este arquivo.\n` +
      `# Contém o SHA-256 da senha do portão, nunca a senha.\n` +
      `VITE_ACCESS_HASH=${hash}\n`,
    'utf8',
  );
  console.log(`  ${cor.ok('✓')} .env.local criado`);
}

// ── 3. Dependências ────────────────────────────────────────────────────────
const temNodeModules = existsSync(resolve(UI, 'node_modules'));
console.log(
  temNodeModules
    ? `  ${cor.ok('✓')} dependências já instaladas`
    : `  ${cor.aviso('!')} dependências ainda não instaladas`,
);

// ── 4. Próximos passos ─────────────────────────────────────────────────────
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

  Abra o endereço que aparecer (algo como ${cor.forte('http://localhost:5173')})
  e use a senha que você acabou de definir.

  ${cor.forte('TAXA DE ACERTO REAL')} ${cor.fraco('(precisa de internet — esta máquina tem)')}

    node ipad_runtime/tools/run-backtest.mjs --symbol BTCUSDT --timeframe 15m --candles 5000

  Ele só lê klines públicas: sem chave de API, sem ordem, nunca.

  ${cor.forte('PRIVACIDADE')}

  Rodando assim, o painel existe ${cor.forte('só nesta máquina')}. Não há URL pública,
  nada publicado, nada para alguém abrir. Para outra pessoa usar, ela precisa
  do computador — que é o controle de acesso mais forte que existe.
`);
