import { Radio } from "lucide-react";

// TradFiEmptyState.tsx — Overhaul Cross-Market (Missão 2, diretriz 4:
// Modo Fail-Closed). Nenhuma API Macro existe neste sistema hoje — clicar
// em qualquer ativo TradFi (índice/ação/commodity/forex) NUNCA tenta
// puxar dado da Binance para ele (o símbolo simplesmente não é um par
// Binance) e NUNCA quebra o app. Este componente é o que aparece no
// lugar de qualquer painel que dependeria dessa fonte inexistente — no
// MESMO vocabulário honesto já usado em todo o resto do sistema
// (AGUARDANDO / SEM_API / DADOS_INSUFICIENTES): declarar a ausência,
// nunca fabricar um número.
export function TradFiEmptyState({
  assetLabel,
  compact = false,
}: {
  assetLabel: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`cyber-panel flex flex-col items-center justify-center gap-2 text-center px-4 ${
        compact ? "flex-1 min-h-[120px] py-3" : "flex-1 min-h-[280px] py-10"
      }`}
    >
      <Radio size={compact ? 16 : 26} className="text-[#8ab4f8]/40 animate-pulse-glow" />
      {assetLabel ? (
        <div className="text-[0.6rem] font-bold text-[#a0f0ff]/80 tracking-wide uppercase">{assetLabel}</div>
      ) : null}
      <div className="text-[0.55rem] tracking-[0.15em] text-[#8ab4f8]/70 uppercase max-w-[300px] leading-relaxed font-bold">
        Aguardando conexão de fonte real (Macro API) - Modo Read-Only
      </div>
    </div>
  );
}
