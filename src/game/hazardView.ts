import * as T from "three";
import {
  DASH_PADS,
  JUMP_PADS,
  PAD_HALF_LENGTH,
  PAD_HALF_WIDTH,
  PORTAL,
  SPIKE_RADIUS,
  TELEPORT_PAIRS,
  predictLanding,
} from "./hazards";
import { box, cyl, mat } from "./models";

function chevronTexture(color: string, bg = "#141c20") {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 512;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 512);
  ctx.strokeStyle = color;
  ctx.lineWidth = 10;
  ctx.strokeRect(10, 10, 236, 492);
  ctx.lineWidth = 28;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (let i = 0; i < 4; i++) {
    const y = 430 - i * 105;
    ctx.beginPath();
    ctx.moveTo(42, y);
    ctx.lineTo(128, y - 62);
    ctx.lineTo(214, y);
    ctx.stroke();
  }
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  return t;
}

function ringTexture(color: string) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, 256, 256);
  const grad = ctx.createRadialGradient(128, 128, 12, 128, 128, 118);
  grad.addColorStop(0, color);
  grad.addColorStop(0.55, color + "66");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(128, 128, 118, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.arc(128, 128, 102, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 8;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.beginPath();
  ctx.arc(128, 128, 66, 0, Math.PI * 2);
  ctx.stroke();
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  return t;
}

function portalSignTexture() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#10181d";
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = "#4fe6ff";
  ctx.lineWidth = 8;
  ctx.strokeRect(6, 6, 500, 116);
  ctx.fillStyle = "#ff9d47";
  ctx.font = "italic bold 54px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("CLONE PORTAL", 256, 66);
  ctx.fillStyle = "#9fe9ff";
  ctx.font = "bold 24px monospace";
  ctx.fillText("6s AI WINGMAN ASSIST", 256, 104);
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  return t;
}

export interface HazardView {
  group: T.Group;
  shadows: T.Group[];
  pulses: T.MeshBasicMaterial[];
  swirl: T.Mesh;
  spikes: T.InstancedMesh;
  innerSpikes: T.InstancedMesh;
}

const plate = () => mat("#222a2e", 0.72, 0.42);

