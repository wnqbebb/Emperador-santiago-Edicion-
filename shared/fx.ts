/// <reference path="./pixelfx.d.ts" />
// Efectos especiales deterministas (mismo cuadro para el mismo tiempo t):
//  · pixelfx (patch-gg/pixelfx, MIT): explosiones, confeti, monedas, rayos… en pixel art
//  · intro3d (three.js): corona dorada 3D del Emperador
// Los usa el editor web en vivo y el "horneador" (Playwright) para Remotion y HyperFrames.
import { createFx, createFrame, composite } from "pixelfx/core/index";
import * as fireworkBurst from "pixelfx/fx/explosions/firework-burst";
import * as cartoonPow from "pixelfx/fx/explosions/cartoon-pow";
import * as confetti from "pixelfx/fx/ui/confetti";
import * as coinCollect from "pixelfx/fx/ui/coin-collect";
import * as lightningStrike from "pixelfx/fx/lightning/lightning-strike";
import * as sunburst from "pixelfx/fx/holy/sunburst";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

import { INTRO3D_DURATION } from "./fxmeta";
export * from "./fxmeta";

type FxModule = { meta: { size: [number, number]; origin: [number, number] } };
const PIXEL_FX: Record<string, { mod: FxModule }> = {
  "firework-burst": { mod: fireworkBurst as FxModule },
  "cartoon-pow": { mod: cartoonPow as FxModule },
  confetti: { mod: confetti as FxModule },
  "coin-collect": { mod: coinCollect as FxModule },
  "lightning-strike": { mod: lightningStrike as FxModule },
  sunburst: { mod: sunburst as FxModule },
};

// ---------- pixelfx: simula desde 0 hasta t (cacheado para reproducir hacia delante sin coste)
const cache = new Map<string, { fx: any; t: number; frame: any; rgba: Uint8ClampedArray; img?: ImageData }>();
const STEP = 1 / 60;

export function pixelFxImage(id: string, t: number): ImageData | null {
  const def = PIXEL_FX[id];
  if (!def) return null;
  const [w, h] = def.mod.meta.size, [ox, oy] = def.mod.meta.origin;
  let c = cache.get(id);
  if (!c || t < c.t - 1e-6) {
    const fx = createFx(def.mod as any, { x: ox, y: oy, seed: 7 });
    c = { fx, t: 0, frame: createFrame(w, h), rgba: new Uint8ClampedArray(w * h * 4) };
    cache.set(id, c);
  }
  while (c.t + STEP <= t + 1e-6) { c.fx.update(STEP); c.t += STEP; }
  c.frame.color.fill(0); c.frame.light.fill(0);
  c.fx.draw(c.frame);
  composite(c.frame, c.rgba, null);
  c.img ??= new ImageData(w, h);
  c.img.data.set(c.rgba);
  return c.img;
}

/** Dibuja el efecto pixel en un contexto 2D, escalado sin suavizado (pixel art nítido). */
export function drawPixelFx(ctx: CanvasRenderingContext2D, id: string, t: number, box: { x: number; y: number; w: number; h: number }) {
  const img = pixelFxImage(id, t);
  if (!img) return;
  const tmp = scratch(img.width, img.height);
  tmp.getContext("2d")!.putImageData(img, 0, 0);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tmp, box.x, box.y, box.w, box.h);
  ctx.restore();
}
let scratchCanvas: HTMLCanvasElement | null = null;
function scratch(w: number, h: number) {
  scratchCanvas ??= document.createElement("canvas");
  if (scratchCanvas.width !== w || scratchCanvas.height !== h) { scratchCanvas.width = w; scratchCanvas.height = h; }
  return scratchCanvas;
}

// ---------- intro3d: corona dorada con three.js
let three: { renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; crown: THREE.Group; gems: THREE.Mesh[]; color: string } | null = null;

function buildCrown(accent: string) {
  const gold = new THREE.MeshStandardMaterial({ color: accent, metalness: 1, roughness: 0.22 });
  const ruby = new THREE.MeshStandardMaterial({ color: "#c0122c", metalness: 0.2, roughness: 0.05, emissive: "#3a0008" });
  const crown = new THREE.Group();
  crown.add(new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.2, 0.55, 64, 1, true), gold));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.24, 0.08, 16, 80), gold);
  rim.rotation.x = Math.PI / 2; rim.position.y = -0.27; crown.add(rim);
  const top = rim.clone(); top.position.y = 0.27; crown.add(top);
  const gems: THREE.Mesh[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.95, 24), gold);
    spike.position.set(Math.cos(a) * 1.22, 0.72, Math.sin(a) * 1.22); crown.add(spike);
    const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.11, 24, 16), gold);
    pearl.position.set(Math.cos(a) * 1.22, 1.24, Math.sin(a) * 1.22); crown.add(pearl);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.13), ruby);
    gem.position.set(Math.cos(a + Math.PI / 8) * 1.27, 0, Math.sin(a + Math.PI / 8) * 1.27); crown.add(gem); gems.push(gem);
  }
  return { crown, gems };
}

/** Renderiza la intro 3D en el tiempo t (0…INTRO3D_DURATION) y devuelve el canvas WebGL (fondo transparente). */
export function renderIntro3D(t: number, accent = "#E9B949", size = 800): HTMLCanvasElement {
  if (!three || three.color !== accent) {
    three?.renderer.dispose();
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(size, size, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    const key = new THREE.DirectionalLight("#fff4d6", 2.4); key.position.set(3, 4, 5); scene.add(key);
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    const { crown, gems } = buildCrown(accent);
    scene.add(crown);
    three = { renderer, scene, camera, crown, gems, color: accent };
  }
  const { renderer, scene, camera, crown, gems } = three;
  const p = Math.min(1, t / INTRO3D_DURATION);
  const inP = 1 - Math.pow(1 - Math.min(1, t / 0.9), 3);
  const outP = t > INTRO3D_DURATION - 0.4 ? (t - (INTRO3D_DURATION - 0.4)) / 0.4 : 0;
  crown.rotation.y = -1.6 + p * 3.2;
  crown.rotation.x = 0.35 - 0.15 * inP;
  crown.position.y = -3 + 3 * inP + outP * 0.6;
  crown.scale.setScalar(0.6 + 0.4 * inP - outP * 0.6);
  gems.forEach((g, i) => (g.rotation.y = t * 2 + i));
  camera.position.set(0, 1.2, 7.2 - 1.2 * p);
  camera.lookAt(0, 0.35, 0);
  renderer.render(scene, camera);
  return renderer.domElement;
}
