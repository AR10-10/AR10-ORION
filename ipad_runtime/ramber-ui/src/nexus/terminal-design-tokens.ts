// terminal-design-tokens.ts — A ESCALA CANÔNICA DO TERMINAL.
//
// PEDIDO DO OPERADOR (ordem "EVOLUÇÃO COMPLETA", §1): "tipografia precisa",
// "hierarquia clara", "cores mais profissionais e consistentes", "zero
// elementos desnecessários".
//
// ── O DEFEITO REAL, MEDIDO (Disciplina §1) ──────────────────────────────
// Varredura do app inteiro, antes desta rodada:
//
//   • 12 tamanhos tipográficos distintos: 0.3 0.32 0.35 0.4 0.42 0.45 0.46
//     0.48 0.5 0.55 0.6 0.62 0.65 0.7 0.75rem (os 3 primeiros já corrigidos
//     na rodada do piso de legibilidade).
//   • 40 cores hex distintas, em 1330 ocorrências.
//   • ZERO arquivo de tokens. Nenhum lugar declarava o que é "um degrau".
//
// Doze tamanhos não são uma escala — são acúmulo. 0.45, 0.46 e 0.48rem
// diferem em 0.16px e 0.32px: nenhum olho humano distingue, mas cada um
// foi uma decisão separada que ninguém podia revisar como conjunto. É
// exatamente o oposto de "tipografia precisa": a imprecisão não está em
// nenhum tamanho isolado, está em não existir sistema.
//
// ── A ESCALA, DERIVADA E NÃO INVENTADA ─────────────────────────────────
// Os degraus abaixo NÃO foram escolhidos por gosto: são os tamanhos que o
// app já usava em massa (0.40 / 0.45 / 0.50 / 0.55 / 0.60 concentram 295
// dos 350 usos), estendidos com passo CONSTANTE de 0.05rem até cobrir os
// raros maiores. O que sai são só os degraus intermediários que ninguém
// consegue ver (0.42, 0.46, 0.48, 0.62) e um extremo solto (0.75).
//
// Cada migração move no MÁXIMO 0.05rem (0.8px) — imperceptível numa
// etiqueta isolada, decisivo no conjunto: 12 tamanhos arbitrários viram 7
// degraus regulares, e a hierarquia passa a ser legível como sistema.
//
// ── O PISO NÃO SE MEXE ─────────────────────────────────────────────────
// 0.40rem (6.4px) continua sendo o menor degrau, pelo mesmo motivo já
// documentado em typography-legibility-floor.test.ts e no
// PriceLabelStackPlugin: "no iPad (a superfície real deste app) fica no
// limite do legível". A escala começa NO piso; nunca abaixo dele.
//
// LEI 24: isto é vocabulário de apresentação. Zero decisão, zero cálculo
// de mercado, zero acesso a dado real.

/** Degraus tipográficos canônicos, em rem. Passo constante de 0.05rem.
 *  Ordem crescente — o índice É a hierarquia. */
export const TYPE_SCALE_REM = [0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7] as const;

export type TypeScaleStep = (typeof TYPE_SCALE_REM)[number];

/** Menor degrau permitido. Igual ao piso de legibilidade já declarado —
 *  a escala não pode começar abaixo dele. */
export const TYPE_SCALE_MIN_REM = TYPE_SCALE_REM[0];

/** Passo entre degraus. Constante de propósito: uma escala com passos
 *  irregulares volta a ser a lista arbitrária que esta rodada desfez. */
export const TYPE_SCALE_STEP_REM = 0.05;

/** Os 5 tamanhos fora-de-escala que existiam antes desta rodada, com o
 *  degrau canônico para o qual cada um foi arredondado (sempre o mais
 *  próximo — a migração minimiza a mudança visual, nunca a maximiza).
 *
 *  Preservado no código, e não só no commit, porque é o registro de POR
 *  QUE cada valor mudou: uma sessão futura que encontre `text-[0.48rem]`
 *  num trecho antigo tem aqui a resposta, em vez de reintroduzi-lo. */
