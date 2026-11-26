"use client";
import { useState } from "react";
import {
  Activity,
  Anchor,
  BatteryCharging,
  Boxes,
  Cog,
  Crosshair,
  Eye,
  EyeOff,
  Gauge,
  GitBranch,
  Info,
  Layers3,
  Scale,
  Shield,
  Weight,
  Zap,
} from "lucide-react";
import {
  DEF,
  MATERIAL_PROFILES,
  metrics,
  partCost,
  partHP,
  itemRating,
  type Profile,
  type V3,
} from "@/game/data";
import { Dialog, SalvageIcon, PartFacts } from "./UI";

interface Props {
  profile: Profile;
  selected: string | null;
  onSelect: (id: string | null) => void;
  showCom: boolean;
  setShowCom: (v: boolean) => void;
  showLinks: boolean;
  setShowLinks: (v: boolean) => void;
  onClose: () => void;
}
const pct = (n: number) => `${Math.max(0, Math.min(100, Math.round(n)))}%`;
const axis = (v: V3) => v.map((n) => n.toFixed(2)).join(" / ");

export default function EngineeringAnalysis({
  profile,
  selected,
  onSelect,
  showCom,
  setShowCom,
  showLinks,
  setShowLinks,
  onClose,
}: Props) {
  const [tab, setTab] = useState<"Overview" | "Components" | "Materials">(
    "Overview",
  );
  const m = metrics(profile.vehicle);
  const part =
    profile.vehicle.parts.find((p) => p.id === selected) ??
    profile.vehicle.parts[0];
  const partDef = DEF[part.key];
  const material = MATERIAL_PROFILES[partDef.material];
  const rows = [...profile.vehicle.parts].sort(
    (a, b) =>
      DEF[a.key].category.localeCompare(DEF[b.key].category) ||
      DEF[a.key].name.localeCompare(DEF[b.key].name),
  );
  return (
    <Dialog
      title="Engineering analysis"
      kicker="INSPECTION / LIVE ASSEMBLY"
      onClose={onClose}
      className="analysis-modal"
    >
      <div className="page-tabs compact-tabs">
        {(["Overview", "Components", "Materials"] as const).map((t) => (
          <button
            key={t}
            className={tab === t ? "active" : ""}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "Overview" ? (
        <div className="analysis-body">
          <div className="analysis-score">
            <div>
              <small>OVERALL RATING</small>
              <strong>{m.rating}</strong>
            </div>
            <div>
              <small>SALVAGE</small>
              <strong>
                {m.cost}
                <em> / {profile.salvage}</em>
              </strong>
            </div>
            <div>
              <small>MASS</small>
              <strong>
                {m.mass}
                <em> kg</em>
              </strong>
            </div>
          </div>
          <div className="analysis-grid">
            {[
              [Shield, "Structural durability", `${m.hp} HP`],
              [Scale, "Armour rating", `${m.armor} / 100`],
              [Activity, "Structural integrity", `${m.structural} / 100`],
              [Gauge, "Mobility", `${m.mobility} / 100`],
              [Crosshair, "Weapon rating", `${m.firepower} / 100`],
              [Zap, "Flight capability", `${m.flight} / 100`],
              [Boxes, "Component count", `${m.parts}`],
              [Weight, "Assembly complexity", `${m.complexity} types`],
            ].map(([Icon, label, value]) => {
              const I = Icon as typeof Shield;
              return (
                <div className="analysis-stat" key={label as string}>
                  <I />
                  <small>{label as string}</small>
                  <b>{value as string}</b>
                </div>
              );
            })}
          </div>
          <div className="analysis-columns">
            <section>
              <h4>
                <Anchor size={14} />
                Mass &amp; centre of gravity
              </h4>
              <div className="detail-rows compact">
                <div>
                  <span>Centre of mass (local)</span>
                  <b>{axis(m.com)}</b>
                </div>
                <div>
                  <span>Front / rear load</span>
                  <b>
                    {m.front}% / {m.rear}%
                  </b>
                </div>
                <div>
                  <span>Left / right load</span>
                  <b>
                    {m.left}% / {m.right}%
                  </b>
                </div>
                <div>
                  <span>Balance score</span>
                  <b>{Math.round(m.balance * 100)}%</b>
                </div>
              </div>
              <div className="load-bars">
                <div>
                  <span>FRONT</span>
                  <i>
                    <b style={{ width: pct(m.front) }} />
                  </i>
                  <em>{m.front}%</em>
                </div>
                <div>
                  <span>REAR</span>
                  <i>
                    <b style={{ width: pct(m.rear) }} />
                  </i>
                  <em>{m.rear}%</em>
                </div>
                <div>
                  <span>LEFT</span>
                  <i>
                    <b style={{ width: pct(m.left) }} />
                  </i>
                  <em>{m.left}%</em>
                </div>
                <div>
                  <span>RIGHT</span>
                  <i>
                    <b style={{ width: pct(m.right) }} />
                  </i>
                  <em>{m.right}%</em>
                </div>
              </div>
            </section>
            <section>
              <h4>
                <BatteryCharging size={14} />
                Electrical architecture
              </h4>
              <div className="detail-rows compact">
                <div>
                  <span>Battery capacity</span>
                  <b>{m.powerCapacity} EP</b>
                </div>
                <div>
                  <span>Generation</span>
                  <b>+{m.powerGen} EP/s</b>
                </div>
                <div>
                  <span>Weapon demand</span>
                  <b>{m.powerDraw} EP/s</b>
                </div>
                <div>
                  <span>Power headroom</span>
                  <b className={m.powerBalance < 0 ? "orange" : ""}>
                    {m.powerBalance} EP
                  </b>
                </div>
                <div>
                  <span>Power components</span>
                  <b>{m.powerParts}</b>
                </div>
              </div>
              <div className="power-strip">
                <i style={{ width: pct(m.powerCapacity / 4) }} />
                <b>CAP</b>
                <span>GEN +{m.powerGen}/s</span>
                <span>DRAW {m.powerDraw}/s</span>
              </div>
            </section>
          </div>
          <div className="overlay-controls">
            <button
              className={showCom ? "active" : ""}
              onClick={() => setShowCom(!showCom)}
            >
              {showCom ? <Eye /> : <EyeOff />} <span>Centre of mass</span>
            </button>
            <button
              className={showLinks ? "active" : ""}
              onClick={() => setShowLinks(!showLinks)}
            >
              <GitBranch />
              <span>Structural connections</span>
            </button>
            <small>
              Overlays stay visible in the workshop after closing this panel.
            </small>
          </div>
        </div>
      ) : tab === "Components" ? (
        <div className="component-inspector">
          <div className="inspect-list">
            {rows.map((p) => {
              const d = DEF[p.key];
              return (
                <button
                  key={p.id}
                  className={p.id === part.id ? "active" : ""}
                  onClick={() => onSelect(p.id)}
                >
                  <span
                    className={`category-dot cat-${d.category.toLowerCase()}`}
                  />
                  <strong>{d.name}</strong>
                  <small>
                    {d.category} · {d.material}
                  </small>
                  <b>{partHP(p)} HP</b>
                  <em>{partCost(p)}S</em>
                </button>
              );
            })}
          </div>
          <div className="inspect-detail">
            <div className="eyebrow mint">
              {partDef.category.toUpperCase()} / {partDef.rarity.toUpperCase()}
            </div>
            <h3>{partDef.name}</h3>
            <p>{partDef.description}</p>
            <PartFacts part={partDef} />
            <div className="detail-rows compact">
              <div>
                <span>Material</span>
                <b>{material.label}</b>
              </div>
              <div>
                <span>Mechanical role</span>
                <b>
                  {partDef.trait === "none"
                    ? partDef.category === "Weapons"
                      ? "Weapon system"
                      : partDef.category === "Mobility"
                        ? "Mobility system"
                        : "Structural"
                    : partDef.trait}
                </b>
              </div>
              <div>
                <span>Health</span>
                <b>{partHP(part)} HP</b>
              </div>
              <div>
                <span>Build cost</span>
                <b>{partCost(part)} salvage</b>
              </div>
              <div>
                <span>Attachment</span>
                <b>
                  {part.parent
                    ? (DEF[
                        rows.find((p) => p.id === part.parent)?.key ?? "core"
                      ]?.name ?? part.parent)
                    : "Primary chassis"}
                </b>
              </div>
              <div>
                <span>Performance rating</span>
                <b>{itemRating(partDef)}</b>
              </div>
              <div>
                <span>Position / rotation</span>
                <b>
                  {axis(part.pos)} · {axis(part.rot)}°
                </b>
              </div>
            </div>
            <button
              className="dark-button wide"
              onClick={() => {
                onSelect(part.id);
                onClose();
              }}
            >
              <Layers3 /> Highlight in workshop
            </button>
          </div>
        </div>
      ) : (
        <div className="materials-body">
          <div className="inspect-detail">
            <div className="eyebrow mint">SELECTED MATERIAL</div>
            <h3>{material.label}</h3>
            <div className="material-swatches">
              {(
                Object.entries(MATERIAL_PROFILES) as [
                  keyof typeof MATERIAL_PROFILES,
                  typeof material,
                ][]
              )
                .filter(([key]) =>
                  rows.some((p) => DEF[p.key].material === key),
                )
                .map(([key, v]) => (
                  <button
                    key={key}
                    title={v.label}
                    className={key === partDef.material ? "active" : ""}
                    style={{ background: v.color }}
                    onClick={() =>
                      onSelect(
                        rows.find((p) => DEF[p.key].material === key)?.id ??
                          null,
                      )
                    }
                  >
                    <span>{v.label}</span>
                  </button>
                ))}
            </div>
            <div className="detail-rows compact">
              <div>
                <span>Density index</span>
                <b>{material.density}</b>
              </div>
              <div>
                <span>Hardness</span>
                <b>{material.hardness}</b>
              </div>
              <div>
                <span>Elasticity</span>
                <b>{material.elasticity}</b>
              </div>
              <div>
                <span>Friction coefficient</span>
                <b>{material.friction}</b>
              </div>
              <div>
                <span>Damage resistance</span>
                <b>
                  cut {material.resist.cut ?? 1}× · impact{" "}
                  {material.resist.impact ?? 1}× · blunt{" "}
                  {material.resist.blunt ?? 1}×
                </b>
              </div>
            </div>
            <p className="hint-text">
              <Info size={12} /> Values below 1.0 resist that damage type. These
              multipliers are applied in real time to each component's health.
            </p>
          </div>
        </div>
      )}
    </Dialog>
  );
}
