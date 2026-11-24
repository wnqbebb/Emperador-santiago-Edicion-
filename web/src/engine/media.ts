import type { Word } from "./types";

/** Decodifica el audio del archivo a mono 16 kHz (lo que necesita Whisper). */
export async function decodeAudio16k(file: File): Promise<Float32Array> {
  const buf = await file.arrayBuffer();
  const tmp = new AudioContext();
  const decoded = await tmp.decodeAudioData(buf);
  await tmp.close();
  const off = new OfflineAudioContext(1, Math.ceil(decoded.duration * 16000), 16000);
  const src = off.createBufferSource();
  src.buffer = decoded;
  src.connect(off.destination);
  src.start();
  return (await off.startRendering()).getChannelData(0);
}

export function transcribe(audio: Float32Array, onStatus: (s: string) => void, language = "spanish"): Promise<Word[]> {
  const worker = new Worker(new URL("./transcribe.worker.ts", import.meta.url), { type: "module" });
  return new Promise((resolve, reject) => {
    worker.onmessage = (e) => {
      const m = e.data;
      if (m.type === "progress") onStatus(`Descargando modelo… ${Math.round(m.value)}%`);
      if (m.type === "status") onStatus(m.value);
      if (m.type === "done") { worker.terminate(); resolve(m.words); }
      if (m.type === "error") { worker.terminate(); reject(new Error(m.value)); }
    };
    worker.postMessage({ audio, language, model: "onnx-community/whisper-base" }, [audio.buffer]);
  });
}
