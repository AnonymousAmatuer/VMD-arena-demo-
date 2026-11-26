import * as T from "three";
import {
  artTexture,
  softContact,
  audienceGeometry,
  batchMeshes,
  disposeOwned,
} from "./visuals";
import { box, cyl, mat, rod } from "./models";
import { buildArena } from "./arena";
import type { Quality, V3 } from "./data";
export function renderRig(host: HTMLElement, quality: Quality, arena = false) {
  const scene = new T.Scene();
  scene.background = new T.Color(arena ? "#24353b" : "#202d31");
  scene.fog = new T.FogExp2(
    arena ? "#25383f" : "#26343a",
    arena ? 0.0011 : 0.031,
  );
  const camera = new T.PerspectiveCamera(arena ? 48 : 36, 1, 0.1, 1400);
  let renderer: T.WebGLRenderer | null = null;
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    renderer = new T.WebGLRenderer({
      antialias: quality !== "Low",
      alpha: false,
      powerPreference: "high-performance",
    });
    canvas = renderer.domElement;
    renderer.setPixelRatio(
      Math.min(
        devicePixelRatio,
        { Low: 1, Medium: 1.3, High: 1.7, Ultra: 2 }[quality],
      ),
    );
    renderer.shadowMap.enabled = quality !== "Low";
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.outputColorSpace = T.SRGBColorSpace;
  } catch {
    canvas = document.createElement("canvas");
    ctx = canvas.getContext("2d");
  }
  host.appendChild(canvas);
  canvas.style.cssText =
    "display:block;width:100%;height:100%;touch-action:none";
  const hemi = new T.HemisphereLight("#d4e9e9", "#6c5440", 1.45);
  scene.add(hemi);
  const sun = new T.DirectionalLight("#ffdebd", 3.5);
  sun.position.set(-16, 30, -14);
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(quality === "Ultra" ? 2048 : 1024);
  sun.shadow.camera.left = sun.shadow.camera.bottom = arena ? -96 : -8;
  sun.shadow.camera.right = sun.shadow.camera.top = arena ? 96 : 8;
  sun.shadow.normalBias = 0.025;
  sun.shadow.bias = -0.0003;
  scene.add(sun);
  const rim = new T.DirectionalLight("#54cbd5", 2.9);
  rim.position.set(6, 4, -9);
  scene.add(rim);
  if (renderer) {
    const sky = artTexture("hangar-environment");
    sky.mapping = T.EquirectangularReflectionMapping;
    scene.background = sky;
    scene.environment = sky;
    scene.backgroundIntensity = arena ? 0.37 : 0.86;
    scene.backgroundBlurriness = arena ? 0.12 : 0.015;
    scene.environmentIntensity = 1.5;
    scene.environmentRotation.y = 0.7;
    scene.backgroundRotation.y = 0.7;
  }
  let width = 1,
    height = 1;
  function resize() {
    width = Math.max(1, host.clientWidth);
    height = Math.max(1, host.clientHeight);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (renderer) renderer.setSize(width, height, false);
    else {
      canvas.width = width;
      canvas.height = height;
    }
  }
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  let load = 0;
  const tmp = new T.Vector3();
  const project = (x: number, y: number, z: number) => {
    tmp.set(x, y, z).project(camera);
    return [((tmp.x + 1) * width) / 2, ((-tmp.y + 1) * height) / 2];
  };
  function fallback() {
    if (!ctx) return;
    const c = ctx;
    c.fillStyle = "#202c31";
    c.fillRect(0, 0, width, height);
    camera.updateMatrixWorld();
    for (let i = -24; i <= 24; i += 2) {
      c.strokeStyle = "#34464b";
      c.lineWidth = 1;
      let a = project(i, 0, -24),
        b = project(i, 0, 24);
      c.beginPath();
      c.moveTo(a[0], a[1]);
      c.lineTo(b[0], b[1]);
      c.stroke();
      a = project(-24, 0, i);
      b = project(24, 0, i);
      c.beginPath();
      c.moveTo(a[0], a[1]);
      c.lineTo(b[0], b[1]);
      c.stroke();
    }
    const faces: { p: number[][]; z: number; color: string }[] = [];
    scene.updateMatrixWorld(true);
    scene.traverse((obj) => {
      if (!(obj instanceof T.Mesh) || !obj.visible || !obj.userData?.fallback)
        return;
      const b = new T.Box3().setFromObject(obj);
      if (b.isEmpty()) return;
      const { min: u, max: v } = b;
      const pts = [
        [u.x, u.y, u.z],
        [v.x, u.y, u.z],
        [v.x, v.y, u.z],
        [u.x, v.y, u.z],
        [u.x, u.y, v.z],
        [v.x, u.y, v.z],
        [v.x, v.y, v.z],
        [u.x, v.y, v.z],
      ];
      [
        [0, 1, 2, 3],
        [4, 5, 6, 7],
        [0, 4, 7, 3],
        [1, 5, 6, 2],
        [2, 3, 7, 6],
      ].forEach((f, i) => {
        const m = obj.material as T.MeshStandardMaterial,
          col = m.color
            .clone()
            .multiplyScalar([0.65, 0.72, 0.82, 0.88, 1.2][i]);
        faces.push({
          p: f.map((n) => project(...(pts[n] as V3))),
          z: f.reduce(
            (s, n) =>
              s + camera.position.distanceTo(new T.Vector3(...(pts[n] as V3))),
            0,
          ),
          color: "#" + col.getHexString(),
        });
      });
    });
    faces.sort((a, b) => b.z - a.z);
    for (const f of faces) {
      c.fillStyle = f.color;
      c.strokeStyle = "#121b1e";
      c.beginPath();
      f.p.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.closePath();
      c.fill();
      c.stroke();
    }
  }
  return {
    scene,
    camera,
    canvas,
    renderer,
    render(dt: number) {
      if (renderer) {
        load =
          dt > 0.047 ? load + Math.min(dt, 0.16) : Math.max(0, load - dt * 1.8);
        if (load > (arena ? 0.75 : 1.05)) {
          const ratio = renderer.getPixelRatio();
          if (ratio > 0.68)
            renderer.setPixelRatio(Math.max(0.68, ratio * 0.79));
          renderer.shadowMap.enabled = false;
          load = 0;
        }
        renderer.render(scene, camera);
      } else fallback();
    },
    dispose() {
      observer.disconnect();
      disposeOwned(scene);
      sun.shadow.map?.dispose();
      renderer?.dispose();
      renderer?.forceContextLoss();
      canvas.remove();
      scene.clear();
    },
  };
}
export function workshopEnvironment(scene: T.Scene) {
  const floor = mat("#272e30", 0.38, 0.75);
  box(scene, [27, 0.18, 27], [0, -0.4, 0], floor);
  cyl(scene, 3.65, 3.74, 0.24, [0, -0.19, 0], mat("#293238", 0.78, 0.4), 80);
  cyl(
    scene,
    3.67,
    3.67,
    0.037,
    [0, -0.058, 0],
    mat("#ef9b45", 0.2, 0.4, true),
    80,
  );
  cyl(scene, 3.62, 3.64, 0.064, [0, -0.019, 0], mat("#3c4447", 0.59, 0.53), 80);
  for (let i = 0; i < 50; i++) {
    const a = (i / 50) * Math.PI * 2;
    const stripe = box(
      scene,
      [0.25, 0.014, 0.13],
      [Math.sin(a) * 3.44, 0.02, Math.cos(a) * 3.44],
      i % 2 ? mat("#b39458", 0.32, 0.68) : mat("#1c2326", 0.3, 0.68),
    );
    stripe.rotation.y = a;
  }
  for (const r of [3.29, 3.19, 2.91]) {
    const ring = new T.Mesh(
      new T.RingGeometry(r, r + 0.014, 72),
      new T.MeshBasicMaterial({ color: "#1c282a", side: T.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.023;
    scene.add(ring);
  }
  for (const s of [-1, 1]) {
    box(
      scene,
      [0.06, 0.012, 21],
      [s * 6.2, -0.295, 0],
      mat("#bc9242", 0.16, 0.74),
    );
    for (const z of [-7.2, 7.2]) {
      const beam = box(
        scene,
        [0.31, 7, 0.35],
        [s * 7.8, 3.13, z],
        mat("#2b3436", 0.45, 0.64),
      );
      box(
        scene,
        [0.21, 1.36, 0.37],
        [s * 7.8, 0.41, z],
        mat("#aa7738", 0.43, 0.65),
      );
      box(
        scene,
        [4, 0.06, 0.12],
        [s * 5.3, 4.9, z],
        mat("#baf4ea", 0.1, 0.3, true),
      );
    }
  }
  batchMeshes(scene);
  scene.add(softContact(4.2, 5.5, 0.82));
}
export function arenaEnvironment(scene: T.Scene, level: number) {
  return buildArena(scene, level);
}
