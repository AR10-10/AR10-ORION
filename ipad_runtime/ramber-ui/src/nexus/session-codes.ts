// session-codes.ts — como uma sessão de mercado se escreve NO GRÁFICO.
//
// PEDIDO DIRETO DO OPERADOR: "o tamanho das etiquetas que fica no gráfico
// ainda tá grande... as letras que fica dentro, as INICIAIS dos nomes, não
// precisa os nome grande."
//
// RAIO-X REAL (medido, não estimado). Duas famílias de sessão viviam com
// nome longo e cada uma resolvia o encurtamento por conta própria — ou não
// resolvia:
//
//   market-session.ts  → "Ásia" "Londres" "Londres+NY" "Nova York" "Pacífico"
//     MarketSessionBandsPlugin desenhava `level.label.toUpperCase()` direto
//     na faixa do topo: "LONDRES+NY" (10 caracteres), "NOVA YORK" (9).
//     Numa faixa de 14px de altura, sobre as velas.
//
//   kill-zones.ts      → "Kill Zone · Ásia" ... "Kill Zone · Fechamento de
//     Londres" — TRINTA E TRÊS caracteres. E o prefixo "Kill Zone · " está
//     repetido nos 4, carregando zero informação: quem olha a camada de kill
//     zone já sabe que é kill zone.
//
// E O PIOR ACHADO — duplicação real, App.tsx:5561:
//
//     Kill Zone · {killZones.active.map((z) => z.label.replace("Kill Zone · ", "")).join(" + ")}
//
//   A UI escreve o prefixo à mão E O ARRANCA de volta de cada rótulo com um
//   replace de string. O mesmo texto existe em dois lugares e um deles é
//   removido em runtime por cirurgia de string. Se o prefixo em
//   kill-zones.ts mudar um caractere (um espaço, o "·"), o replace falha em
//   silêncio e a tela mostra "Kill Zone · Kill Zone · Ásia". Não é
//   hipotético: é o modo de falha exato desse padrão.
//
// A CORREÇÃO É DE MODELO, NÃO DE TEXTO: o dado passa a carregar o NOME
// (só o nome, sem prefixo de apresentação) e o CÓDIGO CURTO. Quem exibe
// decide o que compor. Nunca mais um replace.
//
// OS CÓDIGOS (convenção de mesa real, não invenção): as praças financeiras
// são abreviadas do mesmo jeito em qualquer terminal profissional — ASIA,
// LDN, NY. É o vocabulário que o Operador já lê em qualquer plataforma, e
// é literalmente "as iniciais" que ele pediu.
//
// Largura medida do maior código (LDN+NY, 6 caracteres) contra o maior
// nome anterior (10): o rótulo da faixa encolhe ~40% sem perder NADA — o
// nome completo continua real e visível no cabeçalho e nos tooltips, onde
// existe espaço horizontal de sobra.

/** Vocabulário unido das duas famílias. `LONDRES_CLOSE` só existe em kill
 *  zone; `LONDRES_NY`/`PACIFICO` só em sessão de mercado. Um tipo só para
 *  não haver dois mapas de abreviação divergindo com o tempo. */
export type SessionCodeId =
  | "ASIA"
  | "LONDRES"
  | "LONDRES_NY"
  | "NOVA_YORK"
  | "PACIFICO"
  | "LONDRES_CLOSE";

/** Código curto real desenhado no gráfico. Máximo 6 caracteres por
 *  construção — o teste trava esse teto. */
const SESSION_CODE: Record<SessionCodeId, string> = {
  ASIA: "ASIA",
  LONDRES: "LDN",
  LONDRES_NY: "LDN+NY",
  NOVA_YORK: "NY",
  PACIFICO: "PAC",
  // O fechamento de Londres é a MESMA praça num momento diferente: o
  // sufixo "-C" (close) é o que distingue, não um segundo nome. Mesma
  // convenção de "LDN" acima — nunca uma abreviação de família diferente.
  LONDRES_CLOSE: "LDN-C",
};

/** Teto real do código curto — o que garante que a faixa de 14px nunca
 *  volta a receber um nome inteiro. Exportado para o teste travar. */
export const SESSION_CODE_MAX_LENGTH = 6;

/**
 * Código curto desta sessão para desenho no gráfico.
 *
 * Fail-closed com propósito: um id desconhecido NÃO devolve string vazia
 * (a faixa ficaria muda e o Operador não saberia que existe uma sessão
 * ali) nem o nome longo de volta (o defeito que este módulo corrige).
 * Devolve as primeiras letras do próprio id, em maiúsculas — sempre curto,
 * sempre visível, e obviamente "não cadastrado" para quem for depurar.
 */
export function sessionCode(id: string | null | undefined): string {
  if (typeof id !== "string" || id.length === 0) return "—";
  const known = SESSION_CODE[id as SessionCodeId];
  if (known) return known;
  return id.toUpperCase().slice(0, SESSION_CODE_MAX_LENGTH);
}

/** Todos os ids cadastrados — o teste usa para provar cobertura 1:1 contra
 *  as definições reais de market-session.ts e kill-zones.ts. */
export const SESSION_CODE_IDS: readonly string[] = Object.keys(SESSION_CODE);
