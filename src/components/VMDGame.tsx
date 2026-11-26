"use client";
import { blendMemory } from "@/game/ai";
import { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  Award,
  BookOpen,
  Boxes,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  ChevronsRight,
  CircleHelp,
  Coins,
  Cpu,
  Flag,
  FolderOpen,
  Gamepad2,
  HardDrive,
  Keyboard,
  LayoutGrid,
  Medal,
  Menu,
  PackageCheck,
  Play,
  Radio,
  Settings,
  ShieldCheck,
  Star,
  Trophy,
  UserRound,
  Volume2,
  VolumeX,
  Warehouse,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import Workshop from "./Workshop";
import { Garage, Leaderboard, Tournament } from "./Championship";
import { Manual, SettingsDialog } from "./GameDialogs";
import VersusIntro from "./VersusIntro";
import CinemaSplash from "./CinemaSplash";
import MaterialEncyclopedia from "./MaterialEncyclopedia";
import ComponentEncyclopedia from "./ComponentEncyclopedia";
import ReplayTheater from "./ReplayTheater";
import { Brand, Dialog, SalvageIcon, pad } from "./UI";
import { useProfile } from "@/game/useProfile";
import {
  DEF,
  metrics,
  opponent,
  uid,
  recordMatch,
  engineerRecords,
  REPLAY_LIMIT,
  type MatchResult,
  type StoredReplay,
} from "@/game/data";
import {
  configureAudio,
  sfx,
  unlockAudio,
  playCommentary,
  resetCommentary,
  setMusicScene,
} from "@/game/audio";
import type { Outcome } from "@/game/simulation";
const Battle = dynamic(() => import("./BattleArena"), {
  ssr: false,
  loading: () => (
    <div className="battle-loading">
      <span className="loading-ring" />
      PREPARING THE ARENA
    </div>
  ),
});
type Tab = "Workshop" | "Tournament" | "Garage" | "Leaderboard";
type Modal =
  | "settings"
  | "guide"
  | "story"
  | "profile"
  | "result"
  | "reset"
  | "splash"
  | "encyclopedia"
  | "compendium"
  | "materials"
  | "replay"
  | null;
export default function VMDGame() {
  const { profile, setProfile, saveState, reset, ready } = useProfile();
  const [tab, setTab] = useState<Tab>("Workshop"),
    [modal, setModal] = useState<Modal>(null),
    [splashOpen, setSplashOpen] = useState(true),
    [versusOpen, setVersusOpen] = useState(false),
    [activeReplay, setActiveReplay] = useState<string | null>(null),
    [lab, setLab] = useState(false),
    [round, setRound] = useState(1),
    [fighting, setFighting] = useState(false),
    [toast, setToast] = useState(""),
    [pilotName, setPilotName] = useState("Pip"),
    [result, setResult] = useState<
      | (MatchResult & {
          salvageReward: number;
          coinsReward: number;
          xpReward: number;
          unlock: string | null;
        })
      | null
    >(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    resolved = useRef(false);
  useEffect(() => configureAudio(profile.settings), [profile.settings]);
  useEffect(
    () => setMusicScene(fighting || versusOpen ? "battle" : "menu"),
    [fighting, versusOpen],
  );
  useEffect(() => {
    const fn = () => unlockAudio();
    window.addEventListener("pointerdown", fn, { once: true });
    return () => window.removeEventListener("pointerdown", fn);
  }, []);
  useEffect(() => {
    const dismiss = (e: KeyboardEvent) => {
      if (e.key === "Escape" && splashOpen) setSplashOpen(false);
    };
    window.addEventListener("keydown", dismiss);
    return () => window.removeEventListener("keydown", dismiss);
  }, [splashOpen]);
  useEffect(() => {
    document.title = fighting
      ? "Live arena — VMD Championship"
      : `${tab} — VMD Championship`;
  }, [tab, fighting]);
  function notify(text: string) {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3400);
  }
  function navigate(t: Tab, research = false) {
    setTab(t);
    setLab(research);
    setModal(null);
    sfx("click");
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function briefing(level = profile.level) {
    if (level > profile.level || level < 1) {
      notify("Complete the previous round to enter this match.");
      return;
    }
    if (!ready) {
      notify(
        "Restoring your engineering profile. Please try again in a moment.",
      );
      return;
    }
    setRound(level);
    setSplashOpen(false);
    unlockAudio();
    resetCommentary();
    playCommentary("intro", 0);
    if (profile.settings.cinematic) {
      setVersusOpen(true);
      sfx("start");
    } else {
      // Cinematic introductions disabled: go straight to the arena, where the
      // countdown still gates the start of the match.
      setVersusOpen(false);
      setFighting(true);
      sfx("start");
    }
  }
  function start() {
    resolved.current = false;
    setModal(null);
    setVersusOpen(false);
    setFighting(true);
    unlockAudio();
  }
  function finish(o: Outcome) {
    if (resolved.current) return;
    resolved.current = true;
    const r = opponent(round),
      advance = o.win && round === profile.level && !profile.completed,
      salvageReward = o.win ? (advance ? 4 + Math.floor(round / 15) : 1) : 0,
      coinsReward = o.win ? (advance ? 2 + Math.floor(round / 25) : 1) : 0,
      xpReward = o.win ? 100 + round * 3 : 20;
    const free: Record<number, string> = {
      5: "powered",
      10: "heavyarmor",
      20: "boost",
      40: "hammer",
      60: "rail",
      80: "nova",
    };
    const unlock =
      advance && free[round] && !profile.unlocked.includes(free[round])
        ? free[round]
        : null;
    const replayRecord: StoredReplay | null = o.replay
      ? {
          ...o.replay,
          id: uid(),
          at: Date.now(),
          level: round,
          win: o.win,
          duration: o.duration,
          score: o.score,
          opponent: r.name,
          driver: profile.engineer,
          player: structuredClone(profile.vehicle),
          rival: structuredClone(r.vehicle),
        }
      : null;
    const match: MatchResult = {
      id: uid(),
      replayId: replayRecord?.id,
      level: round,
      win: o.win,
      score: o.score,
      rating: metrics(profile.vehicle).rating,
      duration: o.duration,
      broken: o.broken,
      at: Date.now(),
      opponent: r.name,
      driver: profile.engineer,
    };
    setProfile((p) => ({
      ...p,
      level: advance ? Math.min(100, p.level + 1) : p.level,
      completed: p.completed || (advance && round === 100),
      salvage: p.salvage + salvageReward,
      coins: p.coins + coinsReward,
      xp: p.xp + xpReward,
      history: [match, ...p.history].slice(0, 500),
      replays: replayRecord
        ? [replayRecord, ...(p.replays ?? [])].slice(0, REPLAY_LIMIT)
        : p.replays,
      rivalMemory: o.stats
        ? {
            ...(p.rivalMemory ?? {}),
            [r.name]: blendMemory(p.rivalMemory?.[r.name], o.stats),
          }
        : p.rivalMemory,
      records: recordMatch(engineerRecords(p), match),
      unlocked: unlock ? [...p.unlocked, unlock] : p.unlocked,
    }));
    setResult({ ...match, salvageReward, coinsReward, xpReward, unlock });
    setFighting(false);
    setModal("result");
    window.scrollTo(0, 0);
  }
  const navItems = [
    { name: "Workshop" as Tab, icon: Wrench },
    { name: "Tournament" as Tab, icon: Trophy },
    { name: "Garage" as Tab, icon: Warehouse },
    { name: "Leaderboard" as Tab, icon: Activity },
  ];
  if (fighting)
    return (
      <Battle
        vehicle={profile.vehicle}
        livery={profile.vehicle.livery}
        level={round}
        engineer={profile.engineer}
        settings={profile.settings}
        onFinish={finish}
        onExit={() => {
          setFighting(false);
          navigate("Workshop");
          notify("Match left. Your build and progress are safe.");
        }}
      />
    );
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <button
            className="brand-button"
            aria-label="VMD championship home"
            onClick={() => {
              setSplashOpen(true);
              setModal(null);
            }}
          >
            <Brand />
          </button>
          <span className="brand-divider" />
          <nav aria-label="Main navigation">
            {navItems.map(({ name, icon: Icon }) => (
              <button
                key={name}
                className={name === tab ? "active" : ""}
                aria-current={name === tab ? "page" : undefined}
                onClick={() => navigate(name)}
              >
                <Icon size={16} strokeWidth={1.7} />
                <span>{name}</span>
              </button>
            ))}
          </nav>
          <div className="header-tools">
            <button
              className="header-icon sound-toggle"
              title={profile.settings.muted ? "Unmute audio" : "Mute audio"}
              aria-label={
                profile.settings.muted ? "Unmute audio" : "Mute audio"
              }
              onClick={() => {
                unlockAudio();
                setProfile((p) => ({
                  ...p,
                  settings: { ...p.settings, muted: !p.settings.muted },
                }));
              }}
            >
              {profile.settings.muted ? (
                <VolumeX size={18} />
              ) : (
                <Volume2 size={18} />
              )}
            </button>
            <button
              className="header-icon"
              title="Settings"
              aria-label="Settings"
              onClick={() => setModal("settings")}
            >
              <Settings size={18} />
            </button>
            <div className="header-separator" />
            <button
              className="profile-button"
              onClick={() => {
                setPilotName(profile.engineer);
                setModal("profile");
              }}
            >
              <span className="portrait-wrap">
                <img src="/arts/pip.webp" alt="Pip's engineer portrait" />
                <i />
              </span>
              <span>
                <strong>{profile.engineer}</strong>
                <small>
                  ENGINEER LV. {pad(1 + Math.floor(profile.xp / 300))}
                </small>
              </span>
              <ChevronDown size={13} />
            </button>
          </div>
        </div>
      </header>
      <main className="main-shell">
        {tab === "Workshop" ? (
          <Workshop
            profile={profile}
            setProfile={setProfile}
            onBattle={() => briefing()}
            notify={notify}
            onManual={() => setModal("guide")}
            onUpgrades={() => navigate("Garage", true)}
          />
        ) : tab === "Tournament" ? (
          <Tournament profile={profile} onBattle={briefing} />
        ) : tab === "Garage" ? (
          <Garage
            key={String(lab)}
            profile={profile}
            setProfile={setProfile}
            notify={notify}
            startLab={lab}
            onWorkshop={() => navigate("Workshop")}
            onWatchReplay={(id) => {
              setActiveReplay(id);
              setModal("replay");
            }}
          />
        ) : (
          <Leaderboard profile={profile} onBattle={() => briefing()} />
        )}
        <footer className="app-footer">
          <button
            className="footer-link"
            onClick={() => setModal("compendium")}
          >
            <BookOpen size={13} /> Encyclopedia
          </button>
          <div>
            <i className="live-dot" />
            <span>WORKSHOP SYSTEMS ONLINE</span>
            <b>/</b>
            <span className="footer-save">
              <CheckCheck size={13} />
              {saveState}
            </span>
          </div>
          <div>
            <button onClick={() => setModal("guide")}>
              <BookOpen size={13} />
              Field guide
            </button>
            <span className="footer-v">
              VMD OS <b>1.0</b>
            </span>
          </div>
        </footer>
      </main>
      {toast && (
        <div role="status" className="toast">
          <Check size={15} />
          {toast}
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={13} />
          </button>
        </div>
      )}
      {modal === "settings" && (
        <SettingsDialog
          profile={profile}
          setProfile={setProfile}
          onClose={() => setModal(null)}
          onReset={() => setModal("reset")}
        />
      )}
      {(modal === "guide" || modal === "story") && (
        <Manual startStory={modal === "story"} onClose={() => setModal(null)} />
      )}
      {modal === "profile" && (
        <Dialog
          title="Engineer dossier"
          kicker="VMD CHAMPIONSHIP / DRIVER 001"
          onClose={() => setModal(null)}
        >
          <div className="dossier">
            <img src="/arts/pip.webp" alt="Pip the platypus engineer" />
            <div>
              <span className="eyebrow mint">LICENSED ENGINEER</span>
              <h3>{profile.engineer}</h3>
              <p>Platypus · Rank {pad(1 + Math.floor(profile.xp / 300))}</p>
              <span className="class-badge">
                {profile.xp < 900
                  ? "ROOKIE DIVISION"
                  : profile.xp < 3000
                    ? "PRO ENGINEER"
                    : "ELITE ENGINEER"}
              </span>
            </div>
          </div>
          <label className="form-field">
            ENGINEER CALLSIGN
            <input
              value={pilotName}
              maxLength={24}
              onChange={(e) => setPilotName(e.target.value)}
              placeholder="Engineer name"
            />
          </label>
          <div className="summary-strip">
            <span>{profile.xp} XP</span>
            <span>{profile.history.filter((x) => x.win).length} wins</span>
            <span>Round {pad(profile.level)}</span>
          </div>
          <div className="button-row">
            <button className="dark-button" onClick={() => setModal("story")}>
              <BookOpen size={15} />
              Pip’s story
            </button>
            <button
              className="primary"
              disabled={!pilotName.trim()}
              onClick={() => {
                setProfile((p) => ({ ...p, engineer: pilotName.trim() }));
                setModal(null);
                notify("Engineer dossier updated.");
              }}
            >
              <Check size={15} />
              Save dossier
            </button>
          </div>
        </Dialog>
      )}
      {modal === "reset" && (
        <Dialog
          title="Reset all progress?"
          kicker="SYSTEM / DESTRUCTIVE ACTION"
          onClose={() => setModal("settings")}
        >
          <p>
            This permanently clears your championship progress, coins, saved
            vehicles, research, match history, and settings from this device and
            its backup. You will begin again with 30 salvage.
          </p>
          <div className="button-row">
            <button
              className="dark-button"
              onClick={() => setModal("settings")}
            >
              Keep my progress
            </button>
            <button
              className="danger-btn"
              onClick={async () => {
                await reset();
                navigate("Workshop");
                notify("Progress reset. A fresh workshop is ready.");
              }}
            >
              Reset everything
            </button>
          </div>
        </Dialog>
      )}
      {modal === "result" && result && (
        <Dialog
          title={result.win ? "Championship victory" : "Match complete"}
          kicker={`ROUND ${pad(result.level)} / OFFICIAL RESULT`}
          onClose={() => setModal(null)}
          className="result-dialog"
        >
          {result.win && (
            <div
              className={`victory-animation ${profile.vehicle.livery?.victory ?? "confetti"}`}
              aria-hidden="true"
            >
              <span>✦</span>
              <b>V</b>
              <span>✧</span>
            </div>
          )}
          <div className={`result-banner ${result.win ? "win" : "loss"}`}>
            <Trophy size={45} />
            <strong>{result.win ? "VICTORY" : "DEFEAT"}</strong>
            <span>
              {result.win
                ? `${profile.engineer} takes the round.`
                : `${result.opponent} wins this round.`}
            </span>
          </div>
          <div className="result-numbers">
            <div>
              <b>{result.score.toLocaleString()}</b>
              <small>BATTLE SCORE</small>
            </div>
            <div>
              <b>{result.broken}</b>
              <small>PARTS DETACHED</small>
            </div>
            <div>
              <b>{result.duration}s</b>
              <small>MATCH TIME</small>
            </div>
          </div>
          <div className="reward-strip">
            <span>
              <SalvageIcon />+{result.salvageReward} salvage
            </span>
            <span>
              <Coins size={15} />+{result.coinsReward} coins
            </span>
            <span>
              <Zap size={15} />+{result.xpReward} XP
            </span>
          </div>
          {result.unlock && (
            <div className="info-band">
              <Cpu size={16} />
              {DEF[result.unlock].name} research unlocked!
            </div>
          )}
          <p>
            {result.win
              ? profile.completed
                ? "You have conquered the VMD Championship. Replay any round with a new design."
                : `Rewards saved. Round ${pad(profile.level)} is ready in the championship circuit.`
              : "Your blueprint is safe. Refine your machine or try the round again."}
          </p>
          {result.replayId && (
            <button
              className="dark-button"
              onClick={() => {
                setActiveReplay(result.replayId!);
                setModal("replay");
              }}
            >
              <Play size={15} /> Watch replay
            </button>
          )}
          <div className="button-row">
            <button
              className="dark-button"
              onClick={() => navigate("Workshop")}
            >
              <Wrench size={15} />
              Workshop
            </button>
            <button
              className="primary"
              onClick={() =>
                result.win ? navigate("Tournament") : briefing(result.level)
              }
            >
              {result.win ? "Continue circuit" : "Rematch"}
              <ArrowRight size={15} />
            </button>
          </div>
        </Dialog>
      )}
      {splashOpen && (
        <CinemaSplash
          onEnter={() => {
            setSplashOpen(false);
            briefing();
          }}
          onWorkshop={() => {
            setSplashOpen(false);
            navigate("Workshop");
          }}
          onGarage={() => {
            setSplashOpen(false);
            navigate("Garage");
          }}
          onTournament={() => {
            setSplashOpen(false);
            navigate("Tournament");
          }}
          onComponents={() => {
            setSplashOpen(false);
            setModal("compendium");
          }}
          onLeaderboard={() => {
            setSplashOpen(false);
            navigate("Leaderboard");
          }}
          onSettings={() => {
            setSplashOpen(false);
            setModal("settings");
          }}
          onStory={() => {
            setSplashOpen(false);
            setModal("story");
          }}
        />
      )}
      {versusOpen && (
        <VersusIntro
          profile={profile}
          level={round}
          onStart={start}
          onCancel={() => {
            setVersusOpen(false);
            notify("Match cancelled. Your build is safe.");
          }}
        />
      )}
      {modal === "compendium" && (
        <ComponentEncyclopedia
          profile={profile}
          onClose={() => setModal(null)}
          onMaterials={() => setModal("materials")}
        />
      )}
      {modal === "materials" && (
        <MaterialEncyclopedia
          profile={profile}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "replay" &&
        activeReplay &&
        profile.replays?.find((r) => r.id === activeReplay) && (
          <ReplayTheater
            replay={profile.replays.find((r) => r.id === activeReplay)!}
            onClose={() => {
              setModal(null);
              setActiveReplay(null);
            }}
          />
        )}
      {modal === "encyclopedia" && (
        <MaterialEncyclopedia
          profile={profile}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