/** Pads, portal, teleporters, spike ring and landing shadows. */
export function buildHazards(scene: T.Scene): HazardView {
  const group = new T.Group();
  group.name = "hazards";
  scene.add(group);
  const pulses: T.MeshBasicMaterial[] = [];

  // 1. Small Dash Pads (~1.5x vehicle width & length: 3.5 x 5.0 units)
  const dashMat = new T.MeshBasicMaterial({
    map: chevronTexture("#ff9d3b", "#1c1610"),
    transparent: true,
    depthWrite: false,
  });
  pulses.push(dashMat);
  for (const pad of DASH_PADS) {
    const g = new T.Group();
    g.position.set(pad.x, 0, pad.z);
    g.rotation.y = pad.yaw;
    group.add(g);
    box(
      g,
      [PAD_HALF_WIDTH * 2 + 0.28, 0.08, PAD_HALF_LENGTH * 2 + 0.28],
      [0, 0.04, 0],
      plate(),
    );
    for (const side of [-1, 1]) {
      box(
        g,
        [0.14, 0.16, PAD_HALF_LENGTH * 2],
        [side * (PAD_HALF_WIDTH + 0.08), 0.1, 0],
        mat("#ff8a3d", 0.3, 0.3, true),
      );
    }
    const top = new T.Mesh(
      new T.PlaneGeometry(PAD_HALF_WIDTH * 2, PAD_HALF_LENGTH * 2),
      dashMat,
    );
    top.rotation.x = -Math.PI / 2;
    top.position.y = 0.09;
    g.add(top);
  }

  // 2. Jump Pads (angled launch ramps)
  const jumpMat = new T.MeshBasicMaterial({
    map: chevronTexture("#5dffb0", "#102219"),
    transparent: true,
    depthWrite: false,
  });
  pulses.push(jumpMat);
  for (const pad of JUMP_PADS) {
    const g = new T.Group();
    g.position.set(pad.x, 0, pad.z);
    g.rotation.y = pad.yaw;
    group.add(g);
    const ramp = new T.Mesh(
      new T.BoxGeometry(PAD_HALF_WIDTH * 2, 0.28, PAD_HALF_LENGTH * 2),
      mat("#2f4a3c", 0.55, 0.42),
    );
    ramp.position.set(0, 0.24, 0);
    ramp.rotation.x = 0.22;
    ramp.castShadow = true;
    g.add(ramp);
    for (const side of [-1, 1]) {
      const rail = box(
        g,
        [0.16, 0.32, PAD_HALF_LENGTH * 2],
        [side * (PAD_HALF_WIDTH + 0.08), 0.28, 0],
        mat("#5dffb0", 0.2, 0.3, true),
      );
      rail.rotation.x = 0.22;
    }
    const sign = new T.Mesh(
      new T.PlaneGeometry(PAD_HALF_WIDTH * 2 - 0.1, PAD_HALF_LENGTH * 2 - 0.1),
      jumpMat,
    );
    sign.rotation.x = -Math.PI / 2 + 0.22;
    sign.position.set(0, 0.4, 0);
    g.add(sign);
  }

  // 3. Paired Teleport Pads (matching colors per pair)
  for (const pair of TELEPORT_PAIRS) {
    const ringMat = new T.MeshBasicMaterial({
      map: ringTexture(pair.color),
      transparent: true,
      depthWrite: false,
    });
    pulses.push(ringMat);
    const glowMat = new T.MeshStandardMaterial({
      color: pair.color,
      emissive: pair.color,
      emissiveIntensity: 1.7,
      metalness: 0.4,
      roughness: 0.25,
    });
    for (const pad of [pair.a, pair.b]) {
      const g = new T.Group();
      g.position.set(pad.x, 0, pad.z);
      g.rotation.y = pad.yaw;
      group.add(g);
      cyl(g, 2.35, 2.55, 0.12, [0, 0.06, 0], plate(), 32);
      const disc = new T.Mesh(new T.PlaneGeometry(4.4, 4.4), ringMat);
      disc.rotation.x = -Math.PI / 2;
      disc.position.y = 0.13;
      g.add(disc);
      const halo = new T.Mesh(new T.TorusGeometry(2.1, 0.09, 10, 36), glowMat);
      halo.rotation.x = Math.PI / 2;
      halo.position.y = 0.18;
      g.add(halo);
      for (const side of [-1, 1]) {
        const pylon = new T.Mesh(
          new T.CylinderGeometry(0.14, 0.2, 2.8, 12),
          glowMat,
        );
        pylon.position.set(side * 2.1, 1.4, 0);
        g.add(pylon);
      }
    }
  }

  // 4. Clone Portal (archway with swirling energy field)
  const portal = new T.Group();
  portal.position.set(PORTAL.x, 0, PORTAL.z);
  portal.rotation.y = PORTAL.yaw;
  group.add(portal);
  cyl(portal, 3.6, 3.9, 0.18, [0, 0.09, 0], plate(), 40);
  for (const side of [-1, 1]) {
    box(portal, [0.55, 5.2, 0.65], [side * 2.95, 2.6, 0], mat("#28363d", 0.7, 0.35));
    box(
      portal,
      [0.2, 4.8, 0.72],
      [side * 2.7, 2.6, 0],
      mat("#4fe6ff", 0.2, 0.2, true),
    );
  }
  const ring = new T.Mesh(
    new T.TorusGeometry(2.85, 0.26, 14, 56),
    new T.MeshStandardMaterial({
      color: "#ffb24a",
      emissive: "#ff8a3d",
      emissiveIntensity: 1.8,
      metalness: 0.6,
      roughness: 0.3,
    }),
  );
  ring.position.y = 3.1;
  portal.add(ring);
  const swirlMat = new T.MeshBasicMaterial({
    map: ringTexture("#5fd8ff"),
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    side: T.DoubleSide,
  });
  pulses.push(swirlMat);
  const swirl = new T.Mesh(new T.CircleGeometry(2.65, 40), swirlMat);
  swirl.position.y = 3.1;
  portal.add(swirl);
  const banner = new T.Mesh(
    new T.PlaneGeometry(4.8, 1.2),
    new T.MeshBasicMaterial({ map: portalSignTexture(), side: T.DoubleSide }),
  );
  banner.position.set(0, 6.2, 0);
  portal.add(banner);

  // 5. Perimeter Spike Ring around the arena border
  const count = Math.floor((2 * Math.PI * SPIKE_RADIUS) / 1.35);
  const spikeSteel = mat("#9aa8b0", 0.92, 0.22);
  const spikeTip = mat("#ff6a33", 0.45, 0.3, true);
  const spikes = new T.InstancedMesh(
    new T.ConeGeometry(0.62, 2.7, 6),
    spikeSteel,
    count,
  );
  const innerSpikes = new T.InstancedMesh(
    new T.ConeGeometry(0.42, 2.2, 5),
    spikeTip,
    count,
  );
  const d = new T.Object3D();
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const x = Math.sin(a) * (SPIKE_RADIUS + 0.55);
    const z = Math.cos(a) * (SPIKE_RADIUS + 0.55);
    d.position.set(x, 1.35, z);
    d.rotation.set(0, a, 0);
    d.updateMatrix();
    spikes.setMatrixAt(i, d.matrix);

    // Inward-angled hazard spikes pointing toward the arena floor
    const ix = Math.sin(a) * (SPIKE_RADIUS - 0.15);
    const iz = Math.cos(a) * (SPIKE_RADIUS - 0.15);
    d.position.set(ix, 0.95, iz);
    d.rotation.set(0, a, 0);
    d.rotateX(-0.72);
    d.updateMatrix();
    innerSpikes.setMatrixAt(i, d.matrix);
  }
  spikes.castShadow = true;
  innerSpikes.castShadow = true;
  group.add(spikes, innerSpikes);

  // 6. Landing Shadow Indicators (ground shadow + bullseye target + drop line)
  const shadows: T.Group[] = [];
  for (let i = 0; i < 2; i++) {
    const sg = new T.Group();
    sg.visible = false;
    const darkDisc = new T.Mesh(
      new T.CircleGeometry(2.2, 32),
      new T.MeshBasicMaterial({
        color: "#05080a",
        transparent: true,
        opacity: 0.68,
        depthWrite: false,
      }),
    );
    darkDisc.rotation.x = -Math.PI / 2;
    darkDisc.position.y = 0.05;
    darkDisc.name = "shadow-disc";
    sg.add(darkDisc);

    const targetRing = new T.Mesh(
      new T.RingGeometry(1.75, 2.25, 36),
      new T.MeshBasicMaterial({
        color: i === 0 ? "#5dffb0" : "#ff9d47",
        transparent: true,
        opacity: 0.9,
        side: T.DoubleSide,
        depthWrite: false,
      }),
    );
    targetRing.rotation.x = -Math.PI / 2;
    targetRing.position.y = 0.06;
    targetRing.name = "shadow-ring";
    sg.add(targetRing);

    const stem = new T.Mesh(
      new T.CylinderGeometry(0.06, 0.06, 1, 8),
      new T.MeshBasicMaterial({
        color: i === 0 ? "#5dffb0" : "#ff9d47",
        transparent: true,
        opacity: 0.38,
        depthWrite: false,
      }),
    );
    stem.position.y = 0.5;
    stem.name = "shadow-stem";
    sg.add(stem);

    group.add(sg);
    shadows.push(sg);
  }
  return { group, shadows, pulses, swirl, spikes, innerSpikes };
}

