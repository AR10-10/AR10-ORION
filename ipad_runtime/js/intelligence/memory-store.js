// memory-store.js — memoria da Local Intelligence Engine. Nao cria um
// segundo ledger paralelo: grava SetupScore e ReflectionReport como entradas
// marcadas (campo "kind") no MESMO Evidence Ledger que ja existe
// (js/memory/evidence-ledger.js), que ja tem limite de 50 entradas, append-
// only, e ja entra no Backup/Recovery Pack. Isso evita duas fontes de
// verdade de memoria local divergindo entre si.

import * as evidenceLedger from '../memory/evidence-ledger.js';

const KIND_SETUP_SCORE = 'local_setup_score';
const KIND_REFLECTION_REPORT = 'local_reflection_report';

export async function recordSetupScore(score) {
    return evidenceLedger.appendEvidence({ kind: KIND_SETUP_SCORE, ...score });
}

export async function getSetupScoreHistory(limit = 20) {
    const ledger = await evidenceLedger.getLedger();
    return ledger.filter((e) => e.kind === KIND_SETUP_SCORE).slice(0, limit);
}

export async function recordReflectionReport(report) {
    return evidenceLedger.appendEvidence({ kind: KIND_REFLECTION_REPORT, ...report });
}

export async function getReflectionHistory(limit = 10) {
    const ledger = await evidenceLedger.getLedger();
    return ledger.filter((e) => e.kind === KIND_REFLECTION_REPORT).slice(0, limit);
}
