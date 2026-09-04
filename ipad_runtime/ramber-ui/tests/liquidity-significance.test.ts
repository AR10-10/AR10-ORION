import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  computeZoneSignificance,
  formatZoneAtrWidth,
  MIN_ZONE_ATR_FRACTION,
  SHARED_ZONE_HIGHLIGHT_SLOTS,
  selectSharedZoneHighlights,
} from "../src/nexus/liquidity-significance";

describe("computeZoneSignificance — fail-closed", () => {
  it("sem ATR real, significant é SEMPRE true (nunca esconde por suposição)", () => {
    const r = computeZoneSignificance(101, 100, 100, null);
    expect(r.status).toBe("DADOS_INSUFICIENTES");
    expect(r.significant).toBe(true);
    expect(r.widthAtrUnits).toBeNull();
  });

  it("ATR zero ou negativo também não filtra", () => {
    for (const atr of [0, -1, NaN, Infinity]) {
      const r = computeZoneSignificance(101, 100, 100, atr);
      expect(r.significant, String(atr)).toBe(true);
    }
  });

  it("preço/top/bottom inválidos não filtram", () => {
    for (const [top, bottom, price] of [
      [NaN, 100, 100],
      [101, NaN, 100],
      [101, 100, 0],
      [101, 100, -5],
    ] as Array<[number, number, number]>) {
      expect(computeZoneSignificance(top, bottom, price, 2).significant).toBe(true);
    }
  });

  it("zona invertida (top < bottom, dado corrompido) não é escondida — o defeito é de dado", () => {
    const r = computeZoneSignificance(99, 100, 100, 2);
    expect(r.significant).toBe(true);
    expect(r.widthAtrUnits).toBe(0);
  });
});

describe("computeZoneSignificance — a matemática real", () => {
  it("uma zona larga (2% do preço, ATR 2%) é 1× ATR — bem acima do piso", () => {
    // top=102, bottom=100, price=100 -> largura 2%. ATR 2% -> 1.0x
    const r = computeZoneSignificance(102, 100, 100, 2);
    expect(r.status).toBe("OK");
    expect(r.widthAtrUnits).toBeCloseTo(1.0, 10);
    expect(r.significant).toBe(true);
  });

  it("uma zona minúscula (0.05% do preço, ATR 2%) fica abaixo do piso", () => {
    // largura 0.05%, ATR 2% -> 0.025x, bem abaixo de MIN_ZONE_ATR_FRACTION=0.12
    const r = computeZoneSignificance(100.05, 100, 100, 2);
    expect(r.widthAtrUnits).toBeCloseTo(0.025, 10);
    expect(r.significant).toBe(false);
  });

  it("a MESMA largura absoluta é significativa num ativo calmo e insignificante num agitado", () => {
    // Este é o ponto inteiro do motor: tamanho relativo, não absoluto.
    const calmo = computeZoneSignificance(100.5, 100, 100, 0.3); // largura 0.5%, ATR 0.3% -> 1.67x
    const agitado = computeZoneSignificance(100.5, 100, 100, 8); // mesma largura, ATR 8% -> 0.0625x
    expect(calmo.significant).toBe(true);
    expect(agitado.significant).toBe(false);
  });

  it("o limiar real é o próprio MIN_ZONE_ATR_FRACTION exportado (contrato, não número solto)", () => {
    // Largura construída de trás para frente a partir do limiar, para não
    // depender de arredondamento de ponto flutuante no meio do caminho
    // (100 * (1 + x/100) - 100 não é exatamente x em IEEE 754).
    const price = 100;
    const atrPercent = 4;
    const width = MIN_ZONE_ATR_FRACTION * atrPercent * price / 100; // = 0.48
    const bottom = price;
    const noLimiar = computeZoneSignificance(bottom + width, bottom, price, atrPercent);
    expect(noLimiar.widthAtrUnits).toBeCloseTo(MIN_ZONE_ATR_FRACTION, 10);
    expect(noLimiar.significant).toBe(true); // >= é inclusivo

    const abaixo = computeZoneSignificance(bottom + width * 0.99, bottom, price, atrPercent);
    expect(abaixo.significant).toBe(false);
  });

  it("largura zero (zona pontual) é sempre significativa — não é 'pequena', é uma LINHA", () => {
    const r = computeZoneSignificance(100, 100, 100, 2);
    expect(r.widthAtrUnits).toBe(0);
    expect(r.significant).toBe(true);
  });
});

