// Modo "suscripción": usa los CLIs oficiales, que inician sesión con tu plan
// (Claude Pro/Max → `claude`, ChatGPT Plus/Pro → `codex`, Google AI → `gemini`).
// No hace falta clave de API: cada CLI usa su propio login.
import { spawn } from "node:child_process";

export type CliId = "claude-cli" | "codex-cli" | "gemini-cli";

const COMMANDS: Record<CliId, (prompt: string) => [string, string[]]> = {
  "claude-cli": (p) => ["claude", ["-p", p, "--output-format", "text"]],
  "codex-cli": (p) => ["codex", ["exec", "--skip-git-repo-check", p]],
  "gemini-cli": (p) => ["gemini", ["-p", p]],
};

export function runCli(id: CliId, prompt: string, timeoutMs = 10 * 60_000): Promise<string> {
  const [cmd, args] = COMMANDS[id](prompt);
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    const timer = setTimeout(() => child.kill("SIGTERM"), timeoutMs);
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => reject(new Error(`${cmd} no está instalado: ${e.message}`)));
    child.on("close", (code) => {
      clearTimeout(timer);
      code === 0 ? resolve(out) : reject(new Error(`${cmd} terminó con código ${code}: ${err.slice(-500)}`));
    });
  });
}

export function cliAvailable(id: CliId): Promise<boolean> {
  const [cmd] = COMMANDS[id]("");
  return new Promise((resolve) => {
    const c = spawn(cmd, ["--version"], { stdio: "ignore" });
    c.on("error", () => resolve(false));
    c.on("close", (code) => resolve(code === 0));
  });
}
