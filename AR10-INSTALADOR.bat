@echo off
REM AR10-INSTALADOR.bat -- Windows.
REM
REM E o UNICO arquivo que o Operador precisa baixar. Clique duplo e ele:
REM   1. confere o Node;
REM   2. pergunta onde guardar o sistema;
REM   3. BAIXA TUDO do GitHub sozinho (git clone, ou ZIP via PowerShell se
REM      nao houver git);
REM   4. entrega para o INSTALAR-E-RODAR.bat de dentro da pasta, que prepara
REM      a senha, instala as pecas e liga o painel.
REM
REM NAO duplica a logica de instalacao de proposito: resolve UM problema --
REM trazer os arquivos -- e entrega o resto para o instalador ja testado.
REM Duas copias divergiriam na primeira correcao feita so num lado.
REM
REM NAO exige git: sem ele, baixa o ZIP com PowerShell, que existe em todo
REM Windows moderno. Exigir git seria travar o Operador num pre-requisito
REM que ele nao pediu.

setlocal enabledelayedexpansion

set "REPO=AR10-10/AR10-ORION"
REM RAMO: onde o trabalho realmente esta. O `main` esta MUITO atras (a PR #15
REM ainda nao foi mesclada), entao baixar `main` entregaria um sistema sem
REM nenhuma das correcoes recentes. Quando a PR for mesclada, troque para
REM "main" -- e a unica linha que muda.
set "RAMO=claude/eloquent-cannon-qyt86y"

REM -- ONDE O SISTEMA MORA ---------------------------------------------------
REM
REM Pedido do Operador: tudo salvo e executado na pasta Documentos dele.
REM
REM Por que NAO usar um caminho fixo de Documentos: na maioria dos Windows
REM atuais o OneDrive REDIRECIONA a pasta Documentos para dentro dele
REM (...\OneDrive\Documentos). Nesse caso a pasta antiga ou nao existe, ou
REM existe vazia e NAO e a que aparece no Explorador -- instalar ali seria
REM instalar num lugar que o Operador nunca acha. O caminho REAL esta no
REM registro do Windows (valor "Personal"), e e isso que a linha abaixo le,
REM via API do proprio sistema, com o registro como segunda tentativa.
REM O comando fica numa VARIAVEL, e nao escrito direto dentro do `for /f`, de
REM proposito: o `for /f` usa parenteses como delimitador, e o comando abaixo
REM tem varios parenteses dentro. Escrito direto, o parser do cmd pode fechar o
REM bloco no lugar errado -- uma falha que so aparece na maquina do Operador.
REM Com `!PSDOC!`, o parser nao ve parentese nenhum: a expansao acontece depois.
set "PSDOC=$p=[Environment]::GetFolderPath('MyDocuments'); if(-not $p){ $p=(Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders' -EA SilentlyContinue).Personal; if($p){ $p=[Environment]::ExpandEnvironmentVariables($p) } }; if(-not $p){ $p=Join-Path $env:USERPROFILE 'Documents' }; Write-Output $p"
set "DOCUMENTOS="
for /f "usebackq delims=" %%d in (`powershell -NoProfile -Command "!PSDOC!" 2^>nul`) do set "DOCUMENTOS=%%d"
REM Ultimo recurso: se o PowerShell estiver bloqueado por politica, o caminho
REM classico ainda e melhor do que jogar o projeto na raiz do perfil.
if not defined DOCUMENTOS set "DOCUMENTOS=%USERPROFILE%\Documents"
set "DESTINO_PADRAO=!DOCUMENTOS!\AR10-CYBORG"

echo.
echo   ================================================
echo      AR10 CYBORG -- instalador completo
echo   ================================================
echo.
echo   Este arquivo baixa o sistema inteiro e deixa tudo pronto.
echo.

REM -- 1. Node ---------------------------------------------------------------
echo   [1/4] Procurando o Node...
where node >nul 2>&1
if errorlevel 1 (
    echo.
    echo   O Node nao esta instalado -- ele e o motor do sistema.
    echo.
    echo   Vou abrir o site para voce baixar. Instale a versao LTS
    echo   ^(e so ir avancando^) e depois clique neste arquivo de novo.
    echo.
    start "" https://nodejs.org
    pause
    exit /b 1
)
for /f "delims=" %%v in ('node -p "process.versions.node.split('.')[0]"') do set NODE_MAIOR=%%v
if !NODE_MAIOR! LSS 20 (
    echo.
    echo   [X] PAROU AQUI: o Node e antigo demais ^(precisa ser 20+^).
    echo       Instale a versao LTS por cima: https://nodejs.org
    echo.
    pause
    exit /b 1
)
for /f "delims=" %%v in ('node --version') do echo       [OK] Node %%v

REM -- 2. Onde guardar -------------------------------------------------------
echo.
echo   [2/4] Onde guardar o sistema
echo.
echo       Na sua pasta Documentos: !DESTINO_PADRAO!

REM Aviso honesto ANTES da pergunta, para que ainda de para escolher outro
REM caminho. Com o OneDrive, a pasta Documentos e SINCRONIZADA -- o painel
REM funciona igual, mas as dezenas de milhares de pecas do node_modules entram
REM na fila de sincronizacao. Melhor o Operador saber agora do que descobrir
REM depois pelo disco cheio.
echo !DESTINO_PADRAO!| findstr /i /c:"OneDrive" >nul
if not errorlevel 1 (
    echo.
    echo       Atencao: sua pasta Documentos e sincronizada no OneDrive.
    echo       O painel funciona igual, mas as pecas do sistema ^(milhares de
    echo       arquivos^) vao subir junto. Se preferir evitar, digite outro
    echo       caminho abaixo -- por exemplo: %USERPROFILE%\AR10-CYBORG
)

