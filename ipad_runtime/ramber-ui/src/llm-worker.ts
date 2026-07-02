// llm-worker.ts — dedicated Web Worker hosting the local Llama 3 engine
// (@mlc-ai/web-llm). Weight download + WebGPU compute all happen in this
// worker thread, never the main thread — a multi-gigabyte model load
// must not be able to freeze the glassmorphism UI even for a moment.
// This file only wires WebLLM's own documented worker handler; it is not
// a reimplementation of anything WebLLM does internally.
import { WebWorkerMLCEngineHandler } from '@mlc-ai/web-llm';

const handler = new WebWorkerMLCEngineHandler();
self.onmessage = (msg: MessageEvent) => {
  handler.onmessage(msg);
};
