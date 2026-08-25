@echo off
REM INSTALAR-E-RODAR.bat -- Windows.
REM
REM Clique duplo. Faz tudo: atualiza, prepara e liga.
REM Mesmo conteudo do INSTALAR-E-RODAR.command (Mac/Linux).
REM
REM ATUALIZA SOZINHO: se a pasta veio de `git clone`, busca as atualizacoes a
REM cada execucao -- nada de baixar ZIP de novo quando o sistema evolui. Se
REM veio de ZIP, avisa e explica como trocar uma vez so; nao converte por
REM conta propria, porque mexer no jeito como a pasta existe e decisao de quem
REM instalou.
REM
REM REDE LOCAL: liga com --host, entao o painel fica acessivel do iPad e do
REM celular na MESMA rede. Qualquer aparelho da rede alcanca, com a senha como
REM unica barreira -- isso esta dito na tela, nao escondido aqui.

setlocal enabledelayedexpansion
cd /d "%~dp0"

echo.
echo   ============================================
echo      AR10 CYBORG -- atualizar e rodar
echo   ============================================
echo.

REM -- 1. Node ---------------------------------------------------------------
echo   [1/5] Procurando o Node...
where node >nul 2>&1
if errorlevel 1 (
    echo.
    echo   [X] PAROU AQUI: o Node nao esta instalado nesta maquina.
    echo       Baixe a versao LTS em https://nodejs.org , instale ^(e so avancar^),
    echo       e clique neste arquivo de novo.
    echo.
    pause
    exit /b 1
)
for /f "delims=" %%v in ('node -p "process.versions.node.split('.')[0]"') do set NODE_MAIOR=%%v
if !NODE_MAIOR! LSS 20 (
    echo.
    echo   [X] PAROU AQUI: o Node instalado e antigo demais ^(precisa ser 20 ou maior^).
    echo       Baixe a versao LTS em https://nodejs.org e clique neste arquivo de novo.
    echo.
    pause
    exit /b 1
)
for /f "delims=" %%v in ('node --version') do echo       [OK] Node %%v

REM -- 2. Atualizacao automatica --------------------------------------------
echo.
echo   [2/5] Buscando atualizacoes
set "ATUALIZOU=nao"
where git >nul 2>&1
if errorlevel 1 goto semGit
if not exist ".git" goto semGit
for /f "delims=" %%h in ('git rev-parse HEAD 2^>nul') do set ANTES=%%h
REM Nunca descarta trabalho local: havendo mudanca nao salva, AVISA e segue
REM sem atualizar, em vez de sobrescrever silenciosamente.
for /f "delims=" %%s in ('git status --porcelain 2^>nul') do set SUJO=1
if defined SUJO (
    echo       [!] ha mudancas locais nao salvas -- nao vou atualizar por cima
    echo           ^(o painel roda normalmente com o que ja esta aqui^)
    goto fimAtualizacao
)
git pull --ff-only >nul 2>&1
if errorlevel 1 (
    echo       [!] nao consegui buscar atualizacoes ^(sem internet, ou login necessario^)
    echo           ^(o painel roda normalmente com o que ja esta aqui^)
    goto fimAtualizacao
)
for /f "delims=" %%h in ('git rev-parse HEAD 2^>nul') do set DEPOIS=%%h
if not "!ANTES!"=="!DEPOIS!" (
    echo       [OK] atualizado
    set "ATUALIZOU=sim"
) else (
    echo       [OK] ja estava na versao mais recente
)
goto fimAtualizacao

:semGit
echo       [!] esta pasta veio de ZIP -- nao atualiza sozinha
echo.
echo           Para nunca mais baixar ZIP na mao, instale UMA VEZ assim,
echo           numa pasta nova ^(peca para quem entende, se preferir^):
echo.
echo             git clone https://github.com/AR10-10/AR10-ORION.git
echo.
echo           Depois e so clicar neste arquivo la dentro: ele se atualiza
echo           sozinho toda vez.

:fimAtualizacao

