// siriform.js — controlador do Siriform Avatar (orbe central CSS-only).
// Estados puramente visuais/informativos: nenhum estado aqui dispara rede,
// ordem ou execucao. E so feedback de UI sobre o que o runtime local esta
// fazendo (idle/listening/thinking/responding/installing/analyzing) ou sobre
// a postura de seguranca permanente (read_only/fail_closed).

const STATES = [
    'idle', 'listening', 'thinking', 'responding', 'installing', 'analyzing', 'read_only', 'fail_closed',
];

const DEFAULT_CAPTIONS = {
    idle: 'Cyborg em standby. Toque em qualquer botão para começar.',
    listening: 'Ouvindo o seu toque...',
    thinking: 'Processando localmente, sem rede...',
    responding: 'Pronto.',
    installing: 'Instalando pacote local no Safari Storage...',
    analyzing: 'Analisando dados locais...',
    read_only: 'Cyborg operando em READ_ONLY / FAIL_CLOSED.',
    fail_closed: 'Execução real bloqueada. Modo seguro ativo.',
};

let avatarEl = null;
let captionEl = null;
let tagEl = null;
let restTimer = null;

const TRANSIENT_STATES = new Set(['listening', 'thinking', 'responding', 'installing', 'analyzing']);
const REST_DELAY_MS = 3600;

export function initSiriform({ avatar, caption, tag }) {
    avatarEl = avatar;
    captionEl = caption;
    tagEl = tag;
    setSiriformState('idle');
}

export function setSiriformState(state, captionOverride) {
    if (!avatarEl) return;
    const normalized = STATES.includes(state) ? state : 'idle';
    avatarEl.setAttribute('data-state', normalized);
    if (tagEl) tagEl.textContent = normalized.toUpperCase();

    const text = captionOverride || DEFAULT_CAPTIONS[normalized];
    if (captionEl) {
        captionEl.classList.remove('is-visible');
        // forca reflow para reiniciar a transicao de fade mesmo trocando so o texto
        // eslint-disable-next-line no-unused-expressions
        captionEl.offsetHeight;
        captionEl.textContent = text;
        captionEl.classList.add('is-visible');
    }

    clearTimeout(restTimer);
    if (TRANSIENT_STATES.has(normalized)) {
        restTimer = setTimeout(() => setSiriformState('read_only'), REST_DELAY_MS);
    }
}

export function pulseListening() {
    setSiriformState('listening');
}
