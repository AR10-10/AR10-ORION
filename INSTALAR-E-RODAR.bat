@echo off
REM INSTALAR-E-RODAR.bat -- Windows.
REM
REM Feito para ser CLICADO DUAS VEZES, nao digitado. Mesmo conteudo do
REM INSTALAR-E-RODAR.command (Mac/Linux), escrito para o cmd do Windows.
REM
REM Nao instala o Node sozinho de proposito: instalar runtime na maquina de
REM alguem sem avisar e invasivo. Se faltar, PARA e diz o que baixar.

setlocal enabledelayedexpansion
cd /d "%~dp0"

echo.
echo   ============================================
echo      AR10 CYBORG -- instalar e rodar
echo   ============================================
echo.

REM -- 1. Node ---------------------------------------------------------------
echo   [1/4] Procurando o Node...
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

REM -- 2. Senha --------------------------------------------------------------
echo.
echo   [2/4] Senha do painel
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

REM -- 3. Dependencias -------------------------------------------------------
echo.
echo   [3/4] Instalando as pecas do sistema
cd ipad_runtime\ramber-ui
if exist node_modules (
    echo       [OK] ja estavam instaladas
) else (
    echo       Isto demora alguns minutos NA PRIMEIRA VEZ. Nao feche a janela.
    echo.
    call npm ci
    if errorlevel 1 (
        echo.
        echo   [X] PAROU AQUI: a instalacao das dependencias falhou.
        echo       Verifique se a internet esta funcionando e tente de novo.
        echo.
        pause
        exit /b 1
    )
    echo.
    echo       [OK] instaladas
)

REM -- 4. Ligar --------------------------------------------------------------
echo.
echo   [4/4] Ligando o painel...
echo.
echo       Vai abrir no navegador em http://localhost:5173
echo       Use a senha que voce acabou de escolher.
echo.
echo       Para DESLIGAR: feche esta janela, ou aperte Control+C.
echo       Para ligar de novo depois: clique neste arquivo outra vez.
echo.

REM Abre o navegador depois de uma espera curta -- se abrir antes do servidor
REM responder, o navegador mostra erro e o Operador acha que nao funcionou.
start "" cmd /c "timeout /t 5 /nobreak >nul && start http://localhost:5173"

call npm run dev
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
