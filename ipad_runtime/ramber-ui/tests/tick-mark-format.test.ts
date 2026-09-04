// Suíte da régua de tempo (chart/tick-mark-format.ts).
//
// DEFEITO QUE ORIGINOU ISTO — captura ao vivo do Operador, ZEC/USDT 30m:
// a régua mostrava "15 AGO · 16 AGO · 16 AGO · 16 AGO · 16 AGO · 17 AGO".
// Quatro marcas idênticas para quatro HORÁRIOS do mesmo dia, porque o
// formatador descartava a granularidade da marca e devolvia sempre
// `DD MMM`.
//
// TESTES INDEPENDENTES DE FUSO: nada aqui compara com uma string fixa
// calculada à mão (isso quebraria em qualquer máquina com outro fuso).
// O que se prova é o INVARIANTE que o bug violava — duas marcas em
// horários diferentes do mesmo dia têm de produzir rótulos DIFERENTES
// quando são marcas de horário, e rótulos IGUAIS quando são marcas de dia.
import { describe, it, expect } from "vitest";
import { formatTickMark, TICK_MARK_TYPE } from "../src/chart/tick-mark-format";

const LOCALE = "pt-BR";
// Âncora às 04:00 do fuso LOCAL da máquina que roda o teste — nunca um
// timestamp absoluto somado a horas, que em fusos negativos cruza a virada
// de dia e faria o teste medir outra coisa (foi o que aconteceu na
// primeira versão desta suíte). 04:00 + 12h = 16:00, seguramente o mesmo
// dia local, e longe das transições de horário de verão (00:00–03:00).
const anchor = new Date(1_755_000_000 * 1000);
anchor.setHours(4, 0, 0, 0);
const T0 = Math.floor(anchor.getTime() / 1000);
const T6 = T0 + 6 * 3600;
const T12 = T0 + 12 * 3600;
const NEXT_DAY = T0 + 24 * 3600;

describe("formatTickMark — o bug relatado", () => {
  it("marcas de HORÁRIO no mesmo dia produzem rótulos DIFERENTES", () => {
    const a = formatTickMark(T0, TICK_MARK_TYPE.Time, LOCALE);
    const b = formatTickMark(T6, TICK_MARK_TYPE.Time, LOCALE);
    const c = formatTickMark(T12, TICK_MARK_TYPE.Time, LOCALE);
    expect(new Set([a, b, c]).size).toBe(3);
  });

  it("o formato antigo (DD MMM) reproduzia o defeito — três rótulos idênticos", () => {
    // Prova de que a regressão é detectável: com granularidade de DIA, os
    // mesmos três instantes colapsam num rótulo só. Era isso que a régua
    // fazia para TODAS as marcas.
    const a = formatTickMark(T0, TICK_MARK_TYPE.DayOfMonth, LOCALE);
    const b = formatTickMark(T6, TICK_MARK_TYPE.DayOfMonth, LOCALE);
    const c = formatTickMark(T12, TICK_MARK_TYPE.DayOfMonth, LOCALE);
    expect(new Set([a, b, c]).size).toBe(1);
  });
});

describe("formatTickMark — formatos por granularidade", () => {
  it("Time devolve HH:MM em 24h, sem AM/PM", () => {
    const label = formatTickMark(T6, TICK_MARK_TYPE.Time, LOCALE);
    expect(label).toMatch(/^\d{2}:\d{2}$/);
    expect(label).not.toMatch(/[AP]M/i);
  });

  it("TimeWithSeconds também é intradiário — nunca cai em DD MMM", () => {
    expect(formatTickMark(T6, TICK_MARK_TYPE.TimeWithSeconds, LOCALE)).toMatch(/^\d{2}:\d{2}$/);
  });

  it("DayOfMonth mantém DD MMM, em maiúsculas e sem o ponto do pt-BR", () => {
    const label = formatTickMark(T0, TICK_MARK_TYPE.DayOfMonth, LOCALE);
    expect(label).toMatch(/^\d{2} [A-ZÇ]{3,}$/);
    expect(label).not.toContain(".");
  });

  it("Month segue o mesmo formato de dia — comportamento preservado", () => {
    expect(formatTickMark(T0, TICK_MARK_TYPE.Month, LOCALE)).toBe(
      formatTickMark(T0, TICK_MARK_TYPE.DayOfMonth, LOCALE),
    );
  });

  it("Year acrescenta o ano — 01 JAN de dois anos não pode ter o mesmo rótulo", () => {
    const label = formatTickMark(T0, TICK_MARK_TYPE.Year, LOCALE);
    expect(label).toMatch(/^\d{2} [A-ZÇ]{3,} \d{4}$/);
    const umAnoDepois = formatTickMark(T0 + 365 * 24 * 3600, TICK_MARK_TYPE.Year, LOCALE);
    expect(umAnoDepois).not.toBe(label);
  });

  it("granularidade desconhecida cai no formato de dia, nunca quebra", () => {
    expect(formatTickMark(T0, 99, LOCALE)).toBe(
      formatTickMark(T0, TICK_MARK_TYPE.DayOfMonth, LOCALE),
    );
  });
});

