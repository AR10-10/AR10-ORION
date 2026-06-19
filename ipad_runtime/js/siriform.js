// siriform.js — controlador do Siriform Avatar (orbe central CSS-only).
// Estados puramente visuais/informativos: nenhum estado aqui dispara rede,
// ordem ou execucao. E so feedback de UI sobre o que o runtime local esta
// fazendo (idle/listening/thinking/responding/installing/analyzing) ou sobre
// a postura de seguranca permanente (read_only/fail_closed).
//
// Existe uma segunda trilha de estado, independente, para a camada de voz
// (voice_idle/voice_listening/...). As duas trilhas sao mantidas separadas
// de proposito: a trilha de atividade descreve "o que o runtime esta
// fazendo" (avatar, atributo data-state); a trilha de voz descreve "o que o
// microfone/Siriform Voice esta fazendo" (botao de mic, atributo
// data-voice-state). Misturar as duas em uma lista so de STATES geraria
// combinacoes invalidas (ex.: "instalando" + "ouvindo" ao mesmo tempo).

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

const VOICE_STATES = [
    'voice_idle', 'voice_permission_required', 'voice_listening', 'voice_processing',
    'voice_responding', 'voice_text_only', 'voice_unsupported', 'voice_blocked_by_policy',
];

const VOICE_CAPTIONS = {
    voice_idle: 'Microfone em standby.',
    voice_permission_required: 'Preciso da permissão do microfone para ouvir você.',
    voice_listening: 'Ouvindo...',
    voice_processing: 'Interpretando o comando de voz...',
    voice_responding: 'Pronto.',
    voice_text_only: 'Voz indisponível neste Safari — use os botões na tela.',
    voice_unsupported: 'Reconhecimento de voz não suportado neste navegador.',
    voice_blocked_by_policy: 'Execução real está bloqueada. O Cyborg está em READ_ONLY / FAIL_CLOSED.',
};

let avatarEl = null;
let captionEl = null;
let tagEl = null;
let micEl = null;
let restTimer = null;
let voiceRestTimer = null;

const TRANSIENT_STATES = new Set(['listening', 'thinking', 'responding', 'installing', 'analyzing']);
const REST_DELAY_MS = 3600;

const VOICE_TRANSIENT_STATES = new Set(['voice_listening', 'voice_processing', 'voice_responding', 'voice_blocked_by_policy']);
const VOICE_REST_DELAY_MS = 3200;

export function initSiriform({ avatar, caption, tag, mic }) {
    avatarEl = avatar;
    captionEl = caption;
    tagEl = tag;
    micEl = mic || null;
    setSiriformState('idle');
    if (micEl) setVoiceState('voice_idle');
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

export function setVoiceState(state, captionOverride) {
    if (!micEl) return;
    const normalized = VOICE_STATES.includes(state) ? state : 'voice_idle';
    micEl.setAttribute('data-voice-state', normalized);

    const text = captionOverride || VOICE_CAPTIONS[normalized];
    if (captionEl && text) {
        captionEl.classList.remove('is-visible');
        // forca reflow para reiniciar a transicao de fade mesmo trocando so o texto
        // eslint-disable-next-line no-unused-expressions
        captionEl.offsetHeight;
        captionEl.textContent = text;
        captionEl.classList.add('is-visible');
    }

    clearTimeout(voiceRestTimer);
    if (VOICE_TRANSIENT_STATES.has(normalized)) {
        voiceRestTimer = setTimeout(() => setVoiceState('voice_idle'), VOICE_REST_DELAY_MS);
    }
}

export function getVoiceState() {
    return micEl ? micEl.getAttribute('data-voice-state') : null;
}
