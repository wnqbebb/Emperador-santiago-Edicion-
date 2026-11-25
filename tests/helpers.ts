import { expect, type Page } from "@playwright/test";

/** Transcripción de ejemplo con tiempos (para no depender de descargar Whisper en las pruebas). */
export function sampleWords() {
  const text = "Así se construye un imperio. Gané 10000 dólares en 30 días con esta idea brutal y te voy a contar el secreto.";
  let t = 0.3;
  return text.split(" ").map((w, i) => {
    const t0 = t + (i === 5 ? 1.0 : 0), t1 = t0 + 0.34;
    t = t1 + 0.05;
    return { w, t0, t1 };
  });
}

export async function loadClipAndEdit(page: Page) {
  await page.goto("/");
  await expect(page.getByText("Emperador Santiago").first()).toBeVisible();
  await page.setInputFiles(".panel .drop input[type=file]", "tests/fixtures/clip.mp4");
  await page.waitForFunction(() => (document.querySelector("video") as HTMLVideoElement)?.readyState >= 1);
  await page.evaluate((w) => { (window as any).__santi.setDuration(12); (window as any).__santi.setWords(w); }, sampleWords());
  await page.getByRole("button", { name: "Director IA" }).click();
  await page.getByRole("button", { name: /Edición automática/ }).click();
  await expect(page.locator(".summary")).toContainText("segmentos");
}

export async function seek(page: Page, t: number) {
  await page.evaluate((t) => { (document.querySelector("video") as HTMLVideoElement).currentTime = t; }, t);
  await page.waitForTimeout(400);
}
