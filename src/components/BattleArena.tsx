"use client";
import type { Livery, RivalMemory } from "@/game/data";
import type { ControlMode } from "@/game/controls";
import { useEffect, useRef, useState } from "react";
import * as T from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  Pause,
  Play,
  Flag,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Focus,
  Gauge,
  TriangleAlert,
  Crosshair,
  ChevronsUp,
  Volume2,
  Radio,
  Zap,
  Keyboard,
  ChevronLeft,
  Smartphone,
  Monitor,
} from "lucide-react";
import {
  ArenaSimulation,
  idleInput,
  MAX_FRAME_SECONDS,
  type DriveState,
  type Outcome,
} from "@/game/simulation";
import { softContact } from "@/game/visuals";
import {
  applyLivery,
  createIdentityPanel,
  disposeIdentityPanel,
  pulseLights,
} from "@/game/livery";
import { arenaEnvironment, renderRig } from "@/game/rendering";
import { partModel, animatePart, mat, box, disposeTree } from "@/game/models";
import {
  makePart,
  opponent,
  MATERIAL_PROFILES,
  type Settings,
  type Vehicle,
  SPAWN_PLAYER,
  SPAWN_RIVAL,
} from "@/game/data";
import {
  sfx,
  playCommentary,
  updateCommentaryTime,
} from "@/game/audio";
import {
  buildHazards,
  updateShadows,
  animateHazards,
  disposeHazards,
} from "@/game/hazardView";
interface Props {
  memory?: RivalMemory;
  livery?: Livery;
  vehicle: Vehicle;
  level: number;
  engineer: string;
  settings: Settings;
  controlMode: ControlMode;
  onControlModeChange: (mode: ControlMode) => void;
  onFinish: (o: Outcome) => void;
  onExit: () => void;
}
const physical: Record<string, string> = {
  w: "KeyW",
  a: "KeyA",
  s: "KeyS",
  d: "KeyD",
  f: "KeyF",
  c: "KeyC",
  " ": "Space",
  ArrowUp: "ArrowUp",
  ArrowDown: "ArrowDown",
  ArrowLeft: "ArrowLeft",
  ArrowRight: "ArrowRight",
  Escape: "Escape",
};
const actionKeys = new Set(Object.values(physical));
const driveKeys = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
]);
const driveHelp: Record<Exclude<DriveState, "drive">, string> = {
  limited: "Low traction · wheels off the deck",
  recover: "Overturned · Action to right the buggy",
  none: "No drive parts online",
  lift: "Lift controls · hold Action and drive",
  boost: "Thruster only · press Action",
  unstable: "Support lost · handling is unstable",
  slick: "No traction · arena surface is slick",
};
export type MatchPhase = "intro" | "countdown" | "play";
const rivalLabel = (m: string) =>
  (
    ({
      engage: "CLOSING",
      kite: "KITING",
      flank: "FLANKING",
      pounce: "PUNISHING",
      retreat: "WITHDRAWING",
      fly: "AIRBORNE",
      hold: "READING",
    }) as Record<string, string>
  )[m] ?? m.toUpperCase();
