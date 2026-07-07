// access-gate.test.ts — a cortina de acesso (pedido do Operador: "senha
// fácil pra ninguém acessar sem querer") e o rebranding para AR10 CYBORG.
// Duas coisas travadas como invariante de CI:
//   1. A matemática do hash está correta (vetores de teste conhecidos) e
//      a senha em texto puro nunca aparece no código-fonte além do
//      hash — só o comparador por hash decide, nunca uma comparação de
//      string direta.
//   2. O nome profissional "AR10 CYBORG" aparece em toda superfície
//      voltada ao usuário (aba do navegador, tela de início do iPad,
//      manifest PWA, rodapé do app, contexto do assistente S.E.).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { sha256Hex, verifyPassword } from '../src/access-gate-crypto';
import { ACCESS_HASH } from '../src/access-gate';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');

describe('access-gate-crypto: sha256Hex — vetores de teste conhecidos (NIST)', () => {
  it('sha256("") bate com o vetor de teste padrão', async () => {
    expect(await sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('sha256("abc") bate com o vetor de teste padrão', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('produz sempre 64 caracteres hexadecimais', async () => {
    expect(await sha256Hex('qualquer coisa')).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('access-gate-crypto: verifyPassword — comparação estrita por hash', () => {
  it('a senha correta do portão verifica true contra o ACCESS_HASH oficial', async () => {
    expect(await verifyPassword('ar10cyborg', ACCESS_HASH)).toBe(true);
  });

  it('senha errada, vazia, ou variação de maiúsculas => false', async () => {
    expect(await verifyPassword('senhaerrada', ACCESS_HASH)).toBe(false);
    expect(await verifyPassword('', ACCESS_HASH)).toBe(false);
    expect(await verifyPassword('AR10CYBORG', ACCESS_HASH)).toBe(false);
    expect(await verifyPassword('ar10cyborg ', ACCESS_HASH)).toBe(false); // espaço não é ignorado
  });
});

describe('access-gate.tsx: a senha em texto puro NUNCA aparece no código-fonte', () => {
  it('nenhuma string literal igual a "ar10cyborg" existe no arquivo — só o hash e a chave de storage (que tem sufixo)', () => {
    const src = read('../src/access-gate.tsx');
    expect(src).not.toMatch(/["']ar10cyborg["']/i);
    expect(src).toContain(ACCESS_HASH);
    expect(src).toContain('ar10cyborg_access_unlocked'); // chave de storage, não a senha
  });

  it('a comparação é sempre feita por verifyPassword (hash), nunca por igualdade direta de string da senha', () => {
    const src = read('../src/access-gate.tsx');
    expect(src).toContain('verifyPassword(password, ACCESS_HASH)');
    expect(src).not.toMatch(/password\s*===/);
  });
});

describe('main.tsx: o portão envolve o App real — nada renderiza sem passar por ele', () => {
  it('AccessGate é importado e envolve <App /> no render raiz', () => {
    const main = read('../src/main.tsx');
    expect(main).toContain("import { AccessGate } from './access-gate'");
    expect(main).toMatch(/<AccessGate>\s*<App\s*\/>\s*<\/AccessGate>/);
  });
});

describe('identidade profissional: "AR10 CYBORG" em toda superfície voltada ao usuário', () => {
  it('index.html: título da aba, nome da tela de início do iPad e descrição', () => {
    const html = read('../index.html');
    expect(html).toContain('<title>AR10 CYBORG · Terminal Quantitativo</title>');
    expect(html).toContain('<meta name="apple-mobile-web-app-title" content="AR10 CYBORG" />');
    expect(html).toContain('AR10 CYBORG · Terminal Quantitativo');
    expect(html).not.toContain('RAMBER');
  });

  it('manifest.webmanifest: nome, nome curto (ícone do iPad) e descrição', () => {
    const manifest = JSON.parse(read('../../manifest.webmanifest'));
    expect(manifest.name).toBe('AR10 CYBORG — Terminal Quantitativo');
    expect(manifest.short_name).toBe('AR10 CYBORG');
    expect(manifest.description).toContain('AR10 CYBORG');
    expect(manifest.description).not.toContain('RAMBER');
  });

  it('App.tsx: a marca visível no rodapé é "AR10 CYBORG", nunca mais "RAMBER"', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('>AR10 CYBORG</span>');
    expect(app).not.toContain('>RAMBER</span>');
  });

  it('llm-bridge.ts: o assistente S.E. se identifica e descreve o terminal como AR10 CYBORG (texto que chega ao modelo e ao contexto tático — não o comentário de cabeçalho do arquivo, que é documentação interna)', () => {
    const bridge = read('../src/llm-bridge.ts');
    expect(bridge).toContain('núcleo analítico do terminal AR10 CYBORG');
    expect(bridge).toContain('DADOS REAIS ATUAIS DO TERMINAL AR10 CYBORG');
  });
});
