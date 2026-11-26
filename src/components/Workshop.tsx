"use client";
import dynamic from "next/dynamic";
import {
  useState,
  useEffect,
  useRef,
  useMemo,
  type PointerEvent as ReactPointerEvent,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  Activity,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  Box,
  Boxes,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  CircleHelp,
  CircleDot,
  Copy,
  Crosshair,
  Expand,
  Focus,
  Gauge,
  Grid3X3,
  Layers3,
  Lock,
  Maximize2,
  Mouse,
  Move,
  Orbit,
  Paintbrush,
  Pencil,
  Plus,
  Redo2,
  RotateCcw,
  RotateCw,
  Save,
  Scan,
  Search,
  Shield,
  SlidersHorizontal,
  Trash2,
  Undo2,
  Weight,
  Wrench,
  X,
  Zap,
  ZoomIn,
  ZoomOut,
  Anchor,
  TriangleAlert,
  GripVertical,
  Hand,
  Settings2,
} from "lucide-react";
import {
  CATALOG,
  GARAGE_SLOTS,
  CORE,
  DEF,
  FACES,
  descendants,
  makePart,
  metrics,
  opponent,
  partCost,
  placementError,
  propose,
  snapPart,
  snapPartAt,
  resolveMount,
  starter,
  uid,
  componentLock,
  MATERIAL_PROFILES,
  itemRating,
  type ComponentDef,
  type Face,
  type MountHit,
  type Part,
  type Profile,
  type V3,
  type Vehicle,
  type Category,
} from "@/game/data";
import { sfx, unlockAudio } from "@/game/audio";
import {
  PageHeading,
  Resources,
  SalvageIcon,
  Dialog,
  PartFacts,
  pad,
} from "./UI";
import useSurfaceDrag, {
  type DragView,
  type SurfacePicker,
} from "./useSurfaceDrag";
import EngineeringAnalysis from "./EngineeringAnalysis";
import CustomizeDialog from "./CustomizeDialog";

