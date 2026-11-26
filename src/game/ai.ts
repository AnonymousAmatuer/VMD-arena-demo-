import {
  ARENA_RADIUS,
  DEF,
  type MatchStats,
  type RivalMemory,
  type V3,
} from "./data";
import type { RivalPersonality } from "./rivals";

/*
 * Rival brain. It reasons only from observable and self-known state:
 *   - its own parts, HP, cooldowns, energy and orientation (self-knowledge),
 *   - the rival's attached parts, height, tilt and positions (visible),
 *   - nothing hidden such as the rival's HP numbers or cooldowns.
 * Strategy is chosen by utility scoring every ~0.22s with hysteresis; steering
 * and weapon control run every physics step.
 */

export type Mode =
  "engage" | "kite" | "flank" | "pounce" | "retreat" | "fly" | "hold";
export interface AiPart {
  part: { id: string; key: string; pos: V3; parent: string | null };
  hp: number;
  max: number;
  cooldown: number;
  offset: { x: number; y: number; z: number };
  mass: number;
  debris: unknown;
}
export interface AiBody {
  position: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  quaternion: { x: number; y: number; z: number; w: number };
  mass: number;
}
export interface AiUnit {
  body: AiBody;
  parts: AiPart[];
  energy: number;
  powerMax: number;
  powerGen: number;
  driveState: string;
  airtime: number;
}
export interface AiIntent {
  gas: number;
  steer: number;
  fire: boolean;
  weapons: Set<string>;
  action: boolean;
  mode: Mode;
}

const MODES: Mode[] = [
  "engage",
  "kite",
  "flank",
  "pounce",
  "retreat",
  "fly",
  "hold",
];
const REASON: Record<Mode, string> = {
  engage: "Closing to striking range",
  kite: "Backing off to keep distance from their weapons",
  flank: "Circling for an exposed side",
  pounce: "Exploiting their loss of mobility",
  retreat: "Withdrawing to survive",
  fly: "Taking to the air",
  hold: "Reading the arena",
};

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
/** Heading convention shared with the simulator's own steering. */
const yawOf = (x: number, z: number) => Math.atan2(-x, -z);

/** Rotates a vector by a quaternion (x, y, z, w). */
function rotate(
  q: { x: number; y: number; z: number; w: number },
  v: [number, number, number],
): [number, number, number] {
  const tx = 2 * (q.y * v[2] - q.z * v[1]);
  const ty = 2 * (q.z * v[0] - q.x * v[2]);
  const tz = 2 * (q.x * v[1] - q.y * v[0]);
  return [
    v[0] + q.w * tx + (q.y * tz - q.z * ty),
    v[1] + q.w * ty + (q.z * tx - q.x * tz),
    v[2] + q.w * tz + (q.x * ty - q.y * tx),
  ];
}

interface WeaponView {
  id: string;
  range: number;
  melee: boolean;
  ready: boolean;
  swivel: boolean;
  energy: number;
  efficiency: number;
}
interface Situation {
  mp: { x: number; y: number; z: number };
  fp: { x: number; y: number; z: number };
  dx: number;
  dz: number;
  dist: number;
  fwd: [number, number, number];
  right: [number, number, number];
  q: { x: number; y: number; z: number; w: number };
  tipped: boolean;
  grounded: boolean;
  mobility: number;
  canFly: boolean;
  bestRange: number;
  meleeRange: number;
  health: number;
  canAttack: boolean;
  weapons: WeaponView[];
  hasJumper: boolean;
  hasBoost: boolean;
  boostCost: number;
  foeLoss: number;
  foeTipped: boolean;
  foeAir: boolean;
  foeReach: number;
  foeRearWeapons: number;
  foeLeftParts: number;
  foeRightParts: number;
  foeAttached: number;
  foeFwd: [number, number, number];
  foeRight: [number, number, number];
  obstacles: { x: number; z: number; r: number }[];
}

export class RivalBrain {
  readonly personality: RivalPersonality;
  readonly name: string;
  private readonly skill: number;
  mode: Mode = "engage";
  reason = REASON.engage;
  private modeUntil = 0;
  private nextThink = 0;
  private startWheels = -1;
  private foeStart = -1;
  private foeWheelMax = 0;
  private foeWheelBase = -1;
  private scores: Record<Mode, number> = {
    engage: 0,
    kite: 0,
    flank: 0,
    pounce: 0,
    retreat: 0,
    fly: 0,
    hold: 0,
  };

