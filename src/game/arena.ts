import * as T from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { box, cyl, mat, rod } from "./models";
import { artTexture, batchMeshes } from "./visuals";
import { ARENA_DECK_RADIUS, ARENA_RADIUS, EMBLEM_RADIUS } from "./data";

/* Letterforms built from steel segments so the emblem needs no font asset. */
function letterSegments(letter: string) {
  const seg: { x: number; y: number; w: number; h: number; r?: number }[] = [];
  const bar = (x: number, y: number, w: number, h: number, r = 0) =>
    seg.push({ x, y, w, h, r });
  if (letter === "V") {
    bar(-0.55, 0.35, 0.3, 1.5, -0.42);
    bar(0.55, 0.35, 0.3, 1.5, 0.42);
    bar(0, -0.42, 0.34, 0.4);
  } else if (letter === "M") {
    bar(-0.72, 0, 0.28, 1.6);
    bar(0.72, 0, 0.28, 1.6);
    bar(-0.36, 0.34, 0.26, 1.1, 0.28);
    bar(0.36, 0.34, 0.26, 1.1, -0.28);
  } else {
    bar(-0.62, 0, 0.28, 1.6);
    bar(0.1, 0.66, 1.16, 0.28);
    bar(0.1, -0.66, 1.16, 0.28);
    bar(0.64, 0, 0.26, 1.1);
  }
  return seg;
}

export function emblemGroup() {
  const group = new T.Group();
  group.name = "vmd-emblem";
  const steel = mat("#8d9aa1", 0.92, 0.24);
  const dark = mat("#2b3438", 0.6, 0.5);
  const glow = mat("#ffa04a", 0.2, 0.3, true);
  const disc = cyl(
    group,
    EMBLEM_RADIUS,
    EMBLEM_RADIUS,
    0.12,
    [0, 0.07, 0],
    dark,
    72,
  );
  disc.receiveShadow = true;
  const ring = new T.Mesh(
    new T.RingGeometry(EMBLEM_RADIUS - 0.42, EMBLEM_RADIUS, 84),
    new T.MeshStandardMaterial({
      color: "#aab6bb",
      metalness: 0.94,
      roughness: 0.22,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.135;
  ring.receiveShadow = true;
  group.add(ring);
  const inner = new T.Mesh(
    new T.RingGeometry(EMBLEM_RADIUS - 1.5, EMBLEM_RADIUS - 1.38, 84),
    new T.MeshBasicMaterial({
      color: "#ff9b45",
      transparent: true,
      opacity: 0.65,
      side: T.DoubleSide,
    }),
  );
  inner.rotation.x = -Math.PI / 2;
  inner.position.y = 0.145;
  group.add(inner);
  // radial mechanical pattern
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const spoke = box(
      group,
      [0.16, 0.05, i % 3 === 0 ? 1.5 : 0.8],
      [
        Math.sin(a) * (EMBLEM_RADIUS - 1.05),
        0.16,
        Math.cos(a) * (EMBLEM_RADIUS - 1.05),
      ],
      i % 3 === 0 ? glow : steel,
    );
    spoke.rotation.y = a;
  }
  const letters = "VMD".split("");
  const letterWidth = 2.5;
  const totalWidth = letterWidth * letters.length + 0.9;
  letters.forEach((letter, index) => {
    const x = -totalWidth / 2 + letterWidth * index + letterWidth / 2;
    for (const s of letterSegments(letter)) {
      const piece = box(
        group,
        [s.w, 0.3, s.h],
        [x + s.x * 1.5, 0.24, -s.y * 1.5],
        steel,
        true,
      );
      if (s.r) piece.rotation.y = s.r;
    }
  });
  for (const side of [-1, 1]) {
    const bar = box(
      group,
      [totalWidth + 0.4, 0.14, 0.22],
      [0, 0.2, side * 2.6],
      steel,
    );
    bar.castShadow = true;
  }
  group.traverse((o) => {
    if (o instanceof T.Mesh) {
      o.receiveShadow = true;
      o.castShadow = true;
    }
  });
  batchMeshes(group);
  return group;
}

function hazardRing() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 32;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#1b2124";
  ctx.fillRect(0, 0, 512, 32);
  ctx.fillStyle = "#e0a63c";
  for (let i = -32; i < 520; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 32);
    ctx.lineTo(i + 32, 0);
    ctx.lineTo(i + 64, 0);
    ctx.lineTo(i + 32, 32);
    ctx.closePath();
    ctx.fill();
  }
  const tex = new T.CanvasTexture(canvas);
  tex.wrapS = T.RepeatWrapping;
  tex.repeat.set(46, 1);
  tex.colorSpace = T.SRGBColorSpace;
  return tex;
}

