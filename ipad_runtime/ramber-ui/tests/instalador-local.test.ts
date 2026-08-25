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
const bootUnix = () => readFileSync(raiz("AR10-INSTALADOR.command"), "utf8");
const bootWin = () => readFileSync(raiz("AR10-INSTALADOR.bat"), "utf8");
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
    // o instalador de um arquivo so precisa aparecer PRIMEIRO — e ele que
    // resolve o pedido "baixo um arquivo e ele faz tudo".
    expect(guia).toContain("AR10-INSTALADOR.bat");
    expect(guia).toContain("AR10-INSTALADOR.command");
    expect(guia.indexOf("AR10-INSTALADOR")).toBeLessThan(guia.indexOf("INSTALAR-E-RODAR"));
    expect(guia).toContain("https://nodejs.org");
    // o aviso do Gatekeeper do Mac: sem ele o Operador trava no primeiro clique
    expect(guia).toContain("não pode ser aberto");
    // e o índice para os outros guias — sem ele, eles ficam invisíveis
    for (const outro of ["FECHAR-ACESSO-PUBLICO.md", "TRABALHAR-LOCAL-COMIGO.md", "docs/RODAR_LOCAL.md"]) {
      expect(guia, `COMECE-AQUI não aponta para ${outro}`).toContain(outro);
    }
  });

  it("o guia de trabalho local não promete o que o ambiente da nuvem não faz", () => {
    const g = readFileSync(raiz("TRABALHAR-LOCAL-COMIGO.md"), "utf8");
    // O ponto do documento é justamente a diferença MEDIDA entre os dois
    // ambientes — se ela sumir do texto, ele vira propaganda.
    expect(g).toContain("HTTP 000");
    // onde os dados realmente ficam, conferido em persistence.ts
    expect(g).toContain("IndexedDB");
    // e a armadilha real: o histórico do site antigo NÃO migra sozinho
    expect(g).toContain("não vem junto");
    // as regras do projeto viajam junto com a pasta
    expect(g).toContain("CLAUDE.md");
  });
});


// ---------------------------------------------------------------------------
// AUTOATUALIZAÇÃO E REDE LOCAL.
//
// Pedido do Operador: "ele fazer o restante tudo automático... não precisa
// estar fazendo download manual" e "pra rede local minha". Duas capacidades
// novas, e as duas têm um jeito de dar errado em silêncio: atualizar por cima
// de trabalho não salvo, e expor na rede sem avisar.
// ---------------------------------------------------------------------------
describe("instaladores: atualizam sozinhos, sem atropelar nada", () => {
  it("os dois buscam atualização com --ff-only, nunca um merge que pode conflitar", () => {
    for (const [nome, src] of [["unix", unix()], ["win", win()]] as const) {
      expect(src, `${nome}: não busca atualização`).toContain("git pull --ff-only");
      // `--ff-only` recusa em vez de criar um merge que o Operador não saberia
      // resolver. Um `git pull` cru poderia deixar a pasta num estado que só
      // alguém técnico desfaz.
      expect(src, `${nome}: usa pull sem --ff-only`).not.toMatch(/git pull(?!\s+--ff-only)/);
      // e NUNCA descarta trabalho local à força
      expect(src, `${nome}: usa reset --hard`).not.toMatch(/git (reset --hard|checkout -f|clean -fd)/);
    }
  });

  it("mudança local não salva IMPEDE a atualização — nunca sobrescreve em silêncio", () => {
    expect(unix()).toContain('git status --porcelain');
    expect(unix()).toContain("não vou atualizar por cima");
    expect(win()).toContain("git status --porcelain");
    expect(win()).toContain("nao vou atualizar por cima");
  });

  it("sem git (pasta de ZIP) o painel AINDA roda — a atualização é opcional, não requisito", () => {
    // Se a ausência de git parasse o script, quem baixou o ZIP ficaria sem
    // sistema nenhum. Ele avisa e segue.
    const src = unix();
    const i = src.indexOf("esta pasta veio de ZIP");
    expect(i).toBeGreaterThan(-1);
    // o bloco do ZIP não chama `parar`
    const bloco = src.slice(i, src.indexOf("# ── 3.", i));
    expect(bloco).not.toContain("parar ");
    expect(bloco).toContain("git clone");
  });

  it("reinstala dependências só quando a atualização trouxe algo — não a cada execução", () => {
    for (const [nome, src] of [["unix", unix()], ["win", win()]] as const) {
      expect(src, `${nome}: não rastreia se atualizou`).toMatch(/ATUALIZOU/);
    }
  });
});