  constructor(
    rival: { name: string; personality: RivalPersonality; level?: number },
    memory?: RivalMemory,
  ) {
    this.name = rival.name;
    this.skill = clamp(((rival.level ?? 1) - 1) / 99, 0, 1);
    const p = { ...rival.personality };
    // Veteran rivals press attacks sooner, adapt more readily and take fewer
    // unnecessary pauses. Their engineering still determines their role.
    p.aggression += 0.08 + this.skill * 0.14;
    p.risk += 0.04 + this.skill * 0.08;
    p.adaptability += this.skill * 0.08;
    p.caution -= this.skill * 0.07;
    // Adaptation: bounded nudges from earlier matches, scaled by how adaptable
    // this engineer is. Nothing here touches damage, health or power.
    if (memory && memory.matches > 0) {
      const adapt = 0.5 + 0.5 * p.adaptability;
      if (memory.rangedShare > 0.6) p.aggression += 0.12 * adapt;
      if (memory.meleeShare > 0.55) {
        p.caution += 0.12 * adapt;
        p.preferredRange += 0.12 * adapt;
      }
      if (memory.closeShare > 0.6) p.preferredRange += 0.1 * adapt;
      if (memory.airShare > 0.2) p.mobility += 0.08 * adapt;
    }
    this.personality = {
      aggression: clamp(p.aggression, 0, 1),
      caution: clamp(p.caution, 0, 1),
      creativity: clamp(p.creativity, 0, 1),
      mobility: clamp(p.mobility, 0, 1),
      risk: clamp(p.risk, 0, 1),
      defense: clamp(p.defense, 0, 1),
      adaptability: clamp(p.adaptability, 0, 1),
      preferredRange: clamp(p.preferredRange, 0, 1),
    };
  }

  decide(
    me: AiUnit,
    foe: AiUnit,
    time: number,
    obstacles: { x: number; z: number; r: number }[],
  ): AiIntent {
    if (this.startWheels < 0) this.calibrate(me, foe);
    const S = this.assess(me, foe, obstacles);
    if (time >= this.nextThink) {
      this.nextThink = time + 0.22 - this.skill * 0.08;
      this.think(S, time);
    }
    return this.steer(S, me, foe);
  }

  /** Records what the brain can see at the start of a round. */
  private calibrate(me: AiUnit, foe: AiUnit) {
    this.startWheels = me.parts.filter(
      (p) => DEF[p.part.key].kind === "wheel",
    ).length;
    this.foeStart = Math.max(1, foe.parts.length);
    this.foeWheelBase = foe.parts.filter(
      (p) => DEF[p.part.key].kind === "wheel",
    ).length;
    this.foeWheelMax = this.foeWheelBase;
  }

