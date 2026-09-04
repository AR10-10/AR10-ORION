#!/bin/bash
# INSTALAR-E-RODAR.command — Mac e Linux.
#
# Clique duplo. Faz tudo: atualiza, prepara e liga.
#
# ═══ POR QUE ELE ATUALIZA SOZINHO ═══
#
# Pedido do Operador: "ele fazer o restante tudo automático... não precisa
# estar fazendo download manual". Se a pasta veio de `git clone`, este script
# BUSCA AS ATUALIZAÇÕES sozinho a cada vez que roda — nada de baixar ZIP de
# novo quando o sistema evolui.
#
# Se veio de ZIP (sem `.git`), ele avisa e explica como trocar uma vez só.
# Não converte por conta própria: mexer no jeito como a pasta existe é
# decisão de quem instalou, não do script.
#
# ═══ REDE LOCAL ═══
#
# Liga com `--host` para o painel ficar acessível do iPad e do celular na
# MESMA rede. O endereço aparece na tela. Isso é o que o Operador pediu — e
# significa que qualquer aparelho na rede alcança o painel, com a senha como
# única barreira. Está dito na tela, não escondido aqui.

cd "$(dirname "$0")" || exit 1

VERDE='\033[0;32m'; VERMELHO='\033[0;31m'; AMARELO='\033[1;33m'; AZUL='\033[0;36m'; FORTE='\033[1m'; FIM='\033[0m'

echo ""
echo -e "${FORTE}  ╔══════════════════════════════════════════╗${FIM}"
echo -e "${FORTE}  ║   AR10 CYBORG — atualizar e rodar        ║${FIM}"
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
echo -e "  ${FORTE}[1/5]${FIM} Procurando o Node..."
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

# ── 2. Atualização automática ──────────────────────────────────────────────
echo ""
echo -e "  ${FORTE}[2/5]${FIM} Buscando atualizações"
ATUALIZOU="nao"
if [ -d .git ] && command -v git >/dev/null 2>&1; then
  ANTES="$(git rev-parse HEAD 2>/dev/null)"
  # Nunca descarta trabalho local: se houver mudança não salva, o script
  # AVISA e segue sem atualizar, em vez de sobrescrever silenciosamente.
  if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
    echo -e "      ${AMARELO}!${FIM} há mudanças locais não salvas — não vou atualizar por cima"
    echo "        (o painel roda normalmente com o que já está aqui)"
  elif git pull --ff-only >/dev/null 2>&1; then
    DEPOIS="$(git rev-parse HEAD 2>/dev/null)"
    if [ "$ANTES" != "$DEPOIS" ]; then
      echo -e "      ${VERDE}✓${FIM} atualizado ($(git log --oneline -1 | cut -c1-60))"
      ATUALIZOU="sim"
    else
      echo -e "      ${VERDE}✓${FIM} já estava na versão mais recente"
    fi
  else
    echo -e "      ${AMARELO}!${FIM} não consegui buscar atualizações (sem internet, ou login necessário)"
    echo "        (o painel roda normalmente com o que já está aqui)"
  fi
else
  echo -e "      ${AMARELO}!${FIM} esta pasta veio de ZIP — não atualiza sozinha"
  echo ""
  echo "        Para nunca mais baixar ZIP na mão, instale UMA VEZ assim,"
  echo "        numa pasta nova (peça para quem entende, se preferir):"
  echo ""
  echo -e "          ${AZUL}git clone https://github.com/AR10-10/AR10-ORION.git${FIM}"
  echo ""
  echo "        Depois é só clicar neste arquivo lá dentro: ele se atualiza"
  echo "        sozinho toda vez."
fi

# ── 3. Senha ───────────────────────────────────────────────────────────────
echo ""
echo -e "  ${FORTE}[3/5]${FIM} Senha do painel"
if [ -f ipad_runtime/ramber-ui/.env.local ] && grep -q '^VITE_ACCESS_HASH=[0-9a-fA-F]\{64\}$' ipad_runtime/ramber-ui/.env.local 2>/dev/null; then
  # Já configurada: não pergunta de novo. Perguntar toda vez transformaria
  # o uso diário num formulário.
  echo -e "      ${VERDE}✓${FIM} já configurada (para trocar, apague o arquivo"
  echo "        ipad_runtime/ramber-ui/.env.local e rode de novo)"
else
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
fi

# ── 4. Dependências ────────────────────────────────────────────────────────
echo ""
echo -e "  ${FORTE}[4/5]${FIM} Peças do sistema"
cd ipad_runtime/ramber-ui || parar "não encontrei a pasta do painel." "O download pode ter vindo pela metade."
# `--include=dev` NÃO é enfeite. Pego rodando o instalador de ponta a ponta:
# numa máquina com a variável NODE_ENV valendo "production", o `npm ci` pula
# TODAS as peças de desenvolvimento — e o vite, que é justamente o motor que
# liga o painel, é uma delas. O npm termina dizendo "sucesso" (32 pacotes em
# vez de 87) e só lá na frente aparece `vite: not found`, sem nenhuma pista da
# causa. Este sinalizador força a instalação completa, independente de como a
# máquina do Operador estiver configurada.
if [ ! -d node_modules ]; then
  echo "      Instalando. Demora alguns minutos NA PRIMEIRA VEZ — não feche."
  echo ""
  npm ci --include=dev || parar "a instalação das peças falhou." "Verifique a internet e tente de novo."
  echo ""
  echo -e "      ${VERDE}✓${FIM} instaladas"
