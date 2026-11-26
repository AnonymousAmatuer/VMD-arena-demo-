"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import * as T from "three";
import {
  BookOpen,
  Check,
  Columns3,
  Lock,
  RotateCw,
  Search,
  X,
} from "lucide-react";
import {
  CATALOG,
  DEF,
  MATERIAL_PROFILES,
  componentLock,
  type MaterialClass,
  type Profile,
} from "@/game/data";
import { MATERIAL_GUIDE } from "@/game/materials";
import { Dialog, SalvageIcon } from "./UI";

interface Row {
  key: MaterialClass;
  profile: (typeof MATERIAL_PROFILES)[MaterialClass];
  guide: (typeof MATERIAL_GUIDE)[MaterialClass];
  parts: typeof CATALOG;
  rarity: string;
  unlockLevel: number;
  locked: boolean;
  reason: string | null;
}

function MaterialStage({ material }: { material: MaterialClass }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!host.current) return;
    const profile = MATERIAL_PROFILES[material];
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(34, 1.4, 0.1, 40);
    const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.outputColorSpace = T.SRGBColorSpace;
    const canvas = renderer.domElement;
    canvas.style.cssText = "display:block;width:100%;height:100%";
    host.current.appendChild(canvas);
    scene.add(new T.HemisphereLight("#e6f4ff", "#2e2a24", 1.6));
    const key = new T.DirectionalLight("#fff4e2", 3);
    key.position.set(4, 6, 5);
    scene.add(key);
    const rim = new T.DirectionalLight("#74d6e4", 2.4);
    rim.position.set(-5, 2, -4);
    scene.add(rim);
    const group = new T.Group();
    const body = new T.Mesh(
      new T.BoxGeometry(2.1, 1.5, 2.1),
      new T.MeshStandardMaterial({
        color: profile.color,
        metalness: profile.metalness,
        roughness: profile.roughness,
      }),
    );
    body.castShadow = true;
    group.add(body);
    const edge = new T.Mesh(
      new T.BoxGeometry(2.24, 0.22, 2.24),
      new T.MeshStandardMaterial({
        color: profile.debris,
        metalness: Math.min(1, profile.metalness + 0.2),
        roughness: Math.max(0.12, profile.roughness - 0.18),
      }),
    );
    edge.position.y = 0.82;
    group.add(edge);
    // bars visualise hardness, elasticity and friction from live data.
    const bar = (height: number, x: number, color: string) => {
      const m = new T.Mesh(
        new T.BoxGeometry(0.16, 1, 0.16),
        new T.MeshStandardMaterial({
          color,
          metalness: 0.3,
          roughness: 0.4,
          emissive: color,
          emissiveIntensity: 0.35,
        }),
      );
      m.position.set(x, -1.15 + height / 2, 1.35);
      m.scale.y = height;
      group.add(m);
    };
    bar(Math.max(0.2, profile.hardness * 1.5), -0.5, "#ff8a3d");
    bar(Math.max(0.2, profile.elasticity * 1.5), 0, "#8fe0c4");
    bar(Math.max(0.2, profile.friction * 1.5), 0.5, "#79c7e8");
    scene.add(group);
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
    let drag = 0;
    const canvasDrag = (e: PointerEvent) => {
      drag = e.movementX * 0.01;
    };
    canvas.addEventListener("pointermove", canvasDrag);
    const tick = () => {
      raf = requestAnimationFrame(tick);
      group.rotation.y += 0.006 + drag;
      drag *= 0.86;
      group.rotation.x = Math.sin(performance.now() * 0.0004) * 0.12;
      renderer.render(scene, camera);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      canvas.removeEventListener("pointermove", canvasDrag);
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
      scene.clear();
    };
  }, [material]);
  return <div className="material-stage" ref={host} />;
}