export const TYPE_SCALE_MIGRATIONS: ReadonlyArray<{ from: number; to: TypeScaleStep; uses: number }> = [
  { from: 0.42, to: 0.4, uses: 35 },
  { from: 0.46, to: 0.45, uses: 1 },
  { from: 0.48, to: 0.5, uses: 12 },
  { from: 0.62, to: 0.6, uses: 3 },
  { from: 0.75, to: 0.7, uses: 1 },
];

/** O degrau canônico mais próximo de um tamanho qualquer. Fail-closed:
 *  entrada não-finita devolve o piso, nunca NaN numa classe CSS. */
export function nearestTypeStep(rem: number): TypeScaleStep {
  if (!Number.isFinite(rem)) return TYPE_SCALE_MIN_REM;
  let best: TypeScaleStep = TYPE_SCALE_REM[0];
  let bestDist = Math.abs(rem - best);
  for (const step of TYPE_SCALE_REM) {
    const d = Math.abs(rem - step);
    // `<` estrito: num empate exato fica o degrau MENOR (já visitado),
    // decisão determinística em vez de depender da ordem do array.
    if (d < bestDist) {
      best = step;
      bestDist = d;
    }
  }
  return best;
}

/** Um tamanho está na escala? Comparação com tolerância porque
 *  0.1+0.2 !== 0.3 em ponto flutuante — nunca `===` cru. */
export function isOnTypeScale(rem: number): boolean {
  if (!Number.isFinite(rem)) return false;
  return TYPE_SCALE_REM.some((s) => Math.abs(s - rem) < 1e-9);
}

// ═══════════════════════════════════════════════════════════════════════
// SUPERFÍCIES — a escala de profundidade do terminal (rodada 2)
// ═══════════════════════════════════════════════════════════════════════
//
// ── O DEFEITO REAL, MEDIDO ─────────────────────────────────────────────
// O app tinha QUATRO quase-pretos fazendo trabalho de superfície, e os
// papéis pretendidos estavam legíveis no código:
//
//   #020610 (2)   fundo da página   (App.tsx: `h-[100dvh] bg-[#020610]`)
//   #010205 (15)  painel/card/modal (`cyber-panel`, `fixed inset-0 z-[10000]`)
//   #010308 (65)  dominante         (63 `bg-`, 2 `text-`)
//   #050810 (4)   chip de etiqueta  (PriceLabelStackPlugin: live, critical)
//
// Medição em CIE L* (0–100), o eixo perceptual de claridade:
//
//   #010205  L* 0.55
//   #010308  L* 0.80   ΔL* 0.26   <- INVISÍVEL
//   #020610  L* 1.63   ΔL* 0.83   <- INVISÍVEL
//   #050810  L* 2.20   ΔL* 0.57   <- INVISÍVEL
//
// **O sistema de profundidade inteiro ocupava ΔL* = 1.65 numa escala de
// 0 a 100.** Um degrau só começa a ser lido como deliberado por volta de
// ΔL* 2–3; nenhum destes chegava perto. Pior: o fundo da PÁGINA era mais
// claro que os PAINÉIS — a profundidade estava invertida em relação à
// convenção de UI escura (o que está por cima recebe mais luz).
//
// Ou seja, não havia hierarquia de superfície: havia quatro quase-pretos
// acidentais. É exatamente o pedido "hierarquia clara (o que é importante
// aparece mais forte)" do Operador, dito em cor.
//
// ── A ESCALA, DERIVADA E NÃO INVENTADA ─────────────────────────────────
// Âncora: `#010308`, o dominante (65 usos) — a base não muda de cor, o
// que mantém a identidade do terminal e a menor migração possível. Os dois
// degraus acima são gerados EM Lab a partir dela, somando ΔL* = 3.0 e
// preservando o matiz (a*, b*) byte a byte: continuam o mesmo quase-preto
// azulado, só com luz suficiente para o degrau existir.
//
// Por que ΔL* = 3.0: é o menor passo que se lê como intencional numa área
// grande sem clarear o terminal. Abaixo disso volta a ser o ruído medido
// acima; muito acima vira cinza e o AR10 deixa de ser um terminal escuro.
//
// ── CONTRASTE VERIFICADO, NÃO ASSUMIDO ─────────────────────────────────
// Clarear superfície DERRUBA o contraste do texto — então cada cor de
// texto real foi medida contra a superfície MAIS CLARA (o pior caso).
// Todas passam WCAG AA (4.5:1), com uma exceção que a medição revelou:
// `#b026ff` já estava em 4.49:1 contra o fundo ATUAL — reprovado antes
// desta rodada, por 0.01. Corrigido subindo só o L* (matiz preservado).
//
// NOTA DE PROCESSO (achado da própria rodada): a migração foi feita com
// `sed` sobre `src/**`, e este arquivo mora lá — o `sed` reescreveu a
// tabela `SURFACE_MIGRATIONS` e o texto acima, trocando cada `from` pelo
// seu próprio `to`. Foi o teste de conformidade que pegou (ele acusou
// `#010308` como "cor migrada de volta"). Ficam os valores REAIS de
// origem; quem repetir uma migração assim precisa excluir este arquivo
// do sed, ou a tabela deixa de ser registro e vira eco.

