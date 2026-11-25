import { test, expect } from "@playwright/test";
import { existsSync } from "node:fs";

const API = "http://localhost:8787";
const WEB = { origin: "http://localhost:5173" };

test("las plantillas son familias con variantes (Arthur Brooks tiene 5)", async ({ request }) => {
  const fams = await (await request.get(`${API}/api/familias`, { headers: WEB })).json();
  const arthur = fams.find((f: { id: string }) => f.id === "arthur");
  expect(arthur.variantes).toHaveLength(5);
  const kal = fams.find((f: { id: string }) => f.id === "kallaway");
  expect(kal.skill).toBe("kallaway-editing");
  expect(kal.variantes.map((v: { vesStyle: string }) => v.vesStyle)).toEqual(["kallaway", "kallaway", "kallaway"]);
  expect(kal.paletaEstilo.vibrant_dark).toBe("#8B1A1E");
  const sky = fams.find((f: { id: string }) => f.id === "skylight");
  expect(sky.motor).toBe("skylight");
  expect(sky.variantes).toHaveLength(3);
  for (const [id, skill] of [["nick", "nick-saraev-editing"], ["lobo", "lobo-de-wall-street-editing"]]) {
    const f = fams.find((x: { id: string }) => x.id === id);
    expect(f.skill).toBe(skill);
    expect(f.paletaPorDefecto).toBe("estilo");
  }
  const reels = fams.find((f: { id: string }) => f.id === "reels");
  expect(reels.motor).toBe("reels");
  expect(reels.variantes.map((v: { id: string }) => v.id)).toEqual(["reel-cara", "reel-split", "reel-cine"]);
  expect(fams.map((f: { id: string }) => f.id)).toContain("imperial");
});

test("después de unir, la app pregunta: estilo, color del propio video, energía, texturas, creatividad y b-roll", async ({ page }) => {
  test.skip(!existsSync("tests/fixtures/voz.mp4"), "Falta el clip de prueba con voz");
  test.setTimeout(240_000);
  await page.goto("/");
  await page.getByRole("button", { name: "Crear video", exact: true }).click();
  await page.locator(".c-source input[type=file]").setInputFiles("tests/fixtures/voz.mp4");   // clip directo, sin pasar por Unir clips
  await expect(page.locator(".pal-list button").first()).toBeVisible({ timeout: 200_000 });
  await expect(page.locator(".p-card")).toHaveCount(5);
  await expect(page.locator(".pal-list button.on")).toContainText("recomendado");
  for (const q of ["Energía", "Texturas", "Creatividad", "b-roll", "Indicaciones"]) await expect(page.locator(".q h4", { hasText: q })).toBeVisible();
});

// Flujo completo con IA (lento): FLUJO=1 npm test -- plantillas
test("Crear video con Arthur Brooks: tablero de preedición y borrador", async ({ page }) => {
  test.skip(!process.env.FLUJO || !existsSync("tests/fixtures/voz.mp4"), "Define FLUJO=1 (usa tu IA)");
  test.setTimeout(1_800_000);
  await page.goto("/");
  await page.getByRole("button", { name: "Crear video", exact: true }).click();
  await page.locator(".c-source input[type=file]").setInputFiles("tests/fixtures/voz.mp4");   // clip directo, sin pasar por Unir clips
  await expect(page.locator(".pal-list button").first()).toBeVisible({ timeout: 200_000 });
  await page.getByRole("button", { name: /Empezar edición/ }).click();
  await expect(page.locator(".board .beat").first()).toBeVisible({ timeout: 900_000 });
  await page.getByRole("button", { name: /Construir el borrador/ }).click();
  await expect(page.locator(".p-review video")).toBeVisible({ timeout: 1_500_000 });
});
