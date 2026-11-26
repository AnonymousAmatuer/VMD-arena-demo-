"use client";
import { useState, type Dispatch, type SetStateAction } from "react";
import { Check, Paintbrush, Play, Sparkles, Volume2 } from "lucide-react";
import {
  DEFAULT_LIVERY,
  DECALS,
  EXHAUSTS,
  HORNS,
  PAINT_COLORS,
  PATTERNS,
  VICTORIES,
  type Livery,
  type Profile,
} from "@/game/data";
import { Dialog } from "./UI";
import { sfx } from "@/game/audio";

const patternStyle = (l: Livery) => {
  if (l.pattern === "stripe")
    return `repeating-linear-gradient(0deg, ${l.accent} 0 12px, ${l.paint} 12px 34px)`;
  if (l.pattern === "checker")
    return `repeating-conic-gradient(${l.accent} 0 25%, ${l.paint} 0 50%) 0 0 / 24px 24px`;
  if (l.pattern === "camo")
    return `radial-gradient(circle at 20% 30%, ${l.accent} 0 18%, transparent 19%), radial-gradient(circle at 72% 65%, ${l.accent} 0 22%, transparent 23%), ${l.paint}`;
  if (l.pattern === "flame")
    return `linear-gradient(10deg, ${l.accent} 0 32%, ${l.paint} 33%)`;
  return l.paint;
};

export default function CustomizeDialog({
  profile,
  setProfile,
  onClose,
  notify,
}: {
  profile: Profile;
  setProfile: Dispatch<SetStateAction<Profile>>;
  onClose: () => void;
  notify: (s: string) => void;
}) {
  const [livery, setLivery] = useState<Livery>({
    ...DEFAULT_LIVERY,
    ...(profile.vehicle.livery ?? {}),
  });
  const [name, setName] = useState(profile.vehicle.name);
  const update = <K extends keyof Livery>(key: K, value: Livery[K]) =>
    setLivery((l) => ({ ...l, [key]: value }));
  const apply = () => {
    if (!name.trim()) return;
    setProfile((p) => ({
      ...p,
      vehicle: { ...p.vehicle, name: name.trim().slice(0, 60), livery },
    }));
    sfx("mount");
    notify(`“${name.trim()}” is ready for the arena.`);
    onClose();
  };
  return (
    <Dialog
      title="Vehicle customization"
      kicker="WORKSHOP / IDENTITY & PRESENTATION"
      onClose={onClose}
      className="customize-modal"
    >
      <div className="customize-layout">
        <div className="customize-preview">
          <div
            className="preview-car"
            style={{
              background: patternStyle(livery),
              borderColor: livery.accent,
            }}
          >
            <span className="preview-decal">
              {DECALS.find((d) => d.key === livery.decal)?.glyph}
            </span>
            <span
              className="preview-plate"
              style={{ borderColor: livery.lights }}
            >
              {livery.plate || "VMD"}
            </span>
            <i
              className="preview-light a"
              style={{
                background: livery.lights,
                boxShadow: `0 0 14px ${livery.lights}`,
              }}
            />
            <i
              className="preview-light b"
              style={{
                background: livery.lights,
                boxShadow: `0 0 14px ${livery.lights}`,
              }}
            />
            <span
              className="preview-exhaust"
              style={{
                background: EXHAUSTS.find((e) => e.key === livery.exhaust)
                  ?.color,
              }}
            />
          </div>
          <strong className="preview-name">{name || "Your machine"}</strong>
          <small>
            Changes are saved with this vehicle and every garage blueprint.
          </small>
        </div>
        <div className="customize-controls">
          <label className="form-field">
            VEHICLE NAME
            <input
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <div className="customize-group">
            <h4>
              <Paintbrush size={14} /> Paint job
            </h4>
            <div className="swatches">
              {PAINT_COLORS.map((c, i) => (
                <button
                  key={c}
                  aria-label={`Paint ${i + 1}`}
                  className={livery.paint === c ? "active" : ""}
                  style={{ background: c }}
                  onClick={() => update("paint", c)}
                >
                  {livery.paint === c && <Check size={13} />}
                </button>
              ))}
            </div>
            <label className="inline-color">
              Custom colour{" "}
              <input
                type="color"
                value={livery.paint}
                onChange={(e) => update("paint", e.target.value)}
              />
            </label>
          </div>
          <div className="customize-group">
            <h4>
              <Sparkles size={14} /> Accent & pattern
            </h4>
            <div className="swatches">
              {PAINT_COLORS.map((c, i) => (
                <button
                  key={c}
                  aria-label={`Accent ${i + 1}`}
                  className={livery.accent === c ? "active" : ""}
                  style={{ background: c }}
                  onClick={() => update("accent", c)}
                >
                  {livery.accent === c && <Check size={13} />}
                </button>
              ))}
            </div>
            <div className="chip-row">
              {PATTERNS.map((p) => (
                <button
                  key={p.key}
                  className={livery.pattern === p.key ? "active" : ""}
                  onClick={() => update("pattern", p.key)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="customize-group">
            <h4>Decal</h4>
            <div className="chip-row">
              {DECALS.map((d) => (
                <button
                  key={d.key}
                  className={livery.decal === d.key ? "active" : ""}
                  onClick={() => update("decal", d.key)}
                >
                  {d.glyph || "None"} {d.label}
                </button>
              ))}
            </div>
          </div>
          <div className="customize-group">
            <h4>Animated lights & plate</h4>
            <label className="inline-color">
              Light colour{" "}
              <input
                type="color"
                value={livery.lights}
                onChange={(e) => update("lights", e.target.value)}
              />
            </label>
            <label className="form-field">
              NUMBER PLATE
              <input
                maxLength={12}
                value={livery.plate}
                onChange={(e) => update("plate", e.target.value.slice(0, 12))}
              />
            </label>
          </div>
          <div className="customize-group">
            <h4>Exhaust effect</h4>
            <div className="chip-row">
              {EXHAUSTS.map((e) => (
                <button
                  key={e.key}
                  className={livery.exhaust === e.key ? "active" : ""}
                  onClick={() => update("exhaust", e.key)}
                >
                  <i style={{ background: e.color }} />
                  {e.label}
                </button>
              ))}
            </div>
          </div>
          <div className="customize-group">
            <h4>
              <Volume2 size={14} /> Horn
            </h4>
            <div className="chip-row">
              {HORNS.map((h) => (
                <button
                  key={h.key}
                  className={livery.horn === h.key ? "active" : ""}
                  onClick={() => {
                    update("horn", h.key);
                    sfx("horn", h.key);
                  }}
                >
                  {h.label}
                </button>
              ))}
            </div>
            <button
              className="dark-button"
              onClick={() => sfx("horn", livery.horn)}
            >
              <Play size={13} /> Test horn
            </button>
          </div>
          <div className="customize-group">
            <h4>Victory animation</h4>
            <div className="chip-row">
              {VICTORIES.map((v) => (
                <button
                  key={v.key}
                  className={livery.victory === v.key ? "active" : ""}
                  onClick={() => update("victory", v.key)}
                >
                  {v.label}
                </button>
              ))}
            </div>
            <div className={`victory-demo ${livery.victory}`}>
              {livery.victory === "confetti"
                ? "✦ ✧ ★"
                : livery.victory === "leap"
                  ? "▲"
                  : livery.victory === "spin"
                    ? "↻"
                    : "V"}
            </div>
          </div>
          <button className="primary wide" onClick={apply}>
            <Check size={15} /> Apply to vehicle
          </button>
        </div>
      </div>
    </Dialog>
  );
}
