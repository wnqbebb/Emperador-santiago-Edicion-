// Modo "suscripción": usa los CLIs oficiales, que inician sesión con tu plan
// (Claude Pro/Max → `claude`, ChatGPT Plus/Pro → `codex`, Google AI → `gemini`).
// No hace falta clave de API: cada CLI usa su propio login. El prompt va por la entrada estándar
// (los planes por beats incluyen la biblioteca de Arthur y no caben como argumento).
import { spawn } from "node:child_process";

export type CliId = "claude-cli" | "codex-cli" | "gemini-cli";

const ORDER = "Sigue las instrucciones completas que recibes por la entrada estándar y responde solo lo que piden.";
const COMMANDS: Record<CliId, [string, string[]]> = {
  "claude-cli": ["claude", ["-p", ORDER, "--output-format", "text"]],
  "codex-cli": ["codex", ["exec", "--skip-git-repo-check", "-"]],
  "gemini-cli": ["gemini", ["-p", ORDER]],
};

/** opts.mirar: carpeta con imágenes que el modelo puede abrir (solo lectura) para elegir con la vista. */
export function runCli(id: CliId, prompt: string, timeoutMs = 10 * 60_000, opts: { mirar?: string } = {}): Promise<string> {
  const [cmd, base] = COMMANDS[id];
  const args = opts.mirar && id === "claude-cli" ? [...base, "--allowedTools", "Read"] : base;
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["pipe", "pipe", "pipe"], cwd: opts.mirar });
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
    child.stdin.end(prompt);
  });
}

export function cliAvailable(id: CliId): Promise<boolean> {
  const [cmd] = COMMANDS[id];
  return new Promise((resolve) => {
    const c = spawn(cmd, ["--version"], { stdio: "ignore" });
    c.on("error", () => resolve(false));
    c.on("close", (code) => resolve(code === 0));
  });
}
