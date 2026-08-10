// export-manifest.js — política de exportação de arquivos visíveis ao usuário.
// Local-first: arquivos INTERNOS do app são salvos automaticamente no
// armazenamento seguro (OPFS/IndexedDB/Cache) e o usuário nunca precisa
// gerenciar pastas. Quando o usuário EXPORTA algo para o app Arquivos, cada
// artefato recebe um nome ÚNICO com data/hora — nunca dois artefatos
// diferentes com o mesmo nome (sem prompt de "substituir").
//
// Nenhum arquivo exportado por este módulo contém segredo, chave de API,
// credencial de corretora ou dado de conta real — só estado de diagnóstico
// local, estatística descritiva sintética e metadados de integridade.

/** Carimbo de data/hora local no formato YYYYMMDD_HHMMSS. */
export function timestamp(d = new Date()) {
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/** Nome único: AR10_CYBORG_[TYPE]_[VERSION]_[YYYYMMDD_HHMMSS].[ext]
 *  VERSION é opcional (omitido se vazio). */
export function uniqueName(type, version, ext) {
    const v = version ? `_${version}` : '';
    return `AR10_CYBORG_${type}${v}_${timestamp()}.${ext}`;
}

// Registro em memória dos artefatos desta sessão (mais recentes primeiro).
const sessionExports = [];

/** Dispara um download nativo do Safari com nome único e registra o evento.
 *  Retorna a entrada registrada (com o filename realmente usado). */
export function downloadArtifact({ type, version = '', ext, blob, purpose = '' }) {
    const filename = uniqueName(type, version, ext);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    const entry = { type, version, ext, filename, purpose, bytes: blob.size, generated_at: new Date().toISOString(), visibility: 'downloadable' };
    sessionExports.unshift(entry);
    return entry;
}

/** Artefatos "de base" conhecidos do produto — alguns são apenas internos
 *  (vivem no armazenamento seguro / no repositório) e não são baixados a
 *  cada sessão; outros são baixáveis sob demanda. Usado para popular o
 *  painel "Arquivos Exportados" mesmo antes de qualquer exportação. */
export function baseArtifacts() {
    return [
        { type: 'LOCAL_PACK', version: 'V1', ext: 'ar10pack', visibility: 'downloadable', purpose: 'Pacote local (WASM + dataset de replay + manifestos) instalado automaticamente no Safari Storage.', internal_source: 'AR10_CYBORG_LOCAL_PACK_V1.ar10pack' },
        { type: 'FINAL_REPORT', version: '', ext: 'md', visibility: 'on_demand', purpose: 'Relatório de sessão (estado do runtime, Vault e AnalysisFrame de diagnóstico). Gerado sob demanda.', internal_source: null },
        { type: 'EVIDENCE_OUTBOX', version: '', ext: 'json', visibility: 'internal', purpose: 'Manifesto SHA256 + checklist + inventário. Vive em evidence_outbox/ no repositório.', internal_source: 'evidence_outbox/manifest.sha256.json' },
        { type: 'EVIDENCE_LEDGER', version: '', ext: 'json', visibility: 'on_demand', purpose: 'Histórico de Evidence real (Real Data Layer) acumulado nesta sessão, persistido via IndexedDB. Gerado sob demanda.', internal_source: null },
        { type: 'HYDRATION_ENGINE_REPORT', version: '', ext: 'json', visibility: 'on_demand', purpose: 'Relatório curto da Hydration Engine (status, progresso, quota, Local Availability Map). Gerado sob demanda.', internal_source: null },
        { type: 'PROJECT_DECKAP', version: 'V1', ext: 'html', visibility: 'future', purpose: 'Deck/apresentação do projeto. Reservado para entrega futura.', internal_source: null },
    ];
}

/** Lista completa para render: exportações desta sessão (mais recentes) +
 *  artefatos de base, sem duplicar tipos já exportados nesta sessão. */
export function listForPanel() {
    const exportedTypes = new Set(sessionExports.map((e) => e.type));
    const base = baseArtifacts().filter((b) => !exportedTypes.has(b.type));
    return [...sessionExports, ...base];
}
