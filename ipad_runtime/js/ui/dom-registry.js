// dom-registry.js — registro central de elementos DOM ("els"), extraido de
// app.js (FOCO6: app.js nao pode virar bola de neve). Continua sendo um
// unico objeto compartilhado por import — mesma identidade/semantica que
// tinha como const local em app.js, so' que agora qualquer modulo de render
// extraido (js/render/*.js) pode importa-lo sem duplicar o registro nem
// reconsultar o DOM. Populado uma unica vez no carregamento do modulo:
// <script type="module"> e' deferred por padrao, entao o HTML ja terminou
// de parsear quando este modulo executa — mesma temporalidade que existia
// inline em app.js antes desta extracao.

export const els = {};

const ELEMENT_IDS = [
    'st-pwa', 'st-sw', 'st-cache', 'st-idb', 'st-opfs', 'st-webcrypto', 'st-wasm', 'st-workers',
    'st-webgpu', 'st-webgl', 'st-webllm', 'st-transformers', 'st-onnx', 'st-replay', 'st-vault', 'st-mode',
    'st-voice', 'st-speech-rec', 'st-speech-syn', 'st-mic-perm',
    'st-llama-layer', 'st-llama-profile', 'st-llama-runtime', 'st-llama-webgpu', 'st-llm-adapter-tier',
    'cyborg-live-ticker', 'live-ticker-track',
    'console-log', 'telemetry-latest', 'replay-canvas', 'replay-meta', 'import-input', 'home-modal', 'standalone-state',
    'siriform-avatar', 'siriform-caption', 'siriform-state-tag', 'macro-state-chip', 'mic-button', 'mic-status-label', 'btn-voice-info', 'engine-meta', 'analysis-frame-grid',
    'vault-meta', 'vault-hashes', 'profile-hint',
    'ex-state', 'ex-state-row', 'ex-source', 'ex-freshness', 'ex-paper', 'ex-risk', 'ex-vault', 'ex-report',
    'cr-pwa', 'cr-sw', 'cr-cache', 'cr-idb', 'cr-opfs', 'cr-webcrypto', 'cr-wasm', 'cr-workers',
    'cr-webgpu', 'cr-voice', 'cr-llama', 'cr-pack', 'cr-replay', 'cr-safety',
    'vl-pack', 'vl-pack-name', 'vl-pack-version', 'vl-sha256', 'vl-sw-cache', 'vl-cache-api',
    'vl-idb', 'vl-opfs', 'vl-wasm', 'vl-replay', 'vl-updated', 'vl-cache-version',
    'vl-storage-used', 'vl-storage-quota', 'vl-safety', 'vl-repair',
    'dp-realmode', 'dp-analysis', 'export-list',
    'rdl-connector-grid', 'rdl-active-source', 'rdl-connector-session-note', 'real-data-import-input', 'rdl-ws-ticker',
    'bl-price-row', 'bl-current-price', 'bl-price-delta-badge', 'bl-current-source', 'bl-current-freshness', 'bl-current-mode', 'bl-current-latency',
    'bl-snapshot-price', 'bl-snapshot-time', 'bl-snapshot-age', 'bl-price-diff',
    'bl-route-long-grid', 'bl-route-short-grid', 'bl-reanalyze-banner', 'bl-btn-refresh-now',
    'sr-resistance-2', 'sr-resistance-1', 'sr-current-price', 'sr-support-1', 'sr-support-2',
    'real-analysis-frame-grid', 'real-analysis-frame-session-note', 'real-analysis-frame-note',
    're-evidence-grid', 're-missing-fields', 're-session-note', 're-evidence-hash',
    'route-a-long-grid', 'route-b-short-grid', 'route-c-wait-grid', 'research-engine-session-note',
    'research-data-sufficiency-label', 'research-data-matrix-grid',
    'rdl-explanation-text',
    'sw-update-banner', 'sw-update-text',
    'topbar-status', 'advanced-section', 'btn-tb-advanced',
    'ev-command-routing', 'ev-security-posture', 'ev-data-policy', 'ev-fail-closed', 'ev-siriform-states', 'ev-summary',
    'mx-load-time', 'mx-prep-time', 'mx-cache', 'mx-storage', 'mx-siriform-events', 'mx-diag-fails', 'mx-eval-fails', 'mx-reduced-motion',
    'cs-commander-status', 'cs-soldier-status', 'cs-sync-bridge-status',
    'mv-event-log-count', 'mv-snapshot-status', 'mv-last-good-status', 'mv-recovery-status', 'mv-hydration-status', 'btn-mv-snapshot',
    'sh-grid', 'sh-active-count', 'sh-total-count', 'dm-source-health-summary',
    'rg-kill-switch', 'rg-max-drawdown', 'rg-max-position', 'rg-require-stop', 'rg-min-quality', 'btn-rg-engage', 'btn-rg-disengage',
    'pt-mode', 'pt-open-positions', 'pt-closed-trades', 'pt-realized-pnl', 'pt-drawdown', 'pt-positions-grid', 'pt-block-note', 'btn-pt-open', 'btn-pt-clear',
    'ls-mode', 'ls-status', 'ls-reasons', 'ls-unlock-requires',
    'br-last-backup', 'btn-br-export', 'btn-br-import', 'br-import-input',
    'al-list', 'al-count', 'btn-al-refresh',
    'li-final-label', 'li-confidence', 'li-source-quality', 'li-volatility', 'li-trend', 'li-risk', 'li-data-mode',
    'li-explanation', 'li-reflection-text', 'btn-li-run', 'btn-li-reflect',
    'status-modal', 'status-modal-title', 'status-modal-body', 'btn-status-modal-close',
    'se-edge-status', 'se-device', 'se-session-id', 'se-last-sequence', 'se-render-latency',
    'se-dropped-frames', 'se-visible-panels', 'se-focused-symbol', 'se-focused-timeframe',
    'se-connection-state', 'se-storage-mirror', 'se-is-authoritative', 'se-soldier-validation',
    'ta-telegram-layer', 'ta-bot-token', 'ta-webhook', 'ta-live-execution', 'ta-signal-quarantine',
    'ta-source-trust', 'ta-allowed-commands', 'ta-risk-gate', 'ta-event-ledger', 'ta-is-authoritative',
    'he-ring', 'he-progress-pct', 'he-status', 'he-current-package', 'he-session', 'he-completed', 'he-pending', 'he-failed', 'he-bytes', 'he-checkpoint',
    'he-quota', 'he-resumable', 'he-offline-available', 'he-fail-closed', 'he-last-error',
    'btn-he-start', 'btn-he-pause', 'btn-he-verify', 'btn-he-repair', 'btn-he-export',
    'tb-build-badge', 'tb-heartbeat', 'ex-hydration', 'ex-local', 'li-final-label-hero', 'li-confidence-hero',
    'li-gauge-wrap', 'li-gauge-needle',
];

ELEMENT_IDS.forEach((id) => { els[id] = document.getElementById(id); });
