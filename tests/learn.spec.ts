import { test, expect } from "@playwright/test";

// rea-video desarma un video de referencia y crea un Estilo de Santi. Lento: REA=1 npm test -- learn
test("aprender un estilo de un video con rea-video", async ({ page }) => {
  test.skip(!process.env.REA, "Define REA=1 (y ten rea-video instalado: npm run setup:rea)");
  test.setTimeout(600_000);
  await page.goto("/");
  await page.getByRole("button", { name: "Estilos de Santi" }).click();
  await page.getByPlaceholder("Nombre del estilo").fill("Prueba Referencia");
  await page.locator(".learn input[type=file]").setInputFiles("tests/fixtures/clip.mp4");
  await expect(page.locator(".learn .hint")).toContainText("aprendido", { timeout: 590_000 });
  await expect(page.locator(".style-card.active")).toContainText("Prueba Referencia");
});
