// VoiceControlWidget.tsx — IRON-VOICE camada 5: controles discretos (Glass).
//
// Único ponto de contato entre a Voice Layer e a árvore React. Recebe o
// snapshot real por prop (zero import do App — arquitetura desacoplada
// exigida pelo protocolo) e conversa apenas com os módulos puros da camada
// de voz. Todos os estados possíveis são mostrados honestamente:
// TTS/STT indisponíveis viram etiquetas INDISPONÍVEL, nunca botões que
// fingem funcionar.
import { useEffect, useRef, useState } from "react";
import { Mic, Volume2, VolumeX, Power } from "lucide-react";
import { voiceEngine, type VoiceStatus } from "./voice-engine";
import { voiceRecognition, type RecognitionState } from "./voice-recognition";
import { matchIntent, buildResponse, type TerminalSnapshot } from "./voice-intents";

export function VoiceControlWidget({
  snapshot,
  onRefresh,
}: {
  snapshot: TerminalSnapshot;
  onRefresh: () => void;
}) {
  const [status, setStatus] = useState<VoiceStatus>(() => voiceEngine.getStatus());
  const [recState, setRecState] = useState<RecognitionState>(() => voiceRecognition.getState());
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState("");

  // O snapshot muda a cada tick real; o handler de resultado precisa sempre
  // do mais recente sem re-registrar listeners a cada render.
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    const offStatus = voiceEngine.onStatus(setStatus);
    const offState = voiceRecognition.onState((s) => setRecState(s));
    const offResult = voiceRecognition.onResult((r) => {
      setTranscript(r.transcript);
      if (!r.isFinal) return;
      const intent = matchIntent(r.transcript);
      const text = buildResponse(intent, snapshotRef.current);
      setResponse(text);
      if (intent === "REFRESH") onRefreshRef.current();
      voiceEngine.speak(text, "INFO");
    });
    return () => {
      offStatus();
      offState();
      offResult();
    };
  }, []);

  const ttsSupported = status.supported;
  const sttSupported = voiceRecognition.isSupported();
  const listening = recState === "LISTENING";

  // Ligar a voz É o gesto de usuário que o iOS exige para liberar áudio —
  // a confirmação falada serve de teste audível real, não decoração.
  const handleToggleVoice = () => {
    const next = !status.enabled;
    voiceEngine.setEnabled(next);
    if (next) voiceEngine.speak("Voz operacional. Modo somente leitura.", "INFO");
  };

  return (
    <div className="flex flex-col gap-2 text-[0.55rem] p-1">
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!ttsSupported}
          onClick={handleToggleVoice}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border font-black tracking-[0.15em] uppercase transition-colors ${
            !ttsSupported
              ? "border-[#8ab4f8]/15 text-[#8ab4f8]/30 cursor-not-allowed"
              : status.enabled
                ? "border-[#00ffaa60] bg-[#00ffaa15] text-[#00ffaa]"
                : "border-[#8ab4f8]/30 text-[#8ab4f8] active:bg-[#00f0ff10]"
          }`}
        >
          <Power size={12} /> VOZ {status.enabled ? "ATIVA" : "DESLIGADA"}
        </button>
        <button
          type="button"
          disabled={!ttsSupported || !status.enabled}
          onClick={() => voiceEngine.setMuted(!status.muted)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border font-black tracking-[0.15em] uppercase transition-colors ${
            !ttsSupported || !status.enabled
              ? "border-[#8ab4f8]/15 text-[#8ab4f8]/30 cursor-not-allowed"
              : status.muted
                ? "border-[#ff005560] bg-[#ff005515] text-[#ff0055]"
                : "border-[#8ab4f8]/30 text-[#8ab4f8]"
          }`}
        >
          {status.muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
          {status.muted ? "MUDO" : "SOM"}
        </button>
        <input
          type="range"
          min={0}
          max={100}
          defaultValue={100}
          disabled={!ttsSupported || !status.enabled}
          onChange={(e) => voiceEngine.setVolume(Number(e.target.value) / 100)}
          className="flex-1 accent-[#00f0ff] min-w-0"
          aria-label="Volume da voz"
        />
      </div>

      <button
        type="button"
        disabled={!sttSupported || !status.enabled}
        onPointerDown={() => voiceRecognition.start()}
        onPointerUp={() => voiceRecognition.stop()}
        onPointerLeave={() => listening && voiceRecognition.stop()}
        className={`flex items-center justify-center gap-2 py-3 rounded-lg border font-black tracking-[0.2em] uppercase transition-colors select-none touch-none ${
          !sttSupported || !status.enabled
            ? "border-[#8ab4f8]/15 text-[#8ab4f8]/30 cursor-not-allowed"
            : listening
              ? "border-[#00f0ff] bg-[#00f0ff20] text-[#00f0ff] shadow-[0_0_20px_rgba(0,240,255,0.3)]"
              : "border-[#00f0ff40] text-[#a0f0ff] active:bg-[#00f0ff10]"
        }`}
      >
        <Mic size={14} className={listening ? "animate-pulse" : ""} />
        {listening ? "OUVINDO… SOLTE PARA ENVIAR" : "SEGURAR PARA FALAR"}
      </button>

      <div className="flex items-center justify-between text-[0.45rem] tracking-[0.15em] uppercase text-[#8ab4f8]/70 font-bold">
        <span>
          TTS {ttsSupported ? (status.speaking ? "FALANDO" : "PRONTO") : "INDISPONÍVEL"}
          {status.queueLength > 0 ? ` · FILA ${status.queueLength}` : ""}
        </span>
        <span>DITADO {sttSupported ? (recState === "ERROR" ? "ERRO" : recState === "LISTENING" ? "ATIVO" : "PRONTO") : "INDISPONÍVEL"}</span>
      </div>

      {(transcript || response) && (
        <div className="flex flex-col gap-1 bg-[#010308] border border-[#00f0ff15] rounded p-2 leading-relaxed">
          {transcript && (
            <span className="text-[#8ab4f8]">
              <strong className="text-[#00f0ff]">VOCÊ:</strong> {transcript}
            </span>
          )}
          {response && (
            <span className="text-[#a0f0ff]">
              <strong className="text-[#00ffaa]">S.E.:</strong> {response}
            </span>
          )}
        </div>
      )}

      <span className="text-[0.4rem] tracking-[0.15em] text-[#8ab4f8]/40 uppercase font-bold text-center">
        Comandos: tendência · confiança · risco · absorção · consenso · preço · diagnóstico · atualizar
      </span>
    </div>
  );
}