REM -- 3. Senha --------------------------------------------------------------
echo.
echo   [3/5] Senha do painel
set "TEM_SENHA="
if exist "ipad_runtime\ramber-ui\.env.local" (
    findstr /R /C:"^VITE_ACCESS_HASH=[0-9a-fA-F][0-9a-fA-F]*$" "ipad_runtime\ramber-ui\.env.local" >nul 2>&1
    if not errorlevel 1 set TEM_SENHA=1
)
if defined TEM_SENHA (
    REM Ja configurada: nao pergunta de novo. Perguntar toda vez
    REM transformaria o uso diario num formulario.
    echo       [OK] ja configurada ^(para trocar, apague o arquivo
    echo            ipad_runtime\ramber-ui\.env.local e rode de novo^)
    goto fimSenha
)
echo       Ela so vale nesta maquina. Nunca e gravada -- so o codigo
echo       embaralhado dela ^(hash^) vai para um arquivo local.
echo.
set "SENHA="
:pedirSenha
set /p "SENHA=      Escolha uma senha (minimo 4 caracteres): "
if "!SENHA!"=="" goto pedirSenha
call :tamanho "!SENHA!" TAM
if !TAM! LSS 4 (
    echo       muito curta, tente de novo
    set "SENHA="
    goto pedirSenha
)
node ipad_runtime\tools\setup-local.mjs "!SENHA!" >nul 2>&1
if errorlevel 1 (
    echo.
    echo   [X] PAROU AQUI: nao consegui preparar a senha.
    echo.
    pause
    exit /b 1
)
set "SENHA="
echo       [OK] senha preparada
:fimSenha

REM -- 4. Dependencias -------------------------------------------------------
echo.
echo   [4/5] Pecas do sistema
cd ipad_runtime\ramber-ui
REM `--include=dev` NAO e enfeite. Pego rodando o instalador de ponta a ponta:
REM numa maquina com a variavel NODE_ENV valendo "production", o `npm ci` pula
REM TODAS as pecas de desenvolvimento -- e o vite, que e justamente o motor que
REM liga o painel, e uma delas. O npm termina dizendo "sucesso" (32 pacotes em
REM vez de 87) e so la na frente aparece `vite: not found`, sem nenhuma pista
REM da causa. Este sinalizador forca a instalacao completa, independente de
REM como a maquina do Operador estiver configurada.
if not exist node_modules (
    echo       Instalando. Demora alguns minutos NA PRIMEIRA VEZ -- nao feche.
    echo.
    call npm ci --include=dev
    if errorlevel 1 (
        echo.
        echo   [X] PAROU AQUI: a instalacao das pecas falhou.
        echo       Verifique a internet e tente de novo.
        echo.
        pause
        exit /b 1
    )
    echo.
    echo       [OK] instaladas
) else (
    if "!ATUALIZOU!"=="sim" (
        REM Uma atualizacao pode ter trazido dependencias novas. Reinstalar so
        REM nesse caso evita minutos de espera em toda execucao.
        echo       O sistema foi atualizado -- conferindo se ha pecas novas...
        call npm ci --include=dev
        if errorlevel 1 (
            echo.
            echo   [X] PAROU AQUI: a atualizacao das pecas falhou.
            echo.
            pause
            exit /b 1
        )
        echo       [OK] em dia
    ) else (
        echo       [OK] ja estavam instaladas
    )
)

REM Confere a peca que REALMENTE liga o painel, em vez de confiar no "sucesso"
REM do npm. Sem esta checagem o Operador veria `vite: not found` -- uma
REM mensagem que nao diz nada a quem nao programa.
if not exist "node_modules\.bin\vite.cmd" (
    echo.
    echo   [X] PAROU AQUI: as pecas foram instaladas, mas o motor do painel
    echo       ^(vite^) nao veio junto.
    echo.
    echo       Causa quase certa: esta maquina tem a variavel NODE_ENV valendo
    echo       "production", e isso faz o npm pular as pecas de desenvolvimento.
    echo       Saida: apague a pasta ipad_runtime\ramber-ui\node_modules e
    echo       rode este arquivo de novo.
    echo.
    pause
    exit /b 1
)

