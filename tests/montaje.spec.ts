import { test, expect } from "@playwright/test";
import { existsSync } from "node:fs";

const DIR = "tests/fixtures/montaje";
const files = ["clip 10.mp4", "clip 2.mp4", "clip 1.mp4"].map((f) => `${DIR}/${f}`); // a propósito desordenados

test("Unir clips: ordena por nombre, permite reordenar y no procesa al subir", async ({ page }) => {
  test.skip(!existsSync(files[0]), "Faltan los clips de prueba");
  await page.goto("/");
  await page.getByRole("button", { name: "Crear video", exact: true }).click();
  await page.locator(".m-drop input[type=file][accept]").setInputFiles(files);
  await expect(page.locator(".m-list li")).toHaveCount(3);
  await expect(page.locator(".m-info b")).toHaveText(["clip 1.mp4", "clip 2.mp4", "clip 10.mp4"]); // 1, 2, 10 (no 1, 10, 2)
  await expect(page.locator(".m-progress")).toHaveCount(0); // nada se procesó todavía
  await page.locator(".m-list li").nth(2).getByTitle("Subir").click();
  await expect(page.locator(".m-info b")).toHaveText(["clip 1.mp4", "clip 10.mp4", "clip 2.mp4"]);
  await page.getByRole("button", { name: "Ordenar por nombre" }).click();
  await expect(page.locator(".m-info b")).toHaveText(["clip 1.mp4", "clip 2.mp4", "clip 10.mp4"]);
});

test("Unir clips: un botón busca silencios, recorta, renderiza y comprime", async ({ page }) => {
  test.skip(!existsSync(files[0]), "Faltan los clips de prueba");
  test.setTimeout(300_000);
  await page.goto("/");
  await page.getByRole("button", { name: "Crear video", exact: true }).click();
  await page.locator(".m-drop input[type=file][accept]").setInputFiles(files);
  await page.getByRole("button", { name: /Crear video completo/ }).click();
  await expect(page.locator(".m-result video")).toBeVisible({ timeout: 280_000 });
  await expect(page.locator(".m-saved")).toHaveCount(3);
  const dur = await page.locator(".m-result video").evaluate((v: HTMLVideoElement) => new Promise<number>((r) => (v.readyState ? r(v.duration) : (v.onloadedmetadata = () => r(v.duration)))));
  expect(dur).toBeGreaterThan(10);
  expect(dur).toBeLessThan(22); // 26 s de clips → bastante menos sin silencios
  await page.screenshot({ path: "qa/unir-clips.png" });
});
