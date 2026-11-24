// Pestaña Laboratorio: VES (crear-estilo-edicion) dentro de Emperador Santiago.
// A) Editar un clip con un estilo VES siguiendo sus 3 STOPs. B) Crear un estilo nuevo con el laboratorio de 9 fases.
import { useEffect, useState } from "react";
import * as bridge from "../engine/bridge";
import { Icon } from "./Icon";

const slug = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "");

export function Lab({ mediaId, fileName }: { mediaId: string | null; fileName?: string }) {
  const [ves, setVes] = useState<bridge.VesOverview | null>(null);
  const [style, setStyle] = useState("arthur-talking-minimal");
  const [project, setProject] = useState("");
  const [status, setStatus] = useState<bridge.VesProject | null>(null);
  const [job, setJob] = useState<bridge.VesJob | null>(null);
  const [busy, setBusy] = useState(false);
  const [estilo, setEstilo] = useState("");
  const [creador, setCreador] = useState("");
  const [refs, setRefs] = useState("");

  const refresh = () => bridge.vesOverview().then(setVes).catch(() => setVes(null));
  useEffect(() => { refresh(); }, []);
  useEffect(() => { if (fileName && !project) setProject(slug(fileName.replace(/\.[^.]+$/, ""))); }, [fileName]);
  useEffect(() => { if (project) bridge.vesProject(project).then(setStatus).catch(() => setStatus(null)); }, [project, job?.status]);

  async function run(steps: { script: string; args: string[]; estilo?: string }[]) {
    setBusy(true);
    try {
      for (const s of steps) {
        let j = await bridge.vesRun(s);
        setJob(j);
        while (j.status === "running") { await new Promise((r) => setTimeout(r, 1000)); j = await bridge.vesJob(j.id); setJob(j); }
        if (j.status === "error") break;
      }
    } catch (e) { setJob({ id: "", cmd: "", status: "error", log: [(e as Error).message] }); }
    setBusy(false);
    refresh();
  }

  async function prepare() {
    if (!mediaId) return;
    setBusy(true);
    let j = await bridge.vesNewProject({ name: project, mediaId, style });
    setJob(j);
    while (j.status === "running") { await new Promise((r) => setTimeout(r, 1000)); j = await bridge.vesJob(j.id); setJob(j); }
    setBusy(false);
    if (j.status === "done") run([{ script: "ves", args: ["all", project, "--lang", "es"] }]);
  }

  // STOP 3: Santiago escribe la frase de confirmación
  async function human(action: "approve" | "render" | "sound") {
    const phrase = (await bridge.vesConfirmPhrase(action, project)).phrase;
    const typed = window.prompt(`Esto es el STOP 3: solo tú lo decides.\nRevisa storyboard + hoja de captions + paleta.\n\nPara confirmar escribe:\n${phrase}`);
    if (!typed) return;
    setBusy(true);
    try {
      let j = await bridge.vesHuman({ project, action, confirm: typed });
      setJob(j);
      while (j.status === "running") { await new Promise((r) => setTimeout(r, 1500)); j = await bridge.vesJob(j.id); setJob(j); }
    } catch (e) { setJob({ id: "", cmd: "", status: "error", log: [(e as Error).message] }); }
    setBusy(false);
    refresh();
  }

  const copy = (t: string) => navigator.clipboard?.writeText(t);
  if (!ves) return <p className="hint">Enciende el bridge (<code>npm run dev</code>) para usar el Laboratorio.</p>;
  if (!ves.installed) return <p className="hint">Falta instalar VES: <code>npm run setup:ves</code></p>;
  const files = status?.files ?? [];
  const link = (f: string) => bridge.vesFileUrl(f);

  return (
    <div className="lab">
      <h3>Editar con método VES</h3>
      <p className="hint">Edición profesional en 3 pausas: plan por beats → assets → vista previa. Nada se renderiza en final sin tu OK.</p>
      <select value={style} onChange={(e) => setStyle(e.target.value)}>
        {ves.styles.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <input placeholder="Nombre del proyecto" value={project} onChange={(e) => setProject(slug(e.target.value))} list="ves-projects" />
      <datalist id="ves-projects">{ves.projects.map((p) => <option key={p.name} value={p.name} />)}</datalist>

      <ol className="steps">
        <li className={status?.transcript ? "ok" : ""}>
          <button className="btn wide" disabled={busy || !mediaId || !project} onClick={prepare}><Icon name="bolt" /> Preparar (transcribe, corta, paleta, captions)</button>
          {!mediaId && <small>Sube el clip en Medios (con el bridge encendido).</small>}
        </li>
        <li className={status?.plan || status?.beats ? "ok" : ""}>
          <b>⏸ STOP 1 · Plan por beats</b>
          <small>Planifica en <code>plan.html</code> o pídele a tu IA que siga el contrato VES y escriba <code>edit_plan.json</code>.</small>
          <button className="btn ghost wide" onClick={() => copy(`Sigue .claude/skills/crear-estilo-edicion/system/AGENTS.md para el proyecto VES "${project}" (estilo ${style}): propón el plan por beats A/B/C y, cuando lo apruebe, escribe edit_plan.json con santi_ves_write.`)}>Copiar instrucción para tu IA</button>
        </li>
        <li>
          <button className="btn wide" disabled={busy || !status?.plan} onClick={() => run([{ script: "ves", args: ["captions", project] }, { script: "ves", args: ["captionsheet", project] }, { script: "ves", args: ["validate", project] }, { script: "ves", args: ["storyboard", project] }])}>⏸ STOP 2 · Validar + storyboard + hoja de captions</button>
        </li>
        <li>
          <button className="btn wide" disabled={busy || !status?.plan} onClick={() => run([{ script: "ves", args: ["render", project, "--draft"] }, { script: "ves", args: ["sound", project, "--draft"] }])}>Borrador para revisar</button>
        </li>
        <li className={status?.approved ? "ok" : ""}>
          <b>⏸ STOP 3 · Tu aprobación</b>
          <div className="row">
            <button className="btn" disabled={busy || !status?.plan} onClick={() => human("approve")}>Aprobar</button>
            <button className="btn primary" disabled={busy || !status?.approved} onClick={() => human("render")}>Render final</button>
            <button className="btn" disabled={busy || !status?.approved} onClick={() => human("sound")}>Sonido final</button>
          </div>
        </li>
      </ol>
      {files.length > 0 && <div className="files">{files.map((f) => <a key={f} href={link(f)} target="_blank" rel="noreferrer">{f.split("/").pop()}</a>)}</div>}

      <h3 className="mt">Crear un estilo nuevo</h3>
      <p className="hint">Con 10–20 videos de un creador: las 9 fases de <code>crear-estilo-edicion</code> (REA, rea-video, Katana, Edit Studio). Las fases de análisis las hace tu IA.</p>
      <input placeholder="id del estilo (ej. santi-imperial)" value={estilo} onChange={(e) => setEstilo(slug(e.target.value))} />
      <input placeholder="Creador (ej. Santiago)" value={creador} onChange={(e) => setCreador(e.target.value)} />
      <input placeholder="Carpeta con los videos de referencia (ruta en tu equipo)" value={refs} onChange={(e) => setRefs(e.target.value)} />
      <div className="phase-grid">
        <button disabled={busy || !estilo || !refs} onClick={() => run([{ script: "lab", args: ["nuevo", estilo, "--refs", refs, ...(creador ? ["--creador", creador] : [])], estilo }])}>1 · Reunir</button>
        <button disabled={busy || !estilo} onClick={() => run([{ script: "lab", args: ["preparar", estilo, "--rea"], estilo }])}>2 · Preparar + rea-video</button>
        <button disabled={busy || !estilo} onClick={() => run([{ script: "lab", args: ["briefs", estilo], estilo }])}>3-4 · Briefs para tu IA</button>
        <button disabled={busy || !estilo} onClick={() => run([{ script: "lab", args: ["sonido", estilo], estilo }, { script: "lab", args: ["energia", estilo], estilo }])}>5 · Sonido y energía</button>
        <button disabled={busy || !estilo} onClick={() => run([{ script: "lab", args: ["biblioteca", estilo], estilo }])}>7 · Biblioteca + tablero</button>
        <button disabled={busy || !estilo} onClick={() => run([{ script: "lab", args: ["empaquetar", estilo], estilo }])}>9 · Empaquetar skill</button>
        <button disabled={busy || !estilo} onClick={() => run([{ script: "lab", args: ["estado", estilo], estilo }])}>Estado</button>
        <button disabled={!estilo} onClick={() => copy(`Sigue .claude/skills/crear-estilo-edicion/SKILL.md para el estilo "${estilo}"${creador ? ` (creador: ${creador})` : ""}: revisa el estado y haz la siguiente fase que le toca al modelo, con sus STOPs.`)}>Copiar instrucción para tu IA</button>
      </div>

      {job && (
        <pre className={`console ${job.status}`}>{`$ ${job.cmd}\n${job.log.slice(-40).join("\n")}${job.status === "running" ? "\n…" : ""}`}</pre>
      )}
    </div>
  );
}
