import { test, expect } from "@playwright/test";
import { existsSync } from "node:fs";

// Flujo completo: clip en bruto → unir y cortar silencios → plantilla Arthur Brooks → IA planifica → borrador.
// Necesita una IA conectada (por defecto la suscripción de Claude vía Claude Code). Lento: FLUJO=1 npm test -- plantillas
test("Crear video con la plantilla Arthur Brooks", async ({ page }) => {
  test.skip(!process.env.FLUJO || !existsSync("tests/fixtures/voz.mp4"), "Define FLUJO=1 (usa tu IA) y pon un clip con voz en tests/fixtures/voz.mp4");
  test.setTimeout(1_200_000);
  await page.goto("/");
  await page.getByRole("button", { name: "Crear video", exact: true }).click();
  await page.locator(".m-drop input[type=file][accept]").setInputFiles("tests/fixtures/voz.mp4");
  await page.getByRole("button", { name: /Crear video completo/ }).click();
  await expect(page.locator(".p-card").first()).toBeVisible({ timeout: 300_000 });
  await expect(page.locator(".p-card.on")).toContainText("Arthur Brooks · Talking head");
  await page.getByRole("button", { name: "Editar con esta plantilla" }).click();
  await expect(page.locator(".p-review video")).toBeVisible({ timeout: 1_100_000 });
  await expect(page.locator(".p-beats li").first()).toBeVisible();
  await page.screenshot({ path: "qa/plantilla-arthur.png", fullPage: true });
});

test("las plantillas aparecen después de unir los clips", async ({ request }) => {
  const list = await (await request.get("http://localhost:8787/api/plantillas", { headers: { origin: "http://localhost:5173" } })).json();
  expect(list.map((p: { id: string }) => p.id)).toEqual(expect.arrayContaining(["arthur-talking", "arthur-documental", "arthur-podcast", "imperial"]));
});
