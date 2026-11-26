"use client";
import { useEffect, useRef, useState } from "react";
import * as T from "three";
import { ChevronRight, SkipForward } from "lucide-react";
import { metrics, opponent, type Profile } from "@/game/data";
import { partModel } from "@/game/models";
import { sfx, unlockAudio } from "@/game/audio";

/** Small rotating render of an actual vehicle assembly. */
function VehicleThumb({
  parts,
  accent,
}: {
  parts: {
    id: string;
    key: string;
    pos: [number, number, number];
    rot: [number, number, number];
    scale: [number, number, number];
    parent: string | null;
  }[];
  accent: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!host.current) return;
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(38, 1.6, 0.1, 60);
    const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.outputColorSpace = T.SRGBColorSpace;
    const canvas = renderer.domElement;
    canvas.style.cssText = "display:block;width:100%;height:100%";
    host.current.appendChild(canvas);
    scene.add(new T.HemisphereLight("#dff0ff", "#3a3128", 1.5));
    const key = new T.DirectionalLight("#fff2dd", 2.6);
    key.position.set(4, 7, 6);
    scene.add(key);
    const rim = new T.DirectionalLight("#79dbe6", 2.1);
    rim.position.set(-6, 3, -5);
    scene.add(rim);
    const group = new T.Group();
    for (const p of parts) {
      const model = partModel(p);
      model.traverse((c) => {
        if (c instanceof T.Mesh) c.userData.fallback = true;
      });
      group.add(model);
    }
    scene.add(group);
    const box = new T.Box3().setFromObject(group);
    const size = box.getSize(new T.Vector3());
    const center = box.getCenter(new T.Vector3());
    const scale = 4.6 / Math.max(size.x, size.y, size.z, 0.001);
    group.scale.setScalar(scale);
    group.position.set(
      -center.x * scale,
      -box.min.y * scale,
      -center.z * scale,
    );
    const resize = () => {
      const w = host.current?.clientWidth || 1;
      const h = host.current?.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host.current);
    let raf = 0;
    const start = performance.now();
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const t = (performance.now() - start) / 1000;
      const a = t * 0.42 + 0.6;
      camera.position.set(Math.sin(a) * 7.4, 3.1, Math.cos(a) * 7.4);
      camera.lookAt(0, 0.9, 0);
      renderer.render(scene, camera);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
      scene.clear();
    };
  }, [parts, accent]);
  return <div className="versus-thumb" ref={host} />;
}

interface Props {
  profile: Profile;
  level: number;
  onStart: () => void;
  onCancel: () => void;
}

export default function VersusIntro({
  profile,
  level,
  onStart,
  onCancel,
}: Props) {
  const rival = opponent(level);
  const playerRating = metrics(profile.vehicle).rating;
  const rivalRating = metrics(rival.vehicle).rating;
  const rank = (xp: number) => Math.max(1, Math.floor(xp / 300) + 1);
  const [phase, setPhase] = useState(0);
  const [line, setLine] = useState("");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const schedule = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };
  useEffect(() => {
    unlockAudio();
    const lines: [number, string][] = [
      [200, "Welcome to the V.M.D. Championship!"],
      [
        900,
        "Entering from the blue corner... the engineering sensation... PIP!",
      ],
      [1750, `Piloting the ${profile.vehicle.name}.`],
      [2600, "And facing him today, the formidable rival!"],
      [3400, `${rival.name} enters with the ${rival.vehicle.name}.`],
      [4400, "Engineers... prepare your machines!"],
    ];
    lines.forEach(([at, text]) => {
      schedule(() => {
        setLine(text);
        sfx("cheer");
      }, at);
    });
    schedule(() => setPhase(1), 700);
    schedule(() => setPhase(2), 1500);
    schedule(() => {
      setPhase(3);
      sfx("rail");
    }, 2350);
    schedule(() => {
      setPhase(4);
      sfx("cheer");
    }, 3200);
    schedule(() => setPhase(5), 4200);
    schedule(() => onStart(), 5300);
    return () => timers.current.forEach(clearTimeout);
  }, []);
  return (
    <div className={`versus-intro phase-${phase}`}>
      <div className="versus-backdrop" />
      <div className="versus-fighter left">
        <img
          src="/arts/pip.webp"
          alt={`${profile.engineer}, the platypus engineer`}
        />
        <div className="versus-fighter-body">
          <span className="versus-tag">PLAYER ONE</span>
          <small>PLATYPUS ENGINEER</small>
          <h2>{profile.engineer.toUpperCase()}</h2>
          <p>{profile.vehicle.name}</p>
          <b>
            {playerRating} VR · RANK {rank(profile.xp)}
          </b>
          <VehicleThumb parts={profile.vehicle.parts} accent="#ff8a3d" />
        </div>
      </div>
      <div className="versus-fighter right">
        <img
          src={`/arts/${rival.art}.webp`}
          alt={`${rival.name}, the ${rival.species.toLowerCase()} engineer`}
        />
        <div className="versus-fighter-body">
          <span className="versus-tag">CHALLENGER</span>
          <small>{rival.species.toUpperCase()} ENGINEER</small>
          <h2>{rival.name.toUpperCase()}</h2>
          <p>{rival.vehicle.name}</p>
          <em className="versus-title">{rival.title}</em>
          <b>
            {rivalRating} VR · RANK {rank(0) + rival.tier}
          </b>
          <VehicleThumb parts={rival.vehicle.parts} accent="#7fd8e8" />
        </div>
      </div>
      <div className="versus-center">
        <span className="versus-vs">VS</span>
        <span className="versus-flash" />
      </div>
      <div className="versus-subtitle">{line}</div>
      <div className="versus-actions">
        <button className="versus-skip" onClick={onStart}>
          <SkipForward size={15} /> SKIP INTRO
        </button>
        <button className="versus-back" onClick={onCancel}>
          BACK TO WORKSHOP
        </button>
      </div>
    </div>
  );
}