/** Razão de contraste mínima para texto normal (WCAG 2.1 AA). */
export const CONTRAST_MIN_AA = 4.5;

/** Degrau de claridade entre superfícies vizinhas, em CIE L*. */
export const SURFACE_STEP_DELTA_L = 3.0;

/** As três superfícies do terminal, da mais funda para a mais alta.
 *  Em UI escura, "mais alto" = mais luz — a convenção que a medição acima
 *  mostrou estar invertida antes desta rodada. */
export const SURFACE = {
  /** Fundo da página. A âncora: 65 usos, cor inalterada. */
  base: "#010308",
  /** Painel, card, modal — tudo que pousa sobre a página. */
  panel: "#0c0e11",
  /** Popover, chip de etiqueta no canvas — o que pousa sobre um painel. */
  raised: "#141518",
} as const;

export type SurfaceRole = keyof typeof SURFACE;

/** Migrações de cor desta rodada, com o papel real que cada uma exercia.
 *  Registro no código pelo mesmo motivo de TYPE_SCALE_MIGRATIONS: uma
 *  sessão futura que encontre `#0c0e11` tem aqui a resposta. */
export const SURFACE_MIGRATIONS: ReadonlyArray<{
  from: string;
  to: string;
  papel: string;
  uses: number;
}> = [
  { from: "#020610", to: SURFACE.base, papel: "fundo da página", uses: 2 },
  { from: "#010205", to: SURFACE.panel, papel: "painel / card / modal", uses: 15 },
  { from: "#050810", to: SURFACE.raised, papel: "chip de etiqueta no canvas", uses: 4 },
  // Não é superfície: é a única cor de TEXTO que reprovava no contraste
  // mínimo — e já reprovava antes, contra o fundo antigo. Mesmo roxo,
  // 4.5 pontos de L* mais claro.
  { from: "#b026ff", to: "#be37ff", papel: "roxo (texto) — correção de contraste", uses: 6 },
  // Pares perceptualmente idênticos (ΔE < 5) achados na mesma varredura:
  // duas decisões separadas para uma cor só.
  { from: "#c3d0dc", to: "#c8d4e6", papel: "cinza claro duplicado", uses: 1 },
  { from: "#ffaa00", to: "#ffb020", papel: "âmbar duplicado", uses: 2 },
];

function srgbToLinear(c: number): number {
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Luminância relativa (WCAG 2.1). Fail-closed: hex inválido devolve null
 *  em vez de um número que pareceria uma medição real. */
export function relativeLuminance(hex: string): number | null {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = srgbToLinear(((n >> 16) & 255) / 255);
  const g = srgbToLinear(((n >> 8) & 255) / 255);
  const b = srgbToLinear((n & 255) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razão de contraste WCAG 2.1 entre duas cores. `null` se qualquer uma
 *  for inválida — nunca um número inventado. */
export function contrastRatio(a: string, b: string): number | null {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  if (la === null || lb === null) return null;
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
