"use client";
import { useEffect, useRef, type ReactNode } from "react";
import {
  X,
  Hexagon,
  Coins,
  ChevronRight,
  AudioLines,
  Check,
  Shield,
  Weight,
  Zap,
} from "lucide-react";
import { DEF, metrics, type Vehicle, type ComponentDef } from "@/game/data";
export const pad = (n: number) => String(n).padStart(2, "0");
export function Brand() {
  return (
    <span className="brand">
      <svg viewBox="0 0 42 41" aria-hidden="true">
        <path
          d="M1 7h11l8 23-6 8zM16 7h9l3 9 7-13h8L24 38z"
          fill="currentColor"
        />
      </svg>
      <span>
        <strong>VMD</strong>
        <small>CHAMPIONSHIP</small>
      </span>
    </span>
  );
}
export function SalvageIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className="salvage-icon"
      aria-hidden="true"
    >
      <path
        d="m12 2 8.7 5v10L12 22l-8.7-5V7z"
        fill="currentColor"
        fillOpacity=".12"
        stroke="currentColor"
        strokeWidth="1.65"
      />
      <path
        d="m7.4 14.8 7.1-9.1-1.2 5H17l-7.7 8.4 1.8-5.4z"
        fill="currentColor"
      />
    </svg>
  );
}
export function Resources({
  salvage,
  coins,
}: {
  salvage: number;
  coins: number;
}) {
  return (
    <div className="resources">
      <div className="resource">
        <span className="resource-symbol">
          <SalvageIcon size={28} />
        </span>
        <div>
          <small>SALVAGE</small>
          <strong>{salvage}</strong>
        </div>
      </div>
      <div className="resource coin">
        <span className="resource-symbol">
          <Coins size={27} strokeWidth={1.7} />
        </span>
        <div>
          <small>CHAMP. COINS</small>
          <strong>{coins}</strong>
        </div>
      </div>
    </div>
  );
}
export function PageHeading({
  kicker,
  title,
  description,
  children,
}: {
  kicker: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow orange">
          <span className="eyebrow-dash" />
          {kicker}
        </div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </div>
  );
}
export function Dialog({
  title,
  kicker,
  children,
  onClose,
  className = "",
}: {
  title: string;
  kicker?: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null),
    close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const first = ref.current?.querySelector<HTMLElement>(
      "input,button,select",
    );
    first?.focus();
    const handle = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        e.stopPropagation();
        close.current();
      }
      if (e.key === "Tab") {
        const items = ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input,select,textarea,[tabindex="0"]',
        );
        if (!items?.length) return;
        const first = items[0],
          last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", handle, true);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", handle, true);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`modal ${className}`}
      >
        <button
          className="modal-close icon-btn"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={18} />
        </button>
        {kicker && (
          <div className="eyebrow orange">
            <span className="eyebrow-dash" />
            {kicker}
          </div>
        )}
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}
export function PartFacts({ part }: { part: ComponentDef }) {
  return (
    <div className="part-facts">
      <span>
        <Shield />
        {part.hp} HP
      </span>
      <span>
        <Weight />
        {part.mass} kg
      </span>
      <span>
        <SalvageIcon />
        {part.cost} salvage
      </span>
      {part.power > 0 && (
        <span>
          <Zap />
          {part.power} {part.category === "Weapons" ? "damage" : "power"}
        </span>
      )}
    </div>
  );
}
export function Blueprint({ vehicle }: { vehicle: Vehicle }) {
  const iso = (x: number, y: number, z: number) => [
    160 + (x * 0.88 - z * 0.65) * 22,
    94 + (x * 0.38 + z * 0.45 - y * 0.98) * 22,
  ];
  const sorted = [...vehicle.parts].sort(
    (a, b) => a.pos[0] + a.pos[2] - b.pos[0] - b.pos[2],
  );
  return (
    <svg
      className="blueprint-art"
      viewBox="0 0 320 150"
      aria-label={`${vehicle.name} engineering blueprint`}
    >
      <defs>
        <pattern
          id="bpgrid"
          width="14"
          height="14"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M14 0H0v14"
            fill="none"
            stroke="#54716f"
            strokeOpacity=".17"
            strokeWidth="1"
          />
        </pattern>
      </defs>
      <rect width="320" height="150" fill="#192829" />
      <rect width="320" height="150" fill="url(#bpgrid)" />
      {sorted.map((p) => {
        const [x, y, z] = p.pos,
          [w, h, l] = DEF[p.key].dimensions.map((a, i) => (a * p.scale[i]) / 2);
        const vertex = (a: number, b: number, c: number) =>
          iso(x + a * w, y + b * h, z + c * l).join(",");
        return (
          <g
            key={p.id}
            stroke={DEF[p.key].category === "Weapons" ? "#e8aa72" : "#83c5b9"}
            strokeWidth="1.15"
          >
            <polygon
              fill="#263f41"
              points={[
                vertex(-1, 1, 1),
                vertex(1, 1, 1),
                vertex(1, -1, 1),
                vertex(-1, -1, 1),
              ].join(" ")}
            />
            <polygon
              fill="#314c4c"
              points={[
                vertex(1, 1, -1),
                vertex(1, 1, 1),
                vertex(1, -1, 1),
                vertex(1, -1, -1),
              ].join(" ")}
            />
            <polygon
              fill={DEF[p.key].category === "Weapons" ? "#635043" : "#405a56"}
              points={[
                vertex(-1, 1, -1),
                vertex(1, 1, -1),
                vertex(1, 1, 1),
                vertex(-1, 1, 1),
              ].join(" ")}
            />
          </g>
        );
      })}
    </svg>
  );
}
export function BuildSummary({ vehicle }: { vehicle: Vehicle }) {
  const m = metrics(vehicle);
  return (
    <div className="build-summary">
      <span>
        <b>{m.rating}</b> RATING
      </span>
      <span>
        <b>{m.mass}</b> KG
      </span>
      <span>
        <b>{vehicle.parts.length}</b> PARTS
      </span>
    </div>
  );
}