REM -- 5. Ligar --------------------------------------------------------------
echo.
echo   [5/5] Ligando o painel...
for /f "delims=" %%i in ('node -e "const n=require('os').networkInterfaces();for(const k in n)for(const i of n[k]||[])if(i.family==='IPv4'^&^&!i.internal){console.log(i.address);process.exit(0)}"') do set IP_LOCAL=%%i
echo.
echo       Neste computador:  http://localhost:5173
if defined IP_LOCAL (
    echo       No iPad/celular:   http://!IP_LOCAL!:5173
    echo.
    echo       Atencao: qualquer aparelho na SUA rede alcanca esse endereco.
    echo       A senha e a unica barreira. Numa rede de casa esta ok; numa rede
    echo       publica ou compartilhada, nao use.
) else (
    echo       ^(nao consegui descobrir o endereco da rede local^)
)
echo.
echo       Abre em janela de APLICATIVO ^(sem barra de endereco^), se voce tiver
echo       Chrome ou Edge. Senao, abre no navegador padrao.
echo.
echo       Quer o icone no computador? No Chrome/Edge: menu ^(...^) ^>
echo       "Instalar AR10 CYBORG" -- vira app de verdade, com icone.
echo.
echo       Desligar: feche esta janela, ou Control+C.
echo       Ligar de novo: clique neste arquivo outra vez -- ele ja atualiza junto.
echo.

REM MODO APLICATIVO (pedido do Operador: "abrir ja o modo aplicativo, bem
REM profissional, igual abrindo no outro" -- no iPad ele usa como app da tela
REM de inicio, sem barra de endereco).
REM
REM `--app=URL` no Chrome/Edge abre uma janela LIMPA: sem barra de endereco,
REM sem abas, sem menus. Edge existe em todo Windows 10/11, entao o fallback
REM praticamente sempre pega. Ultimo recurso: navegador padrao -- abrir de
REM algum jeito e melhor do que nao abrir.
set "APPURL=http://localhost:5173"
set "NAV="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "NAV=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined NAV if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "NAV=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined NAV if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "NAV=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if not defined NAV if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "NAV=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not defined NAV if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "NAV=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"

REM ESPERAR O SERVIDOR, NAO UM TEMPO FIXO.
REM
REM A versao anterior dormia 5 segundos e abria. Numa primeira execucao -- ou
REM numa maquina mais lenta -- o Vite ainda nao respondeu aos 5 segundos, e a
REM janela de aplicativo abriria direto num erro de conexao. Aqui a porta e
REM testada de verdade, e a janela so abre quando o painel responde. Teto de
REM ~45s para nunca ficar preso.
REM
REM PowerShell em vez de `cmd /c "... && start """" ...`: aquele encadeamento
REM precisava de aspas dentro de aspas dentro de aspas, e o caminho do Chrome
REM contem parenteses ("Program Files (x86)"). Uma aspa a mais ali falha em
REM silencio -- o painel liga e a janela simplesmente nunca abre.
set "PSESPERA=for($i=0;$i -lt 90;$i++){ try{ $c=New-Object Net.Sockets.TcpClient; $c.Connect('127.0.0.1',5173); $c.Close(); break }catch{ Start-Sleep -Milliseconds 500 } };"
if defined NAV (
    start "" /min powershell -NoProfile -WindowStyle Hidden -Command "!PSESPERA! Start-Process -FilePath '!NAV!' -ArgumentList '--app=!APPURL!'"
) else (
    start "" /min powershell -NoProfile -WindowStyle Hidden -Command "!PSESPERA! Start-Process '!APPURL!'"
)

call npm run dev -- --host
pause
exit /b 0

:tamanho
set "s=%~1"
set "n=0"
:loopTamanho
if defined s (
    set "s=!s:~1!"
    set /a n+=1
    goto loopTamanho
)
set "%~2=!n!"
exit /b 0
