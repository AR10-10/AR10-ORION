// siriform.js — controlador do Siriform Avatar (orbe central CSS-only),
// o "command center" emocional do app (Fase 6). Estados puramente
// visuais/informativos: nenhum estado aqui dispara rede, ordem ou execucao.
// Vocabulario de estado: IDLE, LISTENING, THINKING, UPDATING, CHECKING,
// REPAIRING, SUCCESS, WARNING, BLOCKED (lowercase internamente).
//
// Existe uma segunda trilha de estado, independente, para a camada de voz
// (voice_idle/voice_listening/...). As duas trilhas sao mantidas separadas
// de proposito: a trilha de atividade descreve "o que o runtime esta
// fazendo" (avatar, atributo data-state); a trilha de voz descreve "o que o
// microfone/Siriform Voice esta fazendo" (botao de mic, atributo
// data-voice-state). Misturar as duas em uma lista so de STATES geraria
// combinacoes invalidas (ex.: "atualizando" + "ouvindo" ao mesmo tempo).

const STATES = [
    'idle', 'listening', 'thinking', 'updating', 'checking', 'repairing', 'success', 'warning', 'blocked',
];

const DEFAULT_CAPTIONS = {
    idle: 'Cyborg em standby. Toque em "Preparar / Atualizar Cyborg neste iPad" para começar.',
    listening: 'Ouvindo o seu toque...',
    thinking: 'Processando localmente, sem rede...',
    updating: 'Atualizando/instalando pacote local no Safari Storage...',
    checking: 'Verificando dados locais...',
    repairing: 'Reparando instalação local...',
    success: 'Pronto.',
    warning: 'Atenção: ação manual pode ser necessária.',
    blocked: 'Execução real bloqueada. Modo seguro ativo.',
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

const TRANSIENT_STATES = new Set(['listening', 'thinking', 'updating', 'checking', 'repairing', 'success', 'warning']);
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
        restTimer = setTimeout(() => setSiriformState('idle'), REST_DELAY_MS);
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
