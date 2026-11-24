// Exportación en el navegador: graba el canvas + el audio mientras reproduce la edición.
export function pickMime() {
  const c = ["video/mp4;codecs=avc1,mp4a.40.2", "video/webm;codecs=vp9,opus", "video/webm"];
  return c.find((m) => MediaRecorder.isTypeSupported(m)) ?? "video/webm";
}

export function startRecording(canvas: HTMLCanvasElement, audio: MediaStream) {
  const stream = new MediaStream([...canvas.captureStream(30).getVideoTracks(), ...audio.getAudioTracks()]);
  const mime = pickMime();
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12_000_000 });
  const parts: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && parts.push(e.data);
  rec.start(250);
  return {
    stop: () =>
      new Promise<Blob>((resolve) => {
        rec.onstop = () => resolve(new Blob(parts, { type: mime.split(";")[0] }));
        rec.stop();
      }),
  };
}
