// reason-vocabulary.ts — ORDEM DE SERVIÇO (Frente 1, §2 "Missão
// Principal"): "Quando não houver sinal, o sistema deve explicar
// claramente o que está aguardando (ex: 'Aguardando confirmação de 3/5
// fontes')" (pedido direto do Operador).
//
// AUDITORIA ANTES DE CONSTRUIR (achado real, CLAUDE.md item 1): vários
// motores reais deste app JÁ computam por que um dado não existe ainda —
// cada um no seu próprio código de máquina (snake_case, pensado pra
// comparação programática: risk-engine.js's SEM_SUGESTAO, confluence-
// engine.ts's DADOS_INSUFICIENTES, lorentzian-classifier.js's
// DADOS_INSUFICIENTES) — mas nenhum lugar da UI lia esses campos; a tela
// mostrava só "AGUARDANDO"/"0%"/"—" genérico enquanto o motivo real
// dormia sem uso a um `.reason` de distância. Este módulo não é um motor
// novo — é só o tradutor: zero cálculo, zero dado inventado. Cada frase
// aqui só existe porque o código de origem já existia.
//
// Tabela EXAUSTIVA dos códigos reais encontrados na auditoria desta
// rodada + 2 padrões paramétricos (candles/treino, onde o número faz
// parte do dado real e não pode virar uma chave fixa) + um fallback
// honesto para qualquer código futuro não catalogado: nunca esconde o
// dado real, só formata o que existir.
const KNOWN_REASONS: Record<string, string> = {
  // ipad_runtime/src/risk/risk-engine.js (buildRiskSuggestion, status SEM_SUGESTAO)
  sem_sinal_direcional_do_core_engine_nesta_leitura: "Núcleo sem direção ativa (WAIT) nesta leitura",
  insumo_nao_finito_ou_ausente_fail_closed: "um insumo real do cálculo ainda não chegou (fail-closed)",
  insumo_degenerado_fail_closed: "um insumo real do cálculo está fora da faixa válida (fail-closed)",
  comite_sem_direcao_ou_contrario_ao_sinal_do_core: "Conselho neutro ou contrário ao Núcleo — sem base para dimensionar",
  unidade_de_risco_degenerada_fail_closed: "distância entrada→invalidação real é zero ou inválida",
  rr_sem_assimetria_de_payoff_kelly_nao_positivo: "R:R real não justifica posição (Kelly não-positivo)",
  comite_sem_forca_direcional_suficiente: "Conselho concorda com o Núcleo, mas sem força direcional suficiente",
  // nexus/confluence-engine.ts (buildConfluenceReading, status !== 'OK')
  "core_engine_sem_direcao_ativa_no_momento_(WAIT)": "Núcleo sem direção ativa (WAIT)",
  nenhum_subsistema_com_leitura_real_nesta_janela: "nenhum dos 3 subsistemas tem leitura real nesta janela",
  pool_sem_leitura_real: "pool de opinião sem leitura real para comparar",
  // ipad_runtime/src/research/engines/lorentzian-classifier.js (status DADOS_INSUFICIENTES)
  feature_atual_invalida_apos_warmup: "features do candle atual inválidas após o aquecimento",
};

// Padrões paramétricos reais — o número/limiar É o dado, não pode virar
// uma chave fixa na tabela acima.
const PARAMETRIC_PATTERNS: { re: RegExp; describe: (m: RegExpMatchArray) => string }[] = [
  {
    re: /^apenas_(\d+)_candles_abaixo_do_minimo_(\d+)$/,
    describe: (m) => `apenas ${m[1]} candles reais — mínimo de ${m[2]} ainda não atingido`,
  },
  {
    re: /^treino_insuficiente_(\d+)_pontos_abaixo_de_k=(\d+)$/,
    describe: (m) => `apenas ${m[1]} pontos de treino reais — mínimo de k=${m[2]} ainda não atingido`,
  },
];

/** Traduz um código de razão real (snake_case, de qualquer motor deste
 *  repositório) para uma frase legível. NUNCA inventa: sem entrada
 *  reconhecida, devolve o próprio código com underscores trocados por
 *  espaço — o dado real nunca fica escondido, só formatado. `null`/
 *  `undefined`/string vazia (nenhum motivo real disponível) devolve
 *  `null`, nunca uma frase fabricada. */
export function humanizeReasonCode(raw: string | null | undefined): string | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  const known = KNOWN_REASONS[raw];
  if (known) return known;
  for (const { re, describe } of PARAMETRIC_PATTERNS) {
    const m = raw.match(re);
    if (m) return describe(m);
  }
  return raw.replace(/_/g, " ");
}
