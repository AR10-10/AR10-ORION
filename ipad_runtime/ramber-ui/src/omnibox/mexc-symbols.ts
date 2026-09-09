// mexc-symbols.ts — ADITIVO V-MAX Etapa 9 (Radar Global/OIH: "monitorar
// continuamente todos os ativos públicos da MEXC", dependente da Etapa 1
// Market Data Adapter já concluída). Irmão direto de binance-symbols.ts —
// mesma disciplina: extração PURA e testável sem rede; só fetchMexc*
// toca a rede, fail-closed ([] honesto, nunca uma lista velha/fabricada).
//
// Endpoint real: GET https://api.mexc.com/api/v1/contract/detail (público,
// sem chave — mesmo host já vetted por cross-exchange/mexc-futures.ts
// nesta mesma sessão). Resposta { success, code, data: [...] } — `data` é
// um ARRAY de contratos (diferente do objeto-de-arrays-paralelos dos
// klines, ver mexc-futures-public.js), cada um com symbol ("BTC_USDT"),
// baseCoin, quoteCoin, settleCoin, apiAllowed, isHidden (corroborado por
// múltiplas fontes secundárias — mesma ressalva de honestidade de
// mexc-futures-public.js: doc oficial bloqueada nesta sessão, HTTP 403).
//
// Correção (achado real, 2026-09-09, Operador reportou "MEXC não busca os
// ativos"): a nota abaixo sobre "sem confirmação de um campo de estado
// equivalente" ficou pra trás. `state` (string, "0"=enabled/"1"=delivery/
// "2"=completed/"3"=offline/"4"=pause) é um campo REAL do payload de
// /contract/detail — corroborado agora por uma fonte independente forte
// que este sandbox não tinha quando este arquivo foi escrito (zero egress
// a exchanges): o parser de mercados da ccxt (biblioteca de trading open-
// source, produção real) lê exatamente esse campo pra decidir
// `active: state == '0'`. Adicionado ADITIVAMENTE — `isHidden`/`apiAllowed`
// continuam o piso de segurança que já existia; `state` é mais um filtro
// real, nunca uma substituição. Ausência do campo (`undefined`/`null`)
// NUNCA vira exclusão — Regra de Ouro 3, ausência não é prova de
// inatividade — só um `state` PRESENTE e diferente de "0" exclui.
//
// Honestidade sobre o filtro de "ativo agora": ao contrário da Binance
// (campo `status === "TRADING"` bem documentado e já usado em
// binance-symbols.ts), a confirmação acima chegou por corroboração
// externa (ccxt), nunca pela documentação oficial diretamente (ainda
// bloqueada nesta sessão, HTTP 403/egress) — mesmo padrão de honestidade
// das demais notas deste arquivo.
export interface MexcUsdtSymbol {
  symbol: string; // par completo como a API devolve, ex. "BTC_USDT"
  baseAsset: string;
}

const CONTRACT_DETAIL_URL = "https://api.mexc.com/api/v1/contract/detail";

/** Extrai os contratos USDT-M perpétuos reais e negociáveis do payload
 *  bruto de /api/v1/contract/detail. Função pura — testável sem rede. */
export function extractMexcUsdtSymbols(json: any): MexcUsdtSymbol[] {
  if (!json || json.success !== true) return [];
  const rows = json.data;
  if (!Array.isArray(rows)) return [];
  const out: MexcUsdtSymbol[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    if (typeof row.symbol !== "string" || typeof row.baseCoin !== "string") continue;
    if ((row.settleCoin ?? row.quoteCoin) !== "USDT") continue;
    if (row.isHidden === true) continue;
    if (row.apiAllowed === false) continue;
    if (row.state !== undefined && row.state !== null && String(row.state) !== "0") continue;
    out.push({ symbol: row.symbol, baseAsset: row.baseCoin });
  }
  return out;
}

/** Busca real — toda a lógica testável vive em extractMexcUsdtSymbols.
 *  Fail-closed: qualquer erro de rede/HTTP/parse devolve [] (nunca uma
 *  exceção não tratada, nunca uma lista velha). `console.warn` no motivo
 *  REAL da falha (status HTTP, erro de rede/CORS, ou resposta sem
 *  `success:true`) — nunca muda o contrato de retorno (Regra de Ouro 3:
 *  fail-closed continua [], isto é só diagnóstico pra quem depurar
 *  depois, achado real desta rodada: "MEXC não carrega" e "por quê" eram
 *  indistinguíveis, os dois viravam silenciosamente [] sem rastro). */
export async function fetchMexcUsdtSymbols(): Promise<MexcUsdtSymbol[]> {
  try {
    const res = await fetch(CONTRACT_DETAIL_URL);
    if (!res.ok) {
      console.warn(`[mexc-symbols] HTTP ${res.status} de ${CONTRACT_DETAIL_URL} — devolvendo [] honesto.`);
      return [];
    }
    const json = await res.json();
    const out = extractMexcUsdtSymbols(json);
    if (out.length === 0) {
      console.warn(
        `[mexc-symbols] resposta HTTP ok mas zero símbolo extraído — json.success=${json?.success}, ` +
          `data é array? ${Array.isArray(json?.data)}, tamanho=${Array.isArray(json?.data) ? json.data.length : "n/a"}.`,
      );
    }
    return out;
  } catch (err) {
    // Causa mais provável de um catch aqui num navegador real: falha de
    // rede genuína OU um bloqueio de CORS (fetch() rejeita sem detalhe
    // algum nesse segundo caso — limitação do próprio navegador, não
    // deste código). Nunca verificado ao vivo nesta base (sandbox de
    // implementação sem egress a exchanges) — se for CORS, nenhuma
    // mudança de código do lado do cliente resolve; precisaria de proxy
    // próprio, decisão de arquitetura fora do escopo deste fix pontual.
    console.warn(`[mexc-symbols] fetch/parse falhou (rede ou possível CORS): ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
}
