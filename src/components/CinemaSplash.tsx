"use client";
import { useEffect, useRef, useState } from "react";
import * as T from "three";
import { animatePart, box, mat, partModel, rod } from "@/game/models";
import { emblemGroup } from "@/game/arena";
import { makePart } from "@/game/data";
import { sfx, unlockAudio } from "@/game/audio";

/* Pip: a stylised platypus engineer built from primitives so the splash can
   animate him without an external rig. */
function buildPip() {
  const group = new T.Group();
  const fur = mat("#6b4a33", 0.04, 0.86);
  const furLight = mat("#8a6446", 0.04, 0.82);
  const bill = mat("#8d8474", 0.06, 0.62);
  const billDark = mat("#5d564a", 0.08, 0.55);
  const cloth = mat("#27414a", 0.08, 0.82);
  const clothDark = mat("#1b2e35", 0.1, 0.8);
  const leather = mat("#6b4a2d", 0.05, 0.74);
  const scarf = mat("#e2702c", 0.05, 0.76);
  const brass = mat("#b08b4f", 0.85, 0.3);
  const lens = mat("#d8a13f", 0.7, 0.2, true);
  const eye = mat("#141414", 0.2, 0.35);
  const body = new T.Group();
  body.name = "pip-body";
  group.add(body);
  const torso = box(body, [0.62, 0.78, 0.42], [0, 1.18, 0], cloth, true);
  torso.rotation.x = -0.06;
  box(body, [0.66, 0.2, 0.46], [0, 0.92, 0], clothDark, true);
  for (const side of [-1, 1]) {
    rod(body, [side * 0.33, 1.42, 0.02], [side * 0.42, 0.92, 0.1], 0.09, fur);
    const hand = new T.Mesh(new T.SphereGeometry(0.11, 12, 8), fur);
    hand.position.set(side * 0.44, 0.86, 0.12);
    body.add(hand);
    rod(
      body,
      [side * 0.17, 0.9, 0],
      [side * 0.19, 0.22, 0.02],
      0.11,
      clothDark,
    );
    const boot = box(
      body,
      [0.24, 0.18, 0.34],
      [side * 0.19, 0.12, 0.05],
      leather,
      true,
    );
    boot.rotation.x = 0.06;
  }
  const wrap = new T.Mesh(new T.TorusGeometry(0.26, 0.09, 8, 18), scarf);
  wrap.rotation.x = Math.PI / 2;
  wrap.position.y = 1.56;
  body.add(wrap);
  const tail = box(body, [0.16, 0.5, 0.08], [0.1, 1.32, -0.24], scarf, true);
  tail.rotation.z = -0.3;
  tail.name = "pip-scarf";
  const head = new T.Group();
  head.name = "pip-head";
  head.position.set(0, 1.72, 0);
  body.add(head);
  const skull = new T.Mesh(new T.SphereGeometry(0.33, 18, 14), fur);
  skull.scale.set(1, 0.95, 0.96);
  head.add(skull);
  const beak = new T.Mesh(new T.SphereGeometry(0.27, 16, 12), bill);
  beak.scale.set(1.06, 0.36, 1.15);
  beak.position.set(0, -0.06, 0.26);
  head.add(beak);
  const beakLower = new T.Mesh(new T.SphereGeometry(0.24, 14, 10), billDark);
  beakLower.scale.set(1, 0.2, 1.1);
  beakLower.position.set(0, -0.14, 0.25);
  head.add(beakLower);
  const nose = new T.Mesh(new T.SphereGeometry(0.055, 8, 6), billDark);
  nose.position.set(0, 0.01, 0.52);
  head.add(nose);
  for (const side of [-1, 1]) {
    const e = new T.Mesh(new T.SphereGeometry(0.052, 10, 8), eye);
    e.position.set(side * 0.15, 0.09, 0.29);
    head.add(e);
    const glint = new T.Mesh(
      new T.SphereGeometry(0.017, 6, 5),
      mat("#ffffff", 0, 0.2, true),
    );
    glint.position.set(side * 0.165, 0.115, 0.33);
    head.add(glint);
    const ear = new T.Mesh(new T.SphereGeometry(0.06, 8, 6), furLight);
    ear.position.set(side * 0.3, 0.12, -0.02);
    head.add(ear);
  }
  const cap = new T.Mesh(
    new T.SphereGeometry(0.34, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
    leather,
  );
  cap.position.y = 0.06;
  head.add(cap);
  const brim = new T.Mesh(
    new T.CylinderGeometry(0.36, 0.36, 0.03, 16, 1, false, -0.9, 1.8),
    leather,
  );
  brim.position.set(0, 0.07, 0.12);
  brim.rotation.x = -0.12;
  head.add(brim);
  for (const side of [-1, 1]) {
    const rim = new T.Mesh(new T.TorusGeometry(0.085, 0.022, 6, 14), brass);
    rim.position.set(side * 0.13, 0.2, 0.27);
    rim.rotation.x = 0.2;
    head.add(rim);
    const glass = new T.Mesh(new T.CircleGeometry(0.075, 14), lens);
    glass.position.set(side * 0.13, 0.2, 0.3);
    glass.rotation.x = 0.2;
    head.add(glass);
  }
  group.traverse((o) => {
    if (o instanceof T.Mesh) o.castShadow = true;
  });
  return group;
}

/* Showcase machine: a heavy buggy with a rotor, saw, rail gun and wheels, all
   real component models so the splash shows the actual art of the game. */
function showcaseParts() {
  return [
    makePart("c", "core", [0, 0, 0], null),
    makePart("w1", "heavywheel", [1.33, -0.16, -1.18]),
    makePart("w2", "heavywheel", [-1.33, -0.16, -1.18]),
    makePart("w3", "heavywheel", [1.33, -0.16, 1.18]),
    makePart("w4", "heavywheel", [-1.33, -0.16, 1.18]),
    makePart("plate", "steel", [0, 0.66, 0.1]),
    makePart("side", "heavyarmor", [1.06, 0.34, -0.4]),
    makePart("cutter", "twin_saw", [-0.82, 0.06, -2.02]),
    makePart("gun", "rail", [0.62, 0.92, -1.1]),
    makePart("rotor", "dualrotor", [0, 1.72, 0.35]),
  ];
}

function softSprite() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.45, "rgba(255,255,255,.45)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  return t;
}