const localForward = new T.Vector3(0, 0, -1);
const axisY = new T.Vector3(0, 1, 0);
export default function BattleArena(props: Props) {
  const host = useRef<HTMLDivElement>(null),
    latest = useRef(props),
    flash = useRef<HTMLDivElement>(null),
    slowLabel = useRef<HTMLSpanElement>(null),
    root = useRef<HTMLDivElement>(null),
    playerMarker = useRef<HTMLDivElement>(null),
    follow = useRef(true),
    recenterCount = useRef(0);
  latest.current = props;
  const keys = useRef(new Set<string>()),
    presses = useRef(new Map<number, { code: string; at: number }>()),
    keyPressAt = useRef(new Map<string, number>()),
    pulses = useRef(new Map<string, number>()),
    pauseRef = useRef(false),
    [paused, setPaused] = useState(false),
    [ready, setReady] = useState(false),
    [cameraFollow, setCameraFollow] = useState(true),
    [systems, setSystems] = useState({ weapons: true, mobility: true }),
    [controlsOpen, setControlsOpen] = useState(false),
    [hud, setHud] = useState({
      rivalMode: "engage" as string,
      cloneLeft: 0,
      dashLeft: 0,
      tpLeft: 0,
      airborne: false,
      hp: 1,
      max: 1,
      enemy: 1,
      emax: 1,
      energy: 100,
      time: 150,
      parts: 0,
      speed: 0,
      powerMax: 100,
      powerGen: 12,
      slick: 0,
      paint: 0,
      direction: 0,
      steer: 0,
      gas: 0,
      drive: "drive" as DriveState,
    }),
    [comment, setComment] = useState(
      "You’re driving the orange buggy. Hold W or ↑ to accelerate.",
    );
  const systemsRef = useRef(systems);
  const touchDrive = useRef({ gas: 0, steer: 0 });
  const joystickPointer = useRef<number | null>(null);
  const joystickNub = useRef<HTMLElement>(null);
  const rival = opponent(props.level);
  const [phase, setPhase] = useState<MatchPhase>(
    props.settings.cinematic ? "intro" : "countdown",
  );
  const phaseRef = useRef<MatchPhase>(phase);
  const skipRef = useRef<() => void>(() => {});
  const [countLabel, setCountLabel] = useState<string | null>(null);
  const [introBeat, setIntroBeat] = useState("");
  systemsRef.current = systems;
  phaseRef.current = phase;
  function clearControls() {
    keys.current.clear();
    presses.current.clear();
    pulses.current.clear();
    keyPressAt.current.clear();
    touchDrive.current = { gas: 0, steer: 0 };
    joystickPointer.current = null;
    if (joystickNub.current)
      joystickNub.current.style.transform = "translate(0px, 0px)";
  }
  function focusBattle() {
    root.current?.focus({ preventScroll: true });
  }
  function recenter() {
    follow.current = true;
    setCameraFollow(true);
    recenterCount.current++;
    focusBattle();
  }
  const pause = (v: boolean) => {
    pauseRef.current = v;
    setPaused(v);
    clearControls();
    if (!v) focusBattle();
  };
  useEffect(() => {
    if (!host.current) return;
    const { vehicle, level, settings } = latest.current,
      sim = new ArenaSimulation(vehicle, level, latest.current.memory),
      rig = renderRig(host.current, settings.quality, true),
      { scene, camera, canvas } = rig,
      arena = arenaEnvironment(scene, level);
    const controls = new OrbitControls(camera, canvas);
    const chaseOffset = new T.Vector3(1.8, 5.4, 15.8);
    function centerCamera(yaw = 0) {
      const f = sim.units[0].body.position;
      controls.target.set(
        f.x - Math.sin(yaw) * 5.2,
        Math.max(1.35, f.y + 0.65),
        f.z - Math.cos(yaw) * 5.2,
      );
      camera.position
        .copy(chaseOffset)
        .applyAxisAngle(axisY, yaw)
        .add(controls.target);
      controls.update();
    }
    controls.maxPolarAngle = Math.PI * 0.459;
    controls.minPolarAngle = 0.24;
    controls.minDistance = 7.5;
    controls.maxDistance = 60;
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.enabled = !latest.current.settings.cinematic;
    centerCamera();
    let lastCenter = recenterCount.current;
    // Cinematic arrival: a fixed collection of shots, picked per match.
    const intensity = (settings.cameraIntensity ?? 100) / 100;
    const calm = settings.reducedMotion === true;
    const shot = (
      pos: [number, number, number],
      look: [number, number, number],
      dur: number,
      fov?: number,
    ) => ({
      pos: new T.Vector3(...pos),
      look: new T.Vector3(...look),
      dur,
      fov,
    });
    const crowdShots = [
      [
        shot([34, 13, 30], [46, 7, 12], 1.9),
        shot([-38, 15, -14], [-49, 6, -28], 1.9),
      ],
      [
        shot([-30, 16, 34], [-42, 8, 44], 2),
        shot([40, 12, -26], [50, 6, -38], 1.8),
      ],
    ];
    const sweepShots = [
      [shot([4, 30, -66], [0, 2, 0], 2.4), shot([64, 24, 46], [0, 2, 0], 2.2)],
      [shot([-58, 26, 50], [0, 2, 0], 2.3), shot([12, 22, 66], [0, 2, 0], 2.2)],
    ];
    const pick = <T,>(list: T[]) =>
      list[Math.floor(Math.random() * list.length)];
    const establish = shot([0, 58, 84], [0, 4, 0], 2.9, 52);
    const flyover = pick(crowdShots);
    const sweep = pick(sweepShots);
    const playerClose = shot(
      [SPAWN_PLAYER[0] + 5.6, 3.1, SPAWN_PLAYER[2] + 6.4],
      [SPAWN_PLAYER[0], 1.1, SPAWN_PLAYER[2]],
      2,
      38,
    );
    const rivalClose = shot(
      [SPAWN_RIVAL[0] - 5.4, 3, SPAWN_RIVAL[2] - 6.2],
      [SPAWN_RIVAL[0], 1.1, SPAWN_RIVAL[2]],
      2,
      38,
    );
    const finale = shot([SPAWN_PLAYER[0] + 1.8, 6.8, SPAWN_PLAYER[2] + 10.6], [0, 1.4, 12], 1.8, 48);
    const sequence = [
      establish,
      ...flyover,
      ...sweep,
      playerClose,
      rivalClose,
      finale,
    ];
    const introLines = [
      "Welcome to the V.M.D. Championship!",
      "The arena is open. Engines at the ready.",
      `${rival.name} brings the ${rival.vehicle.name} into the blue corner.`,
      "Engineers... prepare your machines!",
    ];
    let introTime = 0;
    let phaseClock = performance.now();
    let introIndex = -1;
    let countIndex = -1;
    let countTime = 0;
    let ending = false,
      hitCommentCount = 0,
      lastHitCommentAt = -Infinity,
      buildUpCommentPlayed = false,
      rivalryCommentPlayed = false,
      phenomenalCommentPlayed = false,
      victoryCommentPlayed = false,
      time = performance.now(),
      raf = 0,
      hudAt = 0,
      motorAt = 0,
      shake = 0,
      cheer = 0,
      slowUntil = 0,
      smokeClock = 0;
    const shadows = sim.units.map(() => {
      const s = softContact(4.2, 5.8, 0.77);
      scene.add(s);
      return s;
    });
    const units = sim.units.map((u) =>
      u.parts.map((p) => {
        const mesh = partModel(p.part, !!u.index, (level - 1) % 4);
        if (u.index === 0) applyLivery(mesh, latest.current.livery);
        mesh.traverse((c) => {
          if (c instanceof T.Mesh) c.userData.fallback = true;
        });
        scene.add(mesh);
        return mesh;
      }),
    );
    const hazards = buildHazards(scene);
    let cloneGroup: T.Group | null = null;
    const playerRoot = new T.Group();
    scene.add(playerRoot);
    const identityPanel = latest.current.livery
      ? createIdentityPanel(latest.current.livery)
      : null;
    if (identityPanel) playerRoot.add(identityPanel);
    const exhaustCount = settings.quality === "Low" ? 30 : 70;
    const exhaustPos = new Float32Array(exhaustCount * 3);
    const exhaustVel = new Float32Array(exhaustCount * 3);
    const exhaustLife = new Float32Array(exhaustCount);
    exhaustPos.fill(-100);
    const exhaustGeo = new T.BufferGeometry();
    exhaustGeo.setAttribute("position", new T.BufferAttribute(exhaustPos, 3));
    const exhaustColor = (
      {
        smoke: "#9aa5a6",
        flame: "#ff8a3d",
        spark: "#ffd67b",
        ice: "#80e9ff",
      } as Record<string, string>
    )[latest.current.livery?.exhaust ?? "flame"];
    const exhaustMat = new T.PointsMaterial({
      color: exhaustColor,
      size: 0.22,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    });
    const exhaust = new T.Points(exhaustGeo, exhaustMat);
    exhaust.frustumCulled = false;
    scene.add(exhaust);
    let exhaustClock = 0,
      exhaustIndex = 0;
    const boxes = sim.obstacles.map((o, i) => {
      const mesh = partModel(makePart(`box${i}`, "crate", [0, 0, 0]));
      mesh.scale.setScalar(o.size);
      mesh.traverse((c) => {
        if (c instanceof T.Mesh) c.userData.fallback = true;
      });
      scene.add(mesh);
      return mesh;
    });
    const shots: T.Mesh[] = [];
    const debrisMeshes = sim.extraDebris.map((d) => {
      const mesh = new T.Mesh(
        new T.BoxGeometry(1.24, 0.07, 0.28),
        mat(d.color, 0.75, 0.32),
      );
      mesh.castShadow = true;
      mesh.userData.fallback = true;
      mesh.userData.ownedGeometry = true;
      scene.add(mesh);
      return mesh;
    });
    const eggG = new T.SphereGeometry(0.24, 10, 8),
      pillowG = new T.BoxGeometry(0.65, 0.34, 0.55);
    const particleCount = settings.quality === "Low" ? 48 : 144,
      particles = new Float32Array(particleCount * 3),
      vel = new Float32Array(particleCount * 3),
      lives = new Float32Array(particleCount);
    particles.fill(-100);
    const pg = new T.BufferGeometry();
    pg.setAttribute("position", new T.BufferAttribute(particles, 3));
    const pm = new T.PointsMaterial({
      color: "#ffb958",
      size: 0.1,
      transparent: true,
      opacity: 0.94,
      depthWrite: false,
    });
    const sparks = new T.Points(pg, pm);
    sparks.frustumCulled = false;
    scene.add(sparks);
    let particle = 0;
    const smokeCount = settings.quality === "Low" ? 34 : 82;
    const smokePos = new Float32Array(smokeCount * 3),
      smokeVel = new Float32Array(smokeCount * 3),
      smokeLife = new Float32Array(smokeCount);
    smokePos.fill(-100);
    const smokeGeo = new T.BufferGeometry();
    smokeGeo.setAttribute("position", new T.BufferAttribute(smokePos, 3));
    const smokeMat = new T.PointsMaterial({
      color: "#8a918d",
      size: 0.14,
      transparent: true,
      opacity: 0.36,
      depthWrite: false,
    });
    const smoke = new T.Points(smokeGeo, smokeMat);
    smoke.frustumCulled = false;
    scene.add(smoke);
    let smokeIndex = 0;
    const beam = new T.Mesh(
      new T.CylinderGeometry(0.07, 0.07, 1, 8),
      mat("#90fff5", 0.15, 0.15, true),
    );
    beam.visible = false;
    scene.add(beam);
    let beamLife = 0;
    const target = new T.Vector3(),
      delta = new T.Vector3(),
      offset = new T.Vector3(),
      aim = new T.Vector3(),
      marker = new T.Vector3(),
      q = new T.Quaternion(),
      pq = new T.Quaternion();
    const keyCode = (e: KeyboardEvent) =>
      actionKeys.has(e.code)
        ? e.code
        : physical[e.key?.toLowerCase()] || physical[e.key];
    const keyDown = (e: KeyboardEvent) => {
      if (e.code === "KeyH" && !e.repeat) {
        e.preventDefault();
        sfx("horn", latest.current.livery?.horn ?? "stock");
        return;
      }
      if (e.code === "Digit1" || e.code === "Digit2") {
        if (!e.repeat && !pauseRef.current) {
          e.preventDefault();
          setSystems((s) =>
            e.code === "Digit1"
              ? { ...s, weapons: !s.weapons }
              : { ...s, mobility: !s.mobility },
          );
        }
        return;
      }
      const code = keyCode(e);
      if (code === "Escape" && !e.repeat) {
        e.preventDefault();
        pause(!pauseRef.current);
        return;
      }
      if (!code || pauseRef.current || e.altKey || e.ctrlKey || e.metaKey)
        return;
      e.preventDefault();
      if (code === "KeyC") {
        if (!e.repeat) recenter();
        return;
      }
      if (!keys.current.has(code))
        keyPressAt.current.set(code, performance.now());
      keys.current.add(code);
    };
    const keyUp = (e: KeyboardEvent) => {
      const code = keyCode(e);
      if (keys.current.delete(code) && driveKeys.has(code)) {
        const now = performance.now();
        if (now - (keyPressAt.current.get(code) ?? 0) < 95)
          pulses.current.set(code, now + 110);
      }
      keyPressAt.current.delete(code);
    };
    const hidden = () => {
      if (document.hidden) pause(true);
    };
    const blur = () => clearControls();
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", hidden);
    let orbitPress: { id: number; x: number; y: number } | null = null;
    const down = (e: PointerEvent) => {
      if (pauseRef.current) return;
      focusBattle();
      if (!orbitPress)
        orbitPress = { id: e.pointerId, x: e.clientX, y: e.clientY };
      if (e.pointerType === "mouse" && e.button === 0)
        presses.current.set(e.pointerId, {
          code: "MouseFire",
          at: performance.now(),
        });
    };
    const move = (e: PointerEvent) => {
      if (
        orbitPress?.id !== e.pointerId ||
        Math.hypot(e.clientX - orbitPress.x, e.clientY - orbitPress.y) <= 7
      )
        return;
      presses.current.delete(e.pointerId);
      if (follow.current) {
        follow.current = false;
        setCameraFollow(false);
      }
    };
    const up = (e: PointerEvent) => {
      if (presses.current.get(e.pointerId)?.code === "MouseFire")
        presses.current.delete(e.pointerId);
      if (orbitPress?.id === e.pointerId) orbitPress = null;
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const now = performance.now(),
        dt = Math.min(MAX_FRAME_SECONDS, (now - time) / 1000);
      time = now;
      if (pauseRef.current || ending) return;
      if (phaseRef.current !== "play") {
        const dtC = Math.min(0.5, (now - phaseClock) / 1000);
        phaseClock = now;
        if (phaseRef.current === "intro") {
          introTime += dtC;
          let acc = 0;
          let index = 0;
          while (
            index < sequence.length - 1 &&
            introTime > acc + sequence[index].dur
          ) {
            acc += sequence[index].dur;
            index++;
          }
          const current = sequence[index];
          const next = sequence[Math.min(index + 1, sequence.length - 1)];
          const local = Math.min(1, (introTime - acc) / current.dur);
          const eased = local * local * (3 - 2 * local);
          camera.position.lerpVectors(current.pos, next.pos, eased);
          const lookTarget = current.look.clone().lerp(next.look, eased);
          if (!calm) {
            camera.position.x += Math.sin(now * 0.0031) * 0.35 * intensity;
            camera.position.y += Math.cos(now * 0.0027) * 0.22 * intensity;
          }
          camera.lookAt(lookTarget);
          const wantFov = current.fov ?? 50;
          if (Math.abs(camera.fov - wantFov) > 0.05) {
            camera.fov += (wantFov - camera.fov) * 0.08;
            camera.updateProjectionMatrix();
          }
          if (index !== introIndex) {
            introIndex = index;
            const line =
              introLines[
                Math.min(
                  introLines.length - 1,
                  Math.floor((index / sequence.length) * introLines.length),
                )
            ];
            setIntroBeat(line);
            if (index === 1) sfx("cheer");
          }
          skipRef.current = () => {
            introTime = sequence.reduce((a, s) => a + s.dur, 0) + 0.01;
          };
          if (introTime > sequence.reduce((a, s) => a + s.dur, 0)) {
            phaseRef.current = "countdown";
            setPhase("countdown");
            countIndex = -1;
            countTime = 0;
            camera.fov = 48;
            camera.updateProjectionMatrix();
            centerCamera(0);
          }
        } else if (phaseRef.current === "countdown") {
          countTime += dtC;
          const step = Math.floor(countTime / 0.92);
          if (step !== countIndex && step <= 3) {
            countIndex = step;
            const labels = ["3", "2", "1", "FIGHT!"];
            setCountLabel(labels[step]);
            sfx(step === 3 ? "fight" : "countdown");
            if (step < 3) sfx("cheer");
            shake = Math.max(shake, step === 3 ? 0.5 : 0.34);
          }
          if (countIndex === 3 && countTime > 0.92 + 1.05) {
            phaseRef.current = "play";
            setPhase("play");
            setCountLabel(null);
            setIntroBeat("");
            controls.enabled = true;
            centerCamera(0);
            sfx("cheer");
          }
        }
        animateHazards(hazards, now);
        arena.update(now, 0.5, settings.crowdQuality);
        rig.render(dt);
        return;
      }
      const k = keys.current,
        input = idleInput();
      const held = (code: string) => {
        if (k.has(code)) return true;
        for (const press of presses.current.values())
          if (press.code === code) return true;
        const until = pulses.current.get(code);
        if (until === undefined) return false;
        if (until > now) return true;
        pulses.current.delete(code);
        return false;
      };
      input.gas = Math.max(
        -1,
        Math.min(
          1,
          Number(held("KeyW") || held("ArrowUp")) -
            Number(held("KeyS") || held("ArrowDown")) +
            touchDrive.current.gas,
        ),
      );
      input.steer = Math.max(
        -1,
        Math.min(
          1,
          Number(held("KeyA") || held("ArrowLeft")) -
            Number(held("KeyD") || held("ArrowRight")) +
            touchDrive.current.steer,
        ),
      );
      input.fire = held("KeyF") || held("MouseFire");
      input.action = held("Space");
      input.weapons = systemsRef.current.weapons;
      input.mobility = systemsRef.current.mobility;
      sim.advance(dt * (now < slowUntil ? 0.34 : 1), input);
      updateCommentaryTime(sim.time);
      sim.units.forEach((u, i) => {
        shadows[i].position.set(u.body.position.x, 0.034, u.body.position.z);
        shadows[i].rotation.z = -Math.atan2(
          2 *
            (u.body.quaternion.w * u.body.quaternion.y +
              u.body.quaternion.x * u.body.quaternion.z),
          1 - 2 * (u.body.quaternion.y ** 2 + u.body.quaternion.z ** 2),
        );
        (shadows[i].material as T.MeshBasicMaterial).opacity = Math.min(
          0.77,
          1.15 / Math.max(0.5, u.body.position.y),
        );
        q.set(
          u.body.quaternion.x,
          u.body.quaternion.y,
          u.body.quaternion.z,
          u.body.quaternion.w,
        );
        aim.copy(localForward).applyQuaternion(q);
        const wheelSpeed =
          u.body.velocity.x * aim.x + u.body.velocity.z * aim.z;
        u.parts.forEach((p, j) => {
          const mesh = units[i][j],
            b = p.debris;
          if (b) {
            mesh.position.copy(b.position);
            mesh.quaternion.copy(b.quaternion);
            animatePart(mesh, dt, b.angularVelocity.length(), false, 0, false);
          } else {
            const pos = sim.point(u, p);
            mesh.position.copy(pos);
            pq.set(
              p.orientation.x,
              p.orientation.y,
              p.orientation.z,
              p.orientation.w,
            );
            mesh.quaternion.copy(q).multiply(pq);
            animatePart(mesh, dt, wheelSpeed, p.active > 0 || u.airtime > 0);
          }
        });
      });
      smokeClock -= dt;
      if (smokeClock <= 0) {
        smokeClock = 0.11;
        for (const u of sim.units)
          for (const p of u.parts) {
            if (
              p.hp <= 0 ||
              p.hp / p.max > 0.45 ||
              (p.hp > 0 && Math.random() < 0.32)
            )
              continue;
            const at = sim.point(u, p),
              i = smokeIndex++ % smokeCount;
            smokePos[i * 3] = at.x;
            smokePos[i * 3 + 1] = at.y + 0.15;
            smokePos[i * 3 + 2] = at.z;
            smokeVel[i * 3] = (Math.random() - 0.5) * 0.35;
            smokeVel[i * 3 + 1] = 0.45 + Math.random() * 0.65;
            smokeVel[i * 3 + 2] = (Math.random() - 0.5) * 0.35;
            smokeLife[i] = 1.2 + Math.random();
          }
      }
      for (let i = 0; i < smokeCount; i++) {
        if (smokeLife[i] > 0) {
          smokeLife[i] -= dt;
          smokePos[i * 3] += smokeVel[i * 3] * dt;
          smokePos[i * 3 + 1] += smokeVel[i * 3 + 1] * dt;
          smokePos[i * 3 + 2] += smokeVel[i * 3 + 2] * dt;
          smokeVel[i * 3 + 1] *= 0.996;
        } else smokePos[i * 3 + 1] = -100;
      }
      smokeGeo.attributes.position.needsUpdate = true;
      updateShadows(hazards, sim.units);
      animateHazards(hazards, now);
      if (sim.clone && !cloneGroup) {
        cloneGroup = new T.Group();
        for (const p of sim.clone.parts) {
          const m = partModel(p.part, false, 0);
          applyLivery(m, latest.current.livery);
          m.traverse((c) => {
            if (c instanceof T.Mesh) {
              c.userData.fallback = true;
              const cm = (c.material as T.MeshStandardMaterial).clone();
              cm.transparent = true;
              cm.opacity = 0.7;
              cm.emissive = new T.Color("#5fd8ff");
              cm.emissiveIntensity = 0.15;
              c.material = cm;
              c.userData.ownedMaterial = true;
            }
          });
          cloneGroup.add(m);
        }
        scene.add(cloneGroup);
      }
      if (!sim.clone && cloneGroup) {
        scene.remove(cloneGroup);
        disposeTree(cloneGroup);
        cloneGroup = null;
      }
      if (sim.clone && cloneGroup) {
        const c = sim.clone;
        const cq = new T.Quaternion(
          c.body.quaternion.x,
          c.body.quaternion.y,
          c.body.quaternion.z,
          c.body.quaternion.w,
        );
        c.parts.forEach((p, j) => {
          const m = cloneGroup!.children[j];
          if (!m) return;
          if (p.debris) {
            m.position.set(
              p.debris.position.x,
              p.debris.position.y,
              p.debris.position.z,
            );
            m.quaternion.set(
              p.debris.quaternion.x,
              p.debris.quaternion.y,
              p.debris.quaternion.z,
              p.debris.quaternion.w,
            );
            return;
          }
          const pos = sim.point(c, p);
          m.position.set(pos.x, pos.y, pos.z);
          m.quaternion
            .copy(cq)
            .multiply(
              new T.Quaternion(
                p.orientation.x,
                p.orientation.y,
                p.orientation.z,
                p.orientation.w,
              ),
            );
          animatePart(m, dt, c.body.velocity.length(), p.active > 0 || c.airtime > 0);
        });
      }
      const pb = sim.units[0].body;
      playerRoot.position.set(pb.position.x, pb.position.y, pb.position.z);
      q.set(pb.quaternion.x, pb.quaternion.y, pb.quaternion.z, pb.quaternion.w);
      playerRoot.quaternion.copy(q);
      exhaustClock -= dt;
      if (
        exhaustClock <= 0 &&
        (pb.velocity.length() > 2 || sim.units[0].boostTimer > 0)
      ) {
        exhaustClock = 0.07;
        const i = exhaustIndex++ % exhaustCount;
        aim.copy(localForward).applyQuaternion(q);
        exhaustPos[i * 3] = pb.position.x - aim.x * 1.9;
        exhaustPos[i * 3 + 1] = pb.position.y + 0.25;
        exhaustPos[i * 3 + 2] = pb.position.z - aim.z * 1.9;
        exhaustVel[i * 3] = -aim.x * 2 + (Math.random() - 0.5);
        exhaustVel[i * 3 + 1] = 0.8 + Math.random();
        exhaustVel[i * 3 + 2] = -aim.z * 2 + (Math.random() - 0.5);
        exhaustLife[i] = 0.65;
      }
      for (let i = 0; i < exhaustCount; i++) {
        if (exhaustLife[i] > 0) {
          exhaustLife[i] -= dt;
          exhaustPos[i * 3] += exhaustVel[i * 3] * dt;
          exhaustPos[i * 3 + 1] += exhaustVel[i * 3 + 1] * dt;
          exhaustPos[i * 3 + 2] += exhaustVel[i * 3 + 2] * dt;
        } else exhaustPos[i * 3 + 1] = -100;
      }
      exhaustGeo.attributes.position.needsUpdate = true;
      for (const model of units[0]) pulseLights(model, now);
      sim.extraDebris.forEach((d, i) => {
        const mesh = debrisMeshes[i];
        if (!mesh) return;
        mesh.position.copy(d.body.position);
        mesh.quaternion.copy(d.body.quaternion);
      });
      sim.obstacles.forEach((o, i) => {
        boxes[i].visible = o.alive;
        if (o.alive) {
          boxes[i].position.copy(o.body.position);
          boxes[i].quaternion.copy(o.body.quaternion);
        }
      });
      for (const s of sim.shots) {
        let m = shots[s.id];
        if (!m) {
          m = new T.Mesh(eggG, mat("#f2e8cc", 0.11, 0.37));
          m.castShadow = true;
          m.userData.fallback = true;
          scene.add(m);
          shots[s.id] = m;
        }
        m.visible = s.active;
        if (s.active) {
          m.position.copy(s.body.position);
          m.quaternion.copy(s.body.quaternion);
          m.geometry = s.kind === "pillow" ? pillowG : eggG;
          m.scale.set(1, s.kind === "egg" ? 1.35 : 1, 1);
          m.material = mat(s.color ?? "#f2e8cc", s.status ? 0.05 : 0.32, 0.5);
        }
      }
      for (const event of sim.events) {
        if (event.type === "comment") {
          setComment(event.text || "");
          const line = (event.text || "").toLowerCase();
          if (/clean hit|takes a hit/.test(line)) {
            if (sim.time - lastHitCommentAt > 14) hitCommentCount = 0;
            lastHitCommentAt = sim.time;
            hitCommentCount++;
            if (
              !victoryCommentPlayed &&
              sim.health(sim.units[1]) / sim.units[1].max < 0.2
            ) {
              victoryCommentPlayed = true;
              playCommentary("victory", sim.time);
            } else {
              playCommentary(
                hitCommentCount === 1
                  ? "first-hit"
                  : hitCommentCount === 2
                    ? "hit-streak"
                    : "hot-streak",
                sim.time,
              );
            }
          } else if (/barely holding together|helpless/.test(line)) {
            playCommentary("helpless", sim.time);
          } else if (/fifteen seconds/.test(line)) {
            playCommentary("late-fight", sim.time);
          } else if (/hits a dash pad/.test(line)) {
            playCommentary("hit", sim.time);
          } else if (/pip loses the/.test(line)) {
            playCommentary("opponent", sim.time);
          } else if (/detached|loses the|lets go of/.test(line)) {
            playCommentary("destructive", sim.time);
          } else if (/rival|portal clone|dash pad|spike ring/.test(line)) {
            if (sim.time < 24 && !buildUpCommentPlayed) {
              buildUpCommentPlayed = true;
              playCommentary("build-up", sim.time);
            } else if (sim.time >= 24 && !rivalryCommentPlayed) {
              rivalryCommentPlayed = true;
              playCommentary("rivalry", sim.time);
            }
          } else if (/jams|slides|traction|compromised|confetti/.test(line)) {
            playCommentary("interesting", sim.time);
          } else if (/fires the|airborne|jump mechanism/.test(line)) {
            playCommentary("interesting", sim.time);
          } else if (/hit/.test(line)) {
            playCommentary("hit", sim.time);
          } else if (sim.time > 50 && !phenomenalCommentPlayed) {
            phenomenalCommentPlayed = true;
            playCommentary("phenomenal", sim.time);
          }
          continue;
        }
        if (event.type === "fire") {
          sfx("fire");
          continue;
        }
        if (event.type === "lift") {
          sfx("lift");
          sfx("crowd");
          cheer = 1;
          continue;
        }
        if ((event.type === "rail" || event.type === "ray") && event.to) {
          const a = new T.Vector3(...event.pos),
            b = new T.Vector3(...event.to);
          beam.position.copy(a).add(b).multiplyScalar(0.5);
          const v = b.sub(a);
          beam.scale.y = v.length();
          beam.quaternion.setFromUnitVectors(
            new T.Vector3(0, 1, 0),
            v.normalize(),
          );
          beam.visible = true;
          beamLife = 0.16;
          sfx("rail");
          continue;
        }
        if (event.type === "jam") {
          sfx("jam");
          shake = Math.max(shake, 0.11);
          const jam = document.querySelector(".jam-flash");
          if (jam) jam.classList.remove("show");
          if (jam) {
            void (jam as HTMLElement).offsetWidth;
            jam.classList.add("show");
          }
          continue;
        }
        const big = event.type === "break" || event.type === "obstacle";
        shake = Math.max(shake, big ? 0.21 : 0.07);
        if (big) {
          sfx("break", event.material);
          sfx("crowd");
          cheer = 1;
          if (event.critical) {
            slowUntil = now + 540;
            const f = flash.current;
            if (f) {
              f.classList.remove("active");
              void f.offsetWidth;
              f.classList.add("active");
              setTimeout(() => f.classList.remove("active"), 720);
            }
            if (slowLabel.current)
              slowLabel.current.textContent = `${event.label ?? "Critical failure"} — ${event.material ? (MATERIAL_PROFILES[event.material as keyof typeof MATERIAL_PROFILES]?.label ?? event.material) : "structural"} failure`;
          }
        } else {
          const wet = event.status === "slick";
          sfx(wet ? "splash" : "impact");
          pm.color.setHex(
            event.material === "wood" || event.material === "hardwood"
              ? 0xd8a264
              : event.material === "stone" || event.material === "ceramic"
                ? 0xb8b0a1
                : 0xffb958,
          );
        }
        const clash = event.type === "impact" && event.clash === true;
        // The crisp, bright metal burst is reserved for opposing dash contact.
        // Other impacts can still kick up debris on breaks, but never sparks.
        for (let n = 0; n < (clash ? 22 : big ? 26 : 0); n++) {
          const i = particle++ % particleCount;
          for (let a = 0; a < 3; a++) {
            particles[i * 3 + a] = event.pos[a];
            vel[i * 3 + a] = (Math.random() - 0.5) * (clash ? 12 : 9);
          }
          vel[i * 3 + 1] = clash ? 1.2 + Math.random() * 3.2 : 2 + Math.random() * 5;
          lives[i] = clash ? 0.16 + Math.random() * 0.22 : 0.3 + Math.random() * 0.55;
        }
      }
      sim.events.length = 0;
      for (let i = 0; i < particleCount; i++) {
        if (lives[i] > 0) {
          lives[i] -= dt;
          vel[i * 3 + 1] -= 12 * dt;
          for (let a = 0; a < 3; a++)
            particles[i * 3 + a] += vel[i * 3 + a] * dt;
        } else particles[i * 3 + 1] = -100;
      }
      pg.attributes.position.needsUpdate = true;
      beamLife -= dt;
      beam.visible = beamLife > 0;
      cheer = Math.max(0, cheer - dt * 0.65);
      arena.update(now, cheer, settings.crowdQuality);
      shake = Math.max(0, shake - dt * 0.7);
      const body = sim.units[0].body,
        a = body.position;
      q.set(
        body.quaternion.x,
        body.quaternion.y,
        body.quaternion.z,
        body.quaternion.w,
      );
      aim.copy(localForward).applyQuaternion(q);
      aim.y = 0;
      if (aim.lengthSq() < 0.001) aim.set(0, 0, -1);
      else aim.normalize();
      const yaw = Math.atan2(-aim.x, -aim.z);
      if (phaseRef.current === "play" && lastCenter !== recenterCount.current) {
        centerCamera(yaw);
        lastCenter = recenterCount.current;
      }
      const lead = follow.current ? 5.2 : 0.85;
      target.set(
        a.x + aim.x * lead,
        Math.max(1.35, a.y + 0.65),
        a.z + aim.z * lead,
      );
      if (settings.shake && shake > 0) {
        target.x += (Math.random() - 0.5) * shake;
        target.y += (Math.random() - 0.5) * shake;
      }
      delta
        .copy(target)
        .sub(controls.target)
        .multiplyScalar(1 - Math.exp(-dt * 7.5));
      controls.target.add(delta);
      camera.position.add(delta);
      if (follow.current) {
        offset.copy(camera.position).sub(controls.target);
        const angle =
          yaw +
          Math.atan2(chaseOffset.x, chaseOffset.z) -
          Math.atan2(offset.x, offset.z);
        offset.applyAxisAngle(
          axisY,
          Math.atan2(Math.sin(angle), Math.cos(angle)) *
            (1 - Math.exp(-dt * 3.25)),
        );
        camera.position.copy(controls.target).add(offset);
      }
      controls.update();
      if (playerMarker.current) {
        camera.updateMatrixWorld();
        marker.set(a.x, a.y + 1.86, a.z).project(camera);
        const visible =
          marker.z > -1 &&
          marker.z < 1 &&
          Math.abs(marker.x) < 0.9 &&
          Math.abs(marker.y) < 0.72;
        playerMarker.current.hidden = !visible;
        if (visible) {
          playerMarker.current.style.left = `${(marker.x + 1) * 50}%`;
          playerMarker.current.style.top = `${(1 - marker.y) * 50}%`;
        }
      }
      rig.render(dt);
      if (input.gas && now - motorAt > 235) {
        sfx("engine");
        motorAt = now;
      }
      if (now - hudAt > 100) {
        const [a, b] = sim.units;
        setHud({
          rivalMode: sim.rivalMode,
          cloneLeft: sim.clone ? Math.ceil(sim.cloneTimer) : 0,
          dashLeft: a.dashTimer > 0 ? +a.dashTimer.toFixed(1) : 0,
          tpLeft: a.teleportCooldown > 0 ? Math.ceil(a.teleportCooldown) : 0,
          airborne: a.body.position.y > 1.55,
          hp: sim.health(a),
          max: a.max,
          enemy: sim.health(b),
          emax: b.max,
          energy: Math.round(a.energy),
          time: Math.max(0, Math.ceil(sim.duration - sim.time)),
          parts: a.parts.filter((p) => p.hp > 0).length,
          powerMax: Math.round(a.powerMax),
          powerGen: Math.round(a.powerGen),
          slick: a.status.slick,
          paint: a.status.paint,
          speed: Math.round(
            Math.hypot(a.body.velocity.x, a.body.velocity.z) * 3.6,
          ),
          direction: Math.round(((yaw * 180) / Math.PI + 360) % 360),
          steer: input.steer,
          gas: input.gas,
          drive: a.driveState,
        });
        hudAt = now;
      }
      if (sim.finished && !ending) {
        ending = true;
        sfx(sim.finished.win ? "win" : "lose");
        sfx("crowd");
        playCommentary(sim.finished.win ? "kablam" : "end", sim.time);
        latest.current.onFinish(sim.finished);
      }
    };
    setReady(true);
    focusBattle();
    sfx("start");
    sfx("crowd");
    frame();
    return () => {
      cancelAnimationFrame(raf);
      clearControls();
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", hidden);
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      controls.dispose();
      pg.dispose();
      pm.dispose();
      smokeGeo.dispose();
      smokeMat.dispose();
      exhaustGeo.dispose();
      exhaustMat.dispose();
      disposeHazards(hazards);
      if (cloneGroup) {
        scene.remove(cloneGroup);
        disposeTree(cloneGroup);
      }
      if (identityPanel) disposeIdentityPanel(identityPanel);
      eggG.dispose();
      pillowG.dispose();
      units.forEach((list) => list.forEach(disposeTree));
      debrisMeshes.forEach((m) => {
        m.geometry.dispose();
        (m.material as T.Material).dispose();
        scene.remove(m);
      });
      rig.dispose();
    };
  }, []);
  const hold = (code: string) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0 || pauseRef.current) return;
      e.preventDefault();
      focusBattle();
      e.currentTarget.setPointerCapture(e.pointerId);
      presses.current.set(e.pointerId, { code, at: performance.now() });
    },
    onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => {
      const press = presses.current.get(e.pointerId);
      if (
        press &&
        driveKeys.has(press.code) &&
        performance.now() - press.at < 125
      )
        pulses.current.set(press.code, performance.now() + 170);
      presses.current.delete(e.pointerId);
    },
    onPointerCancel: (e: React.PointerEvent<HTMLButtonElement>) => {
      presses.current.delete(e.pointerId);
    },
    onLostPointerCapture: (e: React.PointerEvent<HTMLButtonElement>) => {
      presses.current.delete(e.pointerId);
    },
  });
  const moveJoystick = (e: React.PointerEvent<HTMLDivElement>) => {
    if (joystickPointer.current !== e.pointerId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const radius = Math.min(rect.width, rect.height) * 0.36;
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    const length = Math.hypot(dx, dy);
    const scale = length > radius ? radius / length : 1;
    const x = dx * scale;
    const y = dy * scale;
    if (joystickNub.current)
      joystickNub.current.style.transform = `translate(${x}px, ${y}px)`;
    touchDrive.current = {
      steer: -x / radius,
      gas: -y / radius,
    };
  };
  const releaseJoystick = (e: React.PointerEvent<HTMLDivElement>) => {
    if (joystickPointer.current !== e.pointerId) return;
    joystickPointer.current = null;
    touchDrive.current = { gas: 0, steer: 0 };
    if (joystickNub.current)
      joystickNub.current.style.transform = "translate(0px, 0px)";
  };
  return (
    <div
      className="battle-screen"
      data-controls={props.controlMode}
      ref={root}
      tabIndex={-1}
      aria-label="VMD live arena"
    >
      <div className="arena-canvas" ref={host} />
      {phase !== "play" && (
        <>
          <div className="cinema-bar top" aria-hidden="true" />
          <div className="cinema-bar bottom" aria-hidden="true" />
          <div className="intro-beat">{introBeat}</div>
          <button className="intro-skip" onClick={() => skipRef.current()}>
            SKIP
          </button>
        </>
      )}
      {countLabel && (
        <div
          className={`countdown-numeral${countLabel === "FIGHT!" ? " fight" : ""}`}
          key={countLabel}
        >
          <span className="countdown-ring" />
          <b>{countLabel}</b>
        </div>
      )}
      <div
        className="player-locator"
        ref={playerMarker}
        hidden
        aria-hidden="true"
      >
        <span>YOU</span>
        <i />
      </div>
      <div className="battle-topline">
        <span className="eyebrow">
          <i className="live-dot" /> LIVE ARENA FEED
        </span>
        <span>
          VMD CHAMPIONSHIP <b>//</b> ROUND{" "}
          {String(props.level).padStart(2, "0")}
        </span>
        <div className="arena-toolbar">
          <button
            className={`system-toggle ${systems.weapons ? "on" : ""}`}
            type="button"
            onClick={() => setSystems((s) => ({ ...s, weapons: !s.weapons }))}
            title="Toggle weapons power (1)"
            aria-label="Toggle weapons power"
            aria-pressed={systems.weapons}
          >
            <Crosshair size={12} />
            WPN
          </button>
          <button
            className={`system-toggle ${systems.mobility ? "on" : ""}`}
            type="button"
            onClick={() => setSystems((s) => ({ ...s, mobility: !s.mobility }))}
            title="Toggle mobility power (2)"
            aria-label="Toggle mobility power"
            aria-pressed={systems.mobility}
          >
            <Gauge size={12} />
            DRV
          </button>
          <button
            className={`icon-btn ${cameraFollow ? "following" : ""}`}
            type="button"
            onClick={recenter}
            title="Center follow camera (C)"
            aria-label="Center follow camera"
          >
            <Focus size={17} />
          </button>
          <button
            className="icon-btn"
            title="Pause match"
            aria-label="Pause match"
            onClick={() => pause(true)}
          >
            <Pause size={18} />
          </button>
        </div>
      </div>
      <div className="battle-scores">
        <div className="fighter-score">
          <img src="/arts/pip.webp" alt="Pip" />
          <div>
            <small>PLAYER 01</small>
            <h3>{props.engineer}</h3>
            <div className="hp-track">
              <i style={{ width: `${(hud.hp / hud.max) * 100}%` }} />
            </div>
            <span>
              {hud.hp} / {hud.max} HP
            </span>
          </div>
        </div>
        <div className="round-timer">
          <small>ROUND TIME</small>
          <strong>
            {Math.floor(hud.time / 60)}:{String(hud.time % 60).padStart(2, "0")}
          </strong>
        </div>
        <div className="fighter-score rival">
          <img src={`/arts/${rival.art}.webp`} alt={rival.name} />
          <div>
            <small>CHALLENGER</small>
            <h3>{rival.name}</h3>
            <div className="hp-track">
              <i style={{ width: `${(hud.enemy / hud.emax) * 100}%` }} />
            </div>
            <span>
              {hud.enemy} / {hud.emax} HP
            </span>
          </div>
        </div>
      </div>
      {!ready && <div className="arena-loading">STARTING SIMULATION…</div>}
      <div className="arena-announcer">
        <Radio size={14} />
        <span>{comment}</span>
      </div>
      <div className="battle-instruments" aria-label="Vehicle instruments">
        <span>
          <Zap size={14} />
          {hud.energy}% ENERGY
        </span>
        <span
          className="speed-readout"
          data-speed={hud.speed}
          data-heading={hud.direction}
        >
          <Gauge size={13} />
          <strong>{hud.speed}</strong> KM/H
        </span>
        <span>{hud.parts} PARTS ONLINE</span>
        {hud.dashLeft > 0 && (
          <span className="clone-timer">DASH +150%</span>
        )}
        {hud.airborne && (
          <span className="clone-timer">AIRBORNE</span>
        )}
        {hud.tpLeft > 0 && (
          <span className="status-warning">TP {hud.tpLeft}s</span>
        )}
        {hud.cloneLeft > 0 && (
          <span className="clone-timer">CLONE {hud.cloneLeft}s</span>
        )}
        <span className="rival-mode">RIVAL · {rivalLabel(hud.rivalMode)}</span>
        {hud.drive !== "drive" && (
          <span className="drive-warning">
            <TriangleAlert size={13} />
            {driveHelp[hud.drive]}
          </span>
        )}
      </div>
      <div className="battle-bottom">
        {props.controlMode === "mobile" ? (
          <div
            className="touch-joystick"
            aria-label="Driving joystick"
            role="group"
            onPointerDown={(e) => {
              if (phase !== "play" || pauseRef.current) return;
              e.preventDefault();
              joystickPointer.current = e.pointerId;
              e.currentTarget.setPointerCapture(e.pointerId);
              moveJoystick(e);
            }}
            onPointerMove={moveJoystick}
            onPointerUp={releaseJoystick}
            onPointerCancel={releaseJoystick}
            onLostPointerCapture={releaseJoystick}
          >
            <i ref={joystickNub} />
          </div>
        ) : (
          <div className="drive-pad" aria-label="Hold to drive">
            <button
              aria-label="Steer left"
              title="Steer left (A)"
              data-held={hud.steer > 0}
              disabled={phase !== "play"}
              {...hold("KeyA")}
            >
              <ArrowLeft />
              <kbd>A</kbd>
            </button>
            <div className="drive-pedals">
              <button
                aria-label="Drive forward"
                title="Accelerate (W)"
                data-held={hud.gas > 0}
                disabled={phase !== "play"}
                {...hold("KeyW")}
              >
                <ArrowUp />
                <kbd>W</kbd>
              </button>
              <button
                aria-label="Reverse"
                title="Reverse (S)"
                data-held={hud.gas < 0}
                disabled={phase !== "play"}
                {...hold("KeyS")}
              >
                <ArrowDown />
                <kbd>S</kbd>
              </button>
            </div>
            <button
              aria-label="Steer right"
              title="Steer right (D)"
              data-held={hud.steer < 0}
              disabled={phase !== "play"}
              {...hold("KeyD")}
            >
              <ArrowRight />
              <kbd>D</kbd>
            </button>
          </div>
        )}
        <div className="desktop-hint">
          <Keyboard size={17} />
          <span>
            <b>W A S D</b> DRIVE <b>F</b> FIRE <b>SPACE</b> ACTION <b>C</b>{" "}
            CENTER CAMERA
          </span>
        </div>
        <div className="fire-pad">
          {props.controlMode === "pc" && (
            <button
              className="dark-button"
              title="Sound horn (H)"
              onClick={() => sfx("horn", latest.current.livery?.horn ?? "stock")}
            >
              <Radio size={15} /> HORN
            </button>
          )}
          <button
            className="dark-button"
            disabled={phase !== "play"}
            {...hold("Space")}
          >
            <ChevronsUp size={17} />
            ACTION
          </button>
          <button
            className="primary"
            disabled={phase !== "play"}
            {...hold("KeyF")}
          >
            <Crosshair size={18} />
            FIRE WEAPONS
          </button>
        </div>
      </div>
      {paused && (
        <div className="pause-backdrop">
          <div className="modal compact">
            <div className="eyebrow">
              <Pause size={14} /> SIMULATION SUSPENDED
            </div>
            <h2>Match paused</h2>
            <p>Your machine and the match timer are on hold.</p>
            <button
              className="dark-button wide"
              onClick={() =>
                props.onControlModeChange(
                  props.controlMode === "pc" ? "mobile" : "pc",
                )
              }
            >
              {props.controlMode === "pc" ? (
                <Smartphone size={16} />
              ) : (
                <Monitor size={16} />
              )}
              Switch to {props.controlMode === "pc" ? "mobile" : "PC"} controls
            </button>
            <button className="primary wide" onClick={() => pause(false)}>
              <Play size={16} /> Resume match
            </button>
            <button
              className="dark-button wide"
              onClick={() => setControlsOpen(!controlsOpen)}
            >
              <Keyboard size={16} /> Controls
            </button>
            {controlsOpen && (
              <p className="hint-text">
                {props.controlMode === "mobile"
                  ? "Drag the joystick to drive and steer. Hold Fire to attack. Action triggers your vehicle's special movement."
                  : "W/S: drive and reverse. A/D: steer. Hold F or the fire button to attack. Space: hop, thrust, lift, or right a tipped vehicle. Drag to orbit and press C to restore the follow camera."}
              </p>
            )}
            <button className="text-button wide" onClick={props.onExit}>
              <ChevronLeft size={15} /> Leave match without rewards
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
