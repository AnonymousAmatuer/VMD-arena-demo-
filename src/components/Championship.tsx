"use client";
import { useState, type Dispatch, type SetStateAction } from "react";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Award,
  Box,
  Boxes,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  Coins,
  Cpu,
  Crown,
  Flag,
  FolderOpen,
  HardDrive,
  History,
  Layers3,
  Lock,
  Medal,
  Play,
  Plus,
  Save,
  ShieldCheck,
  Star,
  Trash2,
  Trophy,
  Unlock,
  Wrench,
  Zap,
} from "lucide-react";
import {
  CATALOG,
  GARAGE_SLOTS,
  DEF,
  metrics,
  opponent,
  starter,
  uid,
  engineerRecords,
  componentLock,
  MATERIAL_PROFILES,
  itemRating,
  type ComponentDef,
  type Profile,
  type StoredBuild,
  type Vehicle,
  type StoredReplay,
} from "@/game/data";
import {
  Blueprint,
  BuildSummary,
  Dialog,
  PageHeading,
  PartFacts,
  Resources,
  SalvageIcon,
  pad,
} from "./UI";
import { sfx } from "@/game/audio";
interface BaseProps {
  profile: Profile;
  setProfile: Dispatch<SetStateAction<Profile>>;
  notify: (s: string) => void;
}
export function Tournament({
  profile,
  onBattle,
}: {
  profile: Profile;
  onBattle: (level: number) => void;
}) {
  const [selected, setSelected] = useState(profile.level),
    [batch, setBatch] = useState(Math.floor((profile.level - 1) / 10));
  const rival = opponent(selected),
    locked = selected > profile.level,
    won = profile.completed || selected < profile.level,
    completed = profile.completed ? 100 : profile.level - 1;
  return (
    <>
      <PageHeading
        kicker="CHAMPIONSHIP DIVISION / SINGLE PLAYER"
        title="Championship circuit"
        description="One hundred rounds. Two engineers. One championship."
      >
        <Resources salvage={profile.salvage} coins={profile.coins} />
      </PageHeading>
      <div className="tournament-layout">
        <div className="challenger-card">
          <img
            src={`/arts/${rival.art}.webp`}
            alt={`${rival.name}, the ${rival.species.toLowerCase()} engineer`}
          />
          <div className="challenger-copy">
            <div className="eyebrow mint">
              <i className="live-dot" />
              {locked
                ? "SCOUTING REPORT"
                : won
                  ? "EXHIBITION REMATCH"
                  : "NEXT CHALLENGER"}
            </div>
            <h2>{rival.name}</h2>
            <div className="species-tag">
              {rival.species} engineer <span>//</span> {rival.stage}
            </div>
            <p>{rival.style}</p>
            <div className="rival-machine">
              <Wrench size={16} />
              <span>{rival.vehicle.name}</span>
              <b>{metrics(rival.vehicle).rating} VR</b>
            </div>
            <button
              className="primary"
              disabled={locked}
              onClick={() => onBattle(selected)}
            >
              {locked ? <Lock size={16} /> : <Flag size={16} />}{" "}
              {locked
                ? `Complete round ${pad(selected - 1)} first`
                : `Enter round ${pad(selected)}`}
              <ChevronRight size={17} />
            </button>
          </div>
        </div>
        <div className="progress-card">
          <div className="eyebrow mint">
            <Trophy size={15} /> CHAMPIONSHIP PROGRESS
          </div>
          <div className="progress-value">
            {pad(completed)}
            <span>/ 100</span>
          </div>
          <div className="meter-track mint">
            <i style={{ width: `${completed}%` }} />
          </div>
          <p>
            {profile.completed
              ? "Champion of the animal kingdom."
              : "Your road from the scrapyard to the championship final."}
          </p>
          <div className="detail-rows">
            <div>
              <span>Victories</span>
              <b>{profile.history.filter((r) => r.win).length}</b>
            </div>
            <div>
              <span>Engineer experience</span>
              <b>{profile.xp} XP</b>
            </div>
            <div>
              <span>Current division</span>
              <b>{opponent(profile.level).stage}</b>
            </div>
          </div>
        </div>
      </div>
      <section className="surface circuit-board">
        <div className="surface-heading">
          <h2>
            <Flag size={19} />
            Round selection
          </h2>
          <select
            aria-label="Championship rounds"
            value={batch}
            onChange={(e) => setBatch(+e.target.value)}
          >
            {Array.from({ length: 10 }, (_, i) => (
              <option value={i} key={i}>
                Rounds {pad(i * 10 + 1)}–{pad((i + 1) * 10)}
              </option>
            ))}
          </select>
        </div>
        <div className="round-grid">
          {Array.from({ length: 10 }, (_, i) => batch * 10 + i + 1).map((n) => (
            <button
              key={n}
              className={`round-card ${selected === n ? "selected" : ""} ${n <= profile.level ? "available" : ""}`}
              onClick={() => setSelected(n)}
            >
              <span>
                {n > profile.level ? (
                  <Lock size={14} />
                ) : n < profile.level || profile.completed ? (
                  <Check size={14} />
                ) : (
                  <Flag size={14} />
                )}
              </span>
              <strong>{pad(n)}</strong>
              <small>
                {n > profile.level
                  ? "LOCKED"
                  : n < profile.level || profile.completed
                    ? "CLEARED"
                    : "READY"}
              </small>
            </button>
          ))}
        </div>
        <div className="circuit-note">
          <ShieldCheck size={15} /> Wins unlock the next round. Your workshop
          build is always protected.
        </div>
      </section>
    </>
  );
}
export function Garage({
  profile,
  setProfile,
  notify,
  startLab,
  onWorkshop,
  onWatchReplay,
}: {
  startLab: boolean;
  onWorkshop: () => void;
  onWatchReplay: (id: string) => void;
} & BaseProps) {
  const [lab, setLab] = useState(startLab),
    [chosen, setChosen] = useState<ComponentDef | null>(null),
    [deleting, setDeleting] = useState<StoredBuild | null>(null),
    [save, setSave] = useState(false),
    [name, setName] = useState(profile.vehicle.name),
    [showReplays, setShowReplays] = useState(false),
    [saveSlot, setSaveSlot] = useState(0);
  const load = (v: Vehicle) => {
    if (metrics(v).cost > profile.salvage) {
      notify("This blueprint exceeds your salvage allowance.");
      return;
    }
    setProfile((p) => ({
      ...p,
      vehicle: structuredClone({
        name: v.name,
        parts: v.parts,
        livery: v.livery,
      }),
    }));
    notify(`${v.name} loaded into the workshop.`);
    onWorkshop();
  };
  function unlock() {
    if (!chosen) return;
    const requirement = componentLock(chosen, profile);
    if (
      requirement &&
      requirement !== `Research required · ${chosen.coins} coins`
    )
      return;
    if (profile.coins < chosen.coins || profile.unlocked.includes(chosen.key))
      return;
    setProfile((p) =>
      p.coins >= chosen.coins && !p.unlocked.includes(chosen.key)
        ? {
            ...p,
            coins: p.coins - chosen.coins,
            unlocked: [...p.unlocked, chosen.key],
          }
        : p,
    );
    sfx("mount");
    notify(`${chosen.name} researched. Find it in the component library.`);
    setChosen(null);
  }
  return (
    <>
      <PageHeading
        kicker="ENGINEERING DIVISION / DESIGN ARCHIVE"
        title={
          lab
            ? "Research lab"
            : showReplays
              ? "Match replays"
              : "Vehicle garage"
        }
        description={
          lab
            ? "Invest championship coins in new engineering possibilities."
            : showReplays
              ? "Rewatch collisions, inspect component failures and find out what really lost the match."
              : "Four engineering memories. Recall any machine and its identity exactly as you saved it."
        }
      >
        <Resources salvage={profile.salvage} coins={profile.coins} />
      </PageHeading>
      <div className="page-tabs">
        <button
          className={!lab && !showReplays ? "active" : ""}
          onClick={() => {
            setLab(false);
            setShowReplays(false);
          }}
        >
          <FolderOpen size={16} />
          Memory bank{" "}
          <span>
            {profile.garage.length}/{GARAGE_SLOTS}
          </span>
        </button>
        <button
          className={showReplays ? "active" : ""}
          onClick={() => {
            setShowReplays(true);
            setLab(false);
          }}
        >
          <History size={16} />
          Replays <span>{profile.replays?.length ?? 0}</span>
        </button>
        <button
          className={lab ? "active" : ""}
          onClick={() => {
            setLab(true);
            setShowReplays(false);
          }}
        >
          <Cpu size={16} />
          Upgrades & research
        </button>
      </div>
      {lab ? (
        <>
          <div className="info-band">
            <Coins size={18} />
            <span>
              Win championship matches to earn coins. Research is permanent;
              placing a part still consumes salvage.
            </span>
          </div>
          <div className="research-grid">
            {CATALOG.filter(
              (d) => d.coins > 0 || d.unlockLevel > 1 || d.requiredRival,
            )
              .sort(
                (a, b) => a.unlockLevel - b.unlockLevel || a.coins - b.coins,
              )
              .map((d) => {
                const owned = !d.coins || profile.unlocked.includes(d.key);
                const levelBlocked =
                  d.unlockLevel > profile.level && !profile.completed;
                const rivalBlocked =
                  !!d.requiredRival &&
                  !profile.completed &&
                  !profile.history.some(
                    (r) => r.win && r.opponent === d.requiredRival,
                  );
                const requirement = levelBlocked
                  ? `Round ${String(d.unlockLevel).padStart(2, "0")}`
                  : rivalBlocked
                    ? `Defeat ${d.requiredRival}`
                    : owned
                      ? "Available"
                      : `${d.coins} coins`;
                const state =
                  levelBlocked || rivalBlocked
                    ? "locked"
                    : owned
                      ? "owned"
                      : "research";
                return (
                  <button
                    className="research-card"
                    onClick={() => setChosen(d)}
                    key={d.key}
                  >
                    <img src={`/arts/${d.art}.webp`} alt={d.name} />
                    <div>
                      <span
                        className={`rarity-inline rarity-${d.rarity.toLowerCase()}`}
                      >
                        {d.rarity}
                      </span>
                      <h3>{d.name}</h3>
                      <p>{d.description}</p>
                      <div className={owned ? "mint" : "gold"}>
                        {state === "locked" ? (
                          <Lock size={13} />
                        ) : owned ? (
                          <Check size={14} />
                        ) : (
                          <Coins size={14} />
                        )}{" "}
                        {requirement}
                      </div>
                      <small className="research-meta">
                        {MATERIAL_PROFILES[d.material].label} · {d.category} ·
                        VR {itemRating(d)}
                      </small>
                    </div>
                  </button>
                );
              })}
          </div>
        </>
      ) : showReplays ? (
        <>
          <div className="surface">
            <div className="surface-heading">
              <h2>
                <History size={19} /> Saved match replays
              </h2>
              <span className="technical">
                {profile.replays?.length ?? 0} / 8
              </span>
            </div>
            {!profile.replays?.length ? (
              <div className="empty-state">
                <Play size={32} />
                <h3>No replays saved yet.</h3>
                <p>
                  Finish a match and its full destruction record will appear
                  here.
                </p>
              </div>
            ) : (
              <div className="replay-grid">
                {profile.replays.map((r: StoredReplay) => (
                  <div className="replay-card" key={r.id}>
                    <img
                      src={`/arts/${opponent(r.level).art}.webp`}
                      alt={r.opponent}
                    />
                    <div className={r.win ? "mint" : "orange"}>
                      {r.win ? "VICTORY" : "DEFEAT"}
                    </div>
                    <h3>
                      Round {String(r.level).padStart(2, "0")} · {r.opponent}
                    </h3>
                    <small>
                      {r.player.name} · {r.score.toLocaleString()} pts ·{" "}
                      {r.duration}s
                    </small>
                    <p>{r.lossCause ?? "No chassis failure recorded"}</p>
                    <button
                      className="dark-button"
                      onClick={() => onWatchReplay(r.id)}
                    >
                      <Play size={14} /> Watch & analyse
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="garage-feature">
            <div className="garage-feature-img">
              {JSON.stringify(starter().parts) ===
              JSON.stringify(profile.vehicle.parts) ? (
                <img
                  src="/arts/workshop-hero.webp"
                  alt="Active Mudskipper vehicle"
                />
              ) : (
                <Blueprint vehicle={profile.vehicle} />
              )}
            </div>
            <div className="garage-feature-copy">
              <div className="eyebrow mint">
                <i className="live-dot" />
                ACTIVE MACHINE
              </div>
              <h2>{profile.vehicle.name}</h2>
              <BuildSummary vehicle={profile.vehicle} />
              <div className="button-row">
                <button className="primary" onClick={onWorkshop}>
                  <Wrench size={15} />
                  Edit in workshop
                </button>
                <button
                  className="dark-button"
                  onClick={() => {
                    setName(profile.vehicle.name);
                    setSave(true);
                  }}
                >
                  <Save size={15} />
                  Save blueprint
                </button>
              </div>
            </div>
          </div>
          <div className="surface-heading loose">
            <h2>
              <Layers3 size={19} /> Engineering memory bank
            </h2>
            <span className="technical">
              {profile.garage.length} / {GARAGE_SLOTS} SLOTS
            </span>
          </div>
          <div className="blueprint-grid">
            {Array.from({ length: GARAGE_SLOTS }, (_, slot) => {
              const b = profile.garage.find(
                (x) => (x.slot ?? profile.garage.indexOf(x)) === slot,
              );
              if (!b)
                return (
                  <div
                    className="blueprint-card empty-slot"
                    key={`empty-${slot}`}
                  >
                    <div className="empty-slot-mark">0{slot + 1}</div>
                    <h3>Empty memory slot</h3>
                    <p>
                      Save your current machine here to recall its build and
                      livery later.
                    </p>
                    <button
                      className="dark-button"
                      onClick={() => {
                        setSaveSlot(slot);
                        setName(profile.vehicle.name);
                        setSave(true);
                      }}
                    >
                      <Save size={14} /> Save here
                    </button>
                  </div>
                );
              return (
                <div className="blueprint-card" key={b.id}>
                  <Blueprint vehicle={b} />
                  <div>
                    <small className="eyebrow mint">
                      MEMORY SLOT 0{(b.slot ?? slot) + 1}
                    </small>
                    <h3>{b.name}</h3>
                    <BuildSummary vehicle={b} />
                    <div className="button-row">
                      <button className="dark-button" onClick={() => load(b)}>
                        <FolderOpen size={14} /> Recall build
                      </button>
                      <button
                        className="icon-btn"
                        aria-label={`Delete ${b.name}`}
                        onClick={() => setDeleting(b)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
      {chosen && (
        <Dialog
          title={chosen.name}
          kicker="RESEARCH / COMPONENT SPECIFICATION"
          onClose={() => setChosen(null)}
        >
          <img
            className="research-hero"
            alt={chosen.name}
            src={`/arts/${chosen.art}.webp`}
          />
          <p>{chosen.description}</p>
          <PartFacts part={chosen} />
          <div className="detail-rows">
            <div>
              <span>Material / tier</span>
              <b>
                {MATERIAL_PROFILES[chosen.material].label} · T{chosen.tier}
              </b>
            </div>
            <div>
              <span>Unlock level</span>
              <b>Round {String(chosen.unlockLevel).padStart(2, "0")}</b>
            </div>
            {chosen.requiredRival && (
              <div>
                <span>Championship condition</span>
                <b>Defeat {chosen.requiredRival}</b>
              </div>
            )}
            <div>
              <span>Component rating</span>
              <b>{itemRating(chosen)} VR</b>
            </div>
            {chosen.trait !== "none" && (
              <div>
                <span>Mechanical function</span>
                <b>{chosen.trait}</b>
              </div>
            )}
          </div>
          {chosen.category === "Weapons" && (
            <div className="detail-rows">
              <div>
                <span>Range</span>
                <b>{chosen.range} arena units</b>
              </div>
              <div>
                <span>Cooldown / energy</span>
                <b>
                  {chosen.cooldown}s / {chosen.energy} EP
                </b>
              </div>
            </div>
          )}
          <button
            className="primary wide"
            disabled={
              (!!componentLock(chosen, profile) &&
                componentLock(chosen, profile)?.startsWith("Research") ===
                  true &&
                profile.coins < chosen.coins) ||
              (!!componentLock(chosen, profile) &&
                !componentLock(chosen, profile)?.startsWith("Research")) ||
              !chosen.coins ||
              profile.unlocked.includes(chosen.key)
            }
            onClick={unlock}
          >
            {profile.unlocked.includes(chosen.key) || !chosen.coins ? (
              <Check size={16} />
            ) : (
              <Unlock size={16} />
            )}{" "}
            {!chosen.coins
              ? "Unlocked by round"
              : profile.unlocked.includes(chosen.key)
                ? "Already researched"
                : componentLock(chosen, profile) &&
                    !componentLock(chosen, profile)?.startsWith("Research")
                  ? componentLock(chosen, profile)
                  : profile.coins < chosen.coins
                    ? `Need ${chosen.coins - profile.coins} more coins`
                    : `Research for ${chosen.coins} coins`}
          </button>
        </Dialog>
      )}
      {deleting && (
        <Dialog
          title="Delete blueprint?"
          kicker="GARAGE / CONFIRMATION"
          onClose={() => setDeleting(null)}
        >
          <p>
            Remove “{deleting.name}” from your archive? Your active vehicle will
            not change.
          </p>
          <div className="button-row">
            <button className="dark-button" onClick={() => setDeleting(null)}>
              Keep blueprint
            </button>
            <button
              className="danger-btn"
              onClick={() => {
                setProfile((p) => ({
                  ...p,
                  garage: p.garage.filter((b) => b.id !== deleting.id),
                }));
                setDeleting(null);
                notify("Blueprint deleted.");
              }}
            >
              Delete blueprint
            </button>
          </div>
        </Dialog>
      )}
      {save && (
        <Dialog
          title="Archive blueprint"
          kicker="GARAGE / SAVE DESIGN"
          onClose={() => setSave(false)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const nm = name.trim();
              if (!nm) return;
              const slot = Math.max(0, Math.min(GARAGE_SLOTS - 1, saveSlot));
              const old = profile.garage.find(
                (b) => (b.slot ?? profile.garage.indexOf(b)) === slot,
              );
              const b = {
                ...profile.vehicle,
                name: nm,
                id: old?.id || uid(),
                saved: Date.now(),
                slot,
              };
              setProfile((p) => ({
                ...p,
                garage: [
                  ...p.garage.filter(
                    (x) => (x.slot ?? p.garage.indexOf(x)) !== slot,
                  ),
                  b,
                ],
                vehicle: { ...p.vehicle, name: nm },
              }));
              setSave(false);
              notify("Blueprint archived.");
            }}
          >
            <label className="form-field">
              MEMORY SLOT
              <select
                value={saveSlot}
                onChange={(e) => setSaveSlot(+e.target.value)}
              >
                {Array.from({ length: GARAGE_SLOTS }, (_, i) => (
                  <option key={i} value={i}>
                    Slot {i + 1}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              BLUEPRINT NAME
              <input
                maxLength={60}
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <button className="primary wide" type="submit">
              <Save size={15} />
              Save blueprint
            </button>
          </form>
        </Dialog>
      )}
    </>
  );
}
export function Leaderboard({
  profile,
  onBattle,
}: {
  profile: Profile;
  onBattle: () => void;
}) {
  const [sort, setSort] = useState("Best score"),
    [limit, setLimit] = useState(8);
  const entries = new Map(engineerRecords(profile).map((r) => [r.name, r]));
  if (!entries.has(profile.engineer))
    entries.set(profile.engineer, {
      name: profile.engineer,
      level: 0,
      rating: metrics(profile.vehicle).rating,
      wins: 0,
      score: 0,
    });
  const list = [...entries.values()].sort((a, b) =>
    sort === "Wins"
      ? b.wins - a.wins
      : sort === "Highest round"
        ? b.level - a.level
        : b.score - a.score,
  );
  return (
    <>
      <PageHeading
        kicker="CHAMPIONSHIP DIVISION / LOCAL RECORDS"
        title="Local leaderboard"
        description="The engineers and machines that made their mark on this device."
      >
        <span className="device-chip">
          <HardDrive size={15} />
          LOCAL RECORDS
        </span>
      </PageHeading>
      <div className="record-cards">
        <div>
          <Trophy />
          <small>CHAMPIONSHIP WINS</small>
          <strong>
            {engineerRecords(profile).reduce((a, r) => a + r.wins, 0)}
          </strong>
        </div>
        <div>
          <Award />
          <small>BEST BATTLE SCORE</small>
          <strong>
            {Math.max(
              0,
              ...engineerRecords(profile).map((r) => r.score),
            ).toLocaleString()}
          </strong>
        </div>
        <div>
          <Activity />
          <small>HIGHEST ROUND</small>
          <strong>{pad(profile.completed ? 100 : profile.level - 1)}</strong>
        </div>
      </div>
      <section className="surface">
        <div className="surface-heading">
          <h2>
            <Trophy size={19} />
            Engineer standings
          </h2>
          <select
            aria-label="Sort leaderboard"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            {["Best score", "Wins", "Highest round"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>RANK</th>
                <th>ENGINEER</th>
                <th>ROUND CLEARED</th>
                <th>BEST RATING</th>
                <th>WINS</th>
                <th>BEST SCORE</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r, i) => (
                <tr key={r.name}>
                  <td className="rank-cell">{pad(i + 1)}</td>
                  <td>
                    <span className="table-engineer">
                      <img src="/arts/pip.webp" alt="" />
                      {r.name}
                    </span>
                  </td>
                  <td>{pad(r.level)}</td>
                  <td className="mint">{r.rating}</td>
                  <td>{r.wins}</td>
                  <td>{r.score.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="surface match-history">
        <div className="surface-heading">
          <h2>
            <History size={19} />
            Match log
          </h2>
          <span className="technical">{profile.history.length} MATCHES</span>
        </div>
        {!profile.history.length ? (
          <div className="empty-state">
            <Flag size={30} />
            <h3>Your championship starts here.</h3>
            <p>Finish a match to record your first result.</p>
            <button className="primary" onClick={onBattle}>
              Enter the arena <ArrowRight size={14} />
            </button>
          </div>
        ) : (
          <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>RESULT</th>
                    <th>ROUND</th>
                    <th>OPPONENT</th>
                    <th>TIME</th>
                    <th>SCORE</th>
                    <th>DATE</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.history.slice(0, limit).map((r) => (
                    <tr key={r.id}>
                      <td>
                        <span
                          className={`result-tag ${r.win ? "win" : "loss"}`}
                        >
                          {r.win ? "VICTORY" : "DEFEAT"}
                        </span>
                      </td>
                      <td>{pad(r.level)}</td>
                      <td>{r.opponent}</td>
                      <td>{r.duration}s</td>
                      <td>{r.score}</td>
                      <td>{new Date(r.at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {profile.history.length > limit && (
              <button
                className="text-button wide"
                onClick={() => setLimit((n) => n + 10)}
              >
                Show more matches
              </button>
            )}
          </>
        )}
      </section>
    </>
  );
}
