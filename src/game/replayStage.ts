import * as T from "three";
import { buildArena } from "./arena";
import { buildHazards, disposeHazards, animateHazards } from "./hazardView";
import { partModel, disposeTree, animatePart } from "./models";
import { applyLivery } from "./livery";
import { DEF, type StoredReplay, type V3 } from "./data";

/* A self-contained 3D replay stage. The live replay viewer and the MP4
   exporter both use it, so a downloaded video matches what is on screen. */

function centreOfMass(parts: { pos: V3; key: string; scale: V3 }[]) {
  let x = 0,
    y = 0,
    z = 0,
    m = 0;
  for (const p of parts) {
    const w = DEF[p.key].mass * p.scale[0] * p.scale[1] * p.scale[2];
    x += p.pos[0] * w;
    y += p.pos[1] * w;
    z += p.pos[2] * w;
    m += w;
  }
  return new T.Vector3(x / m, y / m, z / m);
}

export interface ReplayStage {
  renderer: T.WebGLRenderer;
  canvas: HTMLCanvasElement;
  setSize: (w: number, h: number) => void;
  /** Poses both machines at replay time t (seconds) and renders a frame. */
  renderAt: (t: number) => void;
  dispose: () => void;
}

const qa = new T.Quaternion(),
  qb = new T.Quaternion(),
  q = new T.Quaternion(),
  off = new T.Vector3();

export function createReplayStage(
  replay: StoredReplay,
  rivalIndex: number,
  opts: { pixelRatio?: number; shadows?: boolean; crowdEvery?: number } = {},
): ReplayStage {
  const scene = new T.Scene();
  scene.background = new T.Color("#0a1013");
  scene.fog = new T.FogExp2("#0a1013", 0.006);
  const camera = new T.PerspectiveCamera(44, 16 / 9, 0.1, 1400);
  const renderer = new T.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(opts.pixelRatio ?? Math.min(devicePixelRatio, 1.4));
  renderer.shadowMap.enabled = opts.shadows ?? true;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.outputColorSpace = T.SRGBColorSpace;
  const canvas = renderer.domElement;
  scene.add(new T.HemisphereLight("#d7e9ef", "#30251c", 1.4));
  const sun = new T.DirectionalLight("#fff0d8", 2.6);
  sun.position.set(-12, 24, 10);
  sun.castShadow = opts.shadows ?? false;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -72;
  sun.shadow.camera.right = 72;
  sun.shadow.camera.top = 72;
  sun.shadow.camera.bottom = -72;
  sun.shadow.normalBias = 0.025;
  scene.add(sun);
  const rim = new T.DirectionalLight("#5fd0df", 1.8);
  rim.position.set(14, 8, -14);
  scene.add(rim);
  const arena = buildArena(scene, replay.level);
  const hazards = buildHazards(scene);

  const bodies = [replay.player, replay.rival].map((vehicle, i) => {
    const root = new T.Group();
    for (const part of vehicle.parts) {
      const model = partModel(part, i === 1, rivalIndex);
      if (i === 0) applyLivery(model, vehicle.livery);
      root.add(model);
    }
    scene.add(root);
    return root;
  });
  const coms = [
    centreOfMass(replay.player.parts),
    centreOfMass(replay.rival.parts),
  ];
  const frames = replay.frames;

  /** Interpolated pose: frames are stored every 0.2s, video runs at 30fps. */
  function pose(t: number) {
    if (!frames.length) return;
    let i = 0;
    while (i < frames.length - 2 && frames[i + 1].t <= t) i++;
    const a = frames[i],
      b = frames[Math.min(i + 1, frames.length - 1)];
    const span = Math.max(1e-6, b.t - a.t);
    const k = Math.max(0, Math.min(1, (t - a.t) / span));
    for (let u = 0; u < 2; u++) {
      const ra = u === 0 ? a.p : a.e,
        rb = u === 0 ? b.p : b.e;
      qa.set(ra[3], ra[4], ra[5], ra[6]);
      qb.set(rb[3], rb[4], rb[5], rb[6]);
      q.slerpQuaternions(qa, qb, k);
      off.copy(coms[u]).applyQuaternion(q);
      bodies[u].quaternion.copy(q);
      bodies[u].position.set(
        ra[0] + (rb[0] - ra[0]) * k - off.x,
        ra[1] + (rb[1] - ra[1]) * k - off.y,
        ra[2] + (rb[2] - ra[2]) * k - off.z,
      );
    }
  }

  const focus = new T.Vector3(),
    smooth = new T.Vector3();
  let primed = false;
  let frameNo = 0;
  let previousT = 0;
  const crowdEvery = Math.max(1, opts.crowdEvery ?? 1);
  function renderAt(t: number) {
    pose(t);
    const dt = Math.max(0, Math.min(0.1, t - previousT));
    if (t < previousT) primed = false;
    previousT = t;
    for (let u = 0; u < bodies.length; u++) {
      const velocity = dt > 1e-5
        ? bodies[u].position.distanceTo(bodies[u].userData.lastPosition ?? bodies[u].position) / dt
        : 0;
      bodies[u].userData.lastPosition = bodies[u].position.clone();
      for (const part of bodies[u].children)
        animatePart(part, dt, velocity, true, 1, false, t * 1000);
    }
    const a = bodies[0].position,
      b = bodies[1].position;
    const spread = a.distanceTo(b);
    // Keep the player's machine prominent: frame both while they are close,
    // and lean towards the player as the gap opens.
    const w = spread < 26 ? 0.5 : (0.5 * 26) / spread;
    focus.copy(a).lerp(b, w);
    if (!primed) {
      smooth.copy(focus);
      primed = true;
    } else smooth.lerp(focus, 1 - Math.exp(-dt * 9));
    const dist = Math.min(30, 13 + Math.min(spread, 26) * 0.55);
    camera.position.set(
      smooth.x + dist * 0.5,
      4.5 + dist * 0.34,
      smooth.z + dist * 0.82,
    );
    camera.lookAt(smooth.x, 1.2, smooth.z);
    if (frameNo++ % crowdEvery === 0) arena.update(t, 0.25, "Low");
    animateHazards(hazards, t * 1000);
    renderer.render(scene, camera);
  }

  return {
    renderer,
    canvas,
    setSize(w, h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
    renderAt,
    dispose() {
      disposeHazards(hazards);
      bodies.forEach(disposeTree);
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
      scene.clear();
    },
  };
}
