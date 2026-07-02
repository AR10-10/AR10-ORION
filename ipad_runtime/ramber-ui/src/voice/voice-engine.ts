// voice-engine.ts — IRON-VOICE camada 1: Text-to-Speech institucional.
//
// Tecnologia REAL: window.speechSynthesis (Web Speech API), suportada pelo
// Safari/iPadOS com vozes do sistema (inclusive pt-BR) — zero rede, zero
// download, funciona offline. Nenhuma síntese é simulada: se a API não
// existir, todo o módulo falha fechado (isSupported() === false) e a UI
// mostra isso honestamente em vez de fingir que falou.
//
// Arquitetura (exigência do protocolo): nunca bloquear a UI. speechSynthesis
// já é assíncrono por natureza; este módulo adiciona uma fila com prioridade
// para que alertas nunca se atropelem — um alerta CRITICAL fura a fila e
// cancela a fala corrente; INFO espera a vez. Nenhum setInterval de polling:
// o avanço da fila é dirigido pelos eventos onend/onerror de cada utterance.

export type VoicePriority = 'CRITICAL' | 'ALERT' | 'INFO';

export interface VoiceStatus {
  supported: boolean;
  enabled: boolean;
  muted: boolean;
  speaking: boolean;
  queueLength: number;
  voiceName: string | null;
}

interface QueueItem {
  text: string;
  priority: VoicePriority;
}

type StatusListener = (status: VoiceStatus) => void;

const PRIORITY_RANK: Record<VoicePriority, number> = {
  CRITICAL: 0,
  ALERT: 1,
  INFO: 2,
};

// Uma única instância por página — a fila de voz é um recurso global real
// (só existe um alto-falante), então o singleton reflete o hardware.
class VoiceEngine {
  private queue: QueueItem[] = [];
  private speaking = false;
  private enabled = false;
  private muted = false;
  private volume = 1.0;
  private rate = 1.0;
  private preferredVoice: SpeechSynthesisVoice | null = null;
  private listeners = new Set<StatusListener>();

  isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  // Vozes chegam de forma assíncrona no Safari/Chrome (voiceschanged).
  // Preferência: voz pt-BR do sistema; senão pt-*; senão a default.
  private pickVoice(): void {
    if (!this.isSupported()) return;
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return;
    this.preferredVoice =
      voices.find((v) => v.lang === 'pt-BR') ||
      voices.find((v) => v.lang.startsWith('pt')) ||
      voices.find((v) => v.default) ||
      voices[0];
  }

  init(): void {
    if (!this.isSupported()) return;
    this.pickVoice();
    window.speechSynthesis.addEventListener?.('voiceschanged', () => {
      this.pickVoice();
      this.notify();
    });
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!on) this.stopAll();
    this.notify();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) this.stopAll();
    this.notify();
  }

  setVolume(v: number): void {
    this.volume = Math.min(1, Math.max(0, v));
    this.notify();
  }

  getStatus(): VoiceStatus {
    return {
      supported: this.isSupported(),
      enabled: this.enabled,
      muted: this.muted,
      speaking: this.speaking,
      queueLength: this.queue.length,
      voiceName: this.preferredVoice?.name ?? null,
    };
  }

  onStatus(fn: StatusListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify(): void {
    const s = this.getStatus();
    this.listeners.forEach((fn) => fn(s));
  }

  /** Enfileira uma fala. CRITICAL cancela a fala corrente e fura a fila. */
  speak(text: string, priority: VoicePriority = 'INFO'): void {
    if (!this.isSupported() || !this.enabled || this.muted || !text.trim()) return;
    if (priority === 'CRITICAL') {
      // Um evento crítico real não espera: derruba fala corrente e fila INFO.
      this.queue = this.queue.filter((q) => q.priority === 'CRITICAL');
      window.speechSynthesis.cancel();
      this.speaking = false;
    }
    this.queue.push({ text, priority });
    this.queue.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
    this.drain();
    this.notify();
  }

  stopAll(): void {
    this.queue = [];
    if (this.isSupported()) window.speechSynthesis.cancel();
    this.speaking = false;
    this.notify();
  }

  private drain(): void {
    if (this.speaking || !this.queue.length) return;
    const item = this.queue.shift()!;
    const utter = new SpeechSynthesisUtterance(item.text);
    if (this.preferredVoice) utter.voice = this.preferredVoice;
    utter.volume = this.volume;
    utter.rate = this.rate;
    utter.pitch = 0.9; // tom levemente grave — personalidade institucional
    this.speaking = true;
    this.notify();
    const done = () => {
      this.speaking = false;
      this.notify();
      this.drain();
    };
    utter.onend = done;
    utter.onerror = done; // fala falhou -> segue a fila; nunca trava
    window.speechSynthesis.speak(utter);
  }
}

export const voiceEngine = new VoiceEngine();
