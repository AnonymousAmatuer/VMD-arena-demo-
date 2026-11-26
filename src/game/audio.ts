import type { Settings } from "./data";
let ctx: AudioContext | null = null;
let cfg: Settings = {
  quality: "High",
  sound: 55,
  crowd: 25,
  voice: true,
  muted: false,
  shake: true,
  cinematic: true,
  crowdQuality: "High",
  cameraIntensity: 100,
  countdownVolume: 80,
  announcerVolume: 70,
  motionBlur: true,
  reducedMotion: false,
};
export function configureAudio(s: Settings) {
  cfg = s;
  updateMusicVolumes();
}
export function unlockAudio() {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
  } catch {}
  startMusicScene();
  playPendingCommentary();
}
function tone(
  hz: number,
  duration: number,
  type: OscillatorType = "sine",
  power = 0.12,
  slide = 0,
) {
  if (!ctx || cfg.muted || cfg.sound === 0) return;
  const o = ctx.createOscillator(),
    g = ctx.createGain(),
    t = ctx.currentTime;
  o.type = type;
  o.frequency.setValueAtTime(hz, t);
  o.frequency.exponentialRampToValueAtTime(
    Math.max(24, hz + slide),
    t + duration,
  );
  g.gain.setValueAtTime((power * cfg.sound) / 100, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  o.connect(g);
  g.connect(ctx.destination);
  o.start();
  o.stop(t + duration);
}
function noise(
  duration: number,
  power: number,
  frequency: number,
  crowd = false,
) {
  if (!ctx || cfg.muted) return;
  const vol = (crowd ? cfg.crowd : cfg.sound) / 100;
  if (!vol) return;
  const b = ctx.createBuffer(
      1,
      Math.ceil(ctx.sampleRate * duration),
      ctx.sampleRate,
    ),
    a = b.getChannelData(0);
  for (let i = 0; i < a.length; i++) a[i] = Math.random() * 2 - 1;
  const s = ctx.createBufferSource(),
    f = ctx.createBiquadFilter(),
    g = ctx.createGain(),
    t = ctx.currentTime;
  s.buffer = b;
  f.type = "lowpass";
  f.frequency.value = frequency;
  g.gain.setValueAtTime(power * vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  s.connect(f);
  f.connect(g);
  g.connect(ctx.destination);
  s.start();
}
export type Sfx =
  | "click"
  | "mount"
  | "fire"
  | "impact"
  | "break"
  | "rail"
  | "start"
  | "win"
  | "lose"
  | "lift"
  | "crowd"
  | "engine"
  | "jam"
  | "splash"
  | "clank"
  | "countdown"
  | "fight"
  | "cheer"
  | "horn";
export function sfx(event: Sfx, material: string = "steel") {
  const count =
    event === "countdown" || event === "fight"
      ? (cfg.countdownVolume ?? 80) / 100
      : 1;
  switch (event) {
    case "click":
      tone(610, 0.065, "sine", 0.04, -120);
      break;
    case "mount":
      tone(240, 0.12, "triangle", 0.15, 420);
      noise(0.08, 0.16, 2400);
      break;
    case "fire":
      tone(210, 0.16, "sawtooth", 0.15, -155);
      noise(0.13, 0.27, 1900);
      break;
    case "impact":
      noise(0.15, 0.32, 1400);
      tone(89, 0.2, "triangle", 0.2, -50);
      break;
    case "break":
      if (["wood", "hardwood", "cardboard", "box"].includes(material)) {
        noise(0.3, 0.42, 1300);
        tone(170, 0.25, "triangle", 0.12, -90);
      } else if (["stone", "ceramic"].includes(material)) {
        noise(0.55, 0.45, 800);
        tone(92, 0.46, "sawtooth", 0.14, -45);
      } else if (["rubber", "reinforced-rubber", "foam"].includes(material)) {
        noise(0.24, 0.26, 600);
        tone(130, 0.2, "sine", 0.09, -30);
      } else {
        noise(0.42, 0.34, 3400);
        tone(410, 0.33, "triangle", 0.11, -300);
        tone(146, 0.4, "sawtooth", 0.1, -100);
      }
      break;
    case "jam":
      tone(140, 0.16, "square", 0.11, -55);
      noise(0.2, 0.22, 900);
      break;
    case "splash":
      noise(0.3, 0.26, 700);
      tone(280, 0.22, "sine", 0.06, -150);
      break;
    case "clank":
      tone(520, 0.1, "triangle", 0.1, -280);
      noise(0.08, 0.16, 2200);
      break;
    case "rail":
      tone(1200, 0.25, "sawtooth", 0.13, -1100);
      break;
    case "lift":
      tone(90, 0.45, "triangle", 0.13, 290);
      break;
    case "start":
      tone(140, 0.55, "sawtooth", 0.16, 430);
      break;
    case "countdown":
      tone(148, 0.5, "sawtooth", 0.22 * count, -70);
      noise(0.24, 0.34 * count, 1500);
      tone(58, 0.6, "sine", 0.26 * count, -18);
      break;
    case "fight":
      [196, 262, 330, 392].forEach((n, i) =>
        setTimeout(() => tone(n, 0.42, "sawtooth", 0.16), i * 55),
      );
      noise(0.5, 0.3, 2400);
      break;
    case "horn": {
      const kind = material || "stock";
      if (kind === "airhorn") {
        tone(196, 0.5, "sawtooth", 0.16, -30);
        tone(262, 0.5, "sawtooth", 0.13, -40);
      } else if (kind === "whistle") tone(1420, 0.35, "sine", 0.1, 380);
      else if (kind === "siren") {
        tone(620, 0.22, "square", 0.1, 220);
        setTimeout(() => tone(840, 0.24, "square", 0.1, -220), 230);
      } else tone(420, 0.2, "triangle", 0.11, -120);
      break;
    }
    case "cheer": {
      const level = (cfg.crowd ?? 25) / 100;
      if (level <= 0) break;
      noise(2.4, 0.3 * level, 780, true);
      noise(1.2, 0.18 * level, 1800, true);
      const whistles = 3 + Math.floor(Math.random() * 4);
      for (let i = 0; i < whistles; i++)
        setTimeout(
          () =>
            tone(1750 + Math.random() * 900, 0.16, "sine", 0.05 * level, 240),
          i * 190 + Math.random() * 260,
        );
      break;
    }
    case "crowd":
      noise(1.8, 0.19, 900, true);
      break;
    case "engine":
      tone(59, 0.19, "sawtooth", 0.025, 12);
      break;
    case "win":
      [262, 330, 392, 523].forEach((n, i) =>
        setTimeout(() => tone(n, 0.5, "triangle", 0.15), i * 130),
      );
      break;
    case "lose":
      tone(185, 0.7, "triangle", 0.15, -100);
      break;
  }
}
export type CommentaryCue =
  | "intro"
  | "build-up"
  | "interesting"
  | "rivalry"
  | "hit"
  | "first-hit"
  | "hit-streak"
  | "hot-streak"
  | "destructive"
  | "helpless"
  | "victory"
  | "opponent"
  | "kablam"
  | "phenomenal"
  | "late-fight"
  | "end";

// Source clips live in music/commentary and are mirrored to public/commentary
// so the browser can load the same MP3 files as static assets.
const commentaryFiles: Record<CommentaryCue, string> = {
  intro: "For the Intro.mp3",
  "build-up": "really good build up here.mp3",
  interesting: "This match is really getting interesting here.mp3",
  rivalry: "Oh wow, this is peak rivalry between the 2 right here.mp3",
  hit: "Nice hit.mp3",
  "first-hit": "For the strike-1.mp3",
  "hit-streak": "For consecutive hits.mp3",
  "hot-streak": "Yo this is absolutely sensational, keep up the hit streak.mp3",
  destructive: "Now thats what I call Destructive.mp3",
  helpless: "His opponent is helpless there.mp3",
  victory: "Oh look, I can almost smell victory here for that player.mp3",
  opponent: "Well opponent what chance you've got.mp3",
  kablam: "Blam Kablam and the opponents going down.mp3",
  phenomenal: "this is absolutely phenomenal perfomance from both the players here.mp3",
  "late-fight": "everybody's giving everythign they got.mp3",
  end: "For the end part.mp3",
};

let commentaryAudio: HTMLAudioElement | null = null;
type PendingCommentary = { cue: CommentaryCue; gameTime: number };
let pendingCommentary: PendingCommentary | null = null;
let commentaryGameTime = 0;
const MAX_COMMENTARY_QUEUE_AGE = 6;
const urgentCommentary: ReadonlySet<CommentaryCue> = new Set([
  "victory",
  "late-fight",
  "kablam",
  "end",
]);

function commentaryIsStale(request: PendingCommentary) {
  return (
    !urgentCommentary.has(request.cue) &&
    commentaryGameTime - request.gameTime > MAX_COMMENTARY_QUEUE_AGE
  );
}

function playPendingCommentary() {
  if (!pendingCommentary || !commentaryAudio || cfg.muted || !cfg.voice) return;
  if (!commentaryAudio.paused) return;
  if (commentaryIsStale(pendingCommentary)) {
    pendingCommentary = null;
    return;
  }
  const request = pendingCommentary;
  pendingCommentary = null;
  commentaryAudio.src = `/commentary/${encodeURIComponent(commentaryFiles[request.cue])}`;
  commentaryAudio.currentTime = 0;
  void commentaryAudio.play().catch(() => {
    if (!pendingCommentary) pendingCommentary = request;
  });
}

/** Keep delayed commentary close to the match event that requested it. */
export function updateCommentaryTime(gameTime: number) {
  if (!Number.isFinite(gameTime)) return;
  commentaryGameTime = Math.max(commentaryGameTime, gameTime);
  if (pendingCommentary && commentaryIsStale(pendingCommentary))
    pendingCommentary = null;
}

/** Reset commentary state when a new match starts. */
export function resetCommentary() {
  pendingCommentary = null;
  commentaryGameTime = 0;
  if (commentaryAudio) {
    commentaryAudio.pause();
    commentaryAudio.currentTime = 0;
  }
}

/** Play one recorded arena line at the time its game event occurs. */
export function playCommentary(cue: CommentaryCue, gameTime = commentaryGameTime) {
  if (
    typeof Audio === "undefined" ||
    cfg.muted ||
    !cfg.voice ||
    (cfg.announcerVolume ?? 0) <= 0
  )
    return;
  commentaryAudio ??= new Audio();
  commentaryAudio.preload = "auto";
  commentaryAudio.volume = (cfg.announcerVolume ?? 70) / 100;
  commentaryAudio.onended = () => {
    playPendingCommentary();
  };
  commentaryGameTime = Math.max(commentaryGameTime, gameTime);
  const request = { cue, gameTime };
  if (!commentaryAudio.paused && urgentCommentary.has(cue)) {
    commentaryAudio.pause();
    commentaryAudio.currentTime = 0;
  }
  pendingCommentary = request;
  playPendingCommentary();
}

type MusicScene = "menu" | "battle";
let musicScene: MusicScene = "menu";
let menuMusic: HTMLAudioElement | null = null;
let battleMusic: HTMLAudioElement | null = null;
let crowdChant: HTMLAudioElement | null = null;

function updateMusicVolumes() {
  if (menuMusic) menuMusic.volume = cfg.muted ? 0 : cfg.sound / 100;
  if (battleMusic) battleMusic.volume = cfg.muted ? 0 : cfg.sound / 100;
  if (crowdChant) crowdChant.volume = cfg.muted ? 0 : cfg.crowd / 100;
  if (commentaryAudio)
    commentaryAudio.volume = cfg.muted || !cfg.voice
      ? 0
      : (cfg.announcerVolume ?? 70) / 100;
}

function startLoop(audio: HTMLAudioElement) {
  audio.loop = true;
  void audio.play().catch(() => {
    // Browsers can block autoplay until the next user gesture; unlockAudio retries.
  });
}

function startMusicScene() {
  if (typeof Audio === "undefined") return;
  menuMusic ??= new Audio("/menu-music.mp3");
  battleMusic ??= new Audio("/battle-music.mp3");
  crowdChant ??= new Audio("/arena-crowd.mp3");
  updateMusicVolumes();

  if (musicScene === "battle") {
    menuMusic.pause();
    startLoop(battleMusic);
    startLoop(crowdChant);
  } else {
    battleMusic.pause();
    crowdChant.pause();
    startLoop(menuMusic);
  }
}

/** Play the battle score and crowd from the stadium intro through match end. */
export function setMusicScene(scene: MusicScene) {
  const activeMusic = scene === "menu" ? menuMusic : battleMusic;
  if (musicScene === scene && activeMusic?.paused === false)
    return;
  musicScene = scene;
  if (scene === "menu") {
    battleMusic?.pause();
    crowdChant?.pause();
    if (battleMusic) battleMusic.currentTime = 0;
    if (crowdChant) crowdChant.currentTime = 0;
  } else {
    menuMusic?.pause();
    if (menuMusic) menuMusic.currentTime = 0;
  }
  startMusicScene();
}
