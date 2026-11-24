// Transcripción 100% local en el navegador (Whisper vía transformers.js, WebGPU si existe).
// La primera vez descarga el modelo (~150 MB) y queda en caché: después funciona sin internet.
import { pipeline, env } from "@huggingface/transformers";

env.allowLocalModels = false;
let asr: any = null;

self.onmessage = async (e: MessageEvent<{ audio: Float32Array; language: string; model: string }>) => {
  const { audio, language, model } = e.data;
  try {
    if (!asr) {
      const device = (navigator as any).gpu ? "webgpu" : "wasm";
      asr = await pipeline("automatic-speech-recognition", model, {
        device,
        dtype: device === "webgpu" ? "fp32" : "q8",
        progress_callback: (p: any) => p.status === "progress" && self.postMessage({ type: "progress", value: p.progress, file: p.file }),
      });
    }
    self.postMessage({ type: "status", value: "Transcribiendo…" });
    const out = await asr(audio, { language, task: "transcribe", return_timestamps: "word", chunk_length_s: 30, stride_length_s: 5 });
    const words = (out.chunks ?? [])
      .map((c: any) => ({ w: String(c.text).trim(), t0: c.timestamp[0], t1: c.timestamp[1] ?? c.timestamp[0] + 0.3 }))
      .filter((w: any) => w.w);
    self.postMessage({ type: "done", words });
  } catch (err) {
    self.postMessage({ type: "error", value: (err as Error).message });
  }
};
