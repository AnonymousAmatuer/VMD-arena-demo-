"use client";
import { useState, type SetStateAction, type Dispatch } from "react";
import {
  Activity,
  Film,
  ArrowRight,
  AudioLines,
  BookOpen,
  Box,
  Check,
  ChevronRight,
  Coins,
  Flag,
  Gamepad2,
  Gauge,
  Keyboard,
  Layers3,
  Lock,
  Monitor,
  Mouse,
  Radio,
  RotateCcw,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Speaker,
  Sparkles,
  Trophy,
  User,
  Volume2,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import {
  metrics,
  opponent,
  type Profile,
  type Settings,
  type Quality,
} from "@/game/data";
import { Dialog, SalvageIcon, pad } from "./UI";
import { sfx, unlockAudio } from "@/game/audio";
export function SettingsDialog({
  profile,
  setProfile,
  onClose,
  onReset,
}: {
  profile: Profile;
  setProfile: Dispatch<SetStateAction<Profile>>;
  onClose: () => void;
  onReset: () => void;
}) {
  const s = profile.settings;
  const update = (patch: Partial<Settings>) =>
    setProfile((p) => ({ ...p, settings: { ...p.settings, ...patch } }));
  return (
    <Dialog
      title="System settings"
      kicker="ENGINEERING OS / PREFERENCES"
      onClose={onClose}
    >
      <div className="settings-section">
        <h3>
          <Monitor size={16} />
          Rendering quality
        </h3>
        <div className="seg-control">
          {(["Low", "Medium", "High", "Ultra"] as const).map((q) => (
            <button
              key={q}
              className={s.quality === q ? "active" : ""}
              onClick={() => update({ quality: q })}
            >
              {q}
            </button>
          ))}
        </div>
        <p className="small-copy">
          Resolution and shadows adapt automatically when frame time rises.
        </p>
        <label className="switch-row">
          Impact camera shake
          <input
            type="checkbox"
            checked={s.shake}
            onChange={(e) => update({ shake: e.target.checked })}
          />
          <i />
        </label>
      </div>
      <div className="settings-section">
        <h3>
          <AudioLines size={16} />
          Audio mix
        </h3>
        {(["sound", "crowd"] as const).map((k) => (
          <label className="range-field" key={k}>
            <span>
              {k === "sound" ? "Mechanical & effects" : "Crowd ambience"}
              <b>{s[k]}%</b>
            </span>
            <input
              type="range"
              aria-label={k === "sound" ? "Effects volume" : "Crowd volume"}
              min="0"
              max="100"
              value={s[k]}
              onChange={(e) => update({ [k]: +e.target.value })}
              onPointerUp={() => {
                unlockAudio();
                sfx(k === "crowd" ? "crowd" : "mount");
              }}
            />
          </label>
        ))}
        <label className="switch-row">
          Recorded commentator clips
          <input
            type="checkbox"
            checked={s.voice}
            onChange={(e) => update({ voice: e.target.checked })}
          />
          <i />
        </label>
        <label className="switch-row">
          Mute all audio
          <input
            type="checkbox"
            checked={s.muted}
            onChange={(e) => update({ muted: e.target.checked })}
          />
          <i />
        </label>
      </div>
      <div className="settings-section">
        <h3>
          <Film size={16} /> Presentation
        </h3>
        <label className="switch-row">
          Cinematic match introduction
          <input
            type="checkbox"
            checked={s.cinematic}
            onChange={(e) => update({ cinematic: e.target.checked })}
          />
          <i />
        </label>
        <label className="switch-row">
          Reduced motion
          <input
            type="checkbox"
            checked={s.reducedMotion}
            onChange={(e) => update({ reducedMotion: e.target.checked })}
          />
          <i />
        </label>
        <label className="switch-row">
          Motion blur
          <input
            type="checkbox"
            checked={s.motionBlur}
            onChange={(e) => update({ motionBlur: e.target.checked })}
          />
          <i />
        </label>
        <div className="seg-control">
          {(["Low", "Medium", "High"] as const).map((q) => (
            <button
              key={q}
              className={s.crowdQuality === q ? "active" : ""}
              onClick={() => update({ crowdQuality: q })}
            >
              {q} crowd
            </button>
          ))}
        </div>
        <label className="range-field">
          <span>
            Camera movement intensity <b>{s.cameraIntensity}%</b>
          </span>
          <input
            type="range"
            aria-label="Camera movement intensity"
            min="0"
            max="100"
            value={s.cameraIntensity}
            onChange={(e) => update({ cameraIntensity: +e.target.value })}
          />
        </label>
        <label className="range-field">
          <span>
            Countdown volume <b>{s.countdownVolume}%</b>
          </span>
          <input
            type="range"
            aria-label="Countdown volume"
            min="0"
            max="100"
            value={s.countdownVolume}
            onChange={(e) => update({ countdownVolume: +e.target.value })}
          />
        </label>
        <label className="range-field">
          <span>
            Announcer volume <b>{s.announcerVolume}%</b>
          </span>
          <input
            type="range"
            aria-label="Announcer volume"
            min="0"
            max="100"
            value={s.announcerVolume}
            onChange={(e) => update({ announcerVolume: +e.target.value })}
          />
        </label>
        <p className="small-copy">
          Presentation settings only affect the show. Combat physics are never
          altered by them.
        </p>
      </div>
      <div className="settings-bottom">
        <button className="text-button danger" onClick={onReset}>
          <RotateCcw size={13} />
          Reset progress
        </button>
        <button className="primary" onClick={onClose}>
          <Check size={15} />
          Done
        </button>
      </div>
    </Dialog>
  );
}
export function Manual({
  onClose,
  startStory = false,
}: {
  onClose: () => void;
  startStory?: boolean;
}) {
  const [tab, setTab] = useState(startStory ? "Pip’s story" : "Workshop");
  return (
    <Dialog
      title="Engineer field guide"
      kicker="VMD / OPERATOR HANDBOOK"
      onClose={onClose}
      className="manual-modal"
    >
      <div className="page-tabs compact-tabs">
        {["Workshop", "Combat", "Pip’s story"].map((t) => (
          <button
            className={tab === t ? "active" : ""}
            onClick={() => setTab(t)}
            key={t}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "Pip’s story" ? (
        <div className="story-content">
          <img src="/arts/pip.webp" alt="Pip the platypus engineer" />
          <div className="eyebrow orange">THE PLATYPUS 3D ENGINEER</div>
          <h3>Small engineer. Big ambitions.</h3>
          <p>
            In an age when animals are Earth’s greatest inventors, the VMD
            Championship is the ultimate proving ground. Every year, the
            cleverest engineers roll their wildest machines into the arena.
          </p>
          <p>
            From a little workshop by the river, Pip has built his first
            contender. Thirty salvage, four wheels, and a very ambitious
            platypus. The rest is up to you.
          </p>
        </div>
      ) : tab === "Workshop" ? (
        <>
          <p>
            Pick a component from the library to preview it on your machine. A
            green outline means a valid attachment; red indicates a collision or
            an over-budget build.
          </p>
          <div className="guide-entry">
            <Box />
            <div>
              <h4>Box construction</h4>
              <p>
                Drop the part directly on the face you want. On a touchscreen,
                start with the grip icon on a library card. Drag a mounted part
                to move it together with its attachments.
              </p>
            </div>
          </div>
          <div className="guide-entry">
            <SlidersHorizontal />
            <div>
              <h4>Custom engineering</h4>
              <p>
                Drag along a face to position a part. Switch snapping off for
                fine placement, or adjust the position, rotation and dimensions
                numerically.
              </p>
            </div>
          </div>
          <div className="key-list">
            {[
              ["Drag a part / its grip", "Mount or move a part"],
              ["Drag background / pinch", "Orbit / zoom the camera"],
              ["R / Enter", "Rotate / attach preview"],
              ["Ctrl Z / Ctrl Shift Z", "Undo / redo"],
              ["Ctrl D / Delete", "Duplicate / remove selection"],
              ["Ctrl S", "Save a named blueprint"],
            ].map(([a, b]) => (
              <div key={a}>
                <kbd>{a}</kbd>
                <span>{b}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <p>
            Defeat the rival by breaking their central chassis. If time expires,
            the machine with the highest percentage of structural health wins.
          </p>
          <div className="key-list">
            {[
              ["W / S", "Accelerate / reverse"],
              ["A / D", "Steer left / right"],
              ["F / hold click", "Fire all ready weapons"],
              ["Space", "Hop, boost, lift, or recover"],
              ["Drag / C", "Orbit / restore the follow camera"],
              ["Esc", "Pause the match"],
            ].map(([a, b]) => (
              <div key={a}>
                <kbd>{a}</kbd>
                <span>{b}</span>
              </div>
            ))}
          </div>
          <div className="guide-entry">
            <Zap />
            <div>
              <h4>Energy & targeting</h4>
              <p>
                Weapons share a regenerating energy supply. Face the opponent
                for aim assist. Melee parts must be within reach. Losing a
                mounted part also releases its attachments.
              </p>
            </div>
          </div>
          <div className="info-band">
            <Gamepad2 size={18} />
            <span>
              Touch controls are always available in the arena. Hold a direction
              to drive and hold Fire to attack.
            </span>
          </div>
        </>
      )}
    </Dialog>
  );
}
export function Versus({
  profile,
  level,
  onStart,
  onClose,
}: {
  profile: Profile;
  level: number;
  onStart: () => void;
  onClose: () => void;
}) {
  const r = opponent(level);
  return (
    <Dialog
      title="Match briefing"
      kicker={`VMD CHAMPIONSHIP / ROUND ${pad(level)}`}
      onClose={onClose}
      className="versus-dialog"
    >
      <div className="versus-stage">
        <div className="versus-fighter left">
          <img src="/arts/pip.webp" alt="Pip the platypus" />
          <div>
            <span className="fighter-tag">PLAYER ONE</span>
            <small>PLATYPUS ENGINEER</small>
            <h3>{profile.engineer}</h3>
            <p>{profile.vehicle.name}</p>
            <b>
              <Activity size={13} />
              {metrics(profile.vehicle).rating} VR <i>//</i> RANK{" "}
              {pad(Math.floor(profile.xp / 300) + 1)}
            </b>
          </div>
        </div>
        <strong className="vs-badge">VS</strong>
        <div className="versus-fighter right">
          <img src={`/arts/${r.art}.webp`} alt={`${r.name} the ${r.species}`} />
          <div>
            <span className="fighter-tag">CHALLENGER</span>
            <small>{r.species.toUpperCase()} ENGINEER</small>
            <h3>{r.name}</h3>
            <p>{r.vehicle.name}</p>
            <b>
              <Activity size={13} />
              {metrics(r.vehicle).rating} VR <i>//</i> TIER {pad(r.tier + 1)}
            </b>
          </div>
        </div>
      </div>
      <div className="versus-footer">
        <div>
          <small>CHAMPIONSHIP STAGE</small>
          <h4>{r.stage}</h4>
        </div>
        <button className="primary" onClick={onStart}>
          <Flag size={16} />
          Start engines
          <ChevronRight size={17} />
        </button>
      </div>
      <div className="briefing-controls">
        <span>
          <kbd>WASD</kbd> Drive
        </span>
        <span>
          <kbd>F</kbd> Fire
        </span>
        <span>
          <kbd>SPACE</kbd> Action
        </span>
        <span>
          <kbd>ESC</kbd> Pause
        </span>
      </div>
    </Dialog>
  );
}
