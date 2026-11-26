import * as T from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
const textures = new Map<string, T.Texture>();
export function artTexture(name: string) {
  let t = textures.get(name);
  if (!t) {
    t = new T.TextureLoader().load(`/arts/${name}.webp`);
    t.colorSpace = T.SRGBColorSpace;
    t.anisotropy = 4;
    textures.set(name, t);
  }
  return t;
}
function grain(wood = false) {
  const key = wood ? "woodgrain" : "brushed";
  let t = textures.get(key);
  if (t) return t;
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d")!,
    im = ctx.createImageData(256, 256);
  let seed = 41;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let y = 0; y < 256; y++)
    for (let x = 0; x < 256; x++) {
      const i = (y * 256 + x) * 4,
        g = wood
          ? 164 +
            Math.sin(x * 0.51 + Math.sin(y * 0.016) * 2) * 24 +
            rand() * 47
          : 184 + rand() * 52;
      im.data[i] = im.data[i + 1] = im.data[i + 2] = g;
      im.data[i + 3] = 255;
    }
  ctx.putImageData(im, 0, 0);
  for (let i = 0; i < (wood ? 39 : 130); i++) {
    const x = rand() * 256,
      y = rand() * 256;
    ctx.strokeStyle = wood
      ? `rgba(70,50,39,${rand() * 0.3})`
      : `rgba(70,76,79,${rand() * 0.23})`;
    ctx.lineWidth = rand() * 0.9 + 0.15;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(
      x + (wood ? rand() * 4 : rand() * 45),
      y + (wood ? rand() * 80 : rand() * 3),
    );
    ctx.stroke();
  }
  t = new T.CanvasTexture(c);
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.colorSpace = T.SRGBColorSpace;
  textures.set(key, t);
  return t;
}
export function finishSurface(m: T.MeshStandardMaterial) {
  if (typeof document === "undefined" || m.emissiveIntensity > 1.1) return;
  const wood = m.metalness < 0.1 && m.color.r > m.color.b * 1.8;
  m.map = grain(wood);
  m.roughnessMap = grain(wood);
  m.bumpMap = grain(wood);
  m.bumpScale = wood ? 0.018 : 0.005;
}
export function softContact(w: number, l: number, opacity = 0.56) {
  let t = textures.get("contact-shadow");
  if (!t) {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const ctx = c.getContext("2d")!,
      gradient = ctx.createRadialGradient(64, 64, 8, 64, 64, 64);
    gradient.addColorStop(0, "rgba(0,0,0,.96)");
    gradient.addColorStop(0.48, "rgba(0,0,0,.78)");
    gradient.addColorStop(0.77, "rgba(0,0,0,.3)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    t = new T.CanvasTexture(c);
    textures.set("contact-shadow", t);
  }
  const mesh = new T.Mesh(
    new T.PlaneGeometry(w, l),
    new T.MeshBasicMaterial({
      map: t,
      opacity,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.034;
  mesh.userData.ownedGeometry = true;
  mesh.userData.ownedMaterial = true;
  return mesh;
}
export function batchMeshes(root: T.Object3D) {
  const batches = new Map<T.Material, T.Mesh[]>();
  for (const o of [...root.children]) {
    if (
      !(o instanceof T.Mesh) ||
      o instanceof T.InstancedMesh ||
      o.name ||
      Array.isArray(o.material) ||
      o.material.transparent
    )
      continue;
    const batch = batches.get(o.material) || [];
    batch.push(o);
    batches.set(o.material, batch);
  }
  for (const [material, meshes] of batches) {
    if (meshes.length < 3) continue;
    const geometries = meshes.map((m) => {
      m.updateMatrix();
      const g = m.geometry.index
        ? m.geometry.toNonIndexed()
        : m.geometry.clone();
      g.applyMatrix4(m.matrix);
      return g;
    });
    const geometry = mergeGeometries(geometries, false);
    geometries.forEach((g) => g.dispose());
    if (!geometry) continue;
    const m = new T.Mesh(geometry, material);
    m.castShadow = meshes.some((m) => m.castShadow);
    m.receiveShadow = true;
    m.userData.ownedGeometry = true;
    root.add(m);
    meshes.forEach((old) => {
      root.remove(old);
      if (old.userData.ownedGeometry) old.geometry.dispose();
    });
  }
}
const sphereG = new T.SphereGeometry(1, 20, 14);
const paints = new Map<string, T.MeshStandardMaterial>();
function paint(color: string, metal = 0) {
  const key = color + metal;
  if (!paints.has(key))
    paints.set(
      key,
      new T.MeshStandardMaterial({
        color,
        roughness: metal ? 0.34 : 0.85,
        metalness: metal,
      }),
    );
  return paints.get(key)!;
}
export function driverModel(rival = false, species = 0) {
  const driver = new T.Group();
  driver.name = "engineer-driver";
  const head = new T.Group();
  head.name = "driver-head";
  driver.add(head);
  const orb = (
    root: T.Object3D,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    material: T.Material,
  ) => {
    const mesh = new T.Mesh(sphereG, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.castShadow = true;
    root.add(mesh);
    return mesh;
  };
  const fur = paint(
      !rival
        ? "#77503a"
        : species === 2
          ? "#a95c32"
          : species === 3
            ? "#6c5143"
            : "#7e8179",
    ),
    leather = paint("#392f28"),
    brass = paint("#ab8554", 0.7);
  orb(
    driver,
    0,
    -0.2,
    0,
    0.23,
    0.26,
    0.17,
    paint(rival ? "#344d50" : "#3b5457"),
  );
  orb(
    driver,
    0,
    -0.115,
    -0.015,
    0.23,
    0.072,
    0.18,
    paint(rival ? "#7f4937" : "#e97936"),
  );
  orb(head, 0, 0.1, 0, 0.276, 0.255, 0.245, fur);
  if (!rival) {
    orb(head, 0, 0.015, -0.257, 0.24, 0.054, 0.176, paint("#817566"));
    orb(head, 0, -0.025, -0.25, 0.225, 0.044, 0.158, paint("#544e46"));
    orb(head, -0.08, 0.052, -0.302, 0.018, 0.009, 0.025, leather);
    orb(head, 0.08, 0.052, -0.302, 0.018, 0.009, 0.025, leather);
  } else {
    for (const side of [-1, 1]) {
      orb(head, side * 0.224, 0.302, 0, 0.074, 0.13, 0.061, fur);
      orb(head, side * 0.115, 0.14, -0.205, 0.124, 0.084, 0.052, leather);
    }
    orb(head, 0, 0.025, -0.205, 0.14, 0.119, 0.13, paint("#bcb4a0"));
    orb(head, 0, 0.06, -0.318, 0.063, 0.042, 0.043, leather);
  }
  for (const side of [-1, 1]) {
    orb(
      head,
      side * 0.118,
      0.145,
      -0.207,
      0.066,
      0.071,
      0.043,
      paint("#dfc593"),
    );
    orb(
      head,
      side * 0.12,
      0.147,
      -0.243,
      0.036,
      0.046,
      0.022,
      paint("#211b16"),
    );
    orb(
      head,
      side * 0.11,
      0.165,
      -0.263,
      0.012,
      0.015,
      0.008,
      paint("#ffffe8"),
    );
    orb(head, side * 0.248, 0.15, 0.015, 0.048, 0.09, 0.085, leather);
  }
  orb(head, 0, 0.283, 0.019, 0.278, 0.149, 0.236, leather);
  for (const side of [-1, 1]) {
    const rim = orb(
      head,
      side * 0.12,
      0.304,
      -0.183,
      0.105,
      0.084,
      0.041,
      brass,
    );
    rim.rotation.z = side * 0.13;
    const lens = orb(
      head,
      side * 0.12,
      0.307,
      -0.216,
      0.079,
      0.059,
      0.03,
      paint("#aa7938", 0.68),
    );
    lens.rotation.z = side * 0.13;
  }
  batchMeshes(head);
  return driver;
}
export function audienceGeometry() {
  const torso = new T.CapsuleGeometry(0.22, 0.31, 2, 7);
  torso.translate(0, -0.1, 0);
  const head = new T.SphereGeometry(0.195, 8, 6);
  head.translate(0, 0.32, 0);
  const ear1 = new T.ConeGeometry(0.073, 0.14, 4);
  ear1.translate(-0.13, 0.5, 0);
  const ear2 = ear1.clone();
  ear2.translate(0.26, 0, 0);
  const bases = [torso, head, ear1, ear2].map((g) => {
    const q = g.toNonIndexed();
    g.dispose();
    return q;
  });
  const result = mergeGeometries(bases, false)!;
  bases.forEach((g) => g.dispose());
  return result;
}
export function disposeOwned(root: T.Object3D) {
  root.traverse((o) => {
    if (o instanceof T.Mesh && o.userData.ownedGeometry) o.geometry.dispose();
    if (
      o instanceof T.Mesh &&
      o.userData.ownedMaterial &&
      !Array.isArray(o.material)
    )
      o.material.dispose();
  });
}
