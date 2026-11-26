import { Muxer, ArrayBufferTarget } from "mp4-muxer";
import { createReplayStage } from "./replayStage";
import type { StoredReplay } from "./data";

/* Renders a stored replay offline, frame by frame, and encodes it as an
   H.264 MP4. Rendering is decoupled from wall-clock time, so the output is
   smooth regardless of how fast the device can draw. */

export interface ExportOptions {
  width?: number;
  height?: number;
  fps?: number;
  /** Slow down around component failures so the destruction is visible. */
  slowMotion?: boolean;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

const H264_CANDIDATES = [
  "avc1.640028",
  "avc1.4d0028",
  "avc1.42e01f",
  "avc1.42001f",
];

export function mp4ExportSupported() {
  return typeof window !== "undefined" && "VideoEncoder" in window;
}

async function pickCodec(width: number, height: number, fps: number) {
  for (const codec of H264_CANDIDATES) {
    const config: VideoEncoderConfig = {
      codec,
      width,
      height,
      // 0.22 bits per pixel per frame preserves fine arena and livery detail
      // while keeping 1080p exports within a practical download size.
      bitrate: Math.round(Math.min(24_000_000, Math.max(5_000_000, width * height * fps * 0.22))),
      framerate: fps,
      avc: { format: "avc" },
    };
    try {
      const res = await VideoEncoder.isConfigSupported(config);
      if (res.supported) return config;
    } catch {
      /* try next */
    }
  }
  return null;
}

/** Builds the playback time-line, slowing to 30% around critical failures. */
function buildTimeline(replay: StoredReplay, fps: number, slow: boolean) {
  const marks = replay.events.filter((e) => e.type === "break").map((e) => e.t);
  const times: number[] = [];
  let t = 0;
  const step = 1 / fps;
  while (t <= replay.duration && times.length < fps * 300) {
    times.push(t);
    const near = slow && marks.some((m) => t > m - 0.5 && t < m + 0.9);
    t += step * (near ? 0.3 : 1);
  }
  return { times, marks };
}

const fmt = (n: number) =>
  `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, "0")}`;

function drawOverlay(
  ctx: CanvasRenderingContext2D,
  replay: StoredReplay,
  t: number,
  slowed: boolean,
  w: number,
  h: number,
) {
  const s = h / 720;
  // Top bar
  const grad = ctx.createLinearGradient(0, 0, 0, 90 * s);
  grad.addColorStop(0, "rgba(4,8,10,0.85)");
  grad.addColorStop(1, "rgba(4,8,10,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, 90 * s);
  ctx.textBaseline = "middle";
  ctx.font = `italic 800 ${30 * s}px sans-serif`;
  ctx.fillStyle = "#ff8a3d";
  ctx.fillText("VMD", 28 * s, 36 * s);
  ctx.font = `600 ${15 * s}px monospace`;
  ctx.fillStyle = "#e9efe9";
  ctx.fillText(
    `CHAMPIONSHIP · ROUND ${String(replay.level).padStart(2, "0")} · REPLAY`,
    100 * s,
    36 * s,
  );
  ctx.textAlign = "right";
  ctx.font = `700 ${26 * s}px monospace`;
  ctx.fillText(fmt(t), w - 28 * s, 36 * s);
  ctx.textAlign = "left";
  // Names
  ctx.font = `700 ${18 * s}px sans-serif`;
  ctx.fillStyle = "#8fe0c4";
  ctx.fillText(
    `${replay.driver.toUpperCase()} · ${replay.player.name}`,
    28 * s,
    66 * s,
  );
  ctx.textAlign = "right";
  ctx.fillStyle = "#ffb27a";
  ctx.fillText(
    `${replay.opponent.toUpperCase()} · ${replay.rival.name}`,
    w - 28 * s,
    66 * s,
  );
  ctx.textAlign = "left";

  // Slow-motion badge
  if (slowed) {
    ctx.fillStyle = "rgba(60,24,10,0.85)";
    ctx.fillRect(w / 2 - 90 * s, 92 * s, 180 * s, 30 * s);
    ctx.fillStyle = "#ffc49e";
    ctx.font = `700 ${14 * s}px monospace`;
    ctx.textAlign = "center";
    ctx.fillText("SLOW MOTION", w / 2, 107 * s);
    ctx.textAlign = "left";
  }

  // Event ticker: failures in the last 2 seconds
  const recent = replay.events
    .filter(
      (e) =>
        (e.type === "break" || e.type === "jam") && e.t <= t && t - e.t < 2,
    )
    .slice(-3);
  recent.forEach((e, i) => {
    const y = h - (60 + i * 38) * s;
    const alpha = Math.max(0, 1 - (t - e.t) / 2);
    ctx.globalAlpha = alpha;
    ctx.fillStyle =
      e.owner === 0 ? "rgba(70,20,14,0.88)" : "rgba(14,50,38,0.88)";
    ctx.fillRect(24 * s, y - 15 * s, 430 * s, 30 * s);
    ctx.fillStyle = "#fff";
    ctx.font = `600 ${15 * s}px sans-serif`;
    const who = e.owner === 0 ? replay.driver : replay.opponent;
    const what =
      e.type === "jam" ? "weapon jammed" : `lost ${e.label ?? "a component"}`;
    ctx.fillText(`${fmt(e.t)}  ${who} ${what}`, 36 * s, y);
    ctx.globalAlpha = 1;
  });

  // Final result card
  if (t >= replay.duration - 1.5) {
    const a = Math.min(1, (t - (replay.duration - 1.5)) / 0.6);
    ctx.globalAlpha = a;
    ctx.fillStyle = "rgba(4,8,10,0.72)";
    ctx.fillRect(0, h / 2 - 70 * s, w, 140 * s);
    ctx.textAlign = "center";
    ctx.font = `italic 800 ${64 * s}px sans-serif`;
    ctx.fillStyle = replay.win ? "#8fe0c4" : "#ff9a72";
    ctx.fillText(replay.win ? "VICTORY" : "DEFEAT", w / 2, h / 2 - 12 * s);
    ctx.font = `600 ${17 * s}px monospace`;
    ctx.fillStyle = "#e6ece8";
    ctx.fillText(
      replay.lossCause ?? `Score ${replay.score.toLocaleString()}`,
      w / 2,
      h / 2 + 36 * s,
    );
    ctx.textAlign = "left";
    ctx.globalAlpha = 1;
  }
}

export async function exportReplayMp4(
  replay: StoredReplay,
  rivalIndex: number,
  options: ExportOptions = {},
): Promise<Blob> {
  if (!mp4ExportSupported())
    throw new Error(
      "This browser cannot encode video. Use a recent Chrome, Edge, Safari or Firefox.",
    );
  if (!replay.frames.length)
    throw new Error("This replay has no recorded frames.");
  const width = options.width ?? 1280,
    height = options.height ?? 720,
    fps = options.fps ?? 30;
  const config = await pickCodec(width, height, fps);
  if (!config)
    throw new Error("H.264 encoding is not available in this browser.");

  const stage = createReplayStage(replay, rivalIndex, {
    pixelRatio: 1.5,
    shadows: true,
  });
  stage.setSize(width, height);
  const compose = document.createElement("canvas");
  compose.width = width;
  compose.height = height;
  const ctx = compose.getContext("2d")!;

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: "avc", width, height, frameRate: fps },
    fastStart: "in-memory",
  });
  let failure: unknown = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => {
      failure = e;
    },
  });
  encoder.configure(config);

  const { times, marks } = buildTimeline(
    replay,
    fps,
    options.slowMotion ?? true,
  );
  try {
    for (let i = 0; i < times.length; i++) {
      if (options.signal?.aborted)
        throw new DOMException("Export cancelled", "AbortError");
      if (failure) throw failure;
      const t = times[i];
      stage.renderAt(t);
      ctx.drawImage(stage.canvas, 0, 0, width, height);
      const slowed =
        (options.slowMotion ?? true) &&
        marks.some((m) => t > m - 0.5 && t < m + 0.9);
      drawOverlay(ctx, replay, t, slowed, width, height);
      const frame = new VideoFrame(compose, {
        timestamp: Math.round((i * 1_000_000) / fps),
        duration: Math.round(1_000_000 / fps),
      });
      encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
      frame.close();
      while (encoder.encodeQueueSize > 8)
        await new Promise((r) => setTimeout(r, 4));
      if (i % 6 === 0) {
        options.onProgress?.(i / times.length);
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    await encoder.flush();
    if (failure) throw failure;
    muxer.finalize();
    options.onProgress?.(1);
    return new Blob([muxer.target.buffer], { type: "video/mp4" });
  } finally {
    if (encoder.state !== "closed") encoder.close();
    stage.dispose();
  }
}

export function replayFileName(replay: StoredReplay) {
  const clean = (s: string) =>
    s
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase();
  const d = new Date(replay.at);
  const date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `vmd-round${String(replay.level).padStart(2, "0")}-${clean(replay.driver)}-vs-${clean(replay.opponent)}-${date}.mp4`;
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
