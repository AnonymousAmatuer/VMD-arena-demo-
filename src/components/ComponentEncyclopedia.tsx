"use client";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  Crosshair,
  Gauge,
  Lock,
  Search,
  Shield,
  Sparkles,
  Zap,
} from "lucide-react";
import {
  CATALOG,
  DEF,
  MATERIAL_PROFILES,
  componentLock,
  itemRating,
  makePart,
  metrics,
  type ComponentDef,
  type Profile,
  type Vehicle,
} from "@/game/data";
import { Dialog, SalvageIcon } from "./UI";

const CATEGORIES = [
  "All components",
  "Structure",
  "Mobility",
  "Weapons",
  "Mechanical",
  "Power",
] as const;

interface Strategy {
  name: string;
  tagline: string;
  icon: typeof Shield;
  parts: string[];
  advice: string;
  counter: string;
}

function exampleVehicle(keys: string[]): Vehicle {
  const v: Vehicle = {
    name: "Reference build",
    parts: [makePart("chassis", "core", [0, 0, 0], null)],
  };
  const slots: [number, number, number][] = [
    [-1.31, -0.13, -1.12],
    [1.31, -0.13, -1.12],
    [-1.31, -0.13, 1.12],
    [1.31, -0.13, 1.12],
    [0, 0.59, 0.24],
    [0, 1.13, 0.16],
    [-0.78, 0.04, -1.94],
    [0.78, 0.04, -1.94],
    [0, 0.17, 2.1],
  ];
  keys.forEach((key, i) => {
    if (!DEF[key]) return;
    const slot = slots[i % slots.length];
    v.parts.push(makePart(`ref${i}`, key, slot));
  });
  return v;
}

const STRATEGIES: Strategy[] = [
  {
    name: "Iron Brawler",
    tagline: "Close-range impact and overwhelming structure",
    icon: Shield,
    parts: [
      "heavyarmor",
      "iron",
      "heavywheel",
      "drophammer",
      "bumper",
      "stabilizer",
    ],
    advice:
      "Concentrate mass low and forward. Accept poor speed in exchange for surviving repeated contact.",
    counter: "Fast kiting builds with paint, water and long weapons.",
  },
  {
    name: "Scrap Dragster",
    tagline: "Salvage-cheap speed with one good weapon",
    icon: Gauge,
    parts: [
      "smallwheel",
      "wheel",
      "crate",
      "saw",
      "battery_s",
      "rocket_assist",
    ],
    advice:
      "Keep mass near zero, mount one weapon, and use rocket assist to dictate when contact happens.",
    counter: "Area weapons and slick projectiles that remove grip.",
  },
  {
    name: "Skyline Flyer",
    tagline: "Escape the ground plane and fight from above",
    icon: Sparkles,
    parts: ["carbon", "rotor", "dualrotor", "alloy", "tennis", "battery_i"],
    advice:
      "Lift must exceed total mass. Every extra kilogram of armour costs altitude and stability.",
    counter: "Rail weapons and opponents with their own lift.",
  },
  {
    name: "Precision Skirmisher",
    tagline: "Swivel aim, range and status effects",
    icon: Crosshair,
    parts: ["platform", "rail", "water", "paint", "steer", "battery_s"],
    advice:
      "Use a rotating mount to fire while moving sideways. Soak grip with water before committing.",
    counter: "Heavy armour that ignores status and closes distance.",
  },
  {
    name: "Mechanism Engine",
    tagline: "Many small systems working together",
    icon: Zap,
    parts: ["gearbox", "motor", "bearing", "battery_i", "generator", "flail"],
    advice:
      "Bearings shorten cycle times, gearboxes trade speed for impact, and motors add drive torque.",
    counter: "Focused damage to a single exposed power component.",
  },
];

