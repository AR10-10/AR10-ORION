#!/bin/bash
# AR10-INSTALADOR.command — Mac e Linux.
#
# ═══ O QUE ESTE ARQUIVO É ═══
#
# É o ÚNICO arquivo que o Operador precisa baixar. Clique duplo e ele:
#   1. confere o Node;
#   2. pergunta onde guardar o sistema;
#   3. BAIXA TUDO do GitHub sozinho (git clone, ou ZIP se não houver git);
#   4. entrega o trabalho para o INSTALAR-E-RODAR.command de dentro da pasta,
#      que prepara a senha, instala as peças e liga o painel.
#
# Pedido do Operador: "tu gera um arquivo, executa ele, abaixa tudo que tem
# de baixar, arruma tudo no meu computador e faz todo processo tudinho, e
# depois abre o painel".
#
# ═══ POR QUE ELE NÃO DUPLICA A LÓGICA DE INSTALAÇÃO ═══
#
# Ele resolve UM problema — trazer os arquivos para a máquina — e entrega o
# resto para o instalador que já existe e já está testado. Duas cópias da
# mesma preparação divergiriam na primeira correção feita só num lado.
#
# ═══ POR QUE ELE NÃO PRECISA DE GIT ═══
#
# Git é o caminho melhor (permite atualização automática depois), mas não é
# requisito: sem ele, o script baixa o ZIP com `curl`, que existe em todo Mac
# e Linux. Exigir git seria travar o Operador num pré-requisito que ele não
# pediu.

set -u

VERDE='\033[0;32m'; VERMELHO='\033[0;31m'; AMARELO='\033[1;33m'; AZUL='\033[0;36m'; FORTE='\033[1m'; FIM='\033[0m'

REPO="AR10-10/AR10-ORION"
# RAMO: onde o trabalho realmente está. O `main` está MUITO atrás (a PR #15
# ainda não foi mesclada), então baixar `main` entregaria um sistema sem
# nenhuma das correções recentes. Quando a PR for mesclada, troque para
# "main" — é a única linha que muda.
RAMO="claude/eloquent-cannon-qyt86y"
DESTINO_PADRAO="$HOME/AR10-CYBORG"

echo ""
echo -e "${FORTE}  ╔══════════════════════════════════════════════╗${FIM}"
echo -e "${FORTE}  ║   AR10 CYBORG — instalador completo          ║${FIM}"
echo -e "${FORTE}  ╚══════════════════════════════════════════════╝${FIM}"
echo ""
echo "  Este arquivo baixa o sistema inteiro e deixa tudo pronto."
echo ""

parar() {
  echo ""
  echo -e "${VERMELHO}  ✗ PAROU AQUI:${FIM} $1"
  [ -n "${2:-}" ] && echo -e "    $2"
  echo ""
  read -r -p "  Pressione ENTER para fechar..." _ 2>/dev/null || true
  exit 1
}

# ── 1. Node ────────────────────────────────────────────────────────────────
echo -e "  ${FORTE}[1/4]${FIM} Procurando o Node..."
if ! command -v node >/dev/null 2>&1; then
  echo ""
  echo -e "  ${AMARELO}O Node não está instalado — ele é o motor do sistema.${FIM}"
  echo ""
  echo "  Vou abrir o site para você baixar. Instale a versão LTS (é só ir"
  echo "  avançando) e depois clique neste arquivo de novo."
  echo ""
  ( command -v open >/dev/null 2>&1 && open "https://nodejs.org" ) >/dev/null 2>&1 || true
  parar "instale o Node primeiro." "https://nodejs.org — versão LTS"
fi
NODE_MAIOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
if [ "$NODE_MAIOR" -lt 20 ]; then
  parar "o Node é antigo demais ($(node --version), precisa ser 20+)." \
    "Instale a versão LTS por cima: https://nodejs.org"
fi
echo -e "      ${VERDE}✓${FIM} Node $(node --version)"

# ── 2. Onde guardar ────────────────────────────────────────────────────────
echo ""
echo -e "  ${FORTE}[2/4]${FIM} Onde guardar o sistema"
echo ""
echo -e "      Sugestão: ${AZUL}${DESTINO_PADRAO}${FIM}"
read -r -p "      Aperte ENTER para aceitar, ou digite outro caminho: " ESCOLHA 2>/dev/null || ESCOLHA=""
DESTINO="${ESCOLHA:-$DESTINO_PADRAO}"
# Expande o ~ se o Operador digitar manualmente.
DESTINO="${DESTINO/#\~/$HOME}"
echo -e "      ${VERDE}✓${FIM} $DESTINO"

