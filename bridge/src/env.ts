// Carga el .env de la raíz del proyecto (claves de API, SANTI_HOST, SANTI_WEB_ORIGIN…) antes que todo lo demás.
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const f = join(dirname(fileURLToPath(import.meta.url)), "..", "..", ".env");
if (existsSync(f)) process.loadEnvFile(f);