  private assess(
    me: AiUnit,
    foe: AiUnit,
    obstacles: { x: number; z: number; r: number }[],
  ): Situation {
    const q = me.body.quaternion;
    const fwd = rotate(q, [0, 0, -1]);
    const right = rotate(q, [1, 0, 0]);
    const up = rotate(q, [0, 1, 0]);
    const mp = me.body.position;
    const fp = foe.body.position;
    const dx = fp.x - mp.x;
    const dz = fp.z - mp.z;
    const dist = Math.hypot(dx, dz);

    // Own state: complete knowledge, including every component's condition.
    let wheelCondition = 0;
    let lift = 0;
    let weaponHp = 0;
    let weaponMax = 0;
    let hpSum = 0;
    let hpMax = 0;
    const weapons: WeaponView[] = [];
    for (const p of me.parts) {
      const d = DEF[p.part.key];
      const cond = p.max > 0 ? p.hp / p.max : 0;
      hpMax += p.max;
      if (p.hp <= 0) continue;
      hpSum += p.hp;
      if (d.kind === "wheel" && cond > 0.2) wheelCondition += cond;
      if (d.kind === "rotor")
        lift += d.power * (cond < 0.25 ? 0.12 : Math.pow(cond, 1.5));
      if (d.category === "Weapons") {
        weaponHp += cond;
        weaponMax++;
        if (cond > 0.2) {
          const swivel = me.parts.some(
            (a) =>
              a.part.id === p.part.parent &&
              a.hp > 0 &&
              (DEF[a.part.key].trait === "platform" || a.part.key === "joint"),
          );
          weapons.push({
            id: p.part.id,
            range: d.range,
            melee: d.behavior === "melee",
            ready: p.cooldown <= 0 && me.energy >= d.energy,
            swivel,
            energy: d.energy,
            efficiency: d.power / Math.max(1, d.energy),
          });
        }
      }
    }
    const liftPower = lift * 16.6;
    const canFly = liftPower >= me.body.mass * 9.81 * 1.08;
    const mobility =
      this.startWheels > 0
        ? clamp(wheelCondition / this.startWheels, 0, 1)
        : canFly
          ? 0.4
          : 0;
    const bestRange = Math.max(
      0,
      ...weapons.filter((w) => !w.melee).map((w) => w.range),
    );
    const meleeRange = Math.max(
      0,
      ...weapons.filter((w) => w.melee).map((w) => w.range),
    );
    const canAttack = weapons.length > 0 || canFly;

    // Observable rival state: attached parts, tilt and height.
    const attached = foe.parts.filter((p) => p.hp > 0);
    const foeWheels = attached.filter(
      (p) => DEF[p.part.key].kind === "wheel",
    ).length;
    if (this.foeWheelBase < 0) this.foeWheelBase = foeWheels;
    this.foeWheelMax = Math.max(this.foeWheelMax, foeWheels);
    const foeWeapons = attached.filter(
      (p) => DEF[p.part.key].category === "Weapons",
    );
    const foeReach = Math.max(
      0,
      ...foeWeapons.map((p) => DEF[p.part.key].range),
    );
    const foeUp = rotate(foe.body.quaternion, [0, 1, 0]);
    const foeFwd = rotate(foe.body.quaternion, [0, 0, -1]);
    const foeRight = rotate(foe.body.quaternion, [1, 0, 0]);

    return {
      mp,
      fp,
      dx,
      dz,
      dist,
      fwd,
      right,
      q,
      tipped: up[1] < 0.45,
      grounded: me.body.position.y < 1.7,
      mobility,
      canFly,
      bestRange,
      meleeRange,
      health: hpMax > 0 ? hpSum / hpMax : 0,
      canAttack,
      weapons,
      hasJumper: me.parts.some(
        (p) => p.hp > 0 && DEF[p.part.key].trait === "jumper",
      ),
      hasBoost: me.parts.some(
        (p) => p.hp > 0 && DEF[p.part.key].kind === "thruster",
      ),
      boostCost: Math.max(
        14,
        ...me.parts
          .filter((p) => p.hp > 0 && DEF[p.part.key].kind === "thruster")
          .map((p) => DEF[p.part.key].energy),
      ),
      foeLoss: Math.max(0, this.foeWheelMax - foeWheels),
      foeTipped: foeUp[1] < 0.5,
      foeAir: fp.y > 2.3,
      foeReach,
      foeRearWeapons: foeWeapons.filter((p) => p.part.pos[2] > 0).length,
      foeLeftParts: attached.filter((p) => p.offset.x < -0.1).length,
      foeRightParts: attached.filter((p) => p.offset.x > 0.1).length,
      foeAttached: attached.length / this.foeStart,
      foeFwd,
      foeRight,
      obstacles,
    };
  }

  private think(S: Situation, time: number) {
    const p = this.personality;
    const ideal =
      S.bestRange > 0
        ? S.bestRange * (0.35 + 0.5 * p.preferredRange)
        : S.meleeRange > 0
          ? Math.max(2.2, S.meleeRange * 0.75)
          : 9;
    const threat = S.dist < Math.max(S.foeReach * 0.8, 1.8);
    const scores: Record<Mode, number> = {
      engage: S.canAttack
        ? 0.3 +
          0.45 * p.aggression +
          (S.dist > ideal * 1.2 ? 0.18 : 0) -
          (threat ? 0.3 * (1 - p.risk) : 0) -
          (S.health < 0.3 ? 0.25 * p.caution : 0)
        : 0,
      kite:
        S.bestRange > 0 && S.dist < ideal * 0.8 && S.mobility > 0.25
          ? 0.22 + 0.5 * p.caution + (threat ? 0.3 : 0)
          : 0,
      flank:
        S.mobility > 0.3
          ? 0.18 +
            0.45 * p.creativity +
            (S.foeLoss > 0 ? 0.12 : 0) +
            (S.foeRearWeapons === 0 ? 0.16 : 0) -
            (threat ? 0.2 : 0)
          : 0,
      pounce:
        (S.foeLoss > 0 || S.foeTipped) && S.mobility > 0.35
          ? 0.42 + 0.45 * p.aggression
          : 0,
      retreat:
        S.health < 0.35 && S.mobility > 0.3
          ? 0.2 + 0.6 * p.caution * (threat ? 1 : 0.5)
          : 0,
      fly: S.canFly
        ? 0.35 +
          0.55 * p.mobility +
          (S.foeAir && S.bestRange > 0 ? 0.3 : 0) +
          (S.mobility < 0.35 ? 0.25 : 0)
        : 0,
      hold: 0.15,
    };
    this.scores = scores;
    let best: Mode = "hold";
    for (const m of MODES) if (scores[m] > scores[best]) best = m;
    // Hysteresis: keep a plan for a moment unless a clearly better one appears.
    if (
      best !== this.mode &&
      (time >= this.modeUntil || scores[best] > scores[this.mode] + 0.12)
    ) {
      this.mode = best;
      this.modeUntil = time + 1.1 - this.skill * 0.45;
      this.reason = REASON[best];
    }
  }

