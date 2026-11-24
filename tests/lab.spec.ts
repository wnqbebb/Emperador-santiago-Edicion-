import { test, expect } from "@playwright/test";
import { existsSync } from "node:fs";

const API = "http://localhost:8787";
const WEB = { origin: "http://localhost:5173" };

test("el Laboratorio muestra VES y sus estilos", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Laboratorio" }).click();
  await expect(page.getByText("Editar con método VES")).toBeVisible();
  await expect(page.locator(".lab select option")).not.toHaveCount(0);
  await expect(page.locator(".lab select")).toContainText("Arthur Brooks");
  await expect(page.getByText("Crear un estilo nuevo")).toBeVisible();
});

test("los estilos VES aparecen en los Estilos de Santi", async ({ request }) => {
  const styles = await (await request.get(`${API}/api/styles`, { headers: WEB })).json();
  expect(styles.some((s: { id: string }) => s.id.startsWith("ves-arthur"))).toBeTruthy();
});

test("STOP 3: nadie aprueba ni renderiza en final sin la frase de Santiago", async ({ request }) => {
  // por la ruta normal está bloqueado
  const a = await request.post(`${API}/api/ves/run`, { headers: WEB, data: { script: "ves", args: ["approve", "x"] } });
  expect((await a.json()).error).toContain("no permitido");
  const r = await request.post(`${API}/api/ves/run`, { headers: WEB, data: { script: "ves", args: ["render", "x"] } });
  expect((await r.json()).error).toBeTruthy();
  // sin la frase exacta no pasa
  const h = await request.post(`${API}/api/ves/human`, { headers: WEB, data: { project: "x", action: "approve", confirm: "ok" } });
  expect((await h.json()).error).toContain("APROBAR x");
  // otras páginas web no pueden llamar al bridge
  const evil = await request.post(`${API}/api/ves/run`, { headers: { origin: "https://otra-pagina.example" }, data: {} });
  expect(evil.status()).toBe(403);
});

test("flujo VES: proyecto, transcripción y plan.html (clip con voz)", async ({ request }) => {
  test.skip(!process.env.VES || !existsSync("tests/fixtures/voz.mp4"), "Define VES=1 y pon un clip con voz en tests/fixtures/voz.mp4");
  test.setTimeout(900_000);
  const fs = await import("node:fs");
  const up = await (await request.post(`${API}/api/media?name=voz.mp4`, { headers: WEB, data: fs.readFileSync("tests/fixtures/voz.mp4") })).json();
  const wait = async (job: { id: string }) => {
    for (;;) {
      const j = await (await request.get(`${API}/api/ves/run/${job.id}`, { headers: WEB })).json();
      if (j.status !== "running") return j;
      await new Promise((r) => setTimeout(r, 2000));
    }
  };
  const run = async (args: string[]) => wait(await (await request.post(`${API}/api/ves/run`, { headers: WEB, data: { script: "ves", args } })).json());
  const p = "test-voz";
  expect((await wait(await (await request.post(`${API}/api/ves/project`, { headers: WEB, data: { name: p, mediaId: up.mediaId, style: "arthur-talking-minimal" } })).json())).status).toBe("done");
  expect((await run(["all", p, "--lang", "es"])).status).toBe("done");
  const status = await (await request.get(`${API}/api/ves/project/${p}`, { headers: WEB })).json();
  expect(status.transcript).toBeTruthy();
  expect(status.files.join(" ")).toContain("plan.html");
});
