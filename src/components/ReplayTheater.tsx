"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import * as T from "three";
import {
  ChevronLeft,
  Download,
  Film,
  Pause,
  Play,
  RotateCcw,
  Skull,
  X,
  Zap,
} from "lucide-react";
import { createReplayStage } from "@/game/replayStage";
import {
  downloadBlob,
  exportReplayMp4,
  mp4ExportSupported,
  replayFileName,
} from "@/game/replayExport";
import {
  DEF,
  metrics,
  opponent,
  type ReplayEvent,
  type StoredReplay,
  type V3,
} from "@/game/data";
import { Dialog, SalvageIcon } from "./UI";
import { sfx } from "@/game/audio";

interface Props {
  replay: StoredReplay;
  onClose: () => void;
}

const SPEEDS = [0.25, 0.5, 1, 2] as const;

const EVENT_LABEL: Record<string, string> = {
  break: "COMPONENT DETACHED",
  impact: "IMPACT",
  jam: "WEAPON JAMMED",
  lift: "LIFT / BOOST",
  obstacle: "OBSTACLE DESTROYED",
};

export default function ReplayTheater({ replay, onClose }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const time = useRef(0);
  const playing = useRef(true);
  const speed = useRef(1);
  const frameAt = useRef(-1);
  const [displayTime, setDisplayTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [rate, setRate] = useState(1);
  const [selected, setSelected] = useState<ReplayEvent | null>(null);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [exportError, setExportError] = useState("");
  const [slowMotion, setSlowMotion] = useState(true);
  const [quality, setQuality] = useState<"480p" | "720p" | "1080p">("720p");
  const [lastSize, setLastSize] = useState(0);
  const [eta, setEta] = useState<number | null>(null);
  const exportStart = useRef(0);
  const [supported, setSupported] = useState(true);
  const abortRef = useRef<AbortController | null>(null);
  const exportingRef = useRef(false);
  useEffect(() => setSupported(mp4ExportSupported()), []);
  const rival = opponent(replay.level);
  const summary = useMemo(() => {
    const broken = replay.events.filter((e) => e.type === "break");
    const damage = [...(replay.damage ?? [])].sort(
      (a, b) => b.amount - a.amount,
    );
    return {
      broken,
      damage,
      impactful: replay.events.filter((e) => e.type === "impact").length,
    };
  }, [replay]);

  useEffect(() => {
    if (!host.current) return;
    const stage = createReplayStage(replay, rival.index);
    stage.canvas.style.cssText = "display:block;width:100%;height:100%";
    host.current.appendChild(stage.canvas);
    const resize = () =>
      stage.setSize(
        host.current?.clientWidth || 1,
        host.current?.clientHeight || 1,
      );
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host.current);
    let raf = 0;
    let last = performance.now();
    let hudAt = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const now = performance.now();
      if (exportingRef.current) {
        last = now;
        return;
      }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (playing.current) {
        time.current = Math.min(
          replay.duration,
          time.current + dt * speed.current,
        );
        if (time.current >= replay.duration) {
          playing.current = false;
          setIsPlaying(false);
        }
      }
      stage.renderAt(time.current);
      if (now - hudAt > 120) {
        hudAt = now;
        setDisplayTime(time.current);
      }
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      stage.dispose();
    };
  }, [replay.id]);

  async function download() {
    if (exporting) return;
    const controller = new AbortController();
    abortRef.current = controller;
    playing.current = false;
    setIsPlaying(false);
    setExporting(true);
    exportingRef.current = true;
    setExportError("");
    setProgress(0);
    setEta(null);
    exportStart.current = performance.now();
    try {
      const blob = await exportReplayMp4(replay, rival.index, {
        slowMotion,
        width: quality === "1080p" ? 1920 : quality === "480p" ? 854 : 1280,
        height: quality === "1080p" ? 1080 : quality === "480p" ? 480 : 720,
        fps: 60,
        signal: controller.signal,
        onProgress: (f) => {
          setProgress(f);
          const elapsed = (performance.now() - exportStart.current) / 1000;
          setEta(f > 0.03 ? Math.max(0, (elapsed / f) * (1 - f)) : null);
        },
      });
      downloadBlob(blob, replayFileName(replay));
      setLastSize(blob.size);
      sfx("mount");
    } catch (e) {
      if ((e as Error).name !== "AbortError")
        setExportError(
          (e as Error).message || "The video could not be created.",
        );
    } finally {
      setExporting(false);
      exportingRef.current = false;
      abortRef.current = null;
    }
  }

  const jump = (t: number) => {
    time.current = t;
    setDisplayTime(t);
    playing.current = false;
    setIsPlaying(false);
    sfx("click");
  };
  const fmt = (n: number) =>
    `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, "0")}.${Math.floor((n % 1) * 10)}`;
  const critical = replay.events
    .filter((e) => e.type === "break" || e.type === "impact")
    .slice(-8)
    .reverse();

  return (
    <Dialog
      title="Match replay"
      kicker={`DESTRUCTION ANALYSIS / ROUND ${String(replay.level).padStart(2, "0")}`}
      onClose={onClose}
      className="replay-dialog"
    >
      <div className="replay-stage" ref={host} />
      <div className="replay-transport">
        <button
          aria-label="Play or pause"
          onClick={() => {
            playing.current = !playing.current;
            setIsPlaying(playing.current);
          }}
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button
          aria-label="Restart replay"
          onClick={() => {
            time.current = 0;
            playing.current = true;
            setIsPlaying(true);
          }}
        >
          <RotateCcw size={15} />
        </button>
        <span className="replay-time">
          {fmt(displayTime)} / {fmt(replay.duration)}
        </span>
        <input
          aria-label="Replay timeline"
          type="range"
          min="0"
          max={replay.duration}
          step="0.1"
          value={displayTime}
          onChange={(e) => jump(+e.target.value)}
        />
        <div className="replay-rates">
          {SPEEDS.map((s) => (
            <button
              key={s}
              className={rate === s ? "active" : ""}
              onClick={() => {
                speed.current = s;
                setRate(s);
              }}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>
      <div className="replay-export">
        <div className="replay-export-head">
          <Film size={15} />
          <strong>Download replay video</strong>
          <span>MP4 · H.264 · 30 fps</span>
        </div>
        {!supported ? (
          <p className="replay-export-error">
            This browser cannot encode video. Open the replay in a recent
            Chrome, Edge, Safari or Firefox to download it.
          </p>
        ) : exporting ? (
          <div className="replay-export-progress">
            <div className="replay-progress-track">
              <i style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <span>
              Rendering {Math.round(progress * 100)}%
              {eta !== null && ` · ~${eta < 60 ? `${Math.ceil(eta)}s` : `${Math.ceil(eta / 60)} min`} left`}
            </span>
            <button
              className="dark-button"
              onClick={() => abortRef.current?.abort()}
            >
              <X size={13} /> Cancel
            </button>
          </div>
        ) : (
          <div className="replay-export-controls">
            <div className="replay-rates">
              {(["480p", "720p", "1080p"] as const).map((q) => (
                <button
                  key={q}
                  className={quality === q ? "active" : ""}
                  onClick={() => setQuality(q)}
                >
                  {q}
                </button>
              ))}
            </div>
            <label className="replay-check">
              <input
                type="checkbox"
                checked={slowMotion}
                onChange={(e) => setSlowMotion(e.target.checked)}
              />
              Slow motion on failures
            </label>
            <button className="primary" onClick={download}>
              <Download size={15} /> Download MP4
            </button>
          </div>
        )}
        {exportError && <p className="replay-export-error">{exportError}</p>}
        {lastSize > 0 && !exporting && (
          <p className="replay-export-done">
            Saved {replayFileName(replay)} · {(lastSize / 1048576).toFixed(1)}{" "}
            MB
          </p>
        )}
      </div>
      <div className="replay-summary">
        <div className={`replay-result ${replay.win ? "win" : "loss"}`}>
          {replay.win ? "VICTORY" : "DEFEAT"}
        </div>
        <div>
          <small>SCORE</small>
          <b>{replay.score.toLocaleString()}</b>
        </div>
        <div>
          <small>PARTS LOST</small>
          <b>{summary.broken.length}</b>
        </div>
        <div>
          <small>IMPACTS</small>
          <b>{summary.impactful}</b>
        </div>
      </div>
      <div className="replay-cause">
        <Skull size={16} />
        <div>
          <small>CAUSE OF LOSS</small>
          <strong>
            {replay.lossCause ??
              (replay.win
                ? "Your machine survived the round."
                : "The round ended on remaining structural health.")}
          </strong>
        </div>
      </div>
      <div className="replay-analysis">
        <section>
          <h4>
            <Zap size={14} /> Damage taken by component
          </h4>
          {summary.damage.length === 0 ? (
            <p className="empty-hint">No component damage was recorded.</p>
          ) : (
            <div className="damage-bars">
              {summary.damage.slice(0, 8).map((d, i) => (
                <button key={i} onClick={() => jump(d.t)}>
                  <span>{DEF[d.part]?.name ?? d.part}</span>
                  <i>
                    <b style={{ width: `${Math.min(100, d.amount * 2)}%` }} />
                  </i>
                  <em>{d.amount}</em>
                  <small>{d.cause}</small>
                </button>
              ))}
            </div>
          )}
        </section>
        <section>
          <h4>
            <SalvageIcon size={14} /> Failure timeline
          </h4>
          <div className="event-list">
            {critical.length === 0 && (
              <p className="empty-hint">No major failures were recorded.</p>
            )}
            {critical.map((e, i) => (
              <button
                key={i}
                className={selected === e ? "active" : ""}
                onClick={() => {
                  setSelected(e);
                  jump(e.t);
                }}
              >
                <span className="event-time">{fmt(e.t)}</span>
                <span className={`event-tag ${e.type}`}>
                  {EVENT_LABEL[e.type] ?? e.type.toUpperCase()}
                </span>
                <strong>
                  {e.label ??
                    e.material ??
                    (e.owner === 0 ? "Your machine" : "Rival")}
                </strong>
              </button>
            ))}
          </div>
        </section>
      </div>
      {selected && (
        <div className="event-detail">
          <span className="event-time">{fmt(selected.t)}</span>
          <b>{selected.label ?? EVENT_LABEL[selected.type] ?? selected.type}</b>
          <span>{selected.owner === 0 ? "Your machine" : "Rival machine"}</span>
          {selected.material && <span>Material: {selected.material}</span>}
          {selected.pos && (
            <span>
              Position: {selected.pos.map((n) => n.toFixed(1)).join(", ")}
            </span>
          )}
        </div>
      )}
      <div className="replay-meta">
        {replay.player.name} ({metrics(replay.player).rating} VR) vs{" "}
        {replay.rival.name} ({metrics(replay.rival).rating} VR) ·{" "}
        {new Date(replay.at).toLocaleString()}
      </div>
      <button className="dark-button wide" onClick={onClose}>
        <ChevronLeft size={14} /> Back to garage
      </button>
    </Dialog>
  );
}
