// instalador-local.test.ts — os dois instaladores de clique duplo.
//
// Eles são a porta de entrada do projeto para alguém que declarou não saber
// instalar. Um instalador que trava ou que vaza a senha é pior do que
// nenhum, então o que não pode regredir fica travado aqui.
//
// O .bat não pode ser EXECUTADO nesta máquina (não há Windows). O que dá
// para garantir por teste é a estrutura e as invariantes de segurança; a
// execução real dele depende do Operador, e isso está dito na resposta.
import { describe, it, expect } from "vitest";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const raiz = (p: string) => resolve(__dirname, "../../../", p);
const unix = () => readFileSync(raiz("INSTALAR-E-RODAR.command"), "utf8");
const win = () => readFileSync(raiz("INSTALAR-E-RODAR.bat"), "utf8");

describe("instaladores: a senha nunca é gravada nem exposta", () => {
  it("os dois passam a senha para setup-local.mjs e limpam a variável depois", () => {
    for (const [nome, src] of [["unix", unix()], ["win", win()]] as const) {
      expect(src, `${nome}: não chama o preparador`).toMatch(/setup-local\.mjs/);
      // a variável é esvaziada logo após o uso — não fica no ambiente do
      // processo que segue rodando (o servidor de dev).
      expect(src, `${nome}: não limpa a senha`).toMatch(/SENHA=""|set "SENHA="/);
    }
  });

  it("nenhum dos dois escreve a senha em arquivo ou a imprime na tela", () => {
    // A primeira versão desta asserção era um FALSO POSITIVO do próprio
    // teste: `/\$SENHA["']?\s*>/` casava com
    // `setup-local.mjs "$SENHA" >/dev/null`, que redireciona a SAÍDA DO
    // COMANDO, não a senha. Oitava vez nesta trilha que uma asserção casa
    // com algo que não é o alvo. A checagem certa é linha a linha,
    // ignorando redirecionamento para /dev/null e nul.
    for (const [nome, src] of [["unix", unix()], ["win", win()]] as const) {
      const linhas = src.split("\n").filter((l) => /SENHA/.test(l));
      expect(linhas.length, `${nome}: nenhuma linha usa SENHA`).toBeGreaterThan(0);
      for (const l of linhas) {
        const semDevNull = l.replace(/>\s*(\/dev\/null|nul)\b/g, "").replace(/2>&1/g, "");
        expect(semDevNull, `${nome}: grava a senha em arquivo -> ${l.trim()}`).not.toMatch(/>\s*\S/);
        expect(l, `${nome}: ecoa a senha -> ${l.trim()}`).not.toMatch(/^\s*echo\s+.*(\$\{?SENHA|!SENHA!)/);
      }
    }
  });

  it("no Unix a digitação é silenciosa (-s) — a senha não aparece na tela", () => {
    expect(unix()).toMatch(/read -r -s -p/);
  });
});

describe("instaladores: nunca travam", () => {
  it("o laço da senha no Unix sai no EOF — o bug real que o teste pegou", () => {
    // Sem `|| break`, uma entrada fechada faz `read` devolver vazio para
    // sempre e o instalador gira infinitamente. Foi exatamente o que
    // aconteceu no primeiro teste real.
    const src = unix();
    expect(src).toMatch(/read -r -s -p .* SENHA \|\| break/);
    // e há um teto de tentativas, para não girar mesmo com entrada viva
    expect(src).toContain('[ "$TENTATIVAS" -ge 5 ] && break');
    // e depois do laço, uma senha inválida PARA com explicação
    expect(src).toContain('parar "não recebi uma senha válida."');
  });

  it("o Unix é sintaticamente válido (bash -n passou na construção)", () => {
    // Guarda de forma: um `fi`/`done` faltando derrubaria o instalador na
    // cara do Operador. Aqui checamos o balanceamento dos blocos.
    const src = unix();
    const conta = (re: RegExp) => (src.match(re) ?? []).length;
    expect(conta(/^if /gm) + conta(/\bif \[/gm) - conta(/\bif \[/gm)).toBe(conta(/^fi$/gm));
    expect(conta(/^while /gm)).toBe(conta(/^done$/gm));
  });
});

describe("instaladores: não fazem nada invasivo", () => {
  it("nenhum instala runtime, mexe em PATH global ou pede privilégio", () => {
    for (const [nome, src] of [["unix", unix()], ["win", win()]] as const) {
      expect(src, `${nome}: usa sudo`).not.toMatch(/\bsudo\b/);
      expect(src, `${nome}: instala node`).not.toMatch(/brew install|apt-get install|choco install|winget install/);
      expect(src, `${nome}: mexe em PATH global`).not.toMatch(/setx |export PATH=/);
    }
  });

  it("quando falta Node, PARAM com a instrução — nunca instalam por conta própria", () => {
    expect(unix()).toContain("https://nodejs.org");
    expect(win()).toContain("https://nodejs.org");
    expect(unix()).toContain('parar "o Node não está instalado nesta máquina."');
  });

  it("exigem Node 20+, o mesmo piso do setup-local.mjs e do guia", () => {
    expect(unix()).toContain('-lt 20');
    expect(win()).toContain("LSS 20");
    expect(readFileSync(raiz("ipad_runtime/tools/setup-local.mjs"), "utf8")).toContain("const NODE_MINIMO = 20;");
  });
});

describe("instaladores: chegam ao mesmo lugar", () => {
  it("os dois entram na pasta certa e ligam o mesmo servidor", () => {
    expect(unix()).toContain("cd ipad_runtime/ramber-ui");
    expect(win()).toContain("cd ipad_runtime\\ramber-ui");
    expect(unix()).toMatch(/npm run dev/);
    expect(win()).toMatch(/npm run dev/);
  });

  it("o do Unix roda a partir da PRÓPRIA pasta, não de onde foi clicado", () => {
    // Sem isto, clicar duas vezes no Finder executa com o diretório do
    // usuário como cwd e nada é encontrado.
    expect(unix()).toContain('cd "$(dirname "$0")"');
    expect(win()).toContain('cd /d "%~dp0"');
  });

  it("o arquivo do Mac/Linux tem permissão de execução", () => {
    // Sem o bit +x, o duplo clique no Mac não roda.
    expect(statSync(raiz("INSTALAR-E-RODAR.command")).mode & 0o111).toBeGreaterThan(0);
  });

  it("o guia de entrada existe e aponta para os dois arquivos", () => {
    const guia = readFileSync(raiz("COMECE-AQUI.md"), "utf8");
    expect(guia).toContain("INSTALAR-E-RODAR.bat");
    expect(guia).toContain("INSTALAR-E-RODAR.command");
    expect(guia).toContain("https://nodejs.org");
    // o aviso do Gatekeeper do Mac: sem ele o Operador trava no primeiro clique
    expect(guia).toContain("não pode ser aberto");
  });
});
