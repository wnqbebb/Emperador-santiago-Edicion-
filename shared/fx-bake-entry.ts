// Punto de entrada que el horneador (Playwright) carga en un navegador invisible.
import { drawPixelFx, renderIntro3D, fxBox } from "./fx";

(window as any).SantiFX = {
  frame(kind: string, id: string, t: number, accent: string) {
    const b = fxBox(kind, id);
    const c = document.querySelector("canvas") as HTMLCanvasElement;
    c.width = Math.round(b.w); c.height = Math.round(b.h);
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    if (kind === "intro3d") ctx.drawImage(renderIntro3D(t, accent), 0, 0, c.width, c.height);
    else drawPixelFx(ctx, id, t, { x: 0, y: 0, w: c.width, h: c.height });
    return c.toDataURL("image/png");
  },
};