echo.
set "ESCOLHA="
set /p "ESCOLHA=      Aperte ENTER para aceitar, ou digite outro caminho: "
if "!ESCOLHA!"=="" (set "DESTINO=!DESTINO_PADRAO!") else (set "DESTINO=!ESCOLHA!")
echo       [OK] !DESTINO!

REM A pasta Documentos existe em qualquer Windows, mas um caminho digitado a
REM mao pode ter um nivel que ainda nao existe. `mkdir` aqui so cria o CAMINHO
REM ate o destino -- nunca toca no que ja esta la.
for %%p in ("!DESTINO!\..") do set "PAI=%%~fp"
if not exist "!PAI!" mkdir "!PAI!" >nul 2>&1

REM -- 3. Baixar -------------------------------------------------------------
echo.
echo   [3/4] Baixando o sistema do GitHub
echo.

if exist "!DESTINO!\.git" (
    echo       Ja existe uma instalacao aqui -- vou so atualizar.
    pushd "!DESTINO!"
    git fetch origin "!RAMO!" >nul 2>&1
    git checkout "!RAMO!" >nul 2>&1
    git pull --ff-only >nul 2>&1
    popd
    echo       [OK] pronto
    goto fimDownload
)

REM NUNCA apaga uma pasta com conteudo. Se alguem apontar para a pasta errada
REM -- Documentos, Area de Trabalho -- apagar levaria junto o que estava la.
if exist "!DESTINO!\*" (
    echo.
    echo   [X] PAROU AQUI: a pasta !DESTINO! ja existe e NAO esta vazia.
    echo       Escolha outro caminho, ou apague/renomeie essa pasta voce mesmo.
    echo       Nao vou mexer no que ja esta la.
    echo.
    pause
    exit /b 1
)

where git >nul 2>&1
if errorlevel 1 goto baixarZip

echo       Usando git ^(melhor: depois atualiza sozinho^)...
echo       Se o repositorio for privado, o GitHub vai pedir seu login agora.
echo.
git clone --branch "!RAMO!" --single-branch "https://github.com/!REPO!.git" "!DESTINO!"
if errorlevel 1 (
    echo.
    echo   [X] PAROU AQUI: o download falhou. Duas causas provaveis:
    echo       - repositorio PRIVADO e login nao aceito. No Windows o Git abre
    echo         uma janela do navegador para entrar na conta -- se nao abriu,
    echo         instale o Git de novo marcando "Git Credential Manager".
    echo       - sem internet -- verifique a conexao.
    echo.
    pause
    exit /b 1
)
echo       [OK] baixado
goto fimDownload

:baixarZip
echo       [!] git nao encontrado -- baixando o ZIP
echo           ^(funciona igual, mas nao vai se atualizar sozinho depois;
echo            para atualizacao automatica: https://git-scm.com/downloads^)
echo.
set "TMPZIP=%TEMP%\ar10-%RANDOM%"
mkdir "!TMPZIP!" >nul 2>&1
powershell -NoProfile -Command "$ErrorActionPreference='Stop'; try { Invoke-WebRequest -Uri 'https://codeload.github.com/%REPO%/zip/refs/heads/%RAMO%' -OutFile '!TMPZIP!\ar10.zip'; Expand-Archive -Path '!TMPZIP!\ar10.zip' -DestinationPath '!TMPZIP!' -Force; exit 0 } catch { exit 1 }"
if errorlevel 1 (
    rmdir /s /q "!TMPZIP!" >nul 2>&1
    echo.
    echo   [X] PAROU AQUI: o download do ZIP falhou.
    echo.
    echo       Se o repositorio JA FOI TORNADO PRIVADO, este caminho nao
    echo       funciona mais -- ZIP anonimo so existe em repositorio publico.
    echo       A saida e instalar o Git ^(https://git-scm.com/downloads^) e rodar
    echo       este instalador de novo: ele pede seu login e funciona normal.
    echo.
    echo       Se o repositorio ainda e publico, entao e internet.
    echo.
    pause
    exit /b 1
)
for /d %%d in ("!TMPZIP!\AR10-ORION-*") do set "PASTA_INTERNA=%%d"
if not defined PASTA_INTERNA (
    echo   [X] PAROU AQUI: o ZIP veio com uma estrutura inesperada.
    pause
    exit /b 1
)
move "!PASTA_INTERNA!" "!DESTINO!" >nul 2>&1
if errorlevel 1 (
    echo   [X] PAROU AQUI: nao consegui mover os arquivos para !DESTINO!.
    pause
    exit /b 1
)
rmdir /s /q "!TMPZIP!" >nul 2>&1
echo       [OK] baixado

:fimDownload

REM -- 4. Entregar para o instalador de dentro -------------------------------
echo.
echo   [4/4] Preparando e ligando o painel
echo.
set "INTERNO=!DESTINO!\INSTALAR-E-RODAR.bat"
if not exist "!INTERNO!" (
    echo   [X] PAROU AQUI: nao encontrei o instalador dentro da pasta baixada.
    echo       O download pode ter vindo incompleto -- apague !DESTINO! e tente de novo.
    echo.
    pause
    exit /b 1
)

echo       A partir daqui, para ligar de novo e so clicar em:
echo       !INTERNO!
echo       ^(guarde esse caminho -- ele ja atualiza o sistema junto^)
echo.
timeout /t 2 /nobreak >nul

call "!INTERNO!"
exit /b 0
