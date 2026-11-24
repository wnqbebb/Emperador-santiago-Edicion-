import { defineConfig } from "@playwright/test";

// Pruebas del editor en un navegador real. `npm test` levanta la web y el bridge solo.
export default defineConfig({
  testDir: "tests",
  timeout: 60_000,
  globalSetup: "./tests/global-setup.ts",
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: { baseURL: "http://localhost:5173", viewport: { width: 1440, height: 900 }, trace: "off" },
  webServer: [
    { command: "npm run dev -w web -- --port 5173 --strictPort", url: "http://localhost:5173", reuseExistingServer: true },
    { command: "npm run dev -w bridge", url: "http://localhost:8787/api/health", reuseExistingServer: true, env: { SANTI_DATA: "test-results/data" } },
  ],
});
