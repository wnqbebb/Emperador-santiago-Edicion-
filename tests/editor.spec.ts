import { test, expect } from "@playwright/test";
import { loadClipAndEdit, seek } from "./helpers";

test("la marca Emperador Santiago y los Estilos de Santi aparecen", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".brand")).toContainText("Emperador Santiago");
  await expect(page.locator(".brand")).toContainText("Edición de Videos");
  await page.getByRole("button", { name: "Estilos de Santi" }).click();
  await expect(page.locator(".style-card")).toHaveCount(13, { timeout: 10_000 }); // 5 de Santi + 8 de VES
  await expect(page.locator(".styles")).toContainText("VES · Arthur Brooks");
  await expect(page.locator(".style-card.active")).toContainText("Imperial Santi");
});

test("edición automática: corta, subtitula y pone gráficos", async ({ page }) => {
  await loadClipAndEdit(page);
  await expect(page.locator(".clip.video")).toHaveCount(2); // el silencio del medio se cortó
  await expect(page.locator(".clip.text").first()).toBeVisible();
  await expect(page.locator(".clip.motion").first()).toBeVisible();
  await expect(page.locator(".transcript .cut")).toHaveCount(0); // ninguna palabra se perdió

  // El canvas tiene subtítulos dibujados (no está vacío)
  await seek(page, 1.0);
  const lit = await page.evaluate(() => {
    const c = document.querySelector("canvas")!;
    const d = c.getContext("2d")!.getImageData(0, c.height * 0.6, c.width, c.height * 0.15).data;
    let white = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] > 240 && d[i + 1] > 240 && d[i + 2] > 240) white++;
    return white;
  });
  expect(lit).toBeGreaterThan(200);
});

test("menú de exportación ofrece Navegador, Remotion y HyperFrames", async ({ page }) => {
  await loadClipAndEdit(page);
  await page.getByRole("button", { name: "Exportar" }).click();
  for (const name of ["Navegador", "Remotion", "HyperFrames"]) await expect(page.locator(".menu")).toContainText(name);
});

test("enviar a mi suscripción crea un trabajo MCP", async ({ page, request }) => {
  await loadClipAndEdit(page);
  await page.getByRole("button", { name: /Enviar a mi suscripción/ }).click();
  await expect(page.locator(".job")).toContainText("Esperando plan");
  const jobs = await (await request.get("http://localhost:8787/api/jobs")).json();
  expect(jobs.length).toBeGreaterThan(0);
});
