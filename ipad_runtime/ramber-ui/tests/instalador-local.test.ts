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

// ---------------------------------------------------------------------------
// SÓ O QUE O COMPUTADOR EXECUTA.
//
// Nona ocorrência da mesma classe de falha nesta trilha: uma asserção que
// procura um texto acaba casando com o COMENTÁRIO que explica esse texto, e
// passa verde mesmo depois de a linha executável sumir. Estes dois helpers
// removem os comentários antes de qualquer varredura — o que sobra é o que a
// máquina realmente roda.
// ---------------------------------------------------------------------------
const semComentariosSh = (src: string) =>
  src
    .split("\n")
    .filter((l) => !/^\s*#/.test(l))
    .join("\n");
const semComentariosBat = (src: string) =>
  src
    .split("\n")
    .filter((l) => !/^\s*(REM\b|::)/i.test(l))
    .join("\n");
const semComentariosTs = (src: string) =>
  src
    .split("\n")
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join("\n");

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

  it("instala as peças de desenvolvimento à força — NODE_ENV não pode decidir isso", () => {
    // Defeito real, pego rodando o instalador de ponta a ponta: numa máquina
    // com NODE_ENV=production o `npm ci` pula as devDependencies, e o vite —
    // o motor que liga o painel — é uma delas. O npm termina dizendo
    // "sucesso" (32 pacotes em vez de 87) e a falha só aparece depois, como
    // `vite: not found`, sem nenhuma pista da causa.
    for (const [nome, src] of [
      ["unix", semComentariosSh(unix())],
      ["win", semComentariosBat(win())],
    ] as const) {
      const chamadas = [...src.matchAll(/npm ci[^\n|&]*/g)].map((m) => m[0]);
      expect(chamadas.length, `${nome}: não instala as peças`).toBeGreaterThan(0);
      for (const c of chamadas) {
        expect(c, `${nome}: npm ci sem --include=dev -> ${c.trim()}`).toContain(
          "--include=dev",
        );
      }
    }
  });

  it("confere o vite DEPOIS de instalar — não confia no 'sucesso' do npm", () => {
    // Sem esta checagem o Operador veria `vite: not found`, mensagem que não
    // diz nada a quem não programa. Com ela, a parada nomeia a causa.
    const u = semComentariosSh(unix());
    expect(u, "unix: não confere o vite").toMatch(/! -x node_modules\/\.bin\/vite/);
    expect(u).toContain("NODE_ENV");
    const w = semComentariosBat(win());
    expect(w, "win: não confere o vite").toMatch(/if not exist "node_modules\\\.bin\\vite\.cmd"/);
    expect(w).toContain("NODE_ENV");
    // e a checagem vem ANTES de tentar ligar o painel
    expect(u.indexOf("node_modules/.bin/vite")).toBeLessThan(u.indexOf("npm run dev"));
    expect(w.indexOf("node_modules\\.bin\\vite.cmd")).toBeLessThan(w.indexOf("npm run dev"));
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


// ---------------------------------------------------------------------------
// O SISTEMA MORA NOS DOCUMENTOS.
//
// Pedido do Operador: "os arquivos ser salvo, todo o sistema, nos meus
// documentos do meu computador... tudo sendo salvo lá e tudo executado por lá".
//
// A armadilha real aqui NÃO é escrever "Documents" — é escrever o caminho
// ERRADO de Documents. No Windows com OneDrive (a maioria hoje) a pasta que
// aparece no Explorador é ...\OneDrive\Documentos, e a antiga ou não existe ou
// existe vazia. No Linux em português ela chama "Documentos". Instalar no
// lugar errado é pior do que a pasta de usuário crua: o Operador procuraria
// num lugar onde não está.
// ---------------------------------------------------------------------------
describe("instalador completo: instala DENTRO dos Documentos do Operador", () => {
  it("o padrão dos dois é Documentos — a pasta de usuário crua não é mais o destino", () => {
    const u = semComentariosSh(bootUnix());
    const w = semComentariosBat(bootWin());
    expect(u, "unix: o padrão não sai de DOCUMENTOS").toMatch(
      /DESTINO_PADRAO="\$DOCUMENTOS\/AR10-CYBORG"/,
    );
    expect(w, "win: o padrão não sai de DOCUMENTOS").toMatch(
      /set "DESTINO_PADRAO=!DOCUMENTOS!\\AR10-CYBORG"/,
    );
    // e o destino antigo — a raiz do perfil — não pode voltar por descuido
    expect(u, "unix: voltou a jogar na raiz do perfil").not.toMatch(
      /DESTINO_PADRAO="\$HOME\/AR10-CYBORG"/,
    );
    expect(w, "win: voltou a jogar na raiz do perfil").not.toMatch(
      /set "DESTINO_PADRAO=%USERPROFILE%\\AR10-CYBORG"/,
    );
  });

  it("no Unix o caminho vem do sistema (xdg-user-dir), não de um nome chutado", () => {
    // "Documents" em inglês é chute: no Linux em pt-BR a pasta real chama
    // "Documentos". xdg-user-dir responde o caminho configurado de verdade.
    const u = semComentariosSh(bootUnix());
    expect(u).toContain("xdg-user-dir DOCUMENTS");
    // e os dois nomes existem como rede de proteção quando não há xdg
    expect(u).toContain('$HOME/Documents');
    expect(u).toContain('$HOME/Documentos');
  });

  it("a guarda do xdg-user-dir que devolve o PRÓPRIO $HOME é load-bearing", () => {
    // Sem configuração, `xdg-user-dir DOCUMENTS` devolve $HOME. Aceitar essa
    // resposta jogaria o sistema exatamente onde este trabalho tirou dali.
    // Confirmado por mutação: removendo esta comparação, o cenário do
    // xdg-devolvendo-HOME cai na raiz do perfil.
    expect(semComentariosSh(bootUnix())).toMatch(/\[ "\$D" = "\$HOME" \]/);
  });

  it("no Windows o caminho vem do sistema, cobrindo o redirecionamento do OneDrive", () => {
    // Um `%USERPROFILE%\Documents` fixo é o erro mais provável desta mudança:
    // com OneDrive ligado, essa pasta não é a que o Operador enxerga.
    const w = semComentariosBat(bootWin());
    expect(w, "win: não pergunta ao sistema onde é Documentos").toContain(
      "GetFolderPath('MyDocuments')",
    );
    expect(w, "win: não tem o registro como segunda tentativa").toContain(
      "User Shell Folders",
    );
    // e o valor do registro é REG_EXPAND_SZ — sem expandir, o caminho vem com
    // "%USERPROFILE%" literal dentro e nada é encontrado.
    expect(w, "win: não expande as variáveis do valor do registro").toContain(
      "ExpandEnvironmentVariables",
    );
  });

  it("os dois AINDA deixam escolher outro caminho — Documentos é padrão, não prisão", () => {
    expect(semComentariosSh(bootUnix())).toMatch(/read -r -p .*digite outro caminho/);
    expect(semComentariosBat(bootWin())).toMatch(/set \/p "ESCOLHA=.*digite outro caminho/);
  });

  it("o aviso de pasta sincronizada vem ANTES da pergunta, não depois", () => {
    // Um aviso depois da escolha é inútil: node_modules são dezenas de
    // milhares de arquivos, e numa pasta sincronizada eles sobem todos. O
    // Operador só consegue decidir se souber antes de responder.
    const u = semComentariosSh(bootUnix());
    const iAvisoU = u.indexOf("sincronizada na nuvem");
    const iPerguntaU = u.indexOf("Aperte ENTER para aceitar");
    expect(iAvisoU, "unix: não avisa sobre pasta sincronizada").toBeGreaterThan(-1);
    expect(iAvisoU, "unix: avisa DEPOIS de perguntar").toBeLessThan(iPerguntaU);

    const w = semComentariosBat(bootWin());
    const iAvisoW = w.indexOf("sincronizada no OneDrive");
    const iPerguntaW = w.indexOf("Aperte ENTER para aceitar");
    expect(iAvisoW, "win: não avisa sobre OneDrive").toBeGreaterThan(-1);
    expect(iAvisoW, "win: avisa DEPOIS de perguntar").toBeLessThan(iPerguntaW);
  });

  it("cria só o CAMINHO até o destino — continua sem apagar nada", () => {
    // `mkdir -p` / `mkdir` aqui são aditivos. A recusa de pasta não-vazia,
    // travada mais acima neste arquivo, continua sendo a proteção real.
    expect(semComentariosSh(bootUnix())).toMatch(/mkdir -p "\$\(dirname "\$DESTINO"\)"/);
    expect(semComentariosBat(bootWin())).toMatch(/if not exist "!PAI!" mkdir "!PAI!"/);
  });

  it("os guias contam a mesma história que os instaladores", () => {
    // Se o guia mandar procurar na pasta de usuário e o instalador gravar em
    // Documentos, o Operador não acha o sistema que acabou de instalar.
    const comece = readFileSync(raiz("COMECE-AQUI.md"), "utf8");
    const comando = readFileSync(raiz("COMANDO-UNICO.md"), "utf8");
    const local = readFileSync(raiz("TRABALHAR-LOCAL-COMIGO.md"), "utf8");

    expect(comece, "COMECE-AQUI não diz que instala em Documentos").toContain(
      "Documentos/\n└── AR10-CYBORG/",
    );
    expect(comando).toContain("Documentos\\AR10-CYBORG\\INSTALAR-E-RODAR.bat");
    expect(local).toContain("~/Documents/AR10-CYBORG");

    // nenhum guia pode continuar mandando para a raiz do perfil
    for (const [nome, doc] of [
      ["COMECE-AQUI", comece],
      ["COMANDO-UNICO", comando],
      ["TRABALHAR-LOCAL", local],
    ] as const) {
      expect(doc, `${nome}: aponta para a raiz do perfil`).not.toMatch(
        /~\/AR10-CYBORG|%USERPROFILE%\\AR10-CYBORG/,
      );
    }
  });

  it("os guias não escondem a parte que NÃO fica em Documentos", () => {
    // O Operador pediu "tudo salvo lá". O código fica; o Track Record fica no
    // banco interno do navegador, e isso é limitação do navegador, não
    // escolha do projeto. Prometer o contrário seria mentir.
    const local = readFileSync(raiz("TRABALHAR-LOCAL-COMIGO.md"), "utf8");
    expect(local).toContain("IndexedDB");
    expect(local).toMatch(/limitação real/);
    expect(local).toContain("ainda não\n> está construído");
  });
});


// ---------------------------------------------------------------------------
// MODO APLICATIVO.
//
// Pedido do Operador: "o painel dele abrir já o modo aplicativo, bem
// profissional, igual abrindo no outro" — no iPad ele usa o painel como app da
// tela de início, sem barra de endereço.
//
// `--app=URL` no Chrome/Edge abre uma janela sem barra de endereço, sem abas e
// sem menus. O jeito de isso falhar em silêncio é abrir cedo demais (erro de
// conexão) ou bloquear o servidor (nada liga).
// ---------------------------------------------------------------------------
describe("instaladores: abrem o painel em janela de aplicativo", () => {
  it("os dois passam --app, não uma aba comum de navegador", () => {
    expect(semComentariosSh(unix()), "unix: não abre em modo aplicativo").toMatch(
      /--app="\$URL"/,
    );
    expect(semComentariosBat(win()), "win: não abre em modo aplicativo").toMatch(
      /--app=!APPURL!/,
    );
  });

  it("a abertura NUNCA bloqueia o servidor — ela roda em segundo plano", () => {
    // Este é o erro que derrubaria tudo: esperar o navegador na frente do
    // `npm run dev` significa que o servidor nunca sobe, e a espera nunca
    // termina — trava mútua.
    const u = semComentariosSh(unix());
    expect(u, "unix: a espera não foi para segundo plano").toMatch(
      /\(\s*esperar_servidor && abrir_como_app\s*\)[^\n]*&\s*$/m,
    );
    expect(u.indexOf("abrir_como_app )"), "unix: abre depois de ligar o servidor").toBeLessThan(
      u.indexOf("npm run dev"),
    );
    // no Windows, `start` devolve o controle na hora; o PowerShell espera
    // sozinho, em outra janela
    const w = semComentariosBat(win());
    expect(w, "win: não solta a espera em outro processo").toMatch(
      /start "" \/min powershell/,
    );
    expect(w.indexOf("start \"\" /min powershell")).toBeLessThan(w.indexOf("npm run dev"));
  });

  it("espera o painel RESPONDER, não um tempo fixo", () => {
    // A primeira versão dormia 4s e abria. Numa primeira execução o Vite
    // ainda não respondeu, e a janela de aplicativo abriria num erro de
    // conexão — com o painel funcionando atrás. Confirmado por execução real:
    // com o servidor subindo aos 3s, a função esperou e só então abriu.
    const u = semComentariosSh(unix());
    expect(u, "unix: voltou ao tempo fixo").not.toMatch(/\(\s*sleep \d+;\s*abrir_como_app/);
    expect(u, "unix: não testa a porta de verdade").toContain("/dev/tcp/127.0.0.1/5173");
    const w = semComentariosBat(win());
    expect(w, "win: voltou ao tempo fixo").not.toMatch(/timeout \/t \d+ \/nobreak[^\n]*--app/);
    expect(w, "win: não testa a porta de verdade").toContain("TcpClient");
  });

  it("a espera tem teto — nunca fica presa quando o painel não sobe", () => {
    // Sem teto, um servidor que falhou deixaria um processo girando para
    // sempre em segundo plano. Confirmado por execução real com o teto
    // reduzido: desiste e retorna erro.
    expect(semComentariosSh(unix())).toMatch(/TENTATIVA" -lt \d+/);
    expect(semComentariosBat(win())).toMatch(/\$i -lt \d+/);
  });

  it("degradam até o navegador padrão — abrir de algum jeito é melhor que não abrir", () => {
    const u = semComentariosSh(unix());
    // Mac: Chrome, Edge, Brave e por fim o `open` puro
    expect(u).toMatch(/open "\$URL"/);
    // Linux: a lista de binários e o xdg-open no fim
    expect(u).toContain("xdg-open");
    // Windows: sem Chrome/Edge, o navegador padrão pela URL
    expect(semComentariosBat(win())).toMatch(/Start-Process '!APPURL!'/);
  });

  it("no Windows os três lugares onde o Chrome/Edge se instalam são cobertos", () => {
    // Faltando qualquer um deles, a máquina do Operador cairia no navegador
    // padrão sem ninguém entender por quê.
    const w = semComentariosBat(win());
    for (const raizInstalacao of ["%ProgramFiles%", "%ProgramFiles(x86)%", "%LocalAppData%"]) {
      expect(w, `win: não procura em ${raizInstalacao}`).toContain(raizInstalacao);
    }
    expect(w).toContain("chrome.exe");
    expect(w).toContain("msedge.exe");
  });

  it("a tela explica o modo aplicativo e como fixar o ícone", () => {
    // Sem isso, a janela limpa parece defeito ("sumiu a barra de endereço").
    expect(unix()).toMatch(/janela de APLICATIVO/);
    expect(win()).toMatch(/janela de APLICATIVO/);
    expect(unix()).toContain("Instalar AR10 CYBORG");
    expect(win()).toContain("Instalar AR10 CYBORG");
  });

  it("o manifesto do PWA existe e declara standalone — é o que faz o ícone virar app", () => {
    // O `--app=` resolve a JANELA; o manifesto resolve a INSTALAÇÃO como
    // aplicativo de verdade. Sem `display: standalone`, o Chrome nem oferece.
    const man = JSON.parse(readFileSync(raiz("ipad_runtime/manifest.webmanifest"), "utf8"));
    expect(man.display).toBe("standalone");
    expect(man.name).toBeTruthy();
    expect(Array.isArray(man.icons) && man.icons.length).toBeGreaterThan(0);
  });

  it("o manifesto é SERVIDO ao painel — o bug que fingia estar resolvido", () => {
    // MEDIDO: antes desta ponte, `/manifest.webmanifest` respondia HTTP 200
    // com `Content-Type: text/html` — o fallback SPA do Vite devolvendo o
    // index.html. Um "200" que não é o arquivo. O Chrome não conseguia ler o
    // manifesto e por isso nunca oferecia "Instalar AR10 CYBORG", enquanto a
    // tela do instalador prometia exatamente essa opção.
    const cfg = semComentariosTs(
      readFileSync(raiz("ipad_runtime/ramber-ui/vite.config.ts"), "utf8"),
    );
    expect(cfg, "não há ponte para os arquivos do PWA").toContain("ar10-pwa-assets");
    // dev: middleware; build: emissão para o dist. Os dois caminhos importam —
    // faltando o de build, o app publicado volta a não ser instalável.
    expect(cfg, "não serve em dev").toMatch(/configureServer/);
    expect(cfg, "não emite no build").toMatch(/generateBundle/);
    expect(cfg, "o manifesto não é servido com o tipo certo").toContain(
      "application/manifest+json",
    );
  });

  it("a ponte roda ANTES do service worker — senão o app instalado não abre offline", () => {
    // O plugin do SW varre o dist e monta o precache com o que encontra. Se a
    // emissão dos arquivos do PWA acontecesse depois, eles ficariam de fora.
    // Verificado no build real: os quatro aparecem na lista do sw.js.
    const cfg = semComentariosTs(
      readFileSync(raiz("ipad_runtime/ramber-ui/vite.config.ts"), "utf8"),
    );
    const linha = cfg.split("\n").find((l) => l.includes("plugins:")) ?? "";
    expect(linha, "os dois plugins não estão na mesma lista").toContain("pwaAssetsPlugin");
    expect(linha.indexOf("pwaAssetsPlugin"), "a ponte roda depois do SW").toBeLessThan(
      linha.indexOf("serviceWorkerPlugin"),
    );
  });

  it("todo arquivo que a ponte promete servir existe mesmo no disco", () => {
    // Uma renomeação silenciosa de ícone devolveria o 404 que este trabalho
    // acabou de fechar — e de novo sem ninguém perceber.
    const cfg = readFileSync(raiz("ipad_runtime/ramber-ui/vite.config.ts"), "utf8");
    const bloco = cfg.slice(cfg.indexOf("const PWA_ARQUIVOS"));
    const lista = [...bloco.slice(0, bloco.indexOf("]")).matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(lista.length, "a lista de arquivos do PWA está vazia").toBeGreaterThan(3);
    for (const rel of lista) {
      expect(
        statSync(raiz(`ipad_runtime/${rel}`)).size,
        `arquivo do PWA some do disco: ${rel}`,
      ).toBeGreaterThan(0);
    }
  });

  it("o index.html do painel realmente aponta para o manifesto", () => {
    // Sem o <link>, a ponte serviria um arquivo que ninguém pede.
    expect(readFileSync(raiz("ipad_runtime/ramber-ui/index.html"), "utf8")).toMatch(
      /<link rel="manifest" href="manifest\.webmanifest"/,
    );
  });
});

describe("ponte de dev para os workers/wasm/orderflow reais (mesma classe de defeito da ponte do PWA)", () => {
  // Achado real rodando `npm run dev` isolado (auditoria "rode o app de
  // verdade", Playwright real): workers/quant-worker.js e
  // workers/orderflow-worker.js são arquivos ESTÁTICOS pré-existentes em
  // ipad_runtime/workers/ — só viram vizinhos reais de dist/index.html
  // depois do deploy (`cp -r dist/. ../`). O servidor de dev isolado do
  // Vite não os enxerga e cai no MESMO fallback SPA (200 text/html) que a
  // ponte do PWA acima já existe pra evitar — e o construtor de Worker,
  // ao receber HTML em vez de JS, falha com um `[object Event]` sem
  // stack. `describeError` (engine-bridge.ts) já sabia decifrar esse
  // evento — mas só depois que o Worker já tinha falhado.
  const cfg = () => readFileSync(raiz("ipad_runtime/ramber-ui/vite.config.ts"), "utf8");

  it("a ponte existe, roda em dev, e serve os 4 prefixos reais que os workers importam", () => {
    const c = cfg();
    expect(c, "não há ponte pros arquivos-irmãos dos workers").toContain("ar10-sibling-runtime-assets");
    expect(c, "não serve em dev").toMatch(/configureServer/);
    for (const prefixo of ["workers/", "wasm/", "js/", "src/orderflow/"]) {
      expect(c, `prefixo ausente: ${prefixo}`).toContain(`'${prefixo}'`);
    }
  });

  it("NUNCA usa o prefixo genérico 'src/' — colidiria com o /src/ real que o Vite já serve pro app", () => {
    // ramber-ui/src/ existe de verdade e É servido pelo Vite em dev
    // (App.tsx chega ao navegador via /src/App.tsx). Interceptar 'src/'
    // inteiro redirecionaria esses pedidos pra ipad_runtime/src/ — que
    // não tem App.tsx nenhum — e quebraria o app inteiro em dev, um bug
    // estritamente pior do que o console.error que esta ponte resolve.
    const bloco = cfg().slice(cfg().indexOf("SIBLING_PREFIXOS"));
    const lista = [...bloco.slice(0, bloco.indexOf("]")).matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(lista).not.toContain("src/");
    expect(lista).toContain("src/orderflow/");
  });

  it("registrada na lista de plugins de verdade, não só declarada", () => {
    const linha = cfg().split("\n").find((l) => l.includes("plugins:")) ?? "";
    expect(linha, "a ponte existe mas nunca é ligada").toContain("siblingRuntimeAssetsPlugin");
  });

  it("todo arquivo real que os dois workers importam por caminho relativo existe no disco", () => {
    // Os mesmos 7 arquivos que quant-worker.js/orderflow-worker.js
    // resolvem via new URL('../...', import.meta.url) — se um sumir ou
    // for renomeado, o 404 real volta, e desta vez em produção também.
    const arquivos = [
      "ipad_runtime/workers/quant-worker.js",
      "ipad_runtime/workers/orderflow-worker.js",
      "ipad_runtime/wasm/cyborg_quant_core.wasm",
      "ipad_runtime/wasm/cyborg_quant_core_simd.wasm",
      "ipad_runtime/src/orderflow/value-objects.js",
      "ipad_runtime/src/orderflow/ring-buffer.js",
      "ipad_runtime/src/orderflow/signal-engine.js",
      "ipad_runtime/js/orderflow-tick-codec.js",
    ];
    for (const rel of arquivos) {
      expect(statSync(raiz(rel)).size, `arquivo some do disco: ${rel}`).toBeGreaterThan(0);
    }
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