type Body = {
  position: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
};

/** Landing shadow indicator for each vehicle while it is airborne. */
export function updateShadows(view: HazardView, units: { body: Body }[]) {
  units.slice(0, 2).forEach((u, i) => {
    const sg = view.shadows[i];
    if (!sg) return;
    const b = u.body;
    if (b.position.y < 1.45 && Math.abs(b.velocity.y) < 2.2) {
      sg.visible = false;
      return;
    }
    const p = predictLanding(
      b.position.x,
      b.position.y,
      b.position.z,
      b.velocity.x,
      b.velocity.y,
      b.velocity.z,
      0.9,
    );
    if (!p) {
      sg.visible = false;
      return;
    }
    sg.visible = true;
    sg.position.set(p.x, 0, p.z);
    const height = Math.max(0.2, b.position.y - 0.1);
    const disc = sg.getObjectByName("shadow-disc") as T.Mesh | undefined;
    const ring = sg.getObjectByName("shadow-ring") as T.Mesh | undefined;
    const stem = sg.getObjectByName("shadow-stem") as T.Mesh | undefined;
    const scale = Math.max(0.48, 1.15 - b.position.y / 18);
    if (disc) disc.scale.setScalar(scale);
    if (ring) {
      const pulse = 1 + Math.sin(performance.now() * 0.014) * 0.1;
      ring.scale.setScalar(scale * pulse);
    }
    if (stem) {
      stem.scale.y = height;
      stem.position.y = height / 2;
    }
  });
}

export function animateHazards(view: HazardView, time: number) {
  view.pulses.forEach((m, i) => {
    m.opacity = 0.76 + 0.22 * Math.sin(time * 0.005 + i * 1.5);
  });
  view.swirl.rotation.z = time * 0.0022;
}

export function disposeHazards(view: HazardView) {
  view.group.traverse((o) => {
    if (o instanceof T.Mesh || o instanceof T.InstancedMesh) {
      if (
        o.geometry &&
        o.userData.ownedGeometry !== false &&
        !(o instanceof T.InstancedMesh)
      )
        o.geometry.dispose();
    }
  });
  view.spikes.dispose();
  view.innerSpikes.dispose();
  view.pulses.forEach((m) => {
    m.map?.dispose();
    m.dispose();
  });
  view.group.removeFromParent();
}
