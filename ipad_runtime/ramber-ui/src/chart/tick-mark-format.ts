// tick-mark-format.ts — rótulo da régua de tempo do gráfico.
//
// DEFEITO REAL QUE ISTO CORRIGE (captura ao vivo do Operador, ZEC/USDT 30m):
// a régua mostrava
//
//     15 AGO   16 AGO   16 AGO   16 AGO   16 AGO   17 AGO   17 AGO ...
//
// Quatro marcas idênticas "16 AGO" numa janela de ~4 dias em timeframe de
// 30 minutos. Não eram quatro dias — eram quatro HORÁRIOS do mesmo dia, e
// a hora estava sendo jogada fora.
//
// CAUSA RAIZ: o `tickMarkFormatter` anterior ignorava o segundo parâmetro
// (estava escrito `_tickMarkType`, sublinhado de "não uso") e devolvia
// sempre `DD MMM`. Esse parâmetro é justamente como a lightweight-charts
// informa a GRANULARIDADE que aquela marca representa — `Time` quando a
// marca é um horário dentro do dia, `DayOfMonth` quando é a virada de dia.
// A informação necessária sempre chegou; era descartada na entrada.
//
// Puro e testável de propósito: extraído de dentro do objeto de opções do
// chart (EnhancedChart_110_Percent.tsx), onde era inalcançável por teste.
//
// ESCOPO DELIBERADAMENTE CIRÚRGICO: só as marcas intradiárias mudam de
// comportamento, mais o ano nas viradas de ano (onde `DD MMM` sozinho é
// ambíguo entre dois anos). Marca de dia e de mês continuam exatamente
// como estavam — o defeito relatado era o intradiário, e mexer no resto
// seria mudança não pedida numa tela que o Operador já aprovou.

/** Espelha `TickMarkType` da lightweight-charts (dist/typings.d.ts).
 *  Declarado como união numérica local para manter este módulo puro e
 *  testável sem importar a lib (que precisa de DOM). Os valores são os
 *  reais da lib, conferidos no typings — nunca supostos. */
export const TICK_MARK_TYPE = {
  Year: 0,
  Month: 1,
  DayOfMonth: 2,
  Time: 3,
  TimeWithSeconds: 4,
} as const;

export type TickMarkTypeValue = (typeof TICK_MARK_TYPE)[keyof typeof TICK_MARK_TYPE];

// ---------------------------------------------------------------------------
// LOCALE INVÁLIDO — defeito real encontrado ao rodar a verificação visual com
// Playwright (não uma suposição): o Chromium do ambiente reporta o locale
// POSIX `en-US@posix`, e `Intl` rejeita essa forma com
// `RangeError: Invalid language tag`.
//
// A gravidade não é o rótulo da régua: o formatador roda DENTRO do ciclo de
// pintura da lightweight-charts, então a exceção abortava a pintura inteira
// — a captura de verificação saiu com o gráfico VAZIO, sem uma única vela,
// só o overlay do canvas próprio (que pinta fora desse ciclo) sobrevivendo.
// Um locale exótico no aparelho do Operador derrubaria o gráfico do mesmo
// jeito, e o sintoma ("as velas sumiram") não apontaria para o locale.
//
// Fail-closed (Regra de Ouro 3): locale que o runtime não aceita vira
// `undefined` — o padrão resolvido do próprio ambiente, que por definição é
// válido. O rótulo continua sendo uma data real; só a convenção de idioma
// cai para o padrão em vez de derrubar a tela.
let localeCache: { entrada: string; saida: string | undefined } | null = null;

function safeLocale(locale: string): string | undefined {
  if (localeCache && localeCache.entrada === locale) return localeCache.saida;
  let saida: string | undefined;
  try {
    // Uma checagem real do runtime, nunca um regex adivinhando a gramática
    // de BCP-47 (que aceita extensões, variantes e subtags privadas).
    new Intl.DateTimeFormat(locale);
    saida = locale;
  } catch {
    saida = undefined;
  }
  localeCache = { entrada: locale, saida };
  return saida;
}

/**
 * Locale VÁLIDO para entregar à lightweight-charts inteira.
 *
 * POR QUE NÃO BASTA sanear dentro de `formatTickMark`: o stack real do erro
 * (capturado com Playwright) mostrou que quem lançava era o formatador
 * PADRÃO da própria lib, não o nosso. E o nosso devolve `null` no ramo
 * BusinessDay/string — o que devolve o controle exatamente para esse
 * formatador padrão. Além disso a lib usa o mesmo locale no rótulo de tempo
 * do crosshair, fora do nosso formatter.
 *
 * Configurar `localization.locale` com um valor já validado protege a lib
 * INTEIRA de uma vez, em vez de tapar um ponto de uso por vez.
 *
 * Devolve string (nunca undefined): a opção da lib exige uma. O último
 * recurso é o locale resolvido do próprio runtime, que é válido por
 * construção.
 */
export function chartLocale(preferred?: string): string {
  const candidato =
    preferred ?? (typeof navigator !== "undefined" ? navigator.language : "");
  if (candidato && safeLocale(candidato) !== undefined) return candidato;
  try {
    return new Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return "en"; // fim da linha: um locale que todo runtime ICU aceita.
  }
}

/** Mês abreviado em maiúsculas, sem o ponto solto que o pt-BR adiciona
 *  ("ago." → "AGO") — a régua inteira é só dígitos e letras, e um ponto
 *  perdido no meio quebrava esse alinhamento. Comportamento herdado do
 *  formatador anterior, preservado palavra por palavra. */
function monthLabel(date: Date, locale: string | undefined): string {
  return date.toLocaleString(locale, { month: "short" }).toUpperCase().replace(".", "");
}

function dayMonth(date: Date, locale: string | undefined): string {
  return `${String(date.getDate()).padStart(2, "0")} ${monthLabel(date, locale)}`;
}

/**
 * Rótulo de uma marca da régua de tempo.
 *
 * @param timeSeconds timestamp real do candle, em SEGUNDOS (o schema do
 *   Bus; a lib entrega UTCTimestamp nessa unidade).
 * @param tickMarkType granularidade que a lib atribuiu a esta marca.
 * @param locale locale real do navegador, repassado pela lib.
 */
export function formatTickMark(
  timeSeconds: number,
  tickMarkType: number,
  locale: string,
): string {
  const date = new Date(timeSeconds * 1000);
  // Sempre saneado antes de chegar ao Intl — ver safeLocale acima.
  const loc = safeLocale(locale);

  switch (tickMarkType) {
    // As duas marcas INTRADIÁRIAS: aqui a hora é a única informação que
    // distingue uma marca da vizinha. Era exatamente ela que se perdia.
    case TICK_MARK_TYPE.Time:
    case TICK_MARK_TYPE.TimeWithSeconds:
      return date.toLocaleTimeString(loc, {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

    // Virada de ano: `DD MMM` sozinho não distingue 01 JAN de dois anos
    // diferentes. O ano é o que essa marca existe para dizer.
    case TICK_MARK_TYPE.Year:
      return `${dayMonth(date, loc)} ${date.getFullYear()}`;

    // Dia e mês seguem idênticos ao formatador anterior.
    default:
      return dayMonth(date, loc);
  }
}
