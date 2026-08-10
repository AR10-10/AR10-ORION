// hydration-report.js — função pura que descreve, em português, o que o
// boot conseguiu reidratar da memória local (IndexedDB) antes de qualquer
// sonda de rede nova rodar nesta sessão. Não busca dado sozinho: quem chama
// (app.js, dentro de boot()) já sabe o que tentou reidratar em cada seção
// (Real Data Layer, Evidence Ledger, Snapshots, Recovery History...) e passa
// o resultado aqui só para virar um relatório consistente e narrável.

function sectionStatus({ hasError, hasData, count }) {
    if (hasError) return 'FAILED';
    if (hasData && (count === undefined || count === null || count > 0)) return 'RECOVERED';
    if (hasData) return 'PARTIAL';
    return 'EMPTY';
}

function buildSiriformSummary(sections, overall) {
    const failed = sections.filter((s) => s.status === 'FAILED').map((s) => s.name);
    if (overall === 'FULLY_RECOVERED') return `Memória local restaurada por completo: ${sections.length} área(s) recuperada(s) sem falha.`;
    if (overall === 'PARTIAL_WITH_FAILURES') return `Memória local restaurada parcialmente — falha ao reidratar: ${failed.join(', ')}.`;
    if (overall === 'PARTIAL') return 'Memória local restaurada parcialmente — algumas áreas ainda vazias nesta instalação.';
    return 'Nenhuma memória local anterior encontrada nesta instalação — primeira sessão ou armazenamento limpo.';
}

/** @param {Array<{name:string, hasData:boolean, hasError?:boolean, detail?:string, count?:number}>} sections */
export function buildHydrationReport(sections = []) {
    const evaluated = sections.map((s) => ({
        name: s.name,
        status: sectionStatus(s),
        detail: s.detail || null,
        count: s.count ?? null,
    }));
    const failedCount = evaluated.filter((s) => s.status === 'FAILED').length;
    const recoveredCount = evaluated.filter((s) => s.status === 'RECOVERED').length;

    let overall_status = 'EMPTY';
    if (failedCount > 0) overall_status = 'PARTIAL_WITH_FAILURES';
    else if (evaluated.length > 0 && recoveredCount === evaluated.length) overall_status = 'FULLY_RECOVERED';
    else if (recoveredCount > 0) overall_status = 'PARTIAL';

    return {
        generated_at: new Date().toISOString(),
        sections: evaluated,
        overall_status,
        siriform_summary: buildSiriformSummary(evaluated, overall_status),
    };
}
