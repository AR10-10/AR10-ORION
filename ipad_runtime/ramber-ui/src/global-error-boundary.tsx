// global-error-boundary.tsx — Achado real da AUDITORIA TÉCNICA COMPLETA
// (docs/AUDITORIA_TECNICA_COMPLETA_PREENCHIDA.md, item A9): WidgetErrorBoundary
// (App.tsx) só protege DENTRO de um Widget — um erro de render fora dele
// (no shell do App, no AccessGate, num Provider) derrubava a tela inteira
// sem fallback nenhum, sem nem uma tela em branco explicada. Mesmo padrão de
// classe (error boundaries não têm equivalente em hook), agora na raiz —
// cobre o que WidgetErrorBoundary não alcança, sem duplicar a proteção já
// existente (um Widget que quebra continua isolado por ele primeiro; este só
// é acionado quando o erro escapa de qualquer Widget).
//
// LEI 1: puramente uma tela de fallback de renderização — zero rede, zero
// ordem, zero mutação de estado além do próprio catch. "Recarregar" é
// window.location.reload(), nunca uma tentativa de "consertar" o estado.
import { Component, type ReactNode } from "react";
import { APP_SEAL } from "./version";

interface GlobalErrorBoundaryState {
  error: Error | null;
}

export class GlobalErrorBoundary extends Component<{ children: ReactNode }, GlobalErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): GlobalErrorBoundaryState {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-[#010205] px-6">
        <div className="cyber-panel w-full max-w-sm px-6 py-8 flex flex-col items-center gap-4 text-center">
          <div className="text-[#00f0ff] font-black tracking-[0.2em] text-sm drop-shadow-[0_0_5px_#00f0ff]">
            AR10 CYBORG
          </div>
          <div className="text-[#ff0055] text-[0.65rem] font-bold tracking-[0.15em] uppercase">
            Erro de Renderização
          </div>
          <div className="text-[#8ab4f8]/70 text-[0.6rem] leading-relaxed">
            Um erro real interrompeu a interface. Nenhuma ordem foi enviada —
            este terminal é READ_ONLY e não tem caminho de execução. Dados de
            Paper Trading e camadas salvas continuam intactos (armazenamento
            local do dispositivo).
          </div>
          {error.message ? (
            <div className="w-full bg-[#010308] border border-[#8ab4f8]/15 rounded px-3 py-2 text-[#8ab4f8]/50 text-[0.55rem] break-words text-left">
              {error.message}
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full bg-[#00f0ff]/10 border border-[#00f0ff]/40 rounded px-3 py-2 text-[#00f0ff] text-xs font-bold tracking-wide uppercase"
          >
            Recarregar
          </button>
          <div className="text-[#8ab4f8]/30 text-[0.5rem]">{APP_SEAL}</div>
        </div>
      </div>
    );
  }
}