function statsFor(d: ComponentDef) {
  const peers = CATALOG.filter((x) => x.category === d.category);
  const avg = (sel: (x: ComponentDef) => number) =>
    peers.reduce((a, x) => a + sel(x), 0) / peers.length;
  const advantages: string[] = [];
  const disadvantages: string[] = [];
  if (d.hp > avg((x) => x.hp) * 1.15)
    advantages.push(`Above-average durability (${d.hp} HP)`);
  if (d.hp < avg((x) => x.hp) * 0.8)
    disadvantages.push(`Low durability (${d.hp} HP)`);
  if (d.mass < avg((x) => x.mass) * 0.8)
    advantages.push(`Very light (${d.mass} kg)`);
  if (d.mass > avg((x) => x.mass) * 1.2)
    disadvantages.push(`Heavy (${d.mass} kg)`);
  if (d.power > 0)
    advantages.push(
      `${d.power} ${d.category === "Weapons" ? "damage" : d.kind === "thruster" ? "thrust" : "power"}`,
    );
  if (d.energy > 0) disadvantages.push(`Draws ${d.energy} energy per use`);
  if (d.range > 10) advantages.push(`Effective reach ${d.range}`);
  if (d.cooldown > 2) disadvantages.push(`Long ${d.cooldown}s cooldown`);
  if (d.cooldown < 0.6 && d.category === "Weapons")
    advantages.push("Very fast cycle");
  if (d.capacity > 0) advantages.push(`+${d.capacity} battery capacity`);
  if (d.powerGen > 0) advantages.push(`+${d.powerGen} energy per second`);
  if (d.trait !== "none") advantages.push(`${d.trait} mechanism effect`);
  const profile = MATERIAL_PROFILES[d.material];
  if (profile.friction > 0.8) advantages.push("High friction");
  if (profile.friction < 0.45) disadvantages.push("Low friction");
  if (profile.elasticity < 0.1) disadvantages.push("Brittle under shock");
  if (profile.elasticity > 0.7) advantages.push("Absorbs impact energy");
  if (!advantages.length) advantages.push("Balanced baseline component");
  if (!disadvantages.length)
    disadvantages.push("No standout weakness, but no specialisation");
  return { advantages, disadvantages, profile };
}