describe("instaladores: rede local com o aviso junto", () => {
  it("os dois ligam com --host e mostram o endereço da rede", () => {
    for (const [nome, src] of [["unix", unix()], ["win", win()]] as const) {
      expect(src, `${nome}: não liga na rede`).toMatch(/npm run dev -- --host/);
      expect(src, `${nome}: não descobre o IP`).toContain("networkInterfaces()");
      expect(src, `${nome}: não mostra o endereço`).toMatch(/iPad\/celular/);
    }
  });

  it("o aviso de quem alcança o painel é OBRIGATÓRIO, não uma nota de rodapé", () => {
    // Expor na rede sem dizer quem alcança seria a mesma classe de erro do
    // portão de senha que fingia ser segurança.
    expect(unix()).toContain("qualquer aparelho na SUA rede alcança esse endereço");
    expect(unix()).toContain("A senha é a única barreira");
    expect(win()).toContain("qualquer aparelho na SUA rede alcanca esse endereco");
    expect(win()).toContain("A senha e a unica barreira");
  });

  it("não pergunta a senha de novo quando já está configurada", () => {
    // Perguntar a cada execução transformaria o uso diário num formulário.
    expect(unix()).toContain("já configurada");
    expect(win()).toContain("ja configurada");
    expect(unix()).toMatch(/VITE_ACCESS_HASH=\[0-9a-fA-F\]/);
  });
});


// ---------------------------------------------------------------------------
// O INSTALADOR COMPLETO (bootstrap).
//
// Pedido do Operador: "tu gera um arquivo, executa ele, abaixa tudo que tem
// de baixar, arruma tudo no meu computador e faz todo processo tudinho".
//
// É o único arquivo que ele baixa. Isso o torna a peça com MAIS poder de
// estragar a máquina dele — ele escolhe um caminho e o script cria pasta e
// baixa arquivos ali. O que não pode regredir está travado aqui.
// ---------------------------------------------------------------------------
describe("instalador completo: nunca destrói nada do Operador", () => {
  it("recusa uma pasta que já existe e tem conteúdo — em vez de apagar", () => {
    // O risco real: o Operador digita "Documentos" ou a Área de Trabalho por
    // engano. Um `rm -rf` ali levaria junto o que estava lá.
    expect(bootUnix()).toContain("já existe e NÃO está vazia");
    expect(bootWin()).toContain("ja existe e NAO esta vazia");
    expect(bootUnix()).toContain("Não vou mexer no que já está lá");
  });

  it("NENHUM dos dois apaga pasta recursivamente fora de um temporário", () => {
    for (const [nome, src] of [["unix", bootUnix()], ["win", bootWin()]] as const) {
      const remocoes = [...src.matchAll(/(rm -rf|rmdir \/s \/q)\s+"?([^"\n]+)"?/g)].map((m) => m[2]);
      for (const alvo of remocoes) {
        // Só o diretório temporário do próprio download pode ser removido.
        expect(alvo, `${nome}: apaga ${alvo}`).toMatch(/TMP/);
      }
    }
  });

  it("baixa o RAMO que realmente tem o trabalho, não o main desatualizado", () => {
    // `main` está 194 commits atrás (PR #15 aberta). Clonar main entregaria
    // um sistema sem nenhuma das correções — e o Operador não teria como
    // saber. Quando a PR for mesclada, esta é a única linha que muda.
    for (const [nome, src] of [["unix", bootUnix()], ["win", bootWin()]] as const) {
      expect(src, `${nome}: não fixa o ramo`).toMatch(/RAMO="?claude\/eloquent-cannon-qyt86y"?/);
      expect(src, `${nome}: clona sem escolher ramo`).toMatch(/--branch/);
    }
  });

  it("funciona SEM git — o ZIP é caminho de verdade, não desculpa", () => {
    expect(bootUnix()).toContain("codeload.github.com");
    expect(bootWin()).toContain("codeload.github.com");
    // e explica a diferença em vez de esconder
    expect(bootUnix()).toContain("não vai se atualizar sozinho depois");
    expect(bootWin()).toContain("nao vai se atualizar sozinho depois");
  });

  it("entrega para o instalador já testado — nunca reimplementa a preparação", () => {
    // Duas cópias da mesma preparação divergiriam na primeira correção feita
    // só num lado.
    expect(bootUnix()).toContain('INTERNO="$DESTINO/INSTALAR-E-RODAR.command"');
    expect(bootWin()).toContain("INSTALAR-E-RODAR.bat");
    // o bootstrap NÃO refaz senha nem npm ci
    expect(bootUnix()).not.toContain("setup-local.mjs");
    expect(bootUnix()).not.toMatch(/npm ci/);
    expect(bootWin()).not.toContain("setup-local.mjs");
  });

  it("não instala Node nem pede privilégio", () => {
    for (const [nome, src] of [["unix", bootUnix()], ["win", bootWin()]] as const) {
      expect(src, `${nome}: usa sudo`).not.toMatch(/\bsudo\b/);
      expect(src, `${nome}: instala node`).not.toMatch(/brew install|apt-get install|choco install|winget install/);
    }
  });

  it("explica o caso REPOSITÓRIO PRIVADO — a causa mais provável depois do fechamento", () => {
    // Assim que o repositório virar privado, o ZIP anônimo passa a dar 404.
    // Dizer só "verifique a internet" mandaria o Operador procurar no lugar
    // errado por horas. Os dois caminhos precisam nomear a causa certa.
    for (const [nome, src] of [["unix", bootUnix()], ["win", bootWin()]] as const) {
      expect(src, `${nome}: não explica o ZIP em repo privado`).toMatch(/PRIVADO/);
      expect(src, `${nome}: não aponta a saída (git)`).toContain("git-scm.com/downloads");
    }
    // e o clone avisa ANTES que vai pedir login, para o prompt não assustar
    expect(bootUnix()).toContain("o GitHub vai pedir seu login agora");
    expect(bootWin()).toContain("o GitHub vai pedir seu login agora");
  });

  it("o do Unix tem permissão de execução (sem isso o duplo clique não roda)", () => {
    expect(statSync(raiz("AR10-INSTALADOR.command")).mode & 0o111).toBeGreaterThan(0);
  });
});


