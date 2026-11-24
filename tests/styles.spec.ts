import { test } from "@playwright/test";
import { loadClipAndEdit, seek } from "./helpers";

// Revisión visual: una captura de cada Estilo de Santi en el mismo momento del clip.
test("galería de estilos", async ({ page }) => {
  await loadClipAndEdit(page);
  await page.getByRole("button", { name: "Estilos de Santi" }).click();
  const cards = page.locator(".style-card");
  for (let i = 0; i < (await cards.count()); i++) {
    await cards.nth(i).click();
    await seek(page, 1.2);
    const name = (await cards.nth(i).locator("b").textContent())!.trim();
    await page.locator(".canvas-wrap").screenshot({ path: `qa/estilos/${name}.png` });
  }
});