function bannerTexture(title: string, sub: string, tint: string) {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 1024, 256);
  g.addColorStop(0, "#101a1e");
  g.addColorStop(1, tint);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1024, 256);
  ctx.fillStyle = "#ff8a3d";
  ctx.fillRect(0, 0, 1024, 12);
  ctx.fillRect(0, 244, 1024, 12);
  ctx.fillStyle = "#f4f1e6";
  ctx.font = "italic bold 96px sans-serif";
  ctx.fillText(title, 40, 130);
  ctx.fillStyle = "#9fd8c4";
  ctx.font = "30px monospace";
  ctx.fillText(sub, 44, 196);
  const tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace;
  return tex;
}

/** Varied spectator silhouettes: bulk, small and winged species. */
function crowdGeometry(variant: number) {
  const parts: T.BufferGeometry[] = [];
  const body = new T.CapsuleGeometry(0.24, 0.34, 2, 7);
  body.translate(0, -0.08, 0);
  parts.push(body.toNonIndexed());
  const head = new T.SphereGeometry(0.2, 8, 6);
  head.translate(0, 0.33, 0);
  parts.push(head.toNonIndexed());
  if (variant === 0) {
    for (const s of [-1, 1]) {
      const ear = new T.ConeGeometry(0.08, 0.16, 4);
      ear.translate(s * 0.14, 0.52, 0);
      parts.push(ear.toNonIndexed());
    }
  } else if (variant === 1) {
    const beak = new T.ConeGeometry(0.07, 0.22, 5);
    beak.rotateX(Math.PI / 2);
    beak.translate(0, 0.32, 0.24);
    parts.push(beak.toNonIndexed());
    for (const s of [-1, 1]) {
      const wing = new T.BoxGeometry(0.34, 0.1, 0.2);
      wing.translate(s * 0.3, 0.05, 0);
      parts.push(wing.toNonIndexed());
    }
  } else {
    const snout = new T.ConeGeometry(0.09, 0.28, 6);
    snout.rotateX(Math.PI / 2);
    snout.translate(0, 0.26, 0.26);
    parts.push(snout.toNonIndexed());
  }
  const merged = mergeGeometries(parts, false)!;
  parts.forEach((p) => p.dispose());
  return merged;
}

export interface ArenaScene {
  crowd: T.Group;
  banners: T.Mesh[];
  update: (
    time: number,
    cheer: number,
    quality: "Low" | "Medium" | "High",
  ) => void;
}