  private target(S: Situation, me: AiUnit, foe: AiUnit): [number, number] {
    const mx = me.body.position.x,
      mz = me.body.position.z;
    const fx = foe.body.position.x,
      fz = foe.body.position.z;
    const awayX = mx - fx,
      awayZ = mz - fz;
    const awayLen = Math.hypot(awayX, awayZ) || 1;
    const ideal =
      S.bestRange > 0
        ? S.bestRange * (0.35 + 0.5 * this.personality.preferredRange)
        : Math.max(2.2, S.meleeRange * 0.75);
    let t: [number, number];
    switch (this.mode) {
      case "engage":
        // Melee-only machines must drive into their rival to reach their weapons.
        t =
          S.bestRange === 0
            ? [fx, fz]
            : [
                fx + (awayX / awayLen) * ideal * 0.6,
                fz + (awayZ / awayLen) * ideal * 0.6,
              ];
        break;
      case "kite":
      case "retreat": {
        const reach = this.mode === "retreat" ? 18 : 10;
        t = [mx + (awayX / awayLen) * reach, mz + (awayZ / awayLen) * reach];
        break;
      }
      case "flank": {
        // Aim behind the rival, on the side that has fewer attached parts.
        const side = S.foeLeftParts > S.foeRightParts ? -1 : 1;
        const ff = Math.hypot(S.foeFwd[0], S.foeFwd[2]) || 1;
        t = [
          fx - (S.foeFwd[0] / ff) * 5.5 + S.foeRight[0] * side * 3.5,
          fz - (S.foeFwd[2] / ff) * 5.5 + S.foeRight[2] * side * 3.5,
        ];
        break;
      }
      case "hold":
        t = [mx, mz];
        break;
      default:
        t = [fx, fz];
    }
    const r = Math.hypot(t[0], t[1]);
    const limit = ARENA_RADIUS * 0.84;
    if (r > limit) t = [(t[0] / r) * limit, (t[1] / r) * limit];
    return t;
  }

