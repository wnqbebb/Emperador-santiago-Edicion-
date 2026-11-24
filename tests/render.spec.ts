import { test, expect } from "@playwright/test";
import { loadClipAndEdit } from "./helpers";

// Renders completos (lentos). Ejecuta con: RENDER=1 npm test -- render
for (const engine of ["HyperFrames", "Remotion"]) {
  test(`render con ${engine}`, async ({ page }) => {
    test.skip(!process.env.RENDER, "Define RENDER=1 para probar renders completos");
    test.setTimeout(600_000);
    await loadClipAndEdit(page);
    await page.getByRole("button", { name: "Exportar" }).click();
    await page.locator(".menu button", { hasText: engine }).click();
    await expect(page.locator(".status .dl")).toBeVisible({ timeout: 590_000 });
  });
}