interface Props {
  onEnter: () => void;
  onWorkshop: () => void;
  onGarage: () => void;
  onTournament: () => void;
  onComponents: () => void;
  onLeaderboard: () => void;
  onSettings: () => void;
  onStory: () => void;
}

const LINE_ONE = "VEHICLES OF";
const LINE_TWO = "MASS DESTRUCTION";
const TARGET = new T.Vector3(0.35, 1.3, 0);

export default function CinemaSplash({
  onEnter,
  onWorkshop,
  onGarage,
  onTournament,
  onComponents,
  onLeaderboard,
  onSettings,
  onStory,
}: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    if (!host.current) return;
    const scene = new T.Scene();
    scene.background = new T.Color("#05080a");
    scene.fog = new T.FogExp2("#071013", 0.028);
    const camera = new T.PerspectiveCamera(33, 1, 0.1, 400);
    const renderer = new T.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.outputColorSpace = T.SRGBColorSpace;
    const canvas = renderer.domElement;
    canvas.style.cssText = "display:block;width:100%;height:100%";
    host.current.appendChild(canvas);

    scene.add(new T.HemisphereLight("#cfe6f2", "#3a2a1e", 0.9));
    const key = new T.SpotLight("#fff1d8", 760, 80, 0.42, 0.55, 1.5);
    key.position.set(-10, 19, 12);
    key.target.position.set(0.6, 1.2, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key, key.target);
    const rim = new T.SpotLight("#4fd6e6", 520, 80, 0.5, 0.6, 1.5);
    rim.position.set(12, 14, -12);
    rim.target.position.set(1.4, 1.2, -0.4);
    scene.add(rim, rim.target);
    const orange = new T.SpotLight("#ff8a3d", 340, 60, 0.6, 0.7, 1.6);
    orange.position.set(4, 4, 10);
    orange.target.position.set(2.2, 0.8, -0.4);
    scene.add(orange, orange.target);
    const warm = new T.PointLight("#ffb47a", 90, 26, 2);
    warm.position.set(-1.8, 2.2, 2.4);
    scene.add(warm);

    // Stage: a dark metal plinth with a glowing rim and the 3D championship emblem.
    const plinth = new T.Mesh(
      new T.CylinderGeometry(9.5, 10.2, 0.5, 96),
      new T.MeshStandardMaterial({
        color: "#14191c",
        metalness: 0.7,
        roughness: 0.38,
      }),
    );
    plinth.position.y = -0.27;
    plinth.receiveShadow = true;
    scene.add(plinth);
    const floor = new T.Mesh(
      new T.CircleGeometry(60, 64),
      new T.MeshStandardMaterial({
        color: "#0c1114",
        metalness: 0.5,
        roughness: 0.6,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.52;
    floor.receiveShadow = true;
    scene.add(floor);
    const rimRing = new T.Mesh(
      new T.TorusGeometry(9.7, 0.06, 8, 128),
      new T.MeshBasicMaterial({ color: "#ff8a3d" }),
    );
    rimRing.rotation.x = Math.PI / 2;
    rimRing.position.y = 0.0;
    scene.add(rimRing);
    const emblem = emblemGroup();
    emblem.scale.setScalar(0.42);
    emblem.position.set(0.5, 0.01, 0.1);
    scene.add(emblem);

    // Stadium bowl, banners and crowd silhouettes in the distance.
    const bowl = new T.Mesh(
      new T.CylinderGeometry(42, 48, 30, 56, 1, true),
      new T.MeshStandardMaterial({
        color: "#0f171b",
        metalness: 0.25,
        roughness: 0.9,
        side: T.DoubleSide,
      }),
    );
    bowl.position.y = 12;
    scene.add(bowl);
    const crowd = new T.InstancedMesh(
      new T.SphereGeometry(0.5, 6, 4),
      mat("#3d4a4d", 0.05, 0.9),
      520,
    );
    const dummy = new T.Object3D();
    for (let i = 0; i < 520; i++) {
      const a = (i / 520) * Math.PI * 2;
      const r = 39 + ((i * 7) % 6) * 1.1;
      dummy.position.set(
        Math.sin(a) * r,
        2.5 + ((i * 13) % 11) * 1.6,
        Math.cos(a) * r,
      );
      dummy.scale.setScalar(0.8 + ((i * 3) % 5) * 0.08);
      dummy.updateMatrix();
      crowd.setMatrixAt(i, dummy.matrix);
    }
    scene.add(crowd);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const lampPost = box(
        scene,
        [0.6, 30, 0.6],
        [Math.sin(a) * 36, 14, Math.cos(a) * 36],
        mat("#222b30", 0.5, 0.6),
      );
      const lamp = box(
        scene,
        [3.2, 0.5, 0.6],
        [Math.sin(a) * 35, 28, Math.cos(a) * 35],
        mat("#eaf8ff", 0.1, 0.2, true),
      );
      lamp.lookAt(0, 2, 0);
      lampPost.lookAt(0, 6, 0);
    }

    // Subjects.
    const pip = buildPip();
    pip.position.set(-1.35, 0, 0.55);
    pip.rotation.y = 0.5;
    pip.scale.setScalar(1.12);
    scene.add(pip);
    const vehicle = new T.Group();
    const vehicleModels: T.Group[] = [];
    for (const p of showcaseParts()) {
      const model = partModel(p);
      vehicle.add(model);
      vehicleModels.push(model);
    }
    vehicle.position.set(2.05, 0.4, -0.7);
    vehicle.rotation.y = -0.62;
    scene.add(vehicle);

    // Light cones, lit smoke and floating dust.
    const cones: T.Mesh[] = [];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.4;
      const cone = new T.Mesh(
        new T.ConeGeometry(3.6, 19, 24, 1, true),
        new T.MeshBasicMaterial({
          color: i % 2 ? "#ffd9a8" : "#bfe9ff",
          transparent: true,
          opacity: 0.05,
          side: T.DoubleSide,
          depthWrite: false,
          blending: T.AdditiveBlending,
        }),
      );
      cone.position.set(Math.sin(a) * 10, 9.5, Math.cos(a) * 10);
      cone.lookAt(0, 1, 0);
      cone.rotateX(Math.PI / 2);
      cones.push(cone);
      scene.add(cone);
    }
    const sprite = softSprite();
    const smokeMat = new T.SpriteMaterial({
      map: sprite,
      color: "#8b9796",
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
    });
    const smoke: { s: T.Sprite; life: number; seed: number }[] = [];
    for (let i = 0; i < 26; i++) {
      const s = new T.Sprite(smokeMat.clone());
      scene.add(s);
      smoke.push({ s, life: Math.random(), seed: i });
    }
    const dustCount = 260;
    const dust = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      dust[i * 3] = (Math.random() - 0.5) * 30;
      dust[i * 3 + 1] = Math.random() * 13;
      dust[i * 3 + 2] = (Math.random() - 0.5) * 30;
    }
    const dustGeo = new T.BufferGeometry();
    dustGeo.setAttribute("position", new T.BufferAttribute(dust, 3));
    const dustPoints = new T.Points(
      dustGeo,
      new T.PointsMaterial({
        color: "#ffd7a6",
        size: 0.11,
        map: sprite,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
        sizeAttenuation: true,
      }),
    );
    scene.add(dustPoints);

    const resize = () => {
      const w = host.current?.clientWidth || 1;
      const h = host.current?.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // On wide screens the subjects sit right of centre, clear of the title.
      const shift = w > 900 ? -w * 0.2 : 0;
      camera.setViewOffset(w, h, shift, 0, w, h);
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host.current);

    let raf = 0;
    let last = performance.now();
    const start = last;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = (now - start) / 1000;
      const intro = Math.min(1, t / 3.4);
      const ease = 1 - Math.pow(1 - intro, 3);
      const radius = 12.4 - (12.4 - 6.8) * ease + Math.sin(t * 0.16) * 0.35;
      const angle = -0.82 + t * 0.045;
      camera.position.set(
        TARGET.x + Math.sin(angle) * radius,
        2.35 + (1 - ease) * 4.2 + Math.sin(t * 0.3) * 0.2,
        TARGET.z + Math.cos(angle) * radius,
      );
      camera.lookAt(TARGET);

      key.position.x = -10 + Math.sin(t * 0.22) * 2.2;
      key.intensity = 740 + Math.sin(t * 0.9) * 60;
      rim.intensity = 500 + Math.cos(t * 0.7) * 50;
      orange.intensity = 300 + Math.sin(t * 1.3) * 45;
      warm.intensity = 80 + Math.sin(t * 1.7) * 22;
      cones.forEach((cone, i) => {
        (cone.material as T.MeshBasicMaterial).opacity =
          0.04 + Math.abs(Math.sin(t * 0.5 + i)) * 0.05;
      });

      const body = pip.getObjectByName("pip-body");
      if (body) {
        body.rotation.y = Math.sin(t * 0.5) * 0.12;
        body.position.y = Math.sin(t * 1.1) * 0.022;
      }
      const head = pip.getObjectByName("pip-head");
      if (head) head.rotation.y = Math.sin(t * 0.63) * 0.3;
      const scarf = pip.getObjectByName("pip-scarf");
      if (scarf) scarf.rotation.x = Math.sin(t * 1.9) * 0.22;

      vehicle.position.y = 0.4 + Math.sin(t * 0.9) * 0.03;
      vehicleModels.forEach((model) => {
        const spinning = model.getObjectByName("rotor-spin") !== undefined;
        animatePart(model, dt, 3.6, spinning);
      });

      smoke.forEach((item, i) => {
        item.life += dt * 0.07;
        if (item.life > 1) item.life -= 1;
        const angleS = i * 2.4 + t * 0.05;
        const r = 2.4 + item.life * 4.5;
        item.s.position.set(
          0.6 + Math.sin(angleS) * r * 0.6,
          0.4 + item.life * 6.2,
          -0.4 + Math.cos(angleS) * r * 0.5,
        );
        const s = 1.6 + item.life * 3.4;
        item.s.scale.set(s, s, s);
        (item.s.material as T.SpriteMaterial).opacity =
          Math.sin(item.life * Math.PI) * 0.16;
      });
      for (let i = 0; i < dustCount; i++) {
        dust[i * 3 + 1] += 0.004;
        dust[i * 3] += Math.sin(t * 0.4 + i) * 0.0018;
        if (dust[i * 3 + 1] > 13) dust[i * 3 + 1] = 0;
      }
      dustGeo.attributes.position.needsUpdate = true;
      renderer.render(scene, camera);
    };
    tick();
    setReady(true);
    const reveal = setTimeout(() => setRevealed(true), 120);
    const flashTimer = setTimeout(() => sfx("countdown"), 1500);
    return () => {
      clearTimeout(reveal);
      clearTimeout(flashTimer);
      cancelAnimationFrame(raf);
      observer.disconnect();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
      scene.clear();
    };
  }, []);

  const menu = [
    { label: "ENTER CHAMPIONSHIP", action: onEnter, primary: true },
    { label: "WORKSHOP", action: onWorkshop },
    { label: "GARAGE", action: onGarage },
    { label: "TOURNAMENT", action: onTournament },
    { label: "COMPONENTS", action: onComponents },
    { label: "LEADERBOARD", action: onLeaderboard },
    { label: "SETTINGS", action: onSettings },
  ];
  const letters = (line: string, offset: number) =>
    line.split("").map((ch, i) =>
      ch === " " ? (
        <span key={`${line}-${i}`} className="ps-space">
          {" "}
        </span>
      ) : (
        <span
          key={`${line}-${i}`}
          className="ps-letter"
          style={{ animationDelay: `${0.45 + offset + i * 0.04}s` }}
        >
          {ch}
        </span>
      ),
    );

  return (
    <div className="cinema-splash ps-root">
      <div className="cinema-stage" ref={host} />
      <div className="ps-grade" />
      <div className="ps-bars" aria-hidden="true">
        <i />
        <i />
      </div>
      <div className={`ps-flash ${revealed ? "go" : ""}`} aria-hidden="true" />

      <svg className="ps-emblem" viewBox="0 0 200 200" aria-hidden="true">
        <defs>
          <linearGradient id="ps-metal" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fff1d6" />
            <stop offset="45%" stopColor="#ff9a4a" />
            <stop offset="100%" stopColor="#7fe2cf" />
          </linearGradient>
        </defs>
        <circle
          className="ps-ring-outer"
          cx="100"
          cy="100"
          r="92"
          fill="none"
          stroke="url(#ps-metal)"
          strokeWidth="2.5"
          strokeDasharray="6 9"
        />
        <circle
          className="ps-ring-inner"
          cx="100"
          cy="100"
          r="78"
          fill="none"
          stroke="#ff8a3d"
          strokeWidth="1.2"
          strokeDasharray="220 40"
          opacity=".8"
        />
        <circle
          cx="100"
          cy="100"
          r="66"
          fill="#0a1114"
          stroke="url(#ps-metal)"
          strokeWidth="1.5"
        />
        <text x="100" y="92" textAnchor="middle" className="ps-emblem-text">
          V.M.D.
        </text>
        <text x="100" y="124" textAnchor="middle" className="ps-emblem-sub">
          CHAMPIONSHIP
        </text>
      </svg>

      <div className={`cinema-hud ps-hud ${revealed ? "shown" : ""}`}>
        <div className="cinema-titles ps-titles">
          <span className="ps-demo-label">THIS IS A DEMO</span>
          <span className="cinema-kicker ps-kicker">
            THE PLATYPUS 3D ENGINEER
          </span>
          <h1 className="ps-h1">
            <span className="ps-line">{letters(LINE_ONE, 0)}</span>
            <br />
            <span className="ps-line ps-line-two">
              {letters(LINE_TWO, 0.5)}
            </span>
          </h1>
          <div className="ps-rule" />
          <p className="cinema-sub ps-sub">
            Build the machine. Break the rival. Take the championship.
          </p>
        </div>
        <nav className="cinema-menu ps-menu" aria-label="Main menu">
          {menu.map((item, index) => (
            <button
              key={item.label}
              className={`ps-item ${item.primary ? "ps-primary" : ""}`}
              style={{ animationDelay: `${1.25 + index * 0.07}s` }}
              onClick={() => {
                unlockAudio();
                sfx("click");
                item.action();
              }}
            >
              <span className="ps-idx" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="ps-label">{item.label}</span>
              <span className="ps-arrow" aria-hidden="true">
                →
              </span>
            </button>
          ))}
          <button
            className="ps-item ps-quiet"
            style={{ animationDelay: "1.85s" }}
            onClick={() => {
              unlockAudio();
              onStory();
            }}
          >
            <span className="ps-label">THE STORY</span>
          </button>
        </nav>
        <div className="ps-footer">
          <span>ESC · SKIP TO MENU</span>
          <span>CHAMPIONSHIP EDITION</span>
        </div>
      </div>
      {!ready && <div className="cinema-loading">PREPARING THE STADIUM…</div>}
    </div>
  );
}
