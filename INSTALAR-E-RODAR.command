#!/bin/bash
# INSTALAR-E-RODAR.command — Mac e Linux.
#
# Feito para ser CLICADO DUAS VEZES, não digitado. O Operador disse, com
# todas as letras, que não sabe fazer o download nem instalar — então este
# arquivo faz tudo: confere o Node, instala as dependências, prepara a senha
# e liga o painel, explicando cada passo em português enquanto trabalha.
#
# Ele não instala o Node sozinho de propósito: instalar runtime na máquina de
# alguém sem avisar é invasivo. Se faltar, ele PARA e diz exatamente o que
# baixar e onde.

cd "$(dirname "$0")" || exit 1

VERDE='\033[0;32m'; VERMELHO='\033[0;31m'; AMARELO='\033[1;33m'; FORTE='\033[1m'; FIM='\033[0m'

echo ""
echo -e "${FORTE}  ╔══════════════════════════════════════════╗${FIM}"
echo -e "${FORTE}  ║   AR10 CYBORG — instalar e rodar         ║${FIM}"
echo -e "${FORTE}  ╚══════════════════════════════════════════╝${FIM}"
echo ""

parar() {
  echo ""
  echo -e "${VERMELHO}  ✗ PAROU AQUI:${FIM} $1"
  [ -n "$2" ] && echo -e "    $2"
  echo ""
  echo "  (esta janela fica aberta — leia a mensagem acima)"
  read -r -p "  Pressione ENTER para fechar..."
  exit 1
}

# ── 1. Node ────────────────────────────────────────────────────────────────
echo -e "  ${FORTE}[1/4]${FIM} Procurando o Node..."
if ! command -v node >/dev/null 2>&1; then
  parar "o Node não está instalado nesta máquina." \
    "Baixe a versão LTS em https://nodejs.org , instale (é só avançar), e clique neste arquivo de novo."
fi
NODE_MAIOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null)"
if [ -z "$NODE_MAIOR" ] || [ "$NODE_MAIOR" -lt 20 ]; then
  parar "o Node instalado é antigo demais (versão $(node --version), precisa ser 20 ou maior)." \
    "Baixe a versão LTS em https://nodejs.org e clique neste arquivo de novo."
fi
echo -e "      ${VERDE}✓${FIM} Node $(node --version)"

# ── 2. Senha ───────────────────────────────────────────────────────────────
echo ""
echo -e "  ${FORTE}[2/4]${FIM} Senha do painel"
echo "      Ela só vale nesta máquina. Nunca é gravada — só o código"
echo "      embaralhado dela (hash) vai para um arquivo local."
echo ""
SENHA=""
TENTATIVAS=0
while [ ${#SENHA} -lt 4 ]; do
  # `|| break` é essencial: sem ele, uma entrada fechada (EOF) faz `read`
  # devolver vazio para sempre e o laço gira infinitamente. Pego por teste
  # real — um instalador que congela é pior do que um que recusa.
  read -r -s -p "      Escolha uma senha (mínimo 4 caracteres): " SENHA || break
  echo ""
  TENTATIVAS=$((TENTATIVAS + 1))
  if [ ${#SENHA} -lt 4 ]; then
    echo -e "      ${AMARELO}muito curta, tente de novo${FIM}"
    [ "$TENTATIVAS" -ge 5 ] && break
  fi
done
if [ ${#SENHA} -lt 4 ]; then
  parar "não recebi uma senha válida." \
    "Se você clicou duas vezes e a janela não deixou digitar, abra o Terminal nesta pasta e rode: ./INSTALAR-E-RODAR.command"
fi
node ipad_runtime/tools/setup-local.mjs "$SENHA" >/dev/null 2>&1 \
  || parar "não consegui preparar a senha." "Rode manualmente: node ipad_runtime/tools/setup-local.mjs \"sua-senha\""
SENHA=""
echo -e "      ${VERDE}✓${FIM} senha preparada"

# ── 3. Dependências ────────────────────────────────────────────────────────
echo ""
echo -e "  ${FORTE}[3/4]${FIM} Instalando as peças do sistema"
cd ipad_runtime/ramber-ui || parar "não encontrei a pasta do painel." "O arquivo ZIP pode ter sido descompactado pela metade."
if [ -d node_modules ]; then
  echo -e "      ${VERDE}✓${FIM} já estavam instaladas"
else
  echo "      Isto demora alguns minutos NA PRIMEIRA VEZ. Não feche a janela."
  echo ""
  npm ci || parar "a instalação das dependências falhou." "Verifique se a internet está funcionando e tente de novo."
  echo ""
  echo -e "      ${VERDE}✓${FIM} instaladas"
fi

# ── 4. Ligar ───────────────────────────────────────────────────────────────
echo ""
echo -e "  ${FORTE}[4/4]${FIM} Ligando o painel..."
echo ""
echo -e "      Vai abrir no navegador em ${FORTE}http://localhost:5173${FIM}"
echo "      Use a senha que você acabou de escolher."
echo ""
echo -e "      ${AMARELO}Para DESLIGAR:${FIM} feche esta janela, ou aperte Control+C."
echo -e "      ${AMARELO}Para ligar de novo depois:${FIM} clique neste arquivo outra vez."
echo ""

# Abre o navegador sozinho depois que o servidor sobe. Em segundo plano, com
# uma espera curta — se abrir antes do servidor responder, o navegador mostra
# erro e o Operador acha que não funcionou.
( sleep 4
  if command -v open >/dev/null 2>&1; then open http://localhost:5173
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open http://localhost:5173
  fi ) >/dev/null 2>&1 &

npm run dev