export function buildArena(scene: T.Scene, level: number): ArenaScene {
  const floorMap = artTexture("arena-floor").clone();
  floorMap.wrapS = floorMap.wrapT = T.RepeatWrapping;
  floorMap.repeat.set(6, 6);
  floorMap.needsUpdate = true;
  const floor = new T.Mesh(
    new T.CircleGeometry(ARENA_DECK_RADIUS, 96),
    new T.MeshStandardMaterial({
      map: floorMap,
      metalness: 0.24,
      roughness: 0.72,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.01;
  floor.receiveShadow = true;
  floor.userData.ownedGeometry = true;
  floor.userData.ownedMaterial = true;
  scene.add(floor);

  const rim = new T.Mesh(
    new T.RingGeometry(ARENA_RADIUS - 0.5, ARENA_RADIUS + 3.2, 96),
    new T.MeshStandardMaterial({
      map: hazardRing(),
      metalness: 0.3,
      roughness: 0.6,
    }),
  );
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = 0.02;
  rim.receiveShadow = true;
  rim.userData.ownedGeometry = true;
  rim.userData.ownedMaterial = true;
  scene.add(rim);

  scene.add(emblemGroup());

  const stands = new T.Group();
  const tiers = 9;
  for (let tier = 0; tier < tiers; tier++) {
    const radius = ARENA_RADIUS + 5.2 + tier * 3.4;
    const height = 1.5 + tier * 1.55;
    const ring = new T.Mesh(
      new T.CylinderGeometry(radius + 3.1, radius + 3.1, 1.5, 72, 1, true),
      mat(tier % 2 ? "#2b3a41" : "#33454d", 0.24, 0.82),
    );
    ring.position.y = height;
    ring.receiveShadow = true;
    ring.material.side = T.DoubleSide;
    stands.add(ring);
    const lip = new T.Mesh(
      new T.TorusGeometry(radius + 3.05, 0.16, 6, 72),
      mat("#c98a3c", 0.4, 0.5),
    );
    lip.rotation.x = Math.PI / 2;
    lip.position.y = height + 0.78;
    stands.add(lip);
    const seat = new T.Mesh(
      new T.CylinderGeometry(radius, radius, 0.9, 72, 1, true),
      mat("#1d2b31", 0.3, 0.86),
    );
    seat.position.y = height - 0.75;
    seat.material.side = T.DoubleSide;
    stands.add(seat);
  }
  scene.add(stands);

  // Tiered audience, split into sections that bounce independently.
  const crowd = new T.Group();
  crowd.name = "crowd";
  const palette = [
    "#a9b3ad",
    "#e0a06a",
    "#4f7d84",
    "#b6a486",
    "#77544a",
    "#7e919c",
    "#c9c2ac",
  ];
  const sections: {
    mesh: T.InstancedMesh;
    base: T.Matrix4[];
    phase: number;
  }[] = [];
  const variants = [crowdGeometry(0), crowdGeometry(1), crowdGeometry(2)];
  const dummy = new T.Object3D();
  for (let side = 0; side < 4; side++) {
    const radius = ARENA_RADIUS + 6.4;
    for (let tier = 0; tier < 7; tier++) {
      const variant = (side + tier) % 3;
      const seats = 198;
      const mesh = new T.InstancedMesh(
        variants[variant],
        mat(palette[(side * 3 + tier) % palette.length], 0.06, 0.86),
        seats,
      );
      mesh.instanceColor = new T.InstancedBufferAttribute(
        new Float32Array(seats * 3),
        3,
      );
      mesh.frustumCulled = false;
      const base: T.Matrix4[] = [];
      const a0 = (side / 4) * Math.PI * 2;
      for (let i = 0; i < seats; i++) {
        const a = a0 + (i / seats) * (Math.PI / 2) + (tier % 2) * 0.008;
        const r = radius + tier * 3.4;
        dummy.position.set(
          Math.sin(a) * r,
          1.95 + tier * 1.55,
          Math.cos(a) * r,
        );
        dummy.rotation.set(0, a + Math.PI, 0);
        const s = 0.85 + ((i * 7) % 9) * 0.05;
        dummy.scale.set(s, s * 1.05, s);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        mesh.setColorAt(
          i,
          new T.Color(palette[(i * 3 + tier) % palette.length]),
        );
        base.push(dummy.matrix.clone());
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      crowd.add(mesh);
      sections.push({ mesh, base, phase: side * 1.3 + tier * 0.4 });
    }
  }
  scene.add(crowd);

  // Lighting towers and gates.
  const towers = 12;
  for (let i = 0; i < towers; i++) {
    const a = (i / towers) * Math.PI * 2;
    const r = ARENA_RADIUS + 14;
    const x = Math.sin(a) * r;
    const z = Math.cos(a) * r;
    rod(scene, [x, 0, z], [x, 22, z], 0.55, mat("#39464b", 0.5, 0.6));
    for (let l = 0; l < 4; l++) {
      const head = box(
        scene,
        [2.2, 0.5, 0.7],
        [x, 20 - l * 1.1, z],
        mat("#20292d", 0.6, 0.5),
      );
      head.lookAt(0, 4, 0);
      const lamp = box(
        scene,
        [1.9, 0.16, 0.4],
        [x, 19.8 - l * 1.1, z],
        mat("#eaf6ff", 0.1, 0.2, true),
      );
      lamp.lookAt(0, 4, 0);
    }
  }
  for (let g = 0; g < 4; g++) {
    const a = (g / 4) * Math.PI * 2 + Math.PI / 4;
    const r = ARENA_RADIUS + 4.2;
    const x = Math.sin(a) * r;
    const z = Math.cos(a) * r;
    const gate = new T.Group();
    gate.position.set(x, 0, z);
    gate.rotation.y = a;
    box(gate, [9, 6, 0.6], [0, 3, 0], mat("#2c3940", 0.4, 0.66));
    box(gate, [7.4, 4.4, 0.3], [0, 2.6, 0.4], mat("#131b1f", 0.3, 0.8));
    for (let i = 0; i < 5; i++)
      box(
        gate,
        [0.24, 4.4, 0.4],
        [-3 + i * 1.5, 2.6, 0.5],
        mat("#54646c", 0.7, 0.4),
      );
    const sign = new T.Mesh(
      new T.PlaneGeometry(8, 2),
      new T.MeshBasicMaterial({
        map: bannerTexture("VMD", "GATE " + (g + 1), "#1d2c33"),
        transparent: false,
      }),
    );
    sign.position.set(0, 6.4, 0.4);
    gate.add(sign);
    scene.add(gate);
  }

  // Advertising boards ringing the arena.
  const banners: T.Mesh[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const r = ARENA_RADIUS + 1.4;
    const board = new T.Mesh(
      new T.PlaneGeometry(8.4, 2.1),
      new T.MeshBasicMaterial({
        map: bannerTexture(
          ["CHAMPIONSHIP", "PLATYPUS GARAGE", "HEAVY METAL", "SALVAGE CO."][
            i % 4
          ],
          "VMD CHAMPIONSHIP CIRCUIT",
          ["#2a1c16", "#152a2c", "#241d2c", "#2b2617"][i % 4],
        ),
        side: T.DoubleSide,
      }),
    );
    board.position.set(Math.sin(a) * r, 1.5, Math.cos(a) * r);
    board.lookAt(0, 1.5, 0);
    scene.add(board);
    banners.push(board);
  }

  for (const r of [20, 38, ARENA_RADIUS - 2.6]) {
    const guide = new T.Mesh(
      new T.RingGeometry(r - 0.14, r + 0.14, 96),
      new T.MeshBasicMaterial({
        color: r > 50 ? "#ff6433" : "#4f6872",
        transparent: true,
        opacity: r > 50 ? 0.75 : 0.42,
        side: T.DoubleSide,
      }),
    );
    guide.rotation.x = -Math.PI / 2;
    guide.position.y = 0.025;
    scene.add(guide);
  }
  const deckRing = new T.Mesh(
    new T.RingGeometry(ARENA_RADIUS - 1.1, ARENA_RADIUS - 0.9, 96),
    new T.MeshBasicMaterial({
      color: "#c9a15a",
      transparent: true,
      opacity: 0.5,
      side: T.DoubleSide,
    }),
  );
  deckRing.rotation.x = -Math.PI / 2;
  deckRing.position.y = 0.03;
  scene.add(deckRing);

  batchMeshes(scene);

  const update = (
    time: number,
    cheer: number,
    quality: "Low" | "Medium" | "High",
  ) => {
    const detail = quality === "Low" ? 1 : quality === "Medium" ? 2 : 3;
    sections.forEach((section, index) => {
      if (index % detail !== 0 && cheer < 0.2) return;
      const wave = Math.sin(time * (2.1 + cheer * 3.4) + section.phase);
      const lift = Math.max(0, wave) * (0.18 + cheer * 1.15);
      for (let i = 0; i < section.mesh.count; i += quality === "Low" ? 3 : 1) {
        const m = section.base[i].clone();
        const pos = new T.Vector3().setFromMatrixPosition(m);
        pos.y += lift * (0.6 + ((i * 13) % 7) * 0.07);
        m.setPosition(pos);
        section.mesh.setMatrixAt(i, m);
      }
      section.mesh.instanceMatrix.needsUpdate = true;
    });
  };

  return { crowd, banners, update };
}