describe("formatTickMark — continuidade entre dias", () => {
  it("dias diferentes continuam distinguíveis na marca de dia", () => {
    expect(formatTickMark(T0, TICK_MARK_TYPE.DayOfMonth, LOCALE)).not.toBe(
      formatTickMark(NEXT_DAY, TICK_MARK_TYPE.DayOfMonth, LOCALE),
    );
  });

  it("o mesmo horário em dias diferentes tem o MESMO rótulo de horário — e é correto", () => {
    // A régua distingue esses dois pela marca de dia que a lib insere na
    // virada; repetir a hora não é ambiguidade, é a leitura certa.
    expect(formatTickMark(T6, TICK_MARK_TYPE.Time, LOCALE)).toBe(
      formatTickMark(T6 + 24 * 3600, TICK_MARK_TYPE.Time, LOCALE),
    );
  });
});

describe("TICK_MARK_TYPE — valores conferidos contra a lib, nunca supostos", () => {
  it("espelha o enum real da lightweight-charts", () => {
    expect(TICK_MARK_TYPE).toEqual({
      Year: 0,
      Month: 1,
      DayOfMonth: 2,
      Time: 3,
      TimeWithSeconds: 4,
    });
  });
});

// ---------------------------------------------------------------------------
// LOCALE INVÁLIDO — defeito encontrado ao RODAR a verificação visual com
// Playwright (não em revisão de código): o Chromium do ambiente reporta
// `en-US@posix`, forma POSIX que `Intl` rejeita com RangeError.
//
// O impacto real não é o rótulo: este formatador roda dentro do ciclo de
// pintura da lightweight-charts, então a exceção abortava a pintura INTEIRA.
// A captura saiu com o gráfico vazio — nenhuma vela — e o sintoma não
// apontava para o locale em lugar nenhum.
// ---------------------------------------------------------------------------
describe("locale que o runtime rejeita nunca derruba a pintura do gráfico", () => {
  it("o locale POSIX real do ambiente não lança — era este que quebrava", () => {
    expect(() => formatTickMark(1_755_000_000, TICK_MARK_TYPE.Time, "en-US@posix")).not.toThrow();
    expect(() => formatTickMark(1_755_000_000, TICK_MARK_TYPE.DayOfMonth, "en-US@posix")).not.toThrow();
    expect(() => formatTickMark(1_755_000_000, TICK_MARK_TYPE.Year, "en-US@posix")).not.toThrow();
  });

  it("nenhuma forma malformada de locale lança, em nenhum tipo de marca", () => {
    const ruins = ["en-US@posix", "", "pt_BR", "not a locale", "!!", "x".repeat(120)];
    const tipos = Object.values(TICK_MARK_TYPE);
    for (const l of ruins) {
      for (const t of tipos) {
        expect(() => formatTickMark(1_755_000_000, t, l), `locale ${JSON.stringify(l)} tipo ${t}`).not.toThrow();
      }
    }
  });

  it("o rótulo continua sendo uma data REAL, nunca um travessão ou vazio", () => {
    // Fail-closed aqui é cair para o locale padrão do runtime — nunca
    // desistir de informar a data, que é a razão da marca existir.
    const saida = formatTickMark(1_755_000_000, TICK_MARK_TYPE.DayOfMonth, "en-US@posix");
    expect(saida.length).toBeGreaterThan(0);
    expect(saida).toMatch(/^\d{2}\s/); // "DD MMM"
  });

  it("locale VÁLIDO continua sendo respeitado — o saneamento não achata todo mundo", () => {
    const t = 1_755_000_000;
    expect(formatTickMark(t, TICK_MARK_TYPE.DayOfMonth, "pt-BR")).not.toBe(
      formatTickMark(t, TICK_MARK_TYPE.DayOfMonth, "ja-JP"),
    );
  });
});
