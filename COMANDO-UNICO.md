# COMANDO ÚNICO — copiar, colar, pronto

Pedido do Operador: *"faz um comando pra mim jogar no CMD e ele executar tudo,
criar as pasta correta já com nome, com tudo, pra não precisar fazer manual"*.

**Não precisa baixar arquivo nenhum.** Copie a linha do seu sistema, cole, e
aperte ENTER.

---

## WINDOWS

Abra o **Prompt de Comando** (aperte a tecla Windows, digite `cmd`, ENTER) e
cole isto:

```
curl -fsSL -o "%TEMP%\AR10-INSTALADOR.bat" "https://raw.githubusercontent.com/AR10-10/AR10-ORION/refs/heads/claude/eloquent-cannon-qyt86y/AR10-INSTALADOR.bat" && "%TEMP%\AR10-INSTALADOR.bat"
```

> **Se disser que `curl` não é reconhecido** (Windows 8 ou muito antigo), use
> esta versão pelo PowerShell:
>
> ```
> powershell -NoProfile -ExecutionPolicy Bypass -Command "$u='https://raw.githubusercontent.com/AR10-10/AR10-ORION/refs/heads/claude/eloquent-cannon-qyt86y/AR10-INSTALADOR.bat'; $f=\"$env:TEMP\AR10-INSTALADOR.bat\"; Invoke-WebRequest -UseBasicParsing $u -OutFile $f; & $f"
> ```

---

## MAC

Abra o **Terminal** (Command+Espaço, digite `terminal`, ENTER) e cole:

```sh
curl -fsSL "https://raw.githubusercontent.com/AR10-10/AR10-ORION/refs/heads/claude/eloquent-cannon-qyt86y/AR10-INSTALADOR.command" -o ~/AR10-INSTALADOR.command && chmod +x ~/AR10-INSTALADOR.command && ~/AR10-INSTALADOR.command
```

---

## O que vai acontecer

```
[1/4] Procurando o Node...
[2/4] Onde guardar o sistema        <- aperte ENTER
[3/4] Baixando o sistema do GitHub
[4/4] Preparando e ligando o painel <- digite uma senha
```

**Duas coisas você digita, e só:**

1. **ENTER** para aceitar a pasta sugerida — `AR10-CYBORG` **dentro dos seus
   Documentos**. Se quiser outra, digite o caminho.
2. **Uma senha** para o painel. Ela nunca é gravada — só o código embaralhado.

O resto é automático: cria a pasta, baixa tudo, instala as peças, liga o
painel e abre o navegador.

**A primeira vez demora alguns minutos** (instalando as peças). Não feche a
janela.

---

## Se o Node não estiver instalado

O comando vai parar e **abrir o site do Node sozinho**. Instale a versão
**LTS** (é só ir avançando) e cole o comando de novo.

Se preferir adiantar: <https://nodejs.org> → botão **LTS**.

---

## O que esse comando faz, em português claro

Colar comando da internet merece explicação, não confiança cega. Ele:

1. **Baixa um arquivo** do seu próprio repositório no GitHub — o endereço está
   na linha, você pode abrir no navegador e ler antes.
2. **Executa esse arquivo**, que é o mesmo instalador que já está no projeto
   (`AR10-INSTALADOR`).

Não instala nada escondido, não pede senha de administrador, não mexe em
configuração do sistema. Se quiser conferir antes, abra o endereço no
navegador — é texto puro, dá para ler inteiro.

---

## Depois de instalar

Para ligar de novo, **não use mais este comando**. Use o arquivo que ficou
dentro da pasta:

```
Documentos\AR10-CYBORG\INSTALAR-E-RODAR.bat        (Windows)
Documentos/AR10-CYBORG/INSTALAR-E-RODAR.command    (Mac)
```

Dois cliques. Ele já busca as atualizações sozinho antes de ligar.

> **Onde exatamente:** é a mesma pasta **Documentos** que aparece no
> Explorador (Windows) ou no Finder (Mac). Se o seu Documentos estiver no
> OneDrive ou no iCloud, o instalador detecta o caminho de verdade e usa
> aquele — mas avisa antes, porque nesse caso as peças do sistema também
> sobem para a nuvem.

---

## Aviso importante sobre o repositório privado

Este comando funciona **enquanto o repositório estiver público**. Assim que
você fechar (`FECHAR-ACESSO-PUBLICO.md`), o endereço passa a exigir login e o
comando para de funcionar sozinho.

**Por isso a ordem importa:**

1. Rode este comando **agora**, com o repositório ainda público
2. Confirme que o painel abre
3. **Só então** feche o acesso público

Depois de fechado, a instalação que já está na sua máquina continua
funcionando e atualizando normalmente (o Git pede seu login uma vez).