# ── 3. Baixar ──────────────────────────────────────────────────────────────
echo ""
echo -e "  ${FORTE}[3/4]${FIM} Baixando o sistema do GitHub"
echo ""

if [ -d "$DESTINO/.git" ]; then
  echo "      Já existe uma instalação aqui — vou só atualizar."
  ( cd "$DESTINO" && git fetch origin "$RAMO" --quiet && git checkout "$RAMO" --quiet 2>/dev/null; git pull --ff-only --quiet ) \
    || echo -e "      ${AMARELO}!${FIM} não consegui atualizar; seguindo com o que já está aí"
  echo -e "      ${VERDE}✓${FIM} pronto"
elif [ -d "$DESTINO" ] && [ -n "$(ls -A "$DESTINO" 2>/dev/null)" ]; then
  # NUNCA apaga uma pasta com conteúdo. Se alguém apontar para a pasta errada
  # — Documentos, Área de Trabalho — um `rm -rf` levaria junto o que estava lá.
  parar "a pasta $DESTINO já existe e NÃO está vazia." \
    "Escolha outro caminho, ou apague/renomeie essa pasta você mesmo. Não vou mexer no que já está lá."
elif command -v git >/dev/null 2>&1; then
  echo "      Usando git (melhor: depois atualiza sozinho)..."
  echo -e "      ${AMARELO}Se o repositório for privado, o GitHub vai pedir seu login agora.${FIM}"
  echo ""
  git clone --branch "$RAMO" --single-branch "https://github.com/${REPO}.git" "$DESTINO" \
    || parar "o download falhou." \
      "Duas causas prováveis:
    · repositório PRIVADO e login não aceito — no Mac/Linux o Git costuma pedir usuário e um TOKEN (não a senha da conta). Crie um em github.com > Settings > Developer settings > Personal access tokens, com permissão 'repo'.
    · sem internet — verifique a conexão."
  echo -e "      ${VERDE}✓${FIM} baixado"
else
  echo -e "      ${AMARELO}!${FIM} git não encontrado — baixando o ZIP"
  echo "        (funciona igual, mas não vai se atualizar sozinho depois;"
  echo -e "         para ter atualização automática, instale: ${AZUL}https://git-scm.com/downloads${FIM})"
  echo ""
  TMP="$(mktemp -d)"
  if ! curl -fL --progress-bar "https://codeload.github.com/${REPO}/zip/refs/heads/${RAMO}" -o "$TMP/ar10.zip"; then
    rm -rf "$TMP"
    # Causa MAIS PROVÁVEL depois que o repositório vira privado: o download
    # anônimo por ZIP deixa de existir (404). Dizer só "verifique a internet"
    # mandaria o Operador procurar no lugar errado.
    parar "o download do ZIP falhou." \
      "Se o repositório JÁ FOI TORNADO PRIVADO, este caminho não funciona mais — ZIP anônimo só existe em repositório público.
    A saída é instalar o Git (https://git-scm.com/downloads) e rodar este instalador de novo: ele vai pedir seu login do GitHub e funciona normalmente.
    Se o repositório ainda é público, então é internet: verifique a conexão."
  fi
  unzip -q "$TMP/ar10.zip" -d "$TMP" || parar "não consegui descompactar o arquivo baixado."
  PASTA_INTERNA="$(find "$TMP" -maxdepth 1 -type d -name 'AR10-ORION-*' | head -1)"
  [ -z "$PASTA_INTERNA" ] && parar "o ZIP veio com uma estrutura inesperada."
  mkdir -p "$(dirname "$DESTINO")"
  mv "$PASTA_INTERNA" "$DESTINO" || parar "não consegui mover os arquivos para $DESTINO."
  rm -rf "$TMP"
  echo -e "      ${VERDE}✓${FIM} baixado"
fi

# ── 4. Entregar para o instalador de dentro ────────────────────────────────
echo ""
echo -e "  ${FORTE}[4/4]${FIM} Preparando e ligando o painel"
echo ""
INTERNO="$DESTINO/INSTALAR-E-RODAR.command"
[ -f "$INTERNO" ] || parar "não encontrei o instalador dentro da pasta baixada." \
  "O download pode ter vindo incompleto — apague $DESTINO e tente de novo."
chmod +x "$INTERNO" 2>/dev/null || true

echo -e "      ${AZUL}A partir daqui, para ligar de novo é só clicar em:${FIM}"
echo -e "      ${FORTE}${INTERNO}${FIM}"
echo -e "      ${AZUL}(guarde esse caminho — ele já atualiza o sistema junto)${FIM}"
echo ""
sleep 2

exec "$INTERNO"
