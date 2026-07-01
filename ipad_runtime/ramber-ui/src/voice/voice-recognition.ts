// voice-recognition.ts — IRON-VOICE camada 2: Speech-to-Text real.
//
// Tecnologia REAL: webkitSpeechRecognition (Web Speech API). Suportada no
// Safari/iPadOS 14.5+ (exige "Siri e Ditado" ativos no aparelho) e no
// Chrome. Restrições reais respeitadas em vez de escondidas:
//   - Exige permissão de microfone concedida pelo usuário — a primeira
//     ativação SEMPRE parte de um toque (push-to-talk), nunca automática.
//   - iOS encerra sessões longas de reconhecimento por conta própria; por
//     isso o modo primário é PUSH-TO-TALK (segurar/soltar), que é o único
//     comportamento garantido. Não existe modo "always listen" aqui:
//     prometê-lo seria mentir sobre o que o Safari sustenta.
//   - Sem suporte -> isSupported() false, UI mostra INDISPONÍVEL. Nada finge.

export interface RecognitionResult {
  transcript: string;
  isFinal: boolean;
}

export type RecognitionState = 'IDLE' | 'LISTENING' | 'UNSUPPORTED' | 'ERROR';

type ResultListener = (r: RecognitionResult) => void;
type StateListener = (s: RecognitionState, detail?: string) => void;

function getRecognitionCtor(): any {
  if (typeof window === 'undefined') return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

class VoiceRecognition {
  private recognition: any = null;
  private state: RecognitionState = 'IDLE';
  private onResultFns = new Set<ResultListener>();
  private onStateFns = new Set<StateListener>();

  isSupported(): boolean {
    return getRecognitionCtor() !== null;
  }

  getState(): RecognitionState {
    return this.isSupported() ? this.state : 'UNSUPPORTED';
  }

  onResult(fn: ResultListener): () => void {
    this.onResultFns.add(fn);
    return () => this.onResultFns.delete(fn);
  }

  onState(fn: StateListener): () => void {
    this.onStateFns.add(fn);
    return () => this.onStateFns.delete(fn);
  }

  private setState(s: RecognitionState, detail?: string): void {
    this.state = s;
    this.onStateFns.forEach((fn) => fn(s, detail));
  }

  /** Inicia UMA sessão push-to-talk. Deve ser chamada de um gesto do usuário. */
  start(): void {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      this.setState('UNSUPPORTED');
      return;
    }
    if (this.recognition) this.stop();
    try {
      const rec = new Ctor();
      rec.lang = 'pt-BR';
      rec.continuous = false; // sessão curta: falar um comando e soltar
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      rec.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          const transcript = String(res[0]?.transcript ?? '').trim();
          if (transcript) {
            this.onResultFns.forEach((fn) => fn({ transcript, isFinal: !!res.isFinal }));
          }
        }
      };
      rec.onerror = (event: any) => {
        // "no-speech"/"aborted" são fins normais de sessão PTT, não falhas.
        const code = String(event?.error ?? 'erro');
        if (code === 'no-speech' || code === 'aborted') {
          this.setState('IDLE');
        } else {
          this.setState('ERROR', code);
        }
        this.recognition = null;
      };
      rec.onend = () => {
        if (this.state === 'LISTENING') this.setState('IDLE');
        this.recognition = null;
      };
      this.recognition = rec;
      rec.start();
      this.setState('LISTENING');
    } catch (err: any) {
      this.setState('ERROR', String(err?.message || err));
      this.recognition = null;
    }
  }

  /** Encerra a sessão corrente (soltar o botão PTT). */
  stop(): void {
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // já encerrada — sem consequência
      }
      this.recognition = null;
    }
    if (this.state === 'LISTENING') this.setState('IDLE');
  }
}

export const voiceRecognition = new VoiceRecognition();
