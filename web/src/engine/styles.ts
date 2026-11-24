// Estilos incluidos en el build: funcionan offline aunque el bridge no esté corriendo.
import type { Style } from "./types";
const mods = import.meta.glob("../../../styles/*.json", { eager: true, import: "default" });
export const BUILTIN_STYLES = Object.values(mods) as Style[];