const noParts: Part[] = [];
const Canvas = dynamic(() => import("./WorkshopCanvas"), {
  ssr: false,
  loading: () => (
    <div className="canvas-loading">INITIALIZING 3D VIEWPORT…</div>
  ),
});
interface Props {
  profile: Profile;
  setProfile: Dispatch<SetStateAction<Profile>>;
  onBattle: () => void;
  notify: (text: string) => void;
  onManual: () => void;
  onUpgrades: () => void;
}
export default function Workshop({
  profile,
  setProfile,
  onBattle,
  notify,
  onManual,
  onUpgrades,
}: Props) {
  const v = profile.vehicle,
    m = metrics(v),
    [mode, setMode] = useState<"Box build" | "Custom">("Box build"),
    [live, setLive] = useState(true),
    [selected, setSelected] = useState<string | null>(null),
    [ghost, setGhost] = useState<Part | null>(null),
    [editing, setEditing] = useState<string | null>(null),
    [face, setFace] = useState<Face>("Top"),
    [snapping, setSnapping] = useState(true),
    [group, setGroup] = useState<Category | "All parts">("All parts"),
    [page, setPage] = useState(0),
    [query, setQuery] = useState(""),
    [searching, setSearching] = useState(false),
    [rarity, setRarity] = useState("All rarities"),
    [materialFilter, setMaterialFilter] = useState("All materials"),
    [sortBy, setSortBy] = useState("Default"),
    [analysisOpen, setAnalysisOpen] = useState(false),
    [showCom, setShowCom] = useState(true),
    [showLinks, setShowLinks] = useState(false),
    [lockedReason, setLockedReason] = useState(""),
    [filterOpen, setFilterOpen] = useState(false),
    [saveOpen, setSaveOpen] = useState(false),
    [saveName, setSaveName] = useState(v.name),
    [saveSlot, setSaveSlot] = useState(0),
    [customizeOpen, setCustomizeOpen] = useState(false),
    [locked, setLocked] = useState<ComponentDef | null>(null),
    [ratingOpen, setRatingOpen] = useState(false),
    [focus, setFocus] = useState(0),
    [zoom, setZoom] = useState(0),
    [expanded, setExpanded] = useState(false),
    [, setHistoryVersion] = useState(0);
  const past = useRef<Vehicle[]>([]),
    future = useRef<Vehicle[]>([]),
    viewport = useRef<HTMLDivElement>(null),
    catalog = useRef<HTMLDivElement>(null),
    stage = useRef<HTMLDivElement>(null),
    surfacePicker = useRef<SurfacePicker | null>(null),
    previewMount = useRef<MountHit | null>(null);
  const isFactory = useMemo(
    () => JSON.stringify(v.parts) === JSON.stringify(starter().parts),
    [v.parts],
  );
  const show3d = live || !isFactory;
  const selection = v.parts.find((p) => p.id === selected);
  const base = useMemo(
    () => (editing ? v.parts.filter((p) => p.id !== editing) : v.parts),
    [editing, v.parts],
  );
  const snapStep = mode === "Box build" || snapping ? 0.25 : 0;
  const mountedGhost = useMemo(
    () =>
      ghost
        ? { ...ghost, parent: resolveMount(ghost, base) ?? ghost.parent }
        : null,
    [ghost, base],
  );
  const error = mountedGhost
    ? placementError(mountedGhost, base, profile.salvage)
    : null;
  const dragging = useSurfaceDrag({
    parts: v.parts,
    allowance: profile.salvage,
    step: snapStep,
    stage,
    picker: surfacePicker,
    onActivate: () => {
      setLive(true);
      unlockAudio();
    },
    onPlace: handleDrop,
    onInvalid: notify,
  });
  const dragSource = dragging.view?.source;
  const dragGroup = dragSource?.parts;
  const visibleParts = useMemo(() => {
    if (dragSource?.kind === "mounted" && dragGroup) {
      const ids = new Set(dragGroup.map((p) => p.id));
      return v.parts.filter((p) => !ids.has(p.id));
    }
    return base;
  }, [base, v.parts, dragSource?.kind, dragGroup]);
  const plainPreview = useMemo(() => (ghost ? [ghost] : noParts), [ghost]);
  const dragAnchor =
    dragging.view?.hit && v.parts.find((p) => p.id === dragging.view?.hit?.id);
  const cards = CATALOG.filter(
    (p) =>
      (group === "All parts" || p.category === group) &&
      p.name.toLowerCase().includes(query.toLowerCase()) &&
      (rarity === "All rarities" || p.rarity === rarity) &&
      (materialFilter === "All materials" || p.material === materialFilter),
  );
  const sortedCards = [...cards].sort((a, b) =>
    sortBy === "Cost: low"
      ? a.cost - b.cost
      : sortBy === "Cost: high"
        ? b.cost - a.cost
        : sortBy === "Mass: light"
          ? a.mass - b.mass
          : sortBy === "Rating"
            ? itemRating(b) - itemRating(a)
            : a.tier - b.tier || a.cost - b.cost,
  );
  const pageCount = Math.max(1, Math.ceil(sortedCards.length / 6)),
    shown = sortedCards.slice(page * 6, page * 6 + 6);
  useEffect(() => {
    if (page >= pageCount) setPage(0);
  }, [page, pageCount]);
  function commit(next: Vehicle) {
    past.current = [...past.current.slice(-39), v];
    future.current = [];
    setProfile((p) => ({ ...p, vehicle: next }));
    setHistoryVersion((n) => n + 1);
  }
  function undo() {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(v);
    setProfile((p) => ({ ...p, vehicle: prev }));
    setGhost(null);
    setEditing(null);
    setSelected(null);
    setHistoryVersion((n) => n + 1);
    notify("Last build change undone.");
  }
  function redo() {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(v);
    setProfile((p) => ({ ...p, vehicle: next }));
    setGhost(null);
    setEditing(null);
    setSelected(null);
    setHistoryVersion((n) => n + 1);
    notify("Build change restored.");
  }
  function begin(d: ComponentDef) {
    if (d.key === "core") {
      notify("Each machine has exactly one central chassis.");
      return;
    }
    unlockAudio();
    sfx("click");
    const requirement = componentLock(d, profile);
    if (requirement) {
      setLocked(d);
      setLockedReason(requirement);
      return;
    }
    const proposal = propose(d.key, v.parts, selected);
    previewMount.current = null;
    setGhost(proposal.part);
    setFace(proposal.face);
    setEditing(null);
    setLive(true);
    if (window.innerWidth < 800)
      viewport.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  function pickFace(f: Face) {
    if (!ghost) return;
    const a = base.find((p) => p.id === ghost.parent) || base[0];
    previewMount.current = null;
    setFace(f);
    setGhost(snapPart(ghost, a, f));
  }
  function confirm() {
    if (!mountedGhost) return;
    if (error) {
      notify(error);
      return;
    }
    const part = mountedGhost;
    commit({
      ...v,
      parts: editing
        ? v.parts.map((p) => (p.id === editing ? part : p))
        : [...v.parts, part],
    });
    setGhost(null);
    setEditing(null);
    setSelected(part.id);
    previewMount.current = null;
    sfx("mount");
    notify(
      `${DEF[part.key].name} ${editing ? "updated" : "attached"} to your machine.`,
    );
  }
  function handleDrop({ source, parts, hit }: DragView) {
    if (!hit || !parts.length) return;
    setFace(hit.face);
    if (source.kind === "preview") {
      previewMount.current = hit;
      setGhost(parts[0]);
      return;
    }
    const byId = new Map(parts.map((p) => [p.id, p]));
    if (source.kind === "mounted") {
      const moved = parts[0];
      const original = source.parts[0];
      if (
        original.parent === moved.parent &&
        moved.pos.every((n, i) => Math.abs(n - original.pos[i]) < 0.005)
      ) {
        setSelected(moved.id);
        return;
      }
    }
    commit({
      ...v,
      parts:
        source.kind === "mounted"
          ? v.parts.map((p) => byId.get(p.id) ?? p)
          : [...v.parts, ...parts],
    });
    previewMount.current = null;
    setGhost(null);
    setEditing(null);
    setSelected(parts[0].id);
    sfx("mount");
    const anchor = v.parts.find((p) => p.id === hit.id);
    notify(
      `${DEF[parts[0].key].name} ${source.kind === "mounted" ? "moved" : "attached"}${anchor ? ` to ${DEF[anchor.key].name.toLowerCase()} · ${hit.face.toLowerCase()}` : ""}.`,
    );
  }
  function remove() {
    if (!selection || selection.key === "core") return;
    const ids = descendants(v.parts, selection.id);
    commit({ ...v, parts: v.parts.filter((p) => !ids.has(p.id)) });
    setSelected(null);
    setGhost(null);
    sfx("mount");
    notify(
      `${ids.size} component${ids.size > 1 ? "s" : ""} removed. Salvage returned.`,
    );
  }
  function rotate(axis: number) {
    if (!ghost) return;
    const rot = [...ghost.rot] as V3;
    rot[axis] = (rot[axis] + (mode === "Box build" ? 90 : 15)) % 360;
    const p = { ...ghost, rot };
    const anchor = base.find((a) => a.id === p.parent);
    const hit = previewMount.current;
    if (anchor && hit?.id === anchor.id)
      setGhost(snapPartAt(p, anchor, face, hit.point, snapStep));
    else
      setGhost(mode === "Box build" && anchor ? snapPart(p, anchor, face) : p);
  }
  function editPart() {
    if (!selection || selection.key === "core") return;
    if (v.parts.some((p) => p.parent === selection.id)) {
      notify("Remove child attachments before moving this mount.");
      return;
    }
    previewMount.current = null;
    setEditing(selection.id);
    setGhost({
      ...selection,
      pos: [...selection.pos],
      rot: [...selection.rot],
      scale: [...selection.scale],
    });
    setMode("Custom");
    setLive(true);
  }
  function pick(hit: MountHit) {
    if (ghost) {
      const anchor = base.find((p) => p.id === hit.id);
      if (!anchor) return;
      previewMount.current = hit;
      setFace(hit.face);
      setGhost(snapPartAt(ghost, anchor, hit.face, hit.point, snapStep));
    } else setSelected(hit.id);
  }
  function preparePlacedDrag(
    event: PointerEvent,
    hit: MountHit | null,
    canvas: HTMLCanvasElement,
  ) {
    if (event.altKey || event.button !== 0 || !event.isPrimary) return false;
    if (ghost)
      return dragging.prepare(event, canvas, {
        kind: "preview",
        parts: [ghost],
      });
    const moving = hit && v.parts.find((p) => p.id === hit.id);
    if (!moving || moving.key === "core") return false;
    const ids = descendants(v.parts, moving.id);
    const cluster = [
      moving,
      ...v.parts.filter((p) => p.id !== moving.id && ids.has(p.id)),
    ];
    return dragging.prepare(event, canvas, { kind: "mounted", parts: cluster });
  }
  function prepareCatalogDrag(
    event: ReactPointerEvent<HTMLButtonElement>,
    d: ComponentDef,
    isLocked: boolean,
  ) {
    if (
      isLocked ||
      (event.pointerType === "touch" &&
        !(event.target as Element).closest(".part-drag-grip"))
    )
      return;
    if (event.button !== 0 || !event.isPrimary) return;
    void import("./WorkshopCanvas");
    dragging.prepare(event, event.currentTarget, {
      kind: "catalog",
      parts: [makePart(uid(), d.key, [0, 0, 0])],
    });
  }
  function save() {
    const name = saveName.trim().slice(0, 60);
    if (!name) return;
    const slot = Math.max(0, Math.min(GARAGE_SLOTS - 1, saveSlot));
    const existing = profile.garage.find((b) => b.slot === slot);
    const build = {
      ...v,
      name,
      id: existing?.id || uid(),
      saved: Date.now(),
      slot,
    };
    setProfile((p) => ({
      ...p,
      vehicle: { ...v, name },
      garage: [...p.garage.filter((b) => b.slot !== slot), build],
    }));
    setSaveOpen(false);
    sfx("mount");
    notify(`“${name}” stored in memory slot ${slot + 1}.`);
  }
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (
        ((e.target as HTMLElement)?.matches?.("input,select,textarea") ??
          false) ||
        document.querySelector('[role="dialog"]') ||
        document.querySelector(".battle-screen")
      )
        return;
      if (dragging.isActive()) {
        if (e.code === "Escape") {
          e.preventDefault();
          dragging.cancel();
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyZ") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.ctrlKey || e.metaKey) && e.code === "KeyY") {
        e.preventDefault();
        redo();
      } else if ((e.ctrlKey || e.metaKey) && e.code === "KeyS") {
        e.preventDefault();
        setSaveName(v.name);
        setSaveOpen(true);
      } else if (e.code === "Escape") {
        setGhost(null);
        setEditing(null);
        setSelected(null);
        setExpanded(false);
      } else if (e.code === "KeyR" && ghost) rotate(1);
      else if (e.code === "Enter" && ghost) confirm();
      else if ((e.code === "Delete" || e.code === "Backspace") && selection) {
        e.preventDefault();
        remove();
      } else if (e.code === "KeyD" && (e.metaKey || e.ctrlKey) && selection) {
        e.preventDefault();
        begin(DEF[selection.key]);
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  });
  const changeMode = (next: "Box build" | "Custom") => {
    setMode(next);
    setLive(true);
    sfx("click");
    if (!ghost)
      notify(
        next === "Custom"
          ? "Custom engineering: select a component to position, rotate, or resize it."
          : "Box construction: choose a part, then select an attachment face.",
      );
  };
  return (
    <>
      <PageHeading
        kicker="ENGINEERING DIVISION  /  BAY 01"
        title="Vehicle workshop"
        description="Build your machine. Fine-tune your design. Dominate the arena."
      >
        <Resources salvage={profile.salvage} coins={profile.coins} />
      </PageHeading>
      <div className="workshop-grid">
        <section
          className={`vehicle-panel ${expanded ? "viewport-expanded" : ""}`}
          ref={viewport}
          aria-label="Vehicle construction viewport"
        >
          <div
            ref={stage}
            className={`vehicle-stage ${show3d ? "is-live" : "is-cinematic"} ${dragging.view ? "is-part-dragging" : ""} ${ghost && (!dragging.view || dragging.view.source.kind === "preview") ? "has-preview" : ""}`}
          >
            {show3d ? (
              <Canvas
                parts={visibleParts}
                floorParts={v.parts}
                preview={dragging.view ? dragging.view.parts : plainPreview}
                mount={
                  dragging.view
                    ? dragging.view.hit
                    : ghost
                      ? previewMount.current
                      : null
                }
                invalid={dragging.view ? !!dragging.view.error : !!error}
                dragging={!!dragging.view}
                selected={dragging.view ? null : selected}
                onPick={pick}
                onPrepareDrag={preparePlacedDrag}
                onCancelDrag={dragging.cancel}
                picker={surfacePicker}
                livery={v.livery}
                com={m.com}
                showCom={showCom}
                showLinks={showLinks}
                quality={profile.settings.quality}
                focus={focus}
                zoom={zoom}
              />
            ) : (
              <div
                className="cinematic-image"
                role="button"
                tabIndex={0}
                aria-label="Inspect vehicle in 3D"
                onPointerDown={() => setLive(true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setLive(true);
                }}
              >
                <img
                  src="/arts/workshop-hero.webp"
                  alt="Mudskipper battle buggy with orange armor, off-road tires, twin egg launchers, and a rotary saw in Pip’s workshop"
                  fetchPriority="high"
                />
                <div className="embers">
                  {Array.from({ length: 9 }, (_, i) => (
                    <i
                      key={i}
                      style={{
                        left: `${9 + i * 10}%`,
                        animationDelay: `${i * -1.37}s`,
                        animationDuration: `${6 + i * 0.39}s`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
            <div className="viewport-shade" />
            <div className="vehicle-identity">
              <span className="online-tag">
                <i className="live-dot" />
                {show3d ? "LIVE BLUEPRINT" : "ACTIVE VEHICLE"}
              </span>
              <h2>{v.name}</h2>
              <span className="vehicle-subtitle">
                {show3d
                  ? `${v.parts.length} COMPONENT ASSEMBLY`
                  : "PIP’S CHAMPIONSHIP MACHINE"}
              </span>
            </div>
            <div className="bay-label">
              <Scan size={13} /> BAY 01
            </div>
            <div className="viewport-bottom">
              <button
                className={`camera-mode ${show3d ? "active" : ""}`}
                onClick={() => {
                  if (show3d && isFactory) {
                    setLive(false);
                    setGhost(null);
                    setSelected(null);
                  } else {
                    setLive(true);
                    setFocus((n) => n + 1);
                  }
                }}
              >
                <Orbit size={15} />
                {show3d
                  ? isFactory
                    ? "Cinematic view"
                    : "Reset orbit"
                  : "Orbit view"}
                <span>{show3d ? "3D" : "360°"}</span>
              </button>
              <div className="viewport-tools">
                {show3d && (
                  <>
                    <button
                      title="Zoom in"
                      aria-label="Zoom in"
                      onClick={() => setZoom((n) => n + 1)}
                    >
                      <ZoomIn size={15} />
                    </button>
                    <button
                      title="Zoom out"
                      aria-label="Zoom out"
                      onClick={() => setZoom((n) => n - 1)}
                    >
                      <ZoomOut size={15} />
                    </button>
                  </>
                )}
                <button
                  aria-label="Reset camera"
                  title="Reset camera"
                  onClick={() => {
                    setLive(true);
                    setFocus((n) => n + 1);
                  }}
                >
                  <Focus size={16} />
                </button>
                <button
                  aria-label={
                    expanded ? "Exit expanded view" : "Expand viewport"
                  }
                  title="Expand viewport"
                  onClick={() => setExpanded(!expanded)}
                >
                  {expanded ? <X size={16} /> : <Expand size={16} />}
                </button>
              </div>
            </div>
            {dragging.view && (
              <div
                className={`drop-status ${dragging.view.hit && dragging.view.error ? "invalid" : ""}`}
                data-valid={!!dragging.view.hit && !dragging.view.error}
                data-mount={dragging.view.hit?.id ?? ""}
                data-face={dragging.view.hit?.face ?? ""}
              >
                {dragging.view.hit ? (
                  dragging.view.error ? (
                    <TriangleAlert size={17} />
                  ) : (
                    <Anchor size={17} />
                  )
                ) : (
                  <Move size={17} />
                )}
                <div>
                  <strong>
                    {dragging.view.hit
                      ? dragging.view.error
                        ? "Cannot attach here"
                        : dragging.view.source.kind === "preview"
                          ? "Release to position preview"
                          : "Release to attach"
                      : "Drag on to the vehicle"}
                  </strong>
                  <small>
                    {dragging.view.hit
                      ? dragging.view.error ||
                        `${dragAnchor ? DEF[dragAnchor.key].name : "Component"} · ${dragging.view.hit.face}`
                      : "Aim at a visible mounting face"}
                  </small>
                </div>
              </div>
            )}
            {show3d && !dragging.view && !ghost && !selection && (
              <span className="workshop-drag-hint">
                <Move size={12} /> Drag a part to move it · drag floor to orbit
              </span>
            )}
            {ghost && !dragging.view && (
              <div className="placement-panel">
                <div className="panel-kicker">
                  <span className="eyebrow mint">
                    {editing ? "EDIT COMPONENT" : "PLACEMENT PREVIEW"}
                  </span>
                  <button
                    aria-label="Cancel placement"
                    onClick={() => {
                      setGhost(null);
                      setEditing(null);
                    }}
                  >
                    <X size={15} />
                  </button>
                </div>
                <h3>{DEF[ghost.key].name}</h3>
                <div className="mini-stat">
                  <SalvageIcon size={13} />
                  {partCost(ghost)} salvage <span>·</span>{" "}
                  {Math.round(
                    DEF[ghost.key].mass *
                      ghost.scale.reduce((a, b) => a * b, 1),
                  )}{" "}
                  kg <span>·</span>{" "}
                  {Math.round(
                    DEF[ghost.key].hp * ghost.scale.reduce((a, b) => a * b, 1),
                  )}{" "}
                  HP
                </div>
                {mode === "Box build" ? (
                  <>
                    <label className="field-label">ATTACHMENT FACE</label>
                    <div className="face-grid">
                      {FACES.map((f) => (
                        <button
                          key={f}
                          className={face === f ? "selected" : ""}
                          onClick={() => pickFace(f)}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                    <button className="rotate-part" onClick={() => rotate(1)}>
                      <RotateCw size={13} /> Rotate 90° <kbd>R</kbd>
                    </button>
                  </>
                ) : (
                  <>
                    <div className="transform-label">
                      <span>POSITION</span>
                      <button
                        className={snapping ? "mint" : ""}
                        onClick={() => setSnapping(!snapping)}
                      >
                        <Grid3X3 size={11} /> Snap {snapping ? "on" : "off"}
                      </button>
                    </div>
                    <div className="axis-inputs">
                      {["X", "Y", "Z"].map((axis, i) => (
                        <label key={axis}>
                          {axis}
                          <input
                            aria-label={`${axis} position`}
                            type="number"
                            step={snapping ? 0.25 : 0.05}
                            min="-8"
                            max="8"
                            value={ghost.pos[i]}
                            onChange={(e) => {
                              const pos = [...ghost.pos] as V3;
                              pos[i] = Math.max(
                                -8,
                                Math.min(8, Number(e.target.value)),
                              );
                              if (snapping) pos[i] = Math.round(pos[i] * 4) / 4;
                              previewMount.current = null;
                              setGhost({ ...ghost, pos });
                            }}
                          />
                        </label>
                      ))}
                    </div>
                    <div className="transform-label">
                      <span>ROTATION</span>
                      <span>15° STEPS</span>
                    </div>
                    <div className="face-grid rotation-grid">
                      {["X", "Y", "Z"].map((axis, i) => (
                        <button key={axis} onClick={() => rotate(i)}>
                          {axis} {ghost.rot[i]}°
                        </button>
                      ))}
                    </div>
                    <div className="transform-label">
                      <span>DIMENSIONS</span>
                      <span>× SCALE</span>
                    </div>
                    <div className="axis-inputs">
                      {["W", "H", "L"].map((s, i) => (
                        <label key={s}>
                          {s}
                          <input
                            aria-label={`${s} scale`}
                            type="number"
                            step="0.1"
                            min="0.5"
                            max="1.8"
                            value={ghost.scale[i]}
                            onChange={(e) => {
                              const scale = [...ghost.scale] as V3;
                              scale[i] = Math.max(
                                0.5,
                                Math.min(1.8, Number(e.target.value)),
                              );
                              setGhost({ ...ghost, scale });
                            }}
                          />
                        </label>
                      ))}
                    </div>
                  </>
                )}
                <div className={`mount-status ${error ? "invalid" : ""}`}>
                  {error ? <TriangleAlert size={13} /> : <Anchor size={13} />}
                  <span>{error || "Valid structural attachment"}</span>
                </div>
                <button
                  className="small-primary wide"
                  disabled={!!error}
                  onClick={confirm}
                >
                  <Check size={14} />
                  {editing ? "Apply changes" : "Attach component"}
                </button>
                <span className="inline-drag-tip">
                  Drag across the vehicle to adjust this mount.
                </span>
              </div>
            )}
            {!dragging.view && !ghost && selection && show3d && (
              <div className="selection-chip">
                <div>
                  <small>SELECTED PART</small>
                  <strong>{DEF[selection.key].name}</strong>
                </div>
                {selection.key !== "core" && (
                  <>
                    <button
                      title="Move and resize component"
                      aria-label="Edit selected component"
                      onClick={editPart}
                    >
                      <Move size={14} />
                    </button>
                    <button
                      aria-label="Duplicate component"
                      title="Duplicate component"
                      onClick={() => begin(DEF[selection.key])}
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      aria-label="Remove component and child attachments"
                      title="Remove component and its attachments"
                      onClick={remove}
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
                <button
                  aria-label="Deselect component"
                  onClick={() => setSelected(null)}
                >
                  <X size={13} />
                </button>
              </div>
            )}
          </div>
          <div className="build-toolbar">
            <span className="toolbar-label">BUILD MODE</span>
            <div className="mode-controls">
              {(["Box build", "Custom"] as const).map((s, i) => (
                <button
                  key={s}
                  className={mode === s ? "selected" : ""}
                  onClick={() => changeMode(s)}
                >
                  {i ? <SlidersHorizontal size={14} /> : <Box size={14} />} {s}
                </button>
              ))}
            </div>
            <div className="history-controls">
              <button
                title="Undo (Ctrl+Z)"
                aria-label="Undo build change"
                disabled={!past.current.length}
                onClick={undo}
              >
                <Undo2 size={16} />
              </button>
              <button
                title="Redo (Ctrl+Shift+Z)"
                aria-label="Redo build change"
                disabled={!future.current.length}
                onClick={redo}
              >
                <Redo2 size={16} />
              </button>
            </div>
            <button
              className={`tool-btn ${showCom ? "active" : ""}`}
              onClick={() => setShowCom(!showCom)}
              aria-label="Toggle centre of mass overlay"
              title="Centre of mass"
            >
              <Focus size={15} />
            </button>
            <button
              className={`tool-btn ${showLinks ? "active" : ""}`}
              onClick={() => setShowLinks(!showLinks)}
              aria-label="Toggle structural connection overlay"
              title="Structural connections"
            >
              <Layers3 size={15} />
            </button>
            <button
              className="save-build"
              onClick={() => setCustomizeOpen(true)}
            >
              <Paintbrush size={15} />
              <span>Customize</span>
            </button>
            <button
              className="save-build"
              onClick={() => setAnalysisOpen(true)}
            >
              <Activity size={15} />
              <span>Analyze</span>
            </button>
            <button
              className="save-build"
              onClick={() => {
                setSaveName(v.name);
                setSaveOpen(true);
              }}
            >
              <Save size={15} />
              <span>Save build</span>
            </button>
          </div>
        </section>
        <aside className="telemetry">
          <div className="section-top">
            <h2>
              <Activity size={17} />
              Build telemetry
            </h2>
            <span className="live-readout">
              <i className="live-dot" />
              LIVE
            </span>
          </div>
          <button
            className="rating-block"
            onClick={() => setRatingOpen(true)}
            title="View dynamic rating breakdown"
          >
            <div>
              <small>VEHICLE RATING</small>
              <div>
                <strong>{m.rating}</strong>
                <span className="class-badge">
                  CLASS{" "}
                  {m.rating > 650
                    ? "A"
                    : m.rating > 480
                      ? "B"
                      : m.rating > 330
                        ? "C"
                        : "D"}
                </span>
              </div>
            </div>
            <div className="rating-glyph" aria-hidden="true">
              {Array.from({ length: 7 }, (_, i) => (
                <i
                  key={i}
                  style={{
                    height: `${10 + i * 4}px`,
                    opacity: 0.18 + i * 0.12,
                  }}
                />
              ))}
            </div>
          </button>
          <div className="meter-stack">
            {[
              {
                name: "Durability",
                icon: Shield,
                value: m.durability,
                text: `${m.hp} HP`,
                color: "mint",
              },
              {
                name: "Mobility",
                icon: Gauge,
                value: m.mobility,
                text: `${m.mobility} / 100`,
                color: "cyan",
              },
              {
                name: "Firepower",
                icon: Crosshair,
                value: m.firepower,
                text: `${m.firepower} / 100`,
                color: "orange",
              },
            ].map(({ name, icon: Icon, value, text, color }) => (
              <div className={`meter ${color}`} key={name}>
                <div>
                  <span>
                    <Icon size={13} />
                    {name}
                  </span>
                  <b>{text}</b>
                </div>
                <div className="meter-track">
                  <i style={{ width: `${value}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="cost-breakdown">
            <div className="salvage-row">
              <span>
                <SalvageIcon size={15} />
                Salvage used
              </span>
              <b>
                {m.cost} <em>/ {profile.salvage}</em>
              </b>
            </div>
            <div className="segmented-track">
              {Array.from({ length: 24 }, (_, i) => (
                <i
                  key={i}
                  className={
                    i < Math.ceil((m.cost / profile.salvage) * 24) ? "on" : ""
                  }
                />
              ))}
            </div>
            <div className="weight-row">
              <span>
                <Weight size={13} />
                Total weight
              </span>
              <b>
                {m.mass} <em>kg</em>
              </b>
            </div>
            <div className="weight-row">
              <span>
                <Boxes size={13} />
                Components
              </span>
              <b>{pad(m.parts)}</b>
            </div>
          </div>
          <div className="arena-cta">
            <button className="primary enter-arena" onClick={onBattle}>
              <span>
                <Crosshair size={18} /> Enter arena
              </span>
              <ChevronsRight size={21} />
            </button>
            <small>
              ROUND {pad(profile.level)} <b>/</b>{" "}
              {opponent(profile.level).stage}
            </small>
          </div>
        </aside>
      </div>
      <section className="component-library" ref={catalog}>
        <div className="library-head">
          <div className="section-heading">
            <Boxes size={21} />
            <h2>Component library</h2>
            <span className="number-badge">{CATALOG.length}</span>
          </div>
          <div className="category-tabs">
            {(
              [
                "All parts",
                "Structure",
                "Mobility",
                "Weapons",
                "Mechanical",
                "Power",
              ] as const
            ).map((c) => {
              const Icon =
                c === "All parts"
                  ? Grid3X3
                  : c === "Structure"
                    ? Box
                    : c === "Mobility"
                      ? CircleDot
                      : c === "Weapons"
                        ? Crosshair
                        : c === "Mechanical"
                          ? Wrench
                          : Zap;
              return (
                <button
                  key={c}
                  onClick={() => {
                    setGroup(c as Category | "All parts");
                    setPage(0);
                  }}
                  className={group === c ? "active" : ""}
                >
                  <Icon size={13} />
                  {c === "Mechanical" ? "Mechanics" : c}
                </button>
              );
            })}
          </div>
          <div className="library-actions">
            <button
              className={searching ? "active" : ""}
              title="Search components"
              aria-label="Search components"
              onClick={() => {
                setSearching(!searching);
                setQuery("");
              }}
            >
              <Search size={16} />
            </button>
            <button
              title="Filter by rarity"
              aria-label="Filter by rarity"
              className={filterOpen ? "active" : ""}
              onClick={() => setFilterOpen(!filterOpen)}
            >
              <SlidersHorizontal size={15} />
            </button>
          </div>
        </div>
        {(searching || filterOpen) && (
          <div className="filter-strip">
            {searching && (
              <label>
                <Search size={15} />
                <input
                  autoFocus
                  type="search"
                  placeholder="Find a component…"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(0);
                  }}
                />
              </label>
            )}
            {filterOpen && (
              <>
                <select
                  aria-label="Component rarity"
                  value={rarity}
                  onChange={(e) => {
                    setRarity(e.target.value);
                    setPage(0);
                  }}
                >
                  {[
                    "All rarities",
                    "Common",
                    "Uncommon",
                    "Rare",
                    "Epic",
                    "Legendary",
                  ].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                <select
                  aria-label="Component material"
                  value={materialFilter}
                  onChange={(e) => {
                    setMaterialFilter(e.target.value);
                    setPage(0);
                  }}
                >
                  <option>All materials</option>
                  {Object.entries(MATERIAL_PROFILES).map(([key, v]) => (
                    <option key={key} value={key}>
                      {v.label}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Sort components"
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value);
                    setPage(0);
                  }}
                >
                  {[
                    "Default",
                    "Cost: low",
                    "Cost: high",
                    "Mass: light",
                    "Rating",
                  ].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </>
            )}
            <span>{sortedCards.length} matching components</span>
          </div>
        )}
        <div className="part-grid">
          {shown.map((d) => {
            const requirement = componentLock(d, profile),
              isLocked = !!requirement;
            return (
              <button
                className={`part-card ${ghost?.key === d.key ? "chosen" : ""}`}
                key={d.key}
                onClick={(e) => {
                  if (!dragging.consumeClick(e.detail)) begin(d);
                }}
                onPointerDown={(e) => prepareCatalogDrag(e, d, isLocked)}
                onDragStart={(e) => e.preventDefault()}
                data-movable={!isLocked}
                aria-label={`${isLocked ? "Locked" : "Place"} ${d.name}, ${d.cost} salvage`}
                title={
                  requirement ??
                  `${MATERIAL_PROFILES[d.material].label} · ${d.description}`
                }
              >
                <div className="part-art">
                  <img
                    src={`/arts/${d.art}.webp`}
                    alt={d.name}
                    draggable={false}
                    loading="eager"
                  />
                  <span className={`rarity rarity-${d.rarity.toLowerCase()}`}>
                    <i />
                    {d.rarity}
                  </span>
                  {isLocked && <Lock size={14} className="card-lock" />}
                </div>
                <div className="part-card-details">
                  <h3>{d.name}</h3>
                  <span className="part-material">
                    {MATERIAL_PROFILES[d.material].label} · {d.category}
                  </span>
                  <div>
                    <span>
                      <SalvageIcon size={14} />
                      <b>{d.cost}</b> salvage
                    </span>
                    <span
                      className={`part-add ${isLocked ? "" : "part-drag-grip"}`}
                      title={
                        isLocked
                          ? "Research to unlock"
                          : "Drag to mount · click to preview"
                      }
                    >
                      {isLocked ? (
                        <Lock size={12} />
                      ) : (
                        <GripVertical size={15} />
                      )}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        {!shown.length && (
          <div className="empty-state">
            <Search />
            <h3>No matching components</h3>
            <p>Try another name or rarity.</p>
            <button
              className="dark-button"
              onClick={() => {
                setQuery("");
                setRarity("All rarities");
                setGroup("All parts");
              }}
            >
              Clear filters
            </button>
          </div>
        )}
        <div className="catalog-footer">
          <span>
            <GripVertical size={13} /> Drag a part onto your vehicle · tap to
            preview
          </span>
          <div>
            <span>
              {sortedCards.length
                ? `${page * 6 + 1}–${Math.min((page + 1) * 6, sortedCards.length)}`
                : "0"}{" "}
              <em>of {sortedCards.length}</em>
            </span>
            <button
              disabled={page === 0}
              onClick={() => setPage((n) => n - 1)}
              aria-label="Previous components"
            >
              <ChevronLeft size={15} />
            </button>
            <button
              disabled={page >= pageCount - 1}
              onClick={() => setPage((n) => n + 1)}
              aria-label="Next components"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </section>
      {dragging.view && !dragging.view.hit && (
        <div
          className="drag-carrier"
          aria-hidden="true"
          style={{
            left: Math.max(
              12,
              Math.min(dragging.view.x + 13, window.innerWidth - 154),
            ),
            top: Math.max(
              10,
              Math.min(dragging.view.y + 12, window.innerHeight - 62),
            ),
          }}
        >
          <img
            draggable={false}
            src={`/arts/${DEF[dragging.view.source.parts[0].key].art}.webp`}
            alt=""
          />
          <span>
            <small>CARRYING</small>
            <strong>{DEF[dragging.view.source.parts[0].key].name}</strong>
          </span>
        </div>
      )}
      {saveOpen && (
        <Dialog
          title="Save to memory bank"
          kicker="GARAGE / 4 RECALL SLOTS"
          onClose={() => setSaveOpen(false)}
        >
          <p>
            Store this assembly and its livery in one of four recall slots.
            Saving to an occupied slot overwrites that memory.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <label className="form-field">
              VEHICLE NAME
              <input
                autoFocus
                maxLength={60}
                required
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
              />
            </label>
            <label className="form-field">
              MEMORY SLOT
              <select
                value={saveSlot}
                onChange={(e) => setSaveSlot(+e.target.value)}
              >
                {Array.from({ length: GARAGE_SLOTS }, (_, i) => (
                  <option key={i} value={i}>
                    Slot {i + 1}
                    {profile.garage.find((b) => b.slot === i)
                      ? ` · ${profile.garage.find((b) => b.slot === i)!.name}`
                      : " · empty"}
                  </option>
                ))}
              </select>
            </label>
            <div className="summary-strip">
              <span>{m.parts} components</span>
              <span>{m.mass} kg</span>
              <span>{m.rating} rating</span>
            </div>
            <button
              className="primary wide"
              type="submit"
              disabled={!saveName.trim()}
            >
              <Save size={15} />
              Save memory slot
            </button>
          </form>
        </Dialog>
      )}
      {locked && (
        <Dialog
          title={locked.name}
          kicker={`${locked.rarity.toUpperCase()} / UNLOCK REQUIREMENT`}
          onClose={() => setLocked(null)}
        >
          <img
            className="research-hero"
            src={`/arts/${locked.art}.webp`}
            alt={locked.name}
          />
          <p>{locked.description}</p>
          <div className="research-price">
            Requirement{" "}
            <b>{lockedReason || `${locked.coins} championship coins`}</b>
          </div>
          <button
            className="primary wide"
            onClick={() => {
              setLocked(null);
              onUpgrades();
            }}
          >
            Open research lab <ArrowRight size={15} />
          </button>
          <PartFacts part={locked} />
        </Dialog>
      )}
      {customizeOpen && (
        <CustomizeDialog
          profile={profile}
          setProfile={setProfile}
          onClose={() => setCustomizeOpen(false)}
          notify={notify}
        />
      )}
      {analysisOpen && (
        <EngineeringAnalysis
          profile={profile}
          selected={selected}
          onSelect={setSelected}
          showCom={showCom}
          setShowCom={setShowCom}
          showLinks={showLinks}
          setShowLinks={setShowLinks}
          onClose={() => setAnalysisOpen(false)}
        />
      )}
      {ratingOpen && (
        <Dialog
          title="Engineering assessment"
          kicker="TELEMETRY / LIVE CALCULATION"
          onClose={() => setRatingOpen(false)}
        >
          <div className="assessment-score">
            <Activity />
            <strong>{m.rating}</strong>
            <span>VEHICLE RATING</span>
          </div>
          <p>
            Your rating is calculated from this assembly, not your championship
            rank.
          </p>
          <div className="detail-rows">
            {[
              ["Structural durability", `${m.hp} HP`],
              ["Weapon output", `${m.damage.toFixed(1)} effective DPS`],
              ["Drive performance", `${m.mobility} / 100`],
              ["Weight balance", `${Math.round(m.balance * 100)}%`],
              ["Energy efficiency", `${Math.round(m.efficiency * 100)}%`],
              ["Lift capacity", `${m.lift} kg`],
              ["Assembly complexity", `${m.parts} components`],
              ["Available salvage", `${profile.salvage - m.cost} remaining`],
            ].map(([a, b]) => (
              <div key={a}>
                <span>{a}</span>
                <b>{b}</b>
              </div>
            ))}
          </div>
        </Dialog>
      )}
    </>
  );
}