export default function ComponentEncyclopedia({
  profile,
  onClose,
  onMaterials,
}: {
  profile: Profile;
  onClose: () => void;
  onMaterials: () => void;
}) {
  const [tab, setTab] = useState<"Components" | "Strategies" | "Materials">(
    "Components",
  );
  const [category, setCategory] =
    useState<(typeof CATEGORIES)[number]>("All components");
  const [query, setQuery] = useState("");
  const [rarity, setRarity] = useState("All rarities");
  const [selected, setSelected] = useState<ComponentDef>(CATALOG[0]);
  const filtered = useMemo(
    () =>
      CATALOG.filter(
        (d) =>
          (category === "All components" || d.category === category) &&
          (rarity === "All rarities" || d.rarity === rarity) &&
          (d.name.toLowerCase().includes(query.toLowerCase()) ||
            d.description.toLowerCase().includes(query.toLowerCase()) ||
            d.material.includes(query.toLowerCase())),
      ),
    [category, rarity, query],
  );
  const lock = componentLock(selected, profile);
  const s = statsFor(selected);
  return (
    <Dialog
      title="VMD component encyclopedia"
      kicker="HOME REFERENCE / LIVE COMPONENT DATA"
      onClose={onClose}
      className="compendium-modal"
    >
      <div className="page-tabs compact-tabs">
        {(["Components", "Strategies", "Materials"] as const).map((t) => (
          <button
            key={t}
            className={tab === t ? "active" : ""}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "Components" && (
        <div className="compendium-body">
          <aside className="compendium-index">
            <label className="encyclopedia-search">
              <Search size={14} />
              <input
                type="search"
                placeholder="Search every component"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <div className="compendium-filters">
              <select
                aria-label="Component category"
                value={category}
                onChange={(e) => setCategory(e.target.value as typeof category)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <select
                aria-label="Component rarity"
                value={rarity}
                onChange={(e) => setRarity(e.target.value)}
              >
                {[
                  "All rarities",
                  "Common",
                  "Uncommon",
                  "Rare",
                  "Epic",
                  "Legendary",
                ].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </div>
            <div className="compendium-list">
              {filtered.map((d) => {
                const locked = !!componentLock(d, profile);
                return (
                  <button
                    key={d.key}
                    className={`${selected.key === d.key ? "active" : ""} ${locked ? "locked" : ""}`}
                    onClick={() => setSelected(d)}
                  >
                    <img src={`/arts/${d.art}.webp`} alt="" />
                    <div>
                      <strong>{d.name}</strong>
                      <small>
                        {d.category} · {d.rarity}
                      </small>
                    </div>
                    <b>
                      <SalvageIcon size={11} />
                      {d.cost}
                    </b>
                    {locked && <Lock size={11} />}
                  </button>
                );
              })}
              {!filtered.length && (
                <p className="empty-hint">Nothing matches those filters.</p>
              )}
            </div>
          </aside>
          <section className="compendium-detail">
            <div className="compendium-hero">
              <img src={`/arts/${selected.art}.webp`} alt={selected.name} />
              <div>
                <span
                  className={`rarity-inline rarity-${selected.rarity.toLowerCase()}`}
                >
                  {selected.rarity}
                </span>
                <h3>{selected.name}</h3>
                <p>{selected.description}</p>
              </div>
            </div>
            {lock && (
              <div className="encyclopedia-lock">
                <Lock size={13} /> {lock}
              </div>
            )}
            <div className="compendium-stats">
              {[
                ["Salvage", `${selected.cost}`],
                ["Mass", `${selected.mass} kg`],
                ["HP", `${selected.hp}`],
                ["Power", `${selected.power}`],
                ["Range", `${selected.range}`],
                ["Cooldown", `${selected.cooldown}s`],
                ["Energy", `${selected.energy}`],
                ["Rating", `${itemRating(selected)}`],
              ].map(([a, b]) => (
                <div key={a}>
                  <span>{a}</span>
                  <b>{b}</b>
                </div>
              ))}
            </div>
            <div className="compendium-pros">
              <section>
                <h4>
                  <Check size={13} /> Advantages
                </h4>
                <ul>
                  {s.advantages.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </section>
              <section>
                <h4>
                  <Shield size={13} /> Disadvantages
                </h4>
                <ul>
                  {s.disadvantages.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </section>
            </div>
            <div className="compendium-material">
              <span
                className="material-chip"
                style={{ background: s.profile.color }}
              />
              <div>
                <small>MATERIAL</small>
                <b>{s.profile.label}</b>
              </div>
              <div>
                <small>HARDNESS</small>
                <b>{s.profile.hardness}</b>
              </div>
              <div>
                <small>FLEXIBILITY</small>
                <b>{s.profile.elasticity}</b>
              </div>
              <div>
                <small>FRICTION</small>
                <b>{s.profile.friction}</b>
              </div>
              <button className="dark-button" onClick={onMaterials}>
                Full materials guide <ArrowRight size={13} />
              </button>
            </div>
          </section>
        </div>
      )}
      {tab === "Strategies" && (
        <div className="strategy-grid">
          {STRATEGIES.map((strategy) => {
            const Icon = strategy.icon;
            const m = metrics(exampleVehicle(strategy.parts));
            return (
              <div className="strategy-card" key={strategy.name}>
                <div className="strategy-head">
                  <Icon size={19} />
                  <div>
                    <h3>{strategy.name}</h3>
                    <small>{strategy.tagline}</small>
                  </div>
                  <b>{m.rating} VR</b>
                </div>
                <div className="strategy-meters">
                  <span>
                    <i style={{ width: `${m.durability}%` }} />
                    DURABILITY {m.durability}
                  </span>
                  <span>
                    <i style={{ width: `${m.mobility}%` }} />
                    MOBILITY {m.mobility}
                  </span>
                  <span>
                    <i style={{ width: `${m.firepower}%` }} />
                    FIREPOWER {m.firepower}
                  </span>
                </div>
                <div className="strategy-parts">
                  {strategy.parts.map((key) => (
                    <span key={key} title={DEF[key]?.description}>
                      {DEF[key]?.name ?? key}
                    </span>
                  ))}
                </div>
                <p>
                  <b>Build:</b> {strategy.advice}
                </p>
                <p className="strategy-counter">
                  <b>Countered by:</b> {strategy.counter}
                </p>
              </div>
            );
          })}
        </div>
      )}
      {tab === "Materials" && (
        <div className="compendium-materials">
          <p>
            Every material below is driven by the same numbers used in the
            damage solver. Click a material to open the full reference guide.
          </p>
          <div className="material-mini-grid">
            {Object.entries(MATERIAL_PROFILES).map(([key, value]) => {
              const parts = CATALOG.filter((d) => d.material === key);
              return (
                <button
                  key={key}
                  onClick={onMaterials}
                  style={{ borderColor: value.color }}
                >
                  <span
                    className="material-chip"
                    style={{ background: value.color }}
                  />
                  <strong>{value.label}</strong>
                  <small>
                    {parts.length} components · hardness {value.hardness} ·
                    impact ×{value.resist.impact ?? 1}
                  </small>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </Dialog>
  );
}
