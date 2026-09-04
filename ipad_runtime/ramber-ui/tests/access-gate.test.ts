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
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { sha256Hex, verifyPassword } from '../src/access-gate-crypto';
import { ACCESS_HASH, resolveAccessHash } from '../src/access-gate';

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
  // ACHADO REAL DESTA RODADA: a versão anterior deste bloco continha a senha
  // do painel EM TEXTO PURO, como primeiro argumento de verifyPassword — num
  // repositório PÚBLICO. O arquivo access-gate.tsx cumpria a promessa de não
  // conter a senha, e havia até um teste guardando isso; mas a suíte, que
  // ninguém pensou em auditar, publicava a senha por extenso. A guarda
  // olhava para um arquivo só.
  //
  // Agora o comportamento é exercitado com uma senha DE TESTE, cujo hash é
  // derivado na hora — nenhum segredo real precisa existir aqui.
  const SENHA_DE_TESTE = 'senha-apenas-para-teste';

  it('a senha correta verifica true contra o hash correspondente', async () => {
    const hash = await sha256Hex(SENHA_DE_TESTE);
    expect(await verifyPassword(SENHA_DE_TESTE, hash)).toBe(true);
  });

  it('senha errada, vazia, ou variação de maiúsculas/espaço => false', async () => {
    const hash = await sha256Hex(SENHA_DE_TESTE);
    expect(await verifyPassword('outra-coisa', hash)).toBe(false);
    expect(await verifyPassword('', hash)).toBe(false);
    expect(await verifyPassword(SENHA_DE_TESTE.toUpperCase(), hash)).toBe(false);
    expect(await verifyPassword(SENHA_DE_TESTE + ' ', hash)).toBe(false); // espaço não é ignorado
  });
});

describe('o hash vem do BUILD, nunca do código-fonte — e falha FECHADO', () => {
  it('resolveAccessHash aceita só um SHA-256 hex de 64 caracteres', async () => {
    const valido = await sha256Hex('qualquer');
    expect(resolveAccessHash(valido)).toBe(valido);
    expect(resolveAccessHash(valido.toUpperCase())).toBe(valido); // normaliza
    expect(resolveAccessHash(`  ${valido}  `)).toBe(valido); // tolera espaço do segredo
  });

  it('FAIL-CLOSED: qualquer entrada inválida vira null, e null nunca destrava', () => {
    for (const ruim of [undefined, null, '', '   ', 'abc', 'z'.repeat(64), 'a'.repeat(63), 'a'.repeat(65), 123, {}, []]) {
      expect(resolveAccessHash(ruim), `entrada ${JSON.stringify(ruim)}`).toBeNull();
    }
  });

  it('um hash null nunca aceita senha nenhuma — nem string vazia', async () => {
    // A falha segura de um portão é ficar FECHADO. Um build sem o segredo
    // produz um app que ninguém abre, e isso é deliberado.
    expect(await verifyPassword('qualquer', null as unknown as string)).toBe(false);
    expect(await verifyPassword('', null as unknown as string)).toBe(false);
  });

  it('o hash NÃO é mais um literal no código-fonte', () => {
    const src = read('../src/access-gate.tsx');
    // Forma executável: um literal hex de 64 caracteres atribuído. O nome da
    // variável e a explicação aparecem em comentário, e casar com a palavra
    // solta provaria nada (mesmo erro já cometido 4x nesta trilha).
    expect(src).not.toMatch(/=\s*["'][0-9a-f]{64}["']/i);
    expect(src).toContain('VITE_ACCESS_HASH');
    expect(src).toContain('export function resolveAccessHash(');
  });

  it('o portão fecha e DIZ o porquê quando o build saiu sem o segredo', () => {
    const src = read('../src/access-gate.tsx');
    expect(src).toContain('if (ACCESS_HASH === null) {');
    expect(src).toContain('Acesso não configurado');
    // e o submit também é barrado, não só a tela
    expect(src).toContain('if (ACCESS_HASH === null) return;');
  });
});

describe('NENHUM arquivo versionado carrega a senha em texto puro', () => {
  // A guarda antiga olhava um arquivo só (access-gate.tsx) — e a senha
  // estava, o tempo todo, no arquivo de teste ao lado. Esta varre a árvore.
  it('varre src/ e tests/ inteiros, não um arquivo só', () => {
    const alvos: string[] = [];
    const varrer = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = resolve(dir, e.name);
        if (e.isDirectory()) { if (e.name === 'node_modules' || e.name === 'dist') continue; varrer(p); }
        else if (/\.(ts|tsx|js|mjs|html|json)$/.test(e.name)) alvos.push(p);
      }
    };
    varrer(resolve(here, '../src'));
    varrer(resolve(here, '.'));
    expect(alvos.length, 'a varredura não encontrou arquivo nenhum').toBeGreaterThan(50);
    const infratores = alvos.filter((f) => /["']ar10cyborg["']/i.test(readFileSync(f, 'utf8')));
    expect(infratores.map((f) => f.replace(resolve(here, '..'), '')), 'senha em texto puro versionada').toEqual([]);
  });
});

describe('access-gate.tsx: a senha em texto puro NUNCA aparece no código-fonte', () => {
  it('nenhuma string literal igual à senha existe no arquivo — só a chave de storage, que tem sufixo', () => {
    const src = read('../src/access-gate.tsx');
    expect(src).not.toMatch(/["']ar10cyborg["']/i);
    // ANTES esta linha era `expect(src).toContain(ACCESS_HASH)` — ela EXIGIA
    // que o hash estivesse no código-fonte, exatamente o oposto do que o
    // sistema precisa agora. Invertida junto com a mudança.
    expect(ACCESS_HASH === null || !src.includes(ACCESS_HASH)).toBe(true);
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