describe("formatZoneAtrWidth", () => {
  it("segue a mesma disciplina de formatAtrUnits (piso '<0.05×')", () => {
    expect(formatZoneAtrWidth(0)).toBe("0×");
    expect(formatZoneAtrWidth(0.01)).toBe("<0.05×");
    expect(formatZoneAtrWidth(0.01)).not.toBe("0.00× ATR");
    expect(formatZoneAtrWidth(1.5)).toBe("1.50× ATR");
    expect(formatZoneAtrWidth(null)).toBe("—");
    expect(formatZoneAtrWidth(NaN)).toBe("—");
  });
});

describe("liquidity-significance — disciplina do módulo", () => {
  const src = readFileSync(resolve(__dirname, "../src/nexus/liquidity-significance.ts"), "utf8");

  it("é puro: zero rede, zero DOM, zero aleatório", () => {
    expect(src).not.toMatch(/Math\.random/);
    expect(src).not.toMatch(/\bfetch\s*\(/);
    expect(src).not.toMatch(/\bwindow\./);
  });

  it("documenta por que os pools de liquidez NÃO são filtrados aqui (achado real, não omissão)", () => {
    expect(src).toMatch(/STRONG_TOUCH_THRESHOLD/);
    expect(src).toMatch(/JÁ passou pelo piso/);
  });
});

// ---------------------------------------------------------------------------
// AUDITORIA: as TRÊS populações de banda de preço que disputam as mesmas 3
// vagas de destaque no canvas — FVG/OB, Voids, e Breaker/Mitigation.
//
// O cabeçalho deste módulo dizia que o filtro cobria "FVG/Order Block/Void".
// Medição real: ele só chegava a FVG e Order Block. As duas ausências têm
// veredictos DIFERENTES, e os dois ficam travados aqui.
// ---------------------------------------------------------------------------
describe("Voids: o filtro seria redundante — e a redundância é uma INVARIANTE, não uma coincidência", () => {
  const motor = readFileSync(
    resolve(__dirname, "../../src/research/engines/liquidity-void-engine.js"),
    "utf8",
  );

  it("o motor de voids já exige >= 1x ATR de deslocamento por candle", () => {
    // Forma EXECUTÁVEL (a declaração real), nunca a string solta: o nome da
    // constante também aparece na lista de `limitations` do metadata e num
    // comentário, e casar com qualquer uma delas provaria nada.
    expect(motor).toMatch(/const\s+VOID_MIN_DISPLACEMENT_RATIO\s*=\s*1\s*;/);
    expect(motor).toMatch(/const\s+VOID_MIN_RUN_LENGTH\s*=\s*2\s*;/);
  });

  it("a zona de void é o envelope do run — nunca mais estreita que o maior candle dele", () => {
    // top = max(high) e bottom = min(low) sobre o run. É isso que garante
    // que a largura da ZONA herda o piso de 1x ATR do CANDLE.
    expect(motor).toMatch(/if\s*\(h\s*>\s*top\)\s*top\s*=\s*h;/);
    expect(motor).toMatch(/if\s*\(l\s*<\s*bottom\)\s*bottom\s*=\s*l;/);
  });

  it("1x ATR fica MUITO acima do piso deste módulo — por isso o filtro não removeria nada", () => {
    const pisoDoMotorEmAtr = 1; // VOID_MIN_DISPLACEMENT_RATIO
    expect(MIN_ZONE_ATR_FRACTION).toBeLessThan(pisoDoMotorEmAtr);
    // A margem é o que torna o argumento robusto mesmo com os dois ATR
    // vindo de janelas diferentes (motor: lorentzian-classifier.js;
    // este módulo: regime-engine.js — ambos Wilder 14).
    expect(pisoDoMotorEmAtr / MIN_ZONE_ATR_FRACTION).toBeGreaterThan(8);
    // Prova executável de que o filtro é no-op nesta faixa: uma zona no
    // MENOR tamanho que o motor de voids consegue produzir já é significativa.
    const atrPct = 2;
    const preco = 100;
    const larguraMinimaDeVoid = (preco * atrPct) / 100; // exatamente 1x ATR
    const r = computeZoneSignificance(preco + larguraMinimaDeVoid, preco, preco, atrPct);
    expect(r.status).toBe("OK");
    expect(r.significant).toBe(true);
  });

  it("o cabeçalho registra o achado em vez de deixar a contradição de pé", () => {
    const src = readFileSync(resolve(__dirname, "../src/nexus/liquidity-significance.ts"), "utf8");
    expect(src).toMatch(/NUNCA a Void/);
    expect(src).toMatch(/VOID_MIN_DISPLACEMENT_RATIO/);
  });
});

describe("Breaker/Mitigation: aqui o filtro FALTAVA de verdade — e agora está ligado", () => {
  const app = readFileSync(resolve(__dirname, "../src/App.tsx"), "utf8");

  it("as vagas são UMA disputa só, entre as CINCO populações — nunca 3 por família", () => {
    // Quarta vez nesta trilha que uma mutação de FIAÇÃO passaria verde com o
    // motor testado a fundo e a CHAMADA não travada. Aqui a chamada real fica
    // travada — e o que ela trava mudou: os tetos por família (3 para FVG, 3
    // para OB, 3 para Void, 3 para Breaker, 3 para Mitigation = até 15
    // retângulos numa camada que DECLARAVA custar 3) viraram um orçamento
    // único disputado por largura real em ATR.
    expect(app).toContain("const zonasEmDestaque = selectSharedZoneHighlights(");
    // As cinco populações entram na MESMA chamada, na mesma ordem do array.
    expect(app).toContain(
      "[unmitigatedFvgsAll, unmitigatedBlocksAll, unmitigatedVoidsAll, breakerAll, mitigationAll],",
    );
    // ...e as cinco saem pelo MESMO filtro. Se alguém devolver um teto
    // próprio a qualquer família, alguma destas cinco linhas some.
    for (const trecho of [
      "const unmitigatedFvgs = unmitigatedFvgsAll.filter(emDestaque);",
      "const unmitigatedBlocks = unmitigatedBlocksAll.filter(emDestaque);",
      "const unmitigatedVoids = unmitigatedVoidsAll.filter(emDestaque);",
      "const breakerZones = breakerAll.filter(emDestaque).map(toChartZone);",
      "const mitigationZones = mitigationAll.filter(emDestaque).map(toChartZone);",
    ]) {
      expect(app).toContain(trecho);
    }
    // Nenhum teto por família pode ter sobrevivido.
    expect(app).not.toContain("significantBreakers");
    expect(app).not.toContain("significantMitigations");
    expect(app).not.toContain("significantFvgs");
    expect(app).not.toContain("significantBlocks");
  });

  it("obstáculo real do plano ativo continua ESCAPANDO do teto (Regra de Ouro 4)", () => {
    // A escapatória é o que impede o filtro de apagar informação estrutural:
    // uma zona no caminho entrada→alvo aparece independente do tamanho. Agora
    // ela vive num lugar só, válida para as cinco famílias de uma vez.
    expect(app).toContain("isRealObstacle(z) || zonasEmDestaque.has(z)");
  });

  it("a assinatura do filtro é estrutural — um bloco não é PriceZone", () => {
    // Se voltasse a exigir PriceZone, os blocos precisariam de um cast (uma
    // mentira de tipo) ou de uma SEGUNDA chamada duplicada. O genérico abaixo
    // aceita as cinco famílias lendo só top/bottom.
    expect(app).toContain("const emDestaque = <Z extends { top: number; bottom: number }>(z: Z) =>");
  });

  it("a medição que motivou a mudança fica registrada, não só o resultado", () => {
    expect(app).toMatch(/2985 blocos/);
    expect(app).toMatch(/1,27% abaixo do piso/);
  });
});

// ═══ EXECUÇÃO REAL: a arbitragem cruzada entre as populações ═══
//
// Teste de execução (não de padrão) porque o risco aqui é "a matemática de
// seleção está sutilmente errada" — a ordenação decide o que o Operador vê.
describe("selectSharedZoneHighlights — um orçamento, cinco famílias", () => {
  const PRICE = 100;
  const ATR_PCT = 1; // 1% => 1 unidade de ATR == 1 de preço

  /** Zona de largura exata em unidades de ATR (com ATR_PCT = 1). */
  const zonaDe = (larguraAtr: number, id: string) => ({
    id,
    bottom: PRICE,
    top: PRICE + larguraAtr,
  });

  it("escolhe as MAIORES da tela, não as 3 melhores de cada família", () => {
    // O defeito antigo em uma linha: um Breaker pequeno entrava por ser o
    // melhor da sua família enquanto um FVG grande ficava fora por ser o 4º
    // da dele. Aqui as famílias são deliberadamente desiguais.
    const fvgs = [zonaDe(5, "fvg-5"), zonaDe(4, "fvg-4"), zonaDe(3, "fvg-3"), zonaDe(2, "fvg-2")];
    const breakers = [zonaDe(0.5, "brk-0.5")];

    const vencedoras = selectSharedZoneHighlights([fvgs, breakers], PRICE, ATR_PCT, 3);
    const ids = [...vencedoras].map((z) => z.id).sort();

    // As 3 maiores da TELA são todas FVG — o Breaker de 0.5x perde, mesmo
    // sendo o único da sua família. Com tetos por família ele entraria.
    expect(ids).toEqual(["fvg-3", "fvg-4", "fvg-5"]);
    expect(vencedoras.has(breakers[0])).toBe(false);
  });

  it("nunca devolve mais que as vagas — o teto é real, não uma sugestão", () => {
    const muitas = Array.from({ length: 40 }, (_, i) => zonaDe(1 + i, `z${i}`));
    const vencedoras = selectSharedZoneHighlights([muitas], PRICE, ATR_PCT);
    expect(vencedoras.size).toBe(SHARED_ZONE_HIGHLIGHT_SLOTS);
  });

  it("zona abaixo do piso de significância nunca ocupa vaga, mesmo sobrando espaço", () => {
    // Uma vaga vazia não é motivo para promover ruído: o piso continua
    // valendo antes da disputa.
    const ruido = zonaDe(MIN_ZONE_ATR_FRACTION / 2, "ruido");
    const real = zonaDe(3, "real");
    const vencedoras = selectSharedZoneHighlights([[ruido, real]], PRICE, ATR_PCT, 5);
    expect(vencedoras.has(real)).toBe(true);
    expect(vencedoras.has(ruido)).toBe(false);
    expect(vencedoras.size).toBe(1);
  });

  it("fail-closed sem ATR real: conjunto vazio, nunca um destaque fabricado", () => {
    const zonas = [zonaDe(5, "a"), zonaDe(4, "b")];
    expect(selectSharedZoneHighlights([zonas], PRICE, null).size).toBe(0);
    expect(selectSharedZoneHighlights([zonas], PRICE, 0).size).toBe(0);
    expect(selectSharedZoneHighlights([zonas], null, ATR_PCT).size).toBe(0);
  });

  it("populações ausentes/vazias não quebram — as outras seguem disputando", () => {
    const fvgs = [zonaDe(2, "fvg")];
    const vencedoras = selectSharedZoneHighlights([fvgs, null, undefined, []], PRICE, ATR_PCT);
    expect([...vencedoras].map((z) => z.id)).toEqual(["fvg"]);
  });

  it("empate mantém a ordem de chegada — o critério antigo vira desempate, não some", () => {
    const primeira = zonaDe(2, "primeira");
    const segunda = zonaDe(2, "segunda");
    const vencedoras = selectSharedZoneHighlights([[primeira, segunda]], PRICE, ATR_PCT, 1);
    expect(vencedoras.has(primeira)).toBe(true);
    expect(vencedoras.has(segunda)).toBe(false);
  });
});