describe("comando único: a linha que o Operador cola no CMD/Terminal", () => {
  const cmd = () => readFileSync(raiz("COMANDO-UNICO.md"), "utf8");

  it("aponta para o RAMO que tem o trabalho, igual aos instaladores", () => {
    // Se o documento apontasse para outro ramo que os instaladores, o
    // Operador baixaria uma versão e rodaria outra.
    const doc = cmd();
    expect(doc).toContain("refs/heads/claude/eloquent-cannon-qyt86y");
    expect(bootUnix()).toContain("claude/eloquent-cannon-qyt86y");
    expect(bootWin()).toContain("claude/eloquent-cannon-qyt86y");
  });

  it("cobre os dois sistemas e o caso de curl ausente", () => {
    const doc = cmd();
    expect(doc).toContain("AR10-INSTALADOR.bat");
    expect(doc).toContain("AR10-INSTALADOR.command");
    // Windows antigo não tem curl — sem alternativa, o Operador trava.
    expect(doc).toContain("powershell");
  });

  it("EXPLICA o que o comando faz — colar da internet não é confiança cega", () => {
    const doc = cmd();
    expect(doc).toMatch(/O que esse comando faz/);
    expect(doc).toContain("não pede senha de administrador");
    // e diz que dá para ler o arquivo antes
    expect(doc).toMatch(/abra o endereço no\s*\n?navegador|abrir no navegador/);
  });

  it("avisa que o comando morre quando o repositório virar privado", () => {
    // Esta é a armadilha real: ele fecha o acesso e depois o comando para de
    // funcionar sem explicação. A ordem certa precisa estar escrita.
    const doc = cmd();
    expect(doc).toContain("enquanto o repositório estiver público");
    expect(doc).toMatch(/Rode este comando \*\*agora\*\*/);
  });

  it("o COMECE-AQUI aponta para ele", () => {
    expect(readFileSync(raiz("COMECE-AQUI.md"), "utf8")).toContain("COMANDO-UNICO.md");
  });
});
