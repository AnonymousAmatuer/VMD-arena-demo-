import * as T from "three";
import type { Livery } from "./data";

const DECAL_GLYPH: Record<Livery["decal"], string> = {
  none: "",
  bolt: "⚡",
  paw: "🐾",
  skull: "☠",
  vmd: "VMD",
};

/** Applies a player's paint, accent and lights to a single component model. */
export function applyLivery(root: T.Object3D, livery?: Livery) {
  if (!livery) return;
  root.traverse((o) => {
    if (!(o instanceof T.Mesh) || o.userData.liveryApplied) return;
    const source = o.material;
    if (
      !source ||
      Array.isArray(source) ||
      !(source instanceof T.MeshStandardMaterial)
    )
      return;
    const material = source.clone();
    o.material = material;
    o.userData.ownedMaterial = true;
    o.userData.liveryApplied = true;

    if (source.emissiveIntensity > 1 || material.emissiveIntensity > 1) {
      material.color.set(livery.lights);
      material.emissive.set(livery.lights);
      material.emissiveIntensity = 2.2;
      o.userData.liveryRole = "light";
      return;
    }
    const c = source.color;
    const isOrangeAccent = c.r > 0.6 && c.g > 0.2 && c.g < 0.72 && c.b < 0.35;
    if (isOrangeAccent) {
      material.color.set(livery.accent);
      o.userData.liveryRole = "accent";
    } else if (
      c.r > 0.18 &&
      c.r < 0.8 &&
      Math.abs(c.r - c.g) < 0.24 &&
      Math.abs(c.g - c.b) < 0.3
    ) {
      material.color.set(livery.paint);
      o.userData.liveryRole = "paint";
    }
  });
}

function patternBackground(
  ctx: CanvasRenderingContext2D,
  l: Livery,
  w: number,
  h: number,
) {
  ctx.fillStyle = l.paint;
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.globalAlpha = 0.55;
  if (l.pattern === "stripe") {
    ctx.fillStyle = l.accent;
    ctx.fillRect(0, h * 0.36, w, h * 0.16);
    ctx.fillRect(0, h * 0.62, w, h * 0.08);
  } else if (l.pattern === "checker") {
    ctx.fillStyle = l.accent;
    const s = h / 4;
    for (let x = 0; x < w; x += s)
      for (let y = 0; y < h; y += s)
        if (((x / s) | 0) % 2 === ((y / s) | 0) % 2) ctx.fillRect(x, y, s, s);
  } else if (l.pattern === "camo") {
    ctx.fillStyle = l.accent;
    for (let i = 0; i < 16; i++) {
      const x = (i * 71) % w,
        y = (i * 37) % h;
      ctx.beginPath();
      ctx.ellipse(x, y, 30 + (i % 3) * 14, 16 + (i % 4) * 8, i, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (l.pattern === "flame") {
    ctx.fillStyle = l.accent;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 24)
      ctx.lineTo(x, h * (0.5 + Math.sin(x * 0.03) * 0.22));
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** Number plate, decal and pattern rendered as a real 3D panel. */
export function createIdentityPanel(livery: Livery): T.Group {
  const group = new T.Group();
  group.name = "identity-panel";
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  patternBackground(ctx, livery, canvas.width, canvas.height);
  ctx.fillStyle = "#101719";
  ctx.fillRect(16, 12, 480, 232);
  ctx.strokeStyle = livery.lights;
  ctx.lineWidth = 5;
  ctx.strokeRect(16, 12, 480, 232);
  ctx.fillStyle = livery.accent;
  ctx.font = "bold 104px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(DECAL_GLYPH[livery.decal] || "", 256, 118);
  ctx.fillStyle = "#eef3ef";
  ctx.font = "bold 70px monospace";
  ctx.fillText(livery.plate.toUpperCase().slice(0, 12) || "VMD", 256, 212);
  const tex = new T.CanvasTexture(canvas);
  tex.colorSpace = T.SRGBColorSpace;
  const mat = new T.MeshBasicMaterial({ map: tex, side: T.DoubleSide });
  const mesh = new T.Mesh(new T.PlaneGeometry(1.32, 0.66), mat);
  mesh.position.set(0, 0.58, -1.72);
  mesh.rotation.x = -0.22;
  mesh.userData.ownedGeometry = true;
  mesh.userData.ownedMaterial = true;
  mesh.userData.ownedTexture = tex;
  group.add(mesh);
  return group;
}

export function pulseLights(root: T.Object3D, time: number) {
  const pulse = 1.8 + Math.sin(time * 0.005) * 0.7;
  root.traverse((o) => {
    if (o.userData.liveryRole !== "light" || !(o instanceof T.Mesh)) return;
    const m = o.material;
    if (m instanceof T.MeshStandardMaterial) m.emissiveIntensity = pulse;
  });
}

export function disposeIdentityPanel(group: T.Group) {
  group.traverse((o) => {
    if (!(o instanceof T.Mesh)) return;
    if (o.userData.ownedGeometry) o.geometry.dispose();
    if (o.userData.ownedMaterial && o.material instanceof T.MeshBasicMaterial) {
      o.material.map?.dispose();
      o.material.dispose();
    }
  });
}
