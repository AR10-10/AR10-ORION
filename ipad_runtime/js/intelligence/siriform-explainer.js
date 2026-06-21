// siriform-explainer.js — traduz SetupScore/MemoryMatch/ReflectionReport
// para frases curtas em portugues, no mesmo espirito de
// app.js:buildRealDataExplanation(). So' template sobre dados que ja
// existem no objeto — nenhuma chamada de rede, nenhuma IA externa.

export function explainSetupScore(score) {
    if (!score || score.final_label === 'DADOS_INSUFICIENTES') {
        return `Sem dados reais suficientes nesta sessao para gerar uma leitura local. ${score && score.invalidation_reason ? score.invalidation_reason : ''} Nenhuma leitura e forcada.`.trim();
    }
    const parts = [];
    if (score.final_label === 'BLOQUEADO') {
        parts.push(`Leitura marcada BLOQUEADO: ${score.invalidation_reason}`);
    } else if (score.final_label === 'OBSERVAR') {
        parts.push('Condicao classificada como OBSERVAR — volatilidade/z-score fora da faixa normal. E apenas leitura, nao e recomendacao.');
    } else {
        parts.push('Condicao classificada como PAPER_ONLY — dentro de faixas normais, elegivel so para Paper Trading.');
    }
    parts.push(`Volatilidade ${score.volatility_score ?? 'n/d'} · Tendencia ${score.trend_score ?? 'n/d'} · Risco descritivo ${score.risk_score ?? 'n/d'}.`);
    parts.push('Esta leitura nao e sinal, nao e ordem e nao decide nada — Live Trading continua LIVE_LOCKED.');
    return parts.join(' ');
}

export function explainMemoryMatches(matches) {
    if (!matches || !matches.length) return 'Nenhum cenario parecido encontrado na memoria local deste dispositivo ainda.';
    const top = matches[0];
    return `Cenario mais parecido na memoria local: similaridade ${top.similarity_score}%, rotulo anterior ${top.past_outcome}. ${top.lesson}`;
}

export function explainReflectionReport(report) {
    if (!report) return 'Nenhum relatorio de reflexao gerado ainda nesta sessao.';
    return `${report.what_changed} ${report.what_worked} ${report.what_failed} Proximos passos seguros: ${report.next_safe_steps.join('; ')}.`;
}
