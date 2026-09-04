// TradingViewAdvancedChart.tsx — widget real de fallback (pedido direto do
// Operador, confirmado explicitamente via AskUserQuestion antes de abrir a
// CSP script-src/frame-src só para tradingview.com — primeiro script de
// terceiro que este projeto já rodou na tela, decisão registrada, não uma
// abertura silenciosa).
//
// Achado real (docs/MARKET_DATA_FABRIC.md, seção "Fase 3" — confirmado ao
// vivo pelo próprio Operador rodando no PC dele, print real anexado): o
// conector Yahoo delayed (tradfi-delayed-yahoo.js) é bloqueado por CORS
// estrutural do lado do servidor da Yahoo — query1/query2.finance.yahoo.com
// não envia Access-Control-Allow-Origin, um problema antigo e conhecido,
// não um bug corrigível neste código (pesquisado via WebSearch, múltiplas
// fontes independentes confirmando). A TradingView oferece um widget
// gratuito, sem chave, que ELA mesma hospeda como iframe real — nunca um
// fetch() nosso, então o bloqueio de CORS simplesmente não se aplica aqui.
//
// DELIBERADAMENTE MINIMALISTA (mesma disciplina de TradFiRealChart.tsx):
// só o gráfico embutido. allow_symbol_change:true é a rede de segurança
// real contra um símbolo de futuro contínuo eventualmente errado (ver nota
// extensa em instrument-registry.js sobre o nível de confiança de cada
// tradingview_symbol) — o Operador corrige direto na tela, nunca precisa
// de um novo commit para um símbolo torto. Zero Core Engine/Council/
// nexus-core importado aqui — LEI 24 intacta pelo mesmo motivo já
// documentado em TradFiRealChart.tsx: este componente é puramente visual,
// nunca emite LONG/SHORT/WAIT.
//
// Widget injetado via script real (nunca reimplementado) no formato oficial
// documentado pela própria TradingView (script s3.tradingview.com/external-
// embedding/embed-widget-advanced-chart.js + config JSON como texto do
// próprio script) — confirmado via WebSearch nesta sessão contra a
// documentação real, não inventado. O widget é DECLARATIVO (não tem API de
// "trocar símbolo" em runtime) — trocar de instrumento recria o container
// do zero, mesmo espírito de "nunca mutar à mão o DOM de uma lib externa"
// já seguido pelo resto do projeto para bibliotecas de terceiro.
import { useEffect, useRef } from "react";

export function TradingViewAdvancedChart({ symbol }: { symbol: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = "";

    const widgetHost = document.createElement("div");
    widgetHost.className = "tradingview-widget-container__widget";
    container.appendChild(widgetHost);

    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;
    script.text = JSON.stringify({
      autosize: true,
      symbol,
      interval: "D",
      timezone: "Etc/UTC",
      theme: "dark",
      style: "1",
      locale: "br",
      allow_symbol_change: true,
      calendar: false,
      support_host: "https://www.tradingview.com",
    });
    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
  }, [symbol]);

  return <div ref={containerRef} className="tradingview-widget-container flex-1 min-h-0" />;
}