elif [ "$ATUALIZOU" = "sim" ]; then
  # Uma atualização pode ter trazido dependências novas. Reinstalar só nesse
  # caso evita minutos de espera em toda execução.
  echo "      O sistema foi atualizado — conferindo se há peças novas..."
  npm ci --include=dev || parar "a atualização das peças falhou." "Verifique a internet e tente de novo."
  echo -e "      ${VERDE}✓${FIM} em dia"
else
  echo -e "      ${VERDE}✓${FIM} já estavam instaladas"
fi

# Confere a peça que REALMENTE liga o painel, em vez de confiar no "sucesso"
# do npm. Sem esta checagem o Operador veria `sh: vite: not found` — uma
# mensagem que não diz nada a quem não programa.
if [ ! -x node_modules/.bin/vite ]; then
  parar "as peças foram instaladas, mas o motor do painel (vite) não veio junto." \
    "Causa quase certa: esta máquina tem a variável NODE_ENV valendo 'production', e isso faz o npm pular as peças de desenvolvimento.
    Saída: apague a pasta ipad_runtime/ramber-ui/node_modules e rode este arquivo de novo."
fi

# ── 5. Ligar ───────────────────────────────────────────────────────────────
echo ""
echo -e "  ${FORTE}[5/5]${FIM} Ligando o painel..."

IP_LOCAL="$(node -e '
const os = require("os");
const nets = os.networkInterfaces();
for (const nome of Object.keys(nets)) {
  for (const n of nets[nome] || []) {
    if (n.family === "IPv4" && !n.internal) { console.log(n.address); process.exit(0); }
  }
}
' 2>/dev/null)"

echo ""
echo -e "      Neste computador:  ${FORTE}http://localhost:5173${FIM}"
if [ -n "$IP_LOCAL" ]; then
  echo -e "      No iPad/celular:   ${FORTE}http://${IP_LOCAL}:5173${FIM}"
  echo ""
  echo -e "      ${AMARELO}Atenção:${FIM} qualquer aparelho na SUA rede alcança esse endereço."
  echo "      A senha é a única barreira. Numa rede de casa está ok; numa rede"
  echo "      pública ou compartilhada, não use."
else
  echo "      (não consegui descobrir o endereço da rede local)"
fi
echo ""
echo -e "      ${AZUL}Abre em janela de APLICATIVO${FIM} (sem barra de endereço), se você"
echo -e "      ${AZUL}tiver Chrome, Edge ou Brave. Senão, abre no navegador padrão.${FIM}"
echo ""
echo -e "      ${AZUL}Quer o ícone no computador?${FIM} No Chrome/Edge: menu (⋮) >"
echo -e "      ${AZUL}\"Instalar AR10 CYBORG\" — vira app de verdade, com ícone.${FIM}"
echo ""
echo -e "      ${AMARELO}Desligar:${FIM} feche esta janela, ou Control+C."
echo -e "      ${AMARELO}Ligar de novo:${FIM} clique neste arquivo outra vez — ele já atualiza junto."
echo ""

# MODO APLICATIVO (pedido do Operador: "abrir já o modo aplicativo, bem
# profissional, igual abrindo no outro" — no iPad ele usa como app da tela de
# início, sem barra de endereço).
#
# `--app=URL` no Chrome/Edge abre uma janela LIMPA: sem barra de endereço, sem
# abas, sem menus. É o mais perto de um aplicativo nativo sem empacotar nada.
# Fallback em cascata até o navegador comum — abrir de algum jeito é melhor do
# que não abrir, e o painel funciona igual nos dois.
abrir_como_app() {
  local URL="http://localhost:5173"
  if [ "$(uname)" = "Darwin" ]; then
    open -na "Google Chrome" --args --app="$URL" 2>/dev/null && return 0
    open -na "Microsoft Edge" --args --app="$URL" 2>/dev/null && return 0
    open -na "Brave Browser" --args --app="$URL" 2>/dev/null && return 0
    open "$URL" 2>/dev/null && return 0
  else
    for NAV in google-chrome google-chrome-stable chromium chromium-browser microsoft-edge brave-browser; do
      command -v "$NAV" >/dev/null 2>&1 && { "$NAV" --app="$URL" >/dev/null 2>&1 & return 0; }
    done
    command -v xdg-open >/dev/null 2>&1 && { xdg-open "$URL" >/dev/null 2>&1 & return 0; }
  fi
  return 1
}

# ESPERAR O SERVIDOR, NÃO UM TEMPO FIXO.
#
# A versão anterior dormia 4 segundos e abria. Numa primeira execução — ou
# numa máquina mais lenta — o Vite ainda não respondeu aos 4 segundos, e a
# janela de aplicativo abriria direto num erro de conexão. Aqui a porta é
# testada de verdade (bash abre um socket em /dev/tcp) e a janela só abre
# quando o painel realmente responde. Teto de ~45s para nunca ficar preso.
esperar_servidor() {
  local TENTATIVA=0
  while [ "$TENTATIVA" -lt 90 ]; do
    if (exec 3<>/dev/tcp/127.0.0.1/5173) 2>/dev/null; then
      exec 3<&- 3>&- 2>/dev/null
      return 0
    fi
    sleep 0.5
    TENTATIVA=$((TENTATIVA + 1))
  done
  return 1
}
( esperar_servidor && abrir_como_app ) >/dev/null 2>&1 &

npm run dev -- --host