export default function MaterialEncyclopedia({
  profile,
  onClose,
}: {
  profile: Profile;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All categories");
  const [selected, setSelected] = useState<MaterialClass>("steel");
  const [compare, setCompare] = useState<MaterialClass[]>([]);
  const [comparing, setComparing] = useState(false);
  const rows = useMemo<Row[]>(() => {
    const keys = Object.keys(MATERIAL_PROFILES) as MaterialClass[];
    return keys.map((key) => {
      const parts = CATALOG.filter((d) => d.material === key);
      const rarities = parts.map((p) => p.rarity);
      const order = ["Common", "Uncommon", "Rare", "Epic", "Legendary"];
      const rarity = order[Math.max(...rarities.map((r) => order.indexOf(r)))];
      const unlockLevel = Math.min(...parts.map((p) => p.unlockLevel));
      const requirement =
        parts.map((p) => componentLock(p, profile)).find((r) => !!r) ?? null;
      return {
        key,
        profile: MATERIAL_PROFILES[key],
        guide: MATERIAL_GUIDE[key],
        parts,
        rarity,
        unlockLevel,
        locked: !!requirement,
        reason: requirement,
      };
    });
  }, [profile]);
  const categories = [
    "All categories",
    ...new Set(rows.map((r) => r.guide.category)),
  ];
  const filtered = rows.filter(
    (r) =>
      (category === "All categories" || r.guide.category === category) &&
      (r.key.includes(query.toLowerCase()) ||
        r.guide.category.toLowerCase().includes(query.toLowerCase()) ||
        r.parts.some((p) =>
          p.name.toLowerCase().includes(query.toLowerCase()),
        )),
  );
  const active = rows.find((r) => r.key === selected) ?? rows[0];
  const toggleCompare = (key: MaterialClass) =>
    setCompare((list) =>
      list.includes(key)
        ? list.filter((k) => k !== key)
        : list.length >= 3
          ? [...list.slice(1), key]
          : [...list, key],
    );
  return (
    <Dialog
      title="Material encyclopedia"
      kicker="ENGINEERING REFERENCE / ALL MATERIALS"
      onClose={onClose}
      className="encyclopedia"
    >
      <div className="encyclopedia-body">
        <aside className="encyclopedia-index">
          <label className="encyclopedia-search">
            <Search size={15} />
            <input
              autoFocus
              type="search"
              placeholder="Search materials and components"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <select
            aria-label="Material category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <div className="encyclopedia-filters">
            {["All materials", "Unlocked now", "Locked"].map((f) => (
              <button
                key={f}
                className={
                  category === "All categories" && f === "All materials"
                    ? "active"
                    : ""
                }
                onClick={() => {
                  if (f === "Unlocked now") setQuery("");
                }}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="encyclopedia-list">
            {filtered.map((row) => (
              <button
                key={row.key}
                className={`${row.key === selected ? "active" : ""} ${row.locked ? "locked" : ""}`}
                onClick={() => setSelected(row.key)}
              >
                <i style={{ background: row.profile.color }} />
                <div>
                  <strong>
                    {row.key === "reinforced-steel"
                      ? "Reinforced steel"
                      : row.profile.label}
                  </strong>
                  <small>
                    {row.guide.category} · {row.rarity}
                  </small>
                </div>
                {row.locked ? (
                  <Lock size={13} />
                ) : (
                  <span className="eco-cost">{row.parts.length}</span>
                )}
              </button>
            ))}
            {!filtered.length && (
              <p className="empty-hint">No material matches that search.</p>
            )}
          </div>
        </aside>
        <section className="encyclopedia-detail">
          <div className="encyclopedia-hero">
            <MaterialStage material={active.key} />
            <div className="encyclopedia-title">
              <span
                className={`rarity-inline rarity-${active.rarity.toLowerCase()}`}
              >
                {active.rarity}
              </span>
              <h3>{active.profile.label}</h3>
              <p className="encyclopedia-category">
                {active.guide.category} · {active.guide.bestFor.toUpperCase()}{" "}
                FOCUS
              </p>
              {active.locked && (
                <div className="encyclopedia-lock">
                  <Lock size={13} /> {active.reason}
                </div>
              )}
            </div>
            <div className="encyclopedia-actions">
              <button
                className={comparing ? "active" : ""}
                onClick={() => setComparing(!comparing)}
              >
                <Columns3 size={14} /> COMPARE
              </button>
              <button onClick={() => toggleCompare(active.key)}>
                <Check size={14} />{" "}
                {compare.includes(active.key) ? "SELECTED" : "ADD TO COMPARE"}
              </button>
            </div>
          </div>
          {comparing && compare.length > 0 && (
            <div className="compare-table">
              <div className="compare-row compare-head">
                <span>PROPERTY</span>
                {compare.map((k) => (
                  <b key={k}>{MATERIAL_PROFILES[k].label}</b>
                ))}
              </div>
              {(
                [
                  [
                    "Density",
                    (k: MaterialClass) => MATERIAL_PROFILES[k].density,
                  ],
                  [
                    "Hardness",
                    (k: MaterialClass) => MATERIAL_PROFILES[k].hardness,
                  ],
                  [
                    "Elasticity",
                    (k: MaterialClass) => MATERIAL_PROFILES[k].elasticity,
                  ],
                  [
                    "Friction",
                    (k: MaterialClass) => MATERIAL_PROFILES[k].friction,
                  ],
                  [
                    "Cut resist",
                    (k: MaterialClass) => MATERIAL_PROFILES[k].resist.cut ?? 1,
                  ],
                  [
                    "Impact resist",
                    (k: MaterialClass) =>
                      MATERIAL_PROFILES[k].resist.impact ?? 1,
                  ],
                  [
                    "Blunt resist",
                    (k: MaterialClass) =>
                      MATERIAL_PROFILES[k].resist.blunt ?? 1,
                  ],
                  [
                    "Max HP",
                    (k: MaterialClass) =>
                      Math.max(
                        ...CATALOG.filter((d) => d.material === k).map(
                          (d) => d.hp,
                        ),
                      ),
                  ],
                  [
                    "Salvage",
                    (k: MaterialClass) =>
                      Math.min(
                        ...CATALOG.filter((d) => d.material === k).map(
                          (d) => d.cost,
                        ),
                      ),
                  ],
                ] as [string, (k: MaterialClass) => number][]
              ).map(([label, get]) => (
                <div className="compare-row" key={label}>
                  <span>{label}</span>
                  {compare.map((k) => (
                    <b key={k}>{get(k)}</b>
                  ))}
                </div>
              ))}
            </div>
          )}
          <p className="encyclopedia-summary">{active.guide.summary}</p>
          <div className="encyclopedia-properties">
            {(
              [
                ["Material category", active.guide.category],
                ["Rarity", active.rarity],
                ["Density index", String(active.profile.density)],
                [
                  "Maximum HP",
                  String(Math.max(...active.parts.map((p) => p.hp))),
                ],
                [
                  "Structural strength",
                  `${Math.round(active.profile.hardness * 100)}%`,
                ],
                [
                  "Impact resistance",
                  `${(active.profile.resist.impact ?? 1).toFixed(2)}x`,
                ],
                [
                  "Cut resistance",
                  `${(active.profile.resist.cut ?? 1).toFixed(2)}x`,
                ],
                [
                  "Blunt resistance",
                  `${(active.profile.resist.blunt ?? 1).toFixed(2)}x`,
                ],
                [
                  "Flexibility / brittleness",
                  active.profile.elasticity > 0.6
                    ? "Flexible"
                    : active.profile.elasticity < 0.15
                      ? "Brittle"
                      : "Semi-rigid",
                ],
                ["Heat resistance", active.guide.heat],
                [
                  "Salvage cost",
                  `${Math.min(...active.parts.map((p) => p.cost))} - ${Math.max(...active.parts.map((p) => p.cost))} salvage`,
                ],
                [
                  "Unlock requirement",
                  active.locked ? active.reason : "Available now",
                ],
              ] as [string, string][]
            ).map(([label, value]) => (
              <div className="encyclopedia-prop" key={label}>
                <span>{label}</span>
                <b>{value}</b>
              </div>
            ))}
          </div>
          <div className="encyclopedia-columns">
            <section>
              <h4>
                <BookOpen size={14} /> Recommended applications
              </h4>
              <ul>
                {active.guide.recommended.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </section>
            <section>
              <h4>Weaknesses</h4>
              <ul>
                {active.guide.weaknesses.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </section>
            <section>
              <h4>Compatible connections</h4>
              <ul>
                {active.guide.compatible.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </section>
            <section>
              <h4>Destruction characteristics</h4>
              <p>{active.guide.destruction}</p>
            </section>
          </div>
          <div className="encyclopedia-howto">
            <h4>HOW TO USE THIS MATERIAL</h4>
            <p>{active.guide.howToUse}</p>
            <div className="encyclopedia-parts">
              {active.parts.map((p) => (
                <span key={p.key}>
                  <SalvageIcon size={12} /> {p.name} <em>{p.cost}S</em>
                </span>
              ))}
            </div>
          </div>
        </section>
      </div>
    </Dialog>
  );
}
