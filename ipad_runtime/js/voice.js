// voice.js — Siriform Voice Layer (Web Speech API + SpeechSynthesis).
//
// Camada de voz opcional e best-effort: nenhuma funcao aqui executa ordem,
// abre posicao, fecha posicao ou conecta em corretora. O roteador
// (matchCommand) so reconhece frases e devolve uma intencao (id) ou um
// bloqueio explicito — quem decide o que fazer com essa intencao e o
// app.js, reusando os mesmos handlers que os botoes na tela ja usam (mesma
// superficie de acao, nunca uma rota nova/paralela de execucao).
//
// Nota de privacidade: dependendo do dispositivo/idioma, o proprio Safari
// pode processar o reconhecimento de fala em um servidor da Apple (fora do
// controle desta pagina). Isso e um detalhe de implementacao do sistema
// operacional, nao uma chamada de rede deste app — nenhum fetch()/XHR e
// feito por este modulo, e a CSP (connect-src 'self') permanece intacta.

const SpeechRecognitionImpl = window.SpeechRecognition || window.webkitSpeechRecognition || null;

export const BLOCKED_RESPONSE = 'Execução real está bloqueada. O Cyborg está em READ_ONLY / FAIL_CLOSED.';

// Frases bloqueadas por politica de seguranca (verbatim do briefing de
// produto). Checadas ANTES de qualquer comando permitido: se a transcricao
// contiver um trecho bloqueado em qualquer posicao, o resultado e sempre
// "blocked" — mesmo que a mesma frase tambem contenha um trecho permitido
// (defesa em profundidade; nunca deixa uma frase mista escapar como comando
// executavel).
export const BLOCKED_PHRASES = [
    'comprar', 'vender', 'abrir ordem', 'fechar ordem', 'enviar ordem', 'operar real', 'usar chave', 'conectar conta real',
];

// Comandos permitidos. Cada "id" e resolvido pelo app.js para o mesmo
// handler que o botao equivalente usa — este modulo nunca chama uma funcao
// de execucao diretamente, so devolve qual intencao foi reconhecida.
export const ALLOWED_COMMANDS = [
    { id: 'check-safari', phrases: ['verificar safari'] },
    { id: 'prepare-cyborg', phrases: ['preparar cyborg neste ipad', 'preparar cyborg'] },
    { id: 'run-diagnostics', phrases: ['rodar diagnostico offline', 'rodar diagnostico'] },
    { id: 'run-replay', phrases: ['rodar replay btc usdt', 'rodar replay btc/usdt', 'rodar replay btc'] },
    { id: 'show-status', phrases: ['mostrar status'] },
    { id: 'explain-analysis', phrases: ['explicar analise'] },
    { id: 'show-safety-mode', phrases: ['mostrar modo de seguranca'] },
    { id: 'show-add-home', phrases: ['como adicionar a tela de inicio'] },
];

