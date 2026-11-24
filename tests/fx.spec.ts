import { test, expect } from "@playwright/test";
import { loadClipAndEdit, seek } from "./helpers";

const goldPixels = (page: import("@playwright/test").Page, y0: number, y1: number) =>
  page.evaluate(([a, b]) => {
    const c = document.querySelector("canvas")!;
    const d = c.getContext("2d")!.getImageData(0, c.height * a, c.width, c.height * (b - a)).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] > 170 && d[i + 1] > 110 && d[i + 1] < 210 && d[i + 2] < 90) n++;
    return n;
  }, [y0, y1]);

test("la edición imperial abre con la corona 3D (three.js) y pone efectos pixelfx", async ({ page }) => {
  await loadClipAndEdit(page);
  await expect(page.locator(".clip.motion.intro3d")).toHaveCount(1);
  await expect(page.locator(".clip.motion.pixelfx").first()).toBeVisible();
  await page.evaluate(() => { const v = document.querySelector("video")!; v.style.display = "none"; });
  // la corona dorada aparece en la zona central del cuadro
  await seek(page, 1.4);
  expect(await goldPixels(page, 0.25, 0.6)).toBeGreaterThan(500);
});

test("los botones de efectos insertan pixelfx en el momento actual", async ({ page }) => {
  await loadClipAndEdit(page);
  await seek(page, 7.5);
  await page.getByRole("button", { name: "Motion" }).click();
  const before = await page.locator(".motion-list li").count();
  await page.getByRole("button", { name: /Monedas/ }).click();
  await expect(page.locator(".motion-list li")).toHaveCount(before + 1);
  await expect(page.locator(".motion-list")).toContainText("coin-collect");
});

test("la biblioteca de ideas de motion graphics responde", async ({ page }) => {
  await loadClipAndEdit(page);
  await page.getByRole("button", { name: "Motion" }).click();
  await page.getByPlaceholder(/Buscar ideas/).fill("text");
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(page.locator(".ideas li").first()).toBeVisible();
  await page.locator(".ideas li").first().click();
  await expect(page.locator("textarea").last()).not.toHaveValue("");
});

test("HyperFrames renderiza un motion graphic (HTML de prueba) y se inserta como b-roll", async ({ page, request }) => {
  test.skip(!process.env.RENDER, "Define RENDER=1 para renders completos");
  test.setTimeout(300_000);
  const html = `<!doctype html><html><head><script src="assets/gsap.min.js"></script></head><body style="margin:0;background:#0b0b0f">
<div id="root" data-composition-id="main" data-start="0" data-duration="3" data-width="1080" data-height="1920">
  <h1 id="t" class="clip" data-start="0" data-duration="3" style="position:absolute;top:800px;width:100%;text-align:center;color:#E9B949;font:900 120px Oswald">IMPERIO</h1>
</div>
<script>const tl = gsap.timeline({ paused: true }); tl.fromTo("#t", { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.6 }, 0.1); window.__timelines["main"] = tl;</script></body></html>`;
  const job = await (await request.post("http://localhost:8787/api/motion", { data: { html, seconds: 3 }, timeout: 280_000 })).json();
  expect(job.status).toBe("done");
  const head = await request.get(job.url);
  expect(head.ok()).toBeTruthy();
});