  private steer(S: Situation, me: AiUnit, foe: AiUnit): AiIntent {
    const mode = this.mode;
    const [tx, tz] = this.target(S, me, foe);
    const tdx = tx - S.mp.x,
      tdz = tz - S.mp.z;
    const tdist = Math.hypot(tdx, tdz);
    const curYaw = yawOf(S.fwd[0], S.fwd[2]);
    const desired = yawOf(tdx, tdz);
    let err = wrap(desired - curYaw);
    let reverse = false;
    if ((mode === "kite" || mode === "retreat") && Math.abs(err) > 1.9) {
      // Backing away is steered against the wheels' normal direction.
      reverse = true;
      err = wrap(desired - (curYaw + Math.PI));
    }
    let steer = clamp(err * 2.4, -1, 1);
    if (reverse) steer = -steer;

    // Obstacle avoidance: sidestep crates that sit on the path ahead.
    for (const o of S.obstacles) {
      const ox = o.x - S.mp.x,
        oz = o.z - S.mp.z;
      const along = ox * S.fwd[0] + oz * S.fwd[2];
      const lateral = ox * S.right[0] + oz * S.right[2];
      if (along > 0 && along < 3.6 && Math.abs(lateral) < o.r + 0.9) {
        steer += (lateral > 0 ? -1 : 1) * 0.8 * (1 - along / 3.6);
      }
    }
    steer = clamp(steer, -1, 1);

    const mobilityFactor = 0.45 + 0.55 * S.mobility;
    const base =
      (
        {
          engage: 0.9,
          kite: 0.85,
          flank: 0.78,
          pounce: 1,
          retreat: 1,
          fly: 0.7,
          hold: 0.35,
        } as Record<Mode, number>
      )[mode] * mobilityFactor;
    let gas = 0.1;
    if (tdist > 1.6) {
      if (reverse) gas = -base * 0.8;
      else gas = Math.abs(err) > 1.6 ? 0.25 : base;
    }
    if (S.mobility <= 0 && !S.canFly) gas = 0;

    // Keep every usable weapon cycling, including while withdrawing. Reserve
    // enough charge for a planned lift or dash before spending energy on shots.
    const candidates: WeaponView[] = [];
    const toFoeYaw = yawOf(S.dx, S.dz);
    for (const w of S.weapons) {
      if (!w.ready) continue;
      if (w.melee) {
        // Weapons sit a few units forward of the chassis centre; the simulator enforces
        // the true range from each mount, so the brain only pre-filters generously.
        if (S.dist <= w.range + 2.5) candidates.push(w);
        continue;
      }
      if (S.dist > w.range * 1.02) continue;
      const firingArc = 0.9 + this.skill * 0.28;
      if (!w.swivel && Math.abs(wrap(toFoeYaw - curYaw)) > firingArc) continue;
      candidates.push(w);
    }
    candidates.sort((a, b) => b.efficiency - a.efficiency);
    const wantsBoost =
      S.hasBoost &&
      (mode === "engage" || mode === "pounce" || mode === "retreat") &&
      S.dist > 8 &&
      !S.tipped;
    const wantsRight = S.tipped && S.grounded;
    const wantsLift = mode === "fly" && S.canFly && !wantsRight;
    const reserve = wantsRight
      ? 14
      : wantsLift
        ? Math.max(
            18,
            Math.min(48, me.powerMax * (S.grounded ? 0.42 : 0.28)),
          )
        : wantsBoost
          ? S.boostCost
          : 0;
    let charge = Math.max(0, me.energy - reserve);
    const weapons = new Set<string>();
    for (const w of candidates) {
      if (w.energy <= charge) {
        weapons.add(w.id);
        charge -= w.energy;
      }
    }

    let action = false;
    if (S.tipped && S.grounded) action = true; // right an overturned machine
    if (wantsLift) {
      // If lift generation cannot cover hover and weapon draw, bank energy on
      // the ground and resume flight once a safe reserve has accumulated.
      const flightFloor = Math.max(
        18,
        Math.min(48, me.powerMax * (S.grounded ? 0.42 : 0.28)),
      );
      if (me.powerGen >= 17 || me.energy > flightFloor) action = true;
    }
    if (mode === "pounce" && S.hasJumper && S.dist >= 3 && S.dist <= 6)
      action = true;
    if (wantsBoost && me.energy >= S.boostCost) action = true;

    return { gas, steer, fire: weapons.size > 0, weapons, action, mode };
  }

  /** Current plan score for debugging and HUD display. */
  get confidence() {
    return this.scores[this.mode];
  }
}

/** Blends a finished match into long-term memory of the player's style. */
export function blendMemory(
  prev: RivalMemory | undefined,
  s: MatchStats,
): RivalMemory {
  const shots = Math.max(1, s.shotsRanged + s.shotsMelee);
  const samples = Math.max(1, s.samples);
  const sample = {
    rangedShare: s.shotsRanged / shots,
    meleeShare: s.shotsMelee / shots,
    airShare: s.airSamples / samples,
    closeShare: s.closeSamples / samples,
  };
  const alpha = prev && prev.matches > 0 ? 0.35 : 1;
  const mix = (a: number | undefined, b: number) =>
    a === undefined ? b : a * (1 - alpha) + b * alpha;
  return {
    matches: (prev?.matches ?? 0) + 1,
    rangedShare: mix(prev?.rangedShare, sample.rangedShare),
    meleeShare: mix(prev?.meleeShare, sample.meleeShare),
    airShare: mix(prev?.airShare, sample.airShare),
    closeShare: mix(prev?.closeShare, sample.closeShare),
    wheelLosses: mix(prev?.wheelLosses, s.wheelLosses),
  };
}