function normalize(text) {
    return text
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
        .toLowerCase()
        .replace(/[?!.,;:]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/** Interpreta uma transcricao e devolve uma intencao:
 *  { type: 'blocked', matchedPhrase, response } |
 *  { type: 'allowed', id, matchedPhrase } |
 *  { type: 'unknown' } | { type: 'empty' }
 *  Bloqueio sempre tem prioridade sobre qualquer correspondencia permitida. */
export function matchCommand(transcript) {
    const norm = normalize(transcript || '');
    if (!norm) return { type: 'empty', transcript };

    for (const phrase of BLOCKED_PHRASES) {
        if (norm.includes(phrase)) {
            return { type: 'blocked', transcript, matchedPhrase: phrase, response: BLOCKED_RESPONSE };
        }
    }
    for (const cmd of ALLOWED_COMMANDS) {
        for (const phrase of cmd.phrases) {
            if (norm.includes(phrase)) {
                return { type: 'allowed', transcript, id: cmd.id, matchedPhrase: phrase };
            }
        }
    }
    return { type: 'unknown', transcript };
}

/** Sonda funcional (nao so "typeof"): reporta o que de fato esta disponivel
 *  nesta sessao, nunca um "OK" otimista demais. */
export function getVoiceCapabilities() {
    return {
        recognition: SpeechRecognitionImpl ? 'AVAILABLE' : 'UNSUPPORTED',
        synthesis: ('speechSynthesis' in window) ? 'AVAILABLE' : 'UNSUPPORTED',
    };
}

export async function getMicrophonePermissionState() {
    if (!('permissions' in navigator) || typeof navigator.permissions.query !== 'function') return 'REQUIRED';
    try {
        const status = await navigator.permissions.query({ name: 'microphone' });
        if (status.state === 'granted') return 'GRANTED';
        if (status.state === 'denied') return 'DENIED';
        return 'REQUIRED';
    } catch {
        // Safari/iPadOS nem sempre suporta a query 'microphone' via Permissions
        // API — nesse caso o estado real so e conhecido quando o usuario tocar
        // no microfone (o proprio SpeechRecognition pedira a permissao).
        return 'REQUIRED';
    }
}

/** Status agregado para o painel "Siriform Voice". `overall` resume os dois
 *  canais (reconhecimento + sintese): AVAILABLE (ambos), LIMITED (so um dos
 *  dois), TEXT_ONLY (nenhum dos dois — cai para o fallback de texto/legenda,
 *  que sempre funciona porque e DOM puro, nao depende de nenhuma API de voz). */
export async function getVoiceStatus() {
    const caps = getVoiceCapabilities();
    const microphonePermission = await getMicrophonePermissionState();

    let overall;
    if (caps.recognition === 'AVAILABLE' && caps.synthesis === 'AVAILABLE') overall = 'AVAILABLE';
    else if (caps.recognition === 'AVAILABLE' || caps.synthesis === 'AVAILABLE') overall = 'LIMITED';
    else overall = 'TEXT_ONLY';

    return { overall, recognition: caps.recognition, synthesis: caps.synthesis, microphonePermission };
}

/** Sintese de fala best-effort. Nunca lanca: se nao houver suporte, quem
 *  chamou ja tem um fallback de texto (a legenda do Siriform Avatar). */
export function speak(text) {
    if (!('speechSynthesis' in window) || !text) return false;
    try {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = 'pt-BR';
        utter.rate = 1.0;
        window.speechSynthesis.speak(utter);
        return true;
    } catch {
        return false;
    }
}

let recognizer = null;
let listening = false;

/** Inicia uma janela de escuta unica (nao continua, nao streaming). Devolve
 *  false de imediato se nao houver suporte ou se ja estiver escutando.
 *  onResult recebe a transcricao bruta; quem chamou decide o que fazer com
 *  ela (normalmente: matchCommand + despachar para o handler do app.js). */
export function startListening({ onStart, onResult, onError, onEnd } = {}) {
    if (!SpeechRecognitionImpl) {
        onError?.('unsupported');
        return false;
    }
    if (listening) return false;

    try {
        recognizer = new SpeechRecognitionImpl();
        recognizer.lang = 'pt-BR';
        recognizer.continuous = false;
        recognizer.interimResults = false;
        recognizer.maxAlternatives = 1;

        recognizer.onstart = () => { listening = true; onStart?.(); };
        recognizer.onresult = (ev) => {
            const transcript = ev.results?.[0]?.[0]?.transcript || '';
            onResult?.(transcript);
        };
        recognizer.onerror = (ev) => {
            // 'not-allowed'/'service-not-allowed' = permissao de microfone
            // negada ou pendente; outros codigos = falha pontual do motor.
            onError?.(ev.error || 'unknown');
        };
        recognizer.onend = () => { listening = false; onEnd?.(); };

        recognizer.start();
        return true;
    } catch (err) {
        onError?.(err.message || 'start_failed');
        return false;
    }
}

export function stopListening() {
    if (recognizer && listening) {
        try { recognizer.stop(); } catch { /* noop */ }
    }
}

export function isListening() {
    return listening;
}
