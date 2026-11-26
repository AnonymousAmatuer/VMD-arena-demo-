import * as T from "three";
import {
  finishSurface,
  driverModel,
  batchMeshes,
  disposeOwned,
} from "./visuals";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { DEF, MATERIAL_PROFILES, type Part, type V3 } from "./data";
const geometries = new Map<string, T.BufferGeometry>();
function geom(key: string, factory: () => T.BufferGeometry) {
  if (!geometries.has(key)) geometries.set(key, factory());
  return geometries.get(key)!;
}
const materials = new Map<string, T.MeshStandardMaterial>();
export function mat(c: string, metal = 0.65, rough = 0.38, glow = false) {
  const key = [c, metal, rough, glow].join();
  if (!materials.has(key)) {
    const m = new T.MeshStandardMaterial({
      color: c,
      metalness: metal,
      roughness: rough,
      ...(glow ? { emissive: c, emissiveIntensity: 2.2 } : {}),
    });
    finishSurface(m);
    materials.set(key, m);
  }
  return materials.get(key)!;
}
const steel = mat("#505c65"),
  silver = mat("#b9c5cb", 0.91, 0.23),
  black = mat("#19242b", 0.78, 0.32),
  rubber = mat("#24292b", 0.08, 0.88),
  glass = mat("#183c48", 0.58, 0.16),
  bolt = mat("#8f9ca4", 0.88, 0.26),
  orange = mat("#e76f24", 0.53, 0.37),
  wood = mat("#976139", 0.04, 0.84);
