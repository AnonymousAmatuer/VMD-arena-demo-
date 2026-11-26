import { ARENA_PREVIOUS_RADIUS, ARENA_RADIUS } from "./data";

/* Arena features. Every rule lives here so the physics, the 3D views and the
   tests all read the same numbers. */

export const ARENA_SCALE = ARENA_RADIUS / ARENA_PREVIOUS_RADIUS;
export const GRAVITY = 15.8;
/** Small dash/jump pads: ~1.5x the starter vehicle width (2.35 -> 3.5) and length (3.35 -> 5.0). */
export const PAD_HALF_LENGTH = 2.5;
export const PAD_HALF_WIDTH = 1.75;
/** A dash pad boosts speed by +150% (2.5x multiplier) for 0.7 seconds. */
export const DASH_MULTIPLIER = 2.5;
export const DASH_SECONDS = 0.7;
export const DASH_MIN_SPEED = 8;
export const JUMP_SPEED = 12.6;
export const TELEPORT_COOLDOWN = 10;
export const PORTAL_COOLDOWN = 15;
export const CLONE_SECONDS = 6;
export const SPIKE_DAMAGE = 11;
export const SPIKE_COOLDOWN = 0.8;
/** Any part whose centre passes this radius touches the perimeter spike ring. */
export const SPIKE_RADIUS = ARENA_RADIUS - 2.4;

export interface Pad {
  x: number;
  z: number;
  /** Yaw in the same convention as the vehicles: forward = (-sin, -cos). */
  yaw: number;
}
export interface TeleportPair {
  id: string;
  color: string;
  a: Pad;
  b: Pad;
}

export const DASH_PADS: Pad[] = [
  { x: -4.8, z: 24, yaw: 0 },
  { x: 4.8, z: -24, yaw: Math.PI },
  { x: -22, z: 8, yaw: 0.4 },
  { x: 22, z: -8, yaw: -2.74 },
  { x: 16, z: 16, yaw: 0.65 },
  { x: -16, z: -16, yaw: -2.49 },
];

export const JUMP_PADS: Pad[] = [
  { x: 5.2, z: 21, yaw: 0 },
  { x: -5.2, z: -21, yaw: Math.PI },
  { x: -19, z: 0, yaw: Math.PI / 2 },
  { x: 19, z: 0, yaw: -Math.PI / 2 },
];

export const TELEPORT_PAIRS: TeleportPair[] = [
  {
    id: "cyan",
    color: "#38f6ff",
    a: { x: -11.5, z: 25.5, yaw: 0.25 },
    b: { x: 28, z: -24, yaw: -2.4 },
  },
  {
    id: "magenta",
    color: "#ff4fd8",
    a: { x: 11.5, z: 25.5, yaw: -0.25 },
    b: { x: -28, z: -24, yaw: 2.4 },
  },
];

export const PORTAL: Pad = { x: 0, z: 14.5, yaw: 0 };

export function padForward(pad: Pad) {
  return { x: -Math.sin(pad.yaw), z: -Math.cos(pad.yaw) };
}

export function padContains(pad: Pad, x: number, z: number, extraRadius = 0) {
  const dx = x - pad.x;
  const dz = z - pad.z;
  const f = padForward(pad);
  const r = { x: Math.cos(pad.yaw), z: -Math.sin(pad.yaw) };
  const along = dx * f.x + dz * f.z;
  const across = dx * r.x + dz * r.z;
  return (
    Math.abs(along) <= PAD_HALF_LENGTH + extraRadius &&
    Math.abs(across) <= PAD_HALF_WIDTH + extraRadius
  );
}

/**
 * Where a ballistic body will meet the deck. Used for the landing shadow, so
 * the indicator and the physics agree by construction.
 */
export function predictLanding(
  px: number,
  py: number,
  pz: number,
  vx: number,
  vy: number,
  vz: number,
  groundY = 0.9,
): { x: number; z: number; t: number } | null {
  const a = -GRAVITY / 2;
  const b = vy;
  const c = py - groundY;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  const t = Math.max((-b + root) / (2 * a), (-b - root) / (2 * a));
  if (t <= 0) return null;
  const x = Math.max(-ARENA_RADIUS, Math.min(ARENA_RADIUS, px + vx * t));
  const z = Math.max(-ARENA_RADIUS, Math.min(ARENA_RADIUS, pz + vz * t));
  return { x, z, t };
}