export function box(
  parent: T.Object3D,
  size: V3,
  pos: V3,
  material: T.Material,
  round = false,
) {
  const g = round
    ? geom("rounded", () => new RoundedBoxGeometry(1, 1, 1, 2, 0.07))
    : geom("box", () => new T.BoxGeometry(1, 1, 1));
  const m = new T.Mesh(g, material);
  m.scale.set(...size);
  m.position.set(...pos);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
export function cyl(
  parent: T.Object3D,
  r1: number,
  r2: number,
  h: number,
  pos: V3,
  material: T.Material,
  segments = 20,
) {
  const g = geom(
    `c${r1},${r2},${h},${segments}`,
    () => new T.CylinderGeometry(r1, r2, h, segments),
  );
  const m = new T.Mesh(g, material);
  m.position.set(...pos);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
export function rod(
  parent: T.Object3D,
  a: V3,
  b: V3,
  r: number,
  material: T.Material,
) {
  const av = new T.Vector3(...a),
    bv = new T.Vector3(...b),
    delta = bv.clone().sub(av),
    m = cyl(
      parent,
      r,
      r,
      delta.length(),
      av.add(bv).multiplyScalar(0.5).toArray() as V3,
      material,
      8,
    );
  m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), delta.normalize());
  return m;
}
function fasteners(parent: T.Object3D, points: V3[], r = 0.055) {
  if (!points.length) return;
  const m = new T.InstancedMesh(
      geom("bolt", () => new T.CylinderGeometry(1, 1, 0.6, 6)),
      bolt,
      points.length,
    ),
    d = new T.Object3D();
  points.forEach((p, i) => {
    d.position.set(...p);
    d.scale.setScalar(r);
    d.updateMatrix();
    m.setMatrixAt(i, d.matrix);
  });
  m.castShadow = true;
  parent.add(m);
}
function sawGeometry() {
  return geom("sawtooth", () => {
    const s = new T.Shape();
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2,
        r = i % 3 === 0 ? 0.64 : i % 3 === 1 ? 0.53 : 0.51;
      const x = Math.cos(a) * r,
        y = Math.sin(a) * r;
      if (!i) s.moveTo(x, y);
      else s.lineTo(x, y);
    }
    s.closePath();
    const hole = new T.Path();
    hole.absarc(0, 0, 0.105, 0, Math.PI * 2, true);
    s.holes.push(hole);
    return new T.ExtrudeGeometry(s, {
      depth: 0.055,
      bevelEnabled: true,
      bevelSegments: 1,
      steps: 1,
      bevelSize: 0.008,
      bevelThickness: 0.009,
    });
  });
}
export function partModel(p: Part, opponent = false, species = 0): T.Group {
  const d = DEF[p.key],
    g = new T.Group(),
    accent = opponent ? mat("#478b92", 0.55, 0.4) : orange;
  g.userData.partId = p.id;
  g.userData.kind = d.kind;
  const [w, h, l] = d.dimensions;
  if (d.kind === "core") {
    box(g, [2.19, 0.44, 3.27], [0, -0.07, 0], black, true);
    box(g, [2.35, 0.18, 3.32], [0, 0.16, 0], steel, true);
    const hood = box(g, [1.92, 0.23, 1.3], [0, 0.31, -0.91], black, true);
    hood.rotation.x = -0.11;
    for (const side of [-1, 1]) {
      const fender = box(
        g,
        [0.39, 0.17, 2.98],
        [side * 1.055, 0.29, -0.02],
        accent,
        true,
      );
      fender.rotation.z = side * -0.09;
      box(
        g,
        [0.27, 0.15, 0.1],
        [side * 0.84, 0.25, -1.68],
        mat("#8dfcf2", 0.2, 0.18, true),
        true,
      );
      rod(
        g,
        [1.16 * side, -0.16, -1.45],
        [1.16 * side, 0.18, 1.34],
        0.06,
        silver,
      );
      for (const z of [-1.1, 1.1]) {
        rod(
          g,
          [side * 0.77, 0.27, z + 0.15],
          [side * 1.32, -0.21, z],
          0.085,
          silver,
        );
        const spring = cyl(
          g,
          0.11,
          0.11,
          0.55,
          [side * 1.08, 0.04, z],
          accent,
          10,
        );
        spring.rotation.z = -side * 0.55;
      }
    }
    for (let i = 0; i < 7; i++)
      box(g, [0.1, 0.18, 0.05], [-0.44 + i * 0.147, 0.01, -1.692], silver);
    fasteners(
      g,
      [
        [-0.85, 0.45, -1.37],
        [0.85, 0.45, -1.37],
        [-0.83, 0.39, -0.5],
        [0.83, 0.39, -0.5],
      ],
      0.052,
    );
    const driver = driverModel(opponent, species);
    driver.position.set(0.59, 0.99, 0.69);
    driver.scale.setScalar(0.93);
    g.add(driver);
    for (const side of [-1, 1]) {
      rod(
        g,
        [side * 0.9, 0.26, -0.44],
        [side * 0.8, 1.05, 0.05],
        0.047,
        silver,
      );
      rod(g, [side * 0.8, 1.05, 0.05], [side * 0.83, 1.0, 1.18], 0.047, black);
      rod(g, [side * 0.83, 1.0, 1.18], [side * 0.98, 0.28, 1.56], 0.049, steel);
      rod(g, [side * 0.87, 0.1, -1.75], [side * 0.88, 0.3, -1.82], 0.07, steel);
      const tail = cyl(
        g,
        0.115,
        0.116,
        1.1,
        [side * 1.08, 0.03, 0.8],
        silver,
        14,
      );
      tail.rotation.x = Math.PI / 2;
      const exhaust = cyl(
        g,
        0.12,
        0.1,
        0.06,
        [side * 1.08, 0.03, 1.37],
        black,
        14,
      );
      exhaust.rotation.x = Math.PI / 2;
      for (let j = 0; j < 4; j++) {
        const vent = box(
          g,
          [0.035, 0.13, 0.26],
          [side * 1.18, 0.13, 0.7 - j * 0.36],
          black,
        );
        vent.rotation.x = -0.3;
      }
    }
    rod(g, [-0.88, 0.3, -1.82], [0.88, 0.3, -1.82], 0.07, steel);
    rod(g, [-0.8, 1.05, 0.05], [0.8, 1.05, 0.05], 0.046, steel);
    rod(g, [-0.83, 1.0, 1.18], [0.83, 1.0, 1.18], 0.05, black);
    for (let j = 0; j < 7; j++) {
      box(
        g,
        [0.77, 0.027, 0.045],
        [0, 0.425 - j * 0.008, -1.22 + j * 0.085],
        steel,
      );
    }
  } else if (d.kind === "wheel") {
    const spin = new T.Group();
    spin.name = "wheel-spin";
    g.add(spin);
    const r = h / 2;
    const tire = cyl(spin, r * 0.93, r * 0.93, w, [0, 0, 0], rubber, 28);
    tire.rotation.z = Math.PI / 2;
    const treads = new T.InstancedMesh(
        geom("tread", () => new RoundedBoxGeometry(1, 1, 1, 1, 0.12)),
        mat("#2c3032", 0.04, 0.91),
        32,
      ),
      o = new T.Object3D();
    for (let i = 0; i < 32; i++) {
      const a = (i / 16) * Math.PI * 2 + (i % 2) * 0.075;
      o.position.set(
        (i < 16 ? -1 : 1) * w * 0.245,
        Math.cos(a) * r * 0.94,
        Math.sin(a) * r * 0.94,
      );
      o.scale.set(w * 0.55, r * 0.14, r * 0.28);
      o.rotation.set(a, 0, (i < 16 ? -1 : 1) * 0.18);
      o.updateMatrix();
      treads.setMatrixAt(i, o.matrix);
    }
    treads.castShadow = true;
    spin.add(treads);
    for (const side of [-1, 1]) {
      const rim = cyl(
        spin,
        r * 0.65,
        r * 0.65,
        0.07,
        [side * (w / 2 + 0.015), 0, 0],
        black,
      );
      rim.rotation.z = Math.PI / 2;
      const hub = cyl(
        spin,
        r * 0.5,
        r * 0.48,
        0.075,
        [side * (w / 2 + 0.048), 0, 0],
        accent,
        12,
      );
      hub.rotation.z = Math.PI / 2;
      const center = cyl(
        spin,
        r * 0.22,
        r * 0.24,
        0.08,
        [side * (w / 2 + 0.095), 0, 0],
        silver,
        8,
      );
      center.rotation.z = Math.PI / 2;
      for (let j = 0; j < 6; j++) {
        const a = (j / 6) * Math.PI * 2;
        const b = cyl(
          spin,
          r * 0.054,
          r * 0.054,
          0.03,
          [
            side * (w / 2 + 0.096),
            Math.cos(a) * r * 0.36,
            Math.sin(a) * r * 0.36,
          ],
          bolt,
          6,
        );
        b.rotation.z = Math.PI / 2;
      }
    }
  } else if (d.kind === "material") {
    const profile = MATERIAL_PROFILES[d.material],
      base = mat(
        d.color ?? profile.color,
        profile.metalness,
        profile.roughness,
      );
    const soft = [
      "foam",
      "rubber",
      "reinforced-rubber",
      "polymer",
      "cardboard",
      "box",
    ].includes(d.material);
    const brittle = ["ceramic", "stone", "carbon"].includes(d.material);
    if (d.material === "stone") {
      box(g, [w * 0.94, h * 0.88, l * 0.94], [0, 0, 0], base, true);
      for (let i = 0; i < 5; i++) {
        const rock = box(
          g,
          [w * (0.15 + i * 0.018), h * 0.13, l * 0.2],
          [
            (i % 2 ? -0.22 : 0.2) * w,
            (0.36 + (i % 3) * 0.08) * h,
            (i % 2 ? 0.25 : -0.21) * l,
          ],
          mat(profile.color),
        );
        rock.rotation.set(i * 0.4, i * 0.7, i * 0.2);
      }
      fasteners(
        g,
        [
          [-w * 0.33, h * 0.42, l * 0.32],
          [w * 0.33, h * 0.42, -l * 0.32],
        ],
        0.04,
      );
    } else if (soft) {
      box(g, [w * 0.97, h * 0.94, l * 0.97], [0, 0, 0], base, true);
      for (let i = 0; i < 3; i++) {
        const rib = box(
          g,
          [w * 0.99, 0.055, l * 0.92],
          [0, (-0.25 + i * 0.25) * h, 0],
          mat(
            d.material === "foam" ? "#baa98b" : profile.debris,
            soft ? 0.02 : 0.16,
            soft ? 0.96 : 0.66,
          ),
          true,
        );
        rib.scale.z = 0.99;
      }
      if (d.material === "cardboard" || d.material === "box") {
        box(
          g,
          [w * 0.89, h * 0.025, l * 0.07],
          [0, h * 0.51, 0],
          mat("#6e4b2d", 0.02, 0.98),
        );
        box(
          g,
          [0.032, h * 0.88, l * 0.76],
          [0, 0, 0],
          mat("#7c5a3a", 0.02, 0.98),
        );
      }
    } else {
      box(g, [w * 0.96, h * 0.84, l * 0.96], [0, -h * 0.02, 0], base, true);
      box(
        g,
        [w * 0.72, h * 0.1, l * 0.7],
        [0, h * 0.43, 0],
        brittle
          ? base
          : mat(profile.debris, profile.metalness, profile.roughness),
        true,
      );
      for (const side of [-1, 1]) {
        box(
          g,
          [0.045, 0.1, l * 0.89],
          [side * w * 0.455, h * 0.24, 0],
          mat(d.material === "carbon" ? "#202728" : "#c9a36b", 0.62, 0.4),
        );
        for (let i = 0; i < 2; i++)
          box(
            g,
            [w * 0.28, 0.032, 0.035],
            [0, -h * 0.16 + i * h * 0.27, side * l * 0.49],
            base,
          );
      }
      if (d.material === "carbon") {
        for (let i = 0; i < 4; i++)
          box(
            g,
            [w * 0.82, 0.008, l * 0.013],
            [0, -h * 0.24 + i * h * 0.14, 0],
            mat("#b3bcb7", 0.3, 0.5),
          );
      }
      fasteners(
        g,
        [
          [-w * 0.34, h * 0.46, l * 0.34],
          [w * 0.34, h * 0.46, -l * 0.34],
          [-w * 0.34, h * 0.46, -l * 0.34],
          [w * 0.34, h * 0.46, l * 0.34],
        ],
        0.045,
      );
    }
  } else if (
    ["battery", "generator", "motor", "controller"].includes(d.kind) ||
    d.kind === "mechanical"
  ) {
    const trait = d.trait,
      accentMat = accent;
    if (d.kind === "battery") {
      box(
        g,
        [w * 0.92, h * 0.88, l * 0.92],
        [0, 0, 0],
        mat("#2e3b3c", 0.45, 0.56),
        true,
      );
      box(g, [w * 0.83, h * 0.2, l * 0.84], [0, h * 0.34, 0], accentMat, true);
      for (const side of [-1, 1]) {
        const post = cyl(
          g,
          0.055,
          0.055,
          0.12,
          [side * w * 0.24, h * 0.5, -l * 0.16],
          mat("#c69455", 0.85, 0.25),
          8,
        );
        post.rotation.x = Math.PI / 2;
      }
      for (let i = 0; i < 3; i++)
        box(
          g,
          [w * 0.48, 0.055, 0.02],
          [0, -h * 0.14 + i * h * 0.13, l * 0.474],
          mat("#89c3a1", 0.2, 0.4, true),
        );
      for (const sx of [-1, 1])
        for (const sz of [-1, 1])
          box(
            g,
            [0.09, 0.09, 0.09],
            [sx * w * 0.41, -h * 0.33, sz * l * 0.41],
            bolt,
          );
    } else if (
      d.kind === "motor" ||
      trait === "generator" ||
      trait === "motor"
    ) {
      const body = cyl(
        g,
        h * 0.37,
        h * 0.37,
        l * 0.69,
        [0, 0, 0],
        mat("#303b3f", 0.62, 0.44),
        18,
      );
      body.rotation.x = Math.PI / 2;
      for (const z of [-0.25, 0.2]) {
        const wind = cyl(
          g,
          h * 0.4,
          h * 0.4,
          l * 0.17,
          [0, 0, z * l],
          mat("#b47b44", 0.8, 0.34, true),
          18,
        );
        wind.rotation.x = Math.PI / 2;
      }
      const shaft = cyl(g, 0.07, 0.07, w * 0.88, [0, 0, 0], silver, 10);
      shaft.rotation.z = Math.PI / 2;
      box(g, [w * 0.83, 0.1, l * 0.3], [0, h * 0.35, 0.1], accentMat, true);
    } else if (
      trait === "gearbox" ||
      trait === "bearing" ||
      d.kind === "controller"
    ) {
      box(
        g,
        [w * 0.7, h * 0.92, l * 0.9],
        [0, 0, 0],
        mat("#333d41", 0.64, 0.4),
        true,
      );
      const spin = new T.Group();
      spin.name = "gear-spin";
      g.add(spin);
      for (let i = 0; i < 3; i++) {
        const gear = cyl(
          spin,
          w * (0.23 - i * 0.035),
          w * (0.23 - i * 0.035),
          0.075,
          [(i - 1) * w * 0.25, (i === 1 ? 0.1 : 0) * h, l * 0.02],
          i % 2 ? mat("#b59b61", 0.9, 0.27) : silver,
          10,
        );
        gear.rotation.x = Math.PI / 2;
      }
      const axle = cyl(
        g,
        0.055,
        0.055,
        w,
        [0, -h * 0.3, -l * 0.14],
        accentMat,
        8,
      );
      axle.rotation.z = Math.PI / 2;
    } else if (
      trait === "piston" ||
      trait === "hydraulic" ||
      trait === "jumper"
    ) {
      const barrel = cyl(
        g,
        w * 0.21,
        w * 0.23,
        l * 0.71,
        [0, 0, 0],
        mat("#4a5358", 0.82, 0.3),
        12,
      );
      barrel.rotation.x = Math.PI / 2;
      const shaft = cyl(
        g,
        w * 0.1,
        w * 0.1,
        l * 0.58,
        [0, 0, l * 0.44],
        silver,
        10,
      );
      shaft.rotation.x = Math.PI / 2;
      for (let i = 0; i < 4; i++) {
        const ring = cyl(
          g,
          w * 0.26,
          w * 0.26,
          0.035,
          [0, 0, -l * 0.25 + i * l * 0.08],
          accentMat,
          12,
        );
        ring.rotation.x = Math.PI / 2;
      }
      box(g, [w * 0.82, 0.08, l * 0.84], [0, -h * 0.43, 0], black, true);
    } else if (
      trait === "platform" ||
      trait === "stabilizer" ||
      trait === "axle"
    ) {
      const ring = cyl(
        g,
        w * 0.46,
        w * 0.5,
        h * 0.34,
        [0, 0, 0],
        mat("#536268", 0.8, 0.32),
        20,
      );
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        box(
          g,
          [0.075, 0.065, 0.11],
          [Math.sin(a) * w * 0.36, h * 0.23, Math.cos(a) * w * 0.36],
          accentMat,
        );
      }
      if (trait === "axle") {
        const shaft = cyl(g, 0.075, 0.075, w * 0.98, [0, 0, 0], silver, 10);
        shaft.rotation.z = Math.PI / 2;
        rod(g, [-w * 0.48, 0, 0], [-w * 0.48, h * 0.55, 0], 0.06, steel);
        rod(g, [w * 0.48, 0, 0], [w * 0.48, h * 0.55, 0], 0.06, steel);
      }
      if (trait === "stabilizer")
        for (const side of [-1, 1]) {
          const leg = box(
            g,
            [w * 0.95, 0.09, 0.14],
            [side * w * 0.45, -h * 0.24, l * 0.32],
            steel,
            true,
          );
          leg.rotation.z = side * 0.23;
          box(
            g,
            [0.13, 0.25, 0.25],
            [side * w * 0.9, -h * 0.38, l * 0.32],
            accentMat,
          );
        }
    } else {
      box(
        g,
        [w * 0.88, h * 0.84, l * 0.75],
        [0, 0, 0],
        mat("#313c40", 0.6, 0.5),
        true,
      );
      for (let i = 0; i < 3; i++)
        box(
          g,
          [w * 0.52, 0.06, 0.04],
          [0, (i - 1) * h * 0.22, l * 0.39],
          i === 1 ? mat("#70c9a6", 0.2, 0.4, true) : bolt,
        );
      box(g, [0.07, 0.07, 0.08], [-w * 0.27, h * 0.43, -l * 0.1], accentMat);
      box(g, [0.07, 0.07, 0.08], [w * 0.28, h * 0.43, l * 0.08], accentMat);
    }
  } else if (d.kind === "armor") {
    box(g, [w, h, l], [0, 0, 0], p.key === "alloy" ? silver : steel, true);
    box(g, [w * 1.015, h * 0.37, l * 0.81], [0, -h * 0.09, 0], black, true);
    box(
      g,
      [w * 0.79, 0.065, l * 0.76],
      [0, h * 0.5, 0],
      p.key === "steel" ? glass : black,
      true,
    );
    for (const s of [-1, 1]) {
      box(g, [0.075, 0.035, l * 0.72], [s * w * 0.4, h * 0.515, 0], accent);
      if (p.key === "steel") {
        rod(
          g,
          [s * w * 0.46, h * 0.43, -l * 0.4],
          [s * w * 0.4, h * 0.68, l * 0.4],
          0.055,
          silver,
        );
        box(
          g,
          [0.06, h * 0.62, l * 0.55],
          [s * w * 0.505, 0.016, 0],
          glass,
          true,
        );
      }
    }
    fasteners(
      g,
      [-1, 1].flatMap((x) =>
        [-1, 1].map((z) => [x * w * 0.4, h * 0.53, z * l * 0.4] as V3),
      ),
      0.042,
    );
  } else if (d.kind === "wood") {
    box(g, [w * 0.94, h * 0.96, l * 0.94], [0, 0, 0], wood);
    for (const s of [-1, 1]) {
      for (let i = 0; i < 4; i++)
        box(
          g,
          [w * 0.238, h * 0.95, 0.035],
          [(i - 1.5) * w * 0.245, 0, s * l * 0.49],
          mat(["#755034", "#8f623a", "#845b37", "#a67846"][i], 0.04, 0.85),
        );
      for (const y of [-1, 1])
        box(g, [w, 0.15, 0.09], [0, y * h * 0.41, s * l * 0.5], wood);
      const cross = box(
        g,
        [0.14, Math.sqrt(w * w + h * h) * 0.83, 0.05],
        [0, 0, s * l * 0.53],
        mat("#b0814c", 0.08, 0.8),
      );
      cross.rotation.z = -0.78;
      for (const x of [-1, 1])
        box(g, [0.16, h * 1.025, 0.14], [x * w * 0.44, 0, s * l * 0.45], steel);
    }
  } else if (d.kind === "saw" || d.kind === "blade") {
    box(g, [0.39, 0.4, 0.64], [0, -0.08, 0.2], black, true);
    const m = new T.Mesh(sawGeometry(), silver);
    m.name = "saw-spin";
    m.rotation.y = Math.PI / 2;
    const spin = new T.Group();
    spin.name = "blade-axle";
    spin.add(m);
    g.add(spin);
    const hub = cyl(g, 0.19, 0.21, 0.28, [0.06, 0, 0], accent, 12);
    hub.rotation.z = Math.PI / 2;
    const b = cyl(g, 0.1, 0.1, 0.36, [0.04, 0, 0], bolt, 6);
    b.rotation.z = Math.PI / 2;
    if (d.kind === "blade") {
      spin.rotation.z = Math.PI / 2;
      g.scale.setScalar(1.25);
    }
  } else if (d.kind === "rotor" || d.kind === "propeller") {
    cyl(g, 0.24, 0.32, 0.3, [0, -0.06, 0], black);
    cyl(g, 0.2, 0.2, 0.17, [0, 0.13, 0], accent);
    const spin = new T.Group();
    spin.name = "rotor-spin";
    spin.position.y = 0.21;
    g.add(spin);
    for (let i = 0; i < 4; i++) {
      const arm = new T.Group();
      arm.rotation.y = (i * Math.PI) / 2;
      spin.add(arm);
      const blade = box(
        arm,
        [0.19, 0.045, w * 0.445],
        [0, 0, w * 0.23],
        black,
        true,
      );
      blade.rotation.z = 0.12;
      box(arm, [0.19, 0.052, 0.21], [0, 0, w * 0.412], accent);
    }
    cyl(spin, 0.145, 0.17, 0.1, [0, 0.04, 0], silver);
    if (d.kind === "propeller") g.rotation.x = Math.PI / 2;
  } else if (
    ["egg", "pillow", "rail", "blast", "pulse", "thruster"].includes(d.kind)
  ) {
    cyl(g, w * 0.39, w * 0.5, 0.2, [0, -h * 0.28, 0.06], steel, 12);
    box(g, [w * 0.85, h * 0.66, l * 0.67], [0, 0, l * 0.1], black, true);
    const count = d.kind === "egg" || d.kind === "rail" ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const x = count === 1 ? 0 : (i - 0.5) * w * 0.47,
        r = w / (count === 1 ? 2.6 : 5.1);
      const tube = cyl(
        g,
        r,
        r * 0.85,
        l * 0.82,
        [x, h * 0.18, -l * 0.12],
        d.kind === "pillow" ? mat("#b49d9b") : silver,
      );
      tube.rotation.x = Math.PI / 2;
      const ring = cyl(
        g,
        r * 1.12,
        r * 1.12,
        0.16,
        [x, h * 0.18, -l * 0.35],
        accent,
      );
      ring.rotation.x = Math.PI / 2;
      const bore = cyl(
        g,
        r * 0.71,
        r * 0.71,
        0.015,
        [x, h * 0.18, -l * 0.539],
        d.kind === "rail" || d.kind === "pulse"
          ? mat("#5cffff", 0.1, 0.1, true)
          : black,
      );
      bore.rotation.x = Math.PI / 2;
    }
    fasteners(
      g,
      [
        [-w * 0.34, h * 0.36, l * 0.25],
        [w * 0.34, h * 0.36, l * 0.25],
      ],
      0.04,
    );
  } else if (
    d.kind === "hammer" ||
    d.kind === "club" ||
    d.kind === "catapult"
  ) {
    box(g, [w * 0.93, 0.23, l * 0.72], [0, -h * 0.3, 0], black, true);
    const a = new T.Group();
    a.name = "swing-arm";
    g.add(a);
    rod(a, [0, -0.12, l * 0.35], [0, h * 0.45, -l * 0.35], 0.09, silver);
    if (d.kind === "catapult") {
      const bucket = new T.Mesh(
        geom(
          "bucket",
          () =>
            new T.SphereGeometry(
              0.29,
              12,
              8,
              0,
              Math.PI * 2,
              Math.PI / 2,
              Math.PI / 2,
            ),
        ),
        accent,
      );
      bucket.position.set(0, h * 0.45, -l * 0.35);
      a.add(bucket);
    } else box(a, [w, 0.4, 0.52], [0, h * 0.38, -l * 0.36], accent, true);
  } else if (d.kind === "beam") {
    box(g, [w, h * 0.22, l], [0, h * 0.4, 0], steel);
    box(g, [w * 0.33, h, l], [0, 0, 0], silver);
    box(g, [w, h * 0.22, l], [0, -h * 0.4, 0], steel);
  } else if (d.kind === "spring") {
    cyl(g, 0.095, 0.095, h, [0, 0, 0], silver);
    for (let i = 0; i < 7; i++)
      cyl(g, w * 0.44, w * 0.44, 0.055, [0, (i - 3) * h * 0.135, 0], accent);
  } else {
    box(g, [w, h * 0.62, l], [0, 0, 0], steel, true);
    cyl(g, w * 0.33, w * 0.33, h, [0, 0, 0], accent);
  }
  g.traverse((o) => {
    if (o instanceof T.Group && o !== g) batchMeshes(o);
  });
  batchMeshes(g);
  const root = new T.Group();
  root.userData.partId = p.id;
  root.userData.partKey = p.key;
  const lod = new T.LOD();
  lod.addLevel(g, 0);
  const simple = new T.Group();
  if (d.kind === "wheel") {
    const t = cyl(simple, h / 2, h / 2, w, [0, 0, 0], rubber, 10);
    t.rotation.z = Math.PI / 2;
  } else
    box(
      simple,
      [w, h, l],
      [0, 0, 0],
      d.kind === "wood" ? wood : d.category === "Weapons" ? accent : black,
    );
  lod.addLevel(simple, 36);
  root.add(lod);
  root.position.set(...p.pos);
  root.rotation.set(...(p.rot.map((x) => (x * Math.PI) / 180) as V3));
  root.scale.set(...p.scale);
  return root;
}
export function animatePart(
  g: T.Object3D,
  dt: number,
  speed: number,
  active: boolean,
  condition = 1,
  jammed = false,
  timeMs = performance.now(),
) {
  const t = timeMs;
  const head = g.getObjectByName("driver-head");
  if (head) {
    head.rotation.y = Math.sin(performance.now() * 0.00085) * 0.24;
    head.rotation.z = Math.sin(performance.now() * 0.0017) * 0.025;
    head.position.y = Math.sin(performance.now() * 0.002) * 0.01;
  }
  const wheel = g.getObjectByName("wheel-spin");
  if (wheel) {
    wheel.rotation.x -= speed * dt * 1.4;
    const wobble = condition < 0.6 ? (1 - condition) * 0.16 : 0;
    wheel.rotation.z = wobble ? Math.sin(t * 0.021) * wobble : 0;
  }
  const gear = g.getObjectByName("gear-spin");
  if (gear) gear.rotation.z += dt * (active ? 9 : 1.2);
  const rotor = g.getObjectByName("rotor-spin");
  if (rotor) {
    rotor.rotation.y += dt * (active && !jammed ? 32 : 3);
    rotor.rotation.z =
      condition < 0.55 ? Math.sin(t * 0.022) * (1 - condition) * 0.26 : 0;
  }
  const saw = g.getObjectByName("blade-axle");
  if (saw)
    saw.rotation.x +=
      dt * (jammed ? 0 : active ? 29 * (0.25 + 0.75 * condition) : 2);
  const arm = g.getObjectByName("swing-arm");
  if (arm)
    arm.rotation.x = active ? Math.sin(performance.now() * 0.012) * 0.8 : 0;
}
export function disposeTree(root: T.Object3D) {
  disposeOwned(root);
  root.traverse((o) => {
    if (o instanceof T.InstancedMesh) o.dispose();
  });
  root.clear();
}
