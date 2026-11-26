import { RivalBrain, type AiIntent } from "./ai";
import {
  ARENA_SCALE,
  CLONE_SECONDS,
  DASH_MIN_SPEED,
  DASH_MULTIPLIER,
  DASH_PADS,
  DASH_SECONDS,
  JUMP_PADS,
  JUMP_SPEED,
  PORTAL,
  PORTAL_COOLDOWN,
  SPIKE_COOLDOWN,
  SPIKE_DAMAGE,
  SPIKE_RADIUS,
  TELEPORT_COOLDOWN,
  TELEPORT_PAIRS,
  padContains,
  padForward,
} from "./hazards";
import type { MatchReplay, MatchStats, RivalMemory } from "./data";
import * as C from "cannon-es";
import {
  ARENA_RADIUS,
  EMBLEM_RADIUS,
  SPAWN_PLAYER,
  SPAWN_RIVAL,
  DEF,
  partHP,
  sizeFactor,
  opponent,
  type Part,
  type Vehicle,
  type Kind,
  type V3,
  type ReplayEvent,
  type ReplayFrame,
  descendants,
  MATERIAL_PROFILES,
  type DamageType,
  type Trait,
} from "./data";
export interface Input {
  weaponIds?: Set<string>;
  gas: number;
  steer: number;
  fire: boolean;
  action: boolean;
  weapons?: boolean;
  mobility?: boolean;
}
export const idleInput = (): Input => ({
  gas: 0,
  steer: 0,
  fire: false,
  action: false,
});
export interface LivePart {
  part: Part;
  hp: number;
  max: number;
  mass: number;
  shape: C.Shape;
  offset: C.Vec3;
  orientation: C.Quaternion;
  cooldown: number;
  active: number;
  debris: C.Body | null;
}
export type DriveState =
  | "drive"
  | "limited"
  | "lift"
  | "boost"
  | "none"
  | "recover"
  | "unstable"
  | "slick";
export interface UnitStatus {
  slick: number;
  paint: number;
  confetti: number;
}
export interface Unit {
  index: number;
  body: C.Body;
  com: C.Vec3;
  parts: LivePart[];
  vehicle: Vehicle;
  max: number;
  energy: number;
  actionCooldown: number;
  impactCooldown: number;
  airtime: number;
  driveState: DriveState;
  status: UnitStatus;
  powerMax: number;
  powerGen: number;
  powerDraw: number;
  initialFront: number;
  initialRear: number;
  traits: Partial<Record<Trait, number>>;
  wobbleClock: number;
  boostTimer: number;
  boostName: string;
  dashTimer: number;
  teleportCooldown: number;
  spikeCooldown: number;
  padState: Set<string>;
  isClone: boolean;
}
export interface Shot {
  body: C.Body;
  owner: number;
  kind: Kind;
  damage: number;
  life: number;
  active: boolean;
  hit: C.Body | null;
  id: number;
  key: string;
  damageType: DamageType;
  bounces: number;
  status?: UnitStatus extends never
    ? never
    : "slick" | "paint" | "confetti" | "foam";
  impulse: number;
  color: string;
}
export interface Obstacle {
  body: C.Body;
  hp: number;
  alive: boolean;
  size: number;
}
export interface SimEvent {
  type:
    | "impact"
    | "break"
    | "fire"
    | "rail"
    | "ray"
    | "lift"
    | "comment"
    | "obstacle"
    | "jam";
  pos: V3;
  owner: number;
  kind?: Kind;
  to?: V3;
  text?: string;
  material?: string;
  critical?: boolean;
  label?: string;
  status?: string;
  clash?: boolean;
}
export interface Outcome {
  stats?: MatchStats;
  replay?: MatchReplay;
  win: boolean;
  score: number;
  duration: number;
  broken: number;
}
const DECK = new C.Material("arena deck");
const ASSEMBLY = new C.Material("competition drivetrain");
const LOCAL_FORWARD = new C.Vec3(0, 0, -1);
const LOCAL_SIDE = new C.Vec3(1, 0, 0);
const LOCAL_UP = new C.Vec3(0, 1, 0);
export const MAX_FRAME_SECONDS = 0.2;
const cv = (v: V3) => new C.Vec3(...v);
const tuple = (v: C.Vec3): V3 => [v.x, v.y, v.z];
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
export class ArenaSimulation {
  world = new C.World({ gravity: new C.Vec3(0, -15.8, 0), allowSleep: true });
  units: Unit[] = [];
  shots: Shot[] = [];
  obstacles: Obstacle[] = [];
  time = 0;
  duration = 150;
  broken = 0;
  damageDealt = 0;
  finished: Outcome | null = null;
  accumulator = 0;
  events: SimEvent[] = [];
  brain: RivalBrain | null = null;
  rivalMode = "engage";
  clone: Unit | null = null;
  cloneTimer = 0;
  portalCooldown = 0;
  private cloneBrain: RivalBrain | null = null;
  replayFrames: ReplayFrame[] = [];
  replayEvents: ReplayEvent[] = [];
  damageLog: { t: number; part: string; amount: number; cause: string }[] = [];
  lossCause?: string;
  private currentSource = "arena impact";
  private replayClock = 0;
  stats: MatchStats = {
    shotsRanged: 0,
    shotsMelee: 0,
    samples: 0,
    airSamples: 0,
    closeSamples: 0,
    wheelLosses: 0,
  };
  extraDebris: { body: C.Body; kind: "blade"; color: string }[] = [];
  lastComment = -10;
  lastAIShot = -10;
  level: number;
  private temp = new C.Vec3();
  private force = new C.Vec3();
  private forward = new C.Vec3();
  private side = new C.Vec3();
  private up = new C.Vec3();
  private seq = 0;
  private aiTimer = 0;
  constructor(v: Vehicle, level: number, memory?: RivalMemory) {
    this.level = level;
    this.brain = new RivalBrain(opponent(level), memory);
    this.world.broadphase = new C.SAPBroadphase(this.world);
    (this.world.solver as C.GSSolver).iterations = 12;
    this.world.defaultContactMaterial.friction = 0.32;
    this.world.defaultContactMaterial.restitution = 0.08;
    this.world.defaultContactMaterial.contactEquationStiffness = 1e7;
    // The rolling assembly should not be dragged like a block on sandpaper.
    // Powered traction and cornering friction are supplied by the wheel model.
    this.world.addContactMaterial(
      new C.ContactMaterial(DECK, ASSEMBLY, {
        friction: 0,
        restitution: 0.04,
        contactEquationStiffness: 1e7,
      }),
    );
    const floor = new C.Body({
      material: DECK,
      mass: 0,
      shape: new C.Plane(),
      collisionFilterGroup: 8,
    });
    floor.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.world.addBody(floor);
    // Circular boundary matching the new arena radius exactly.
    this.circularBoundary(ARENA_RADIUS);
    this.units = [
      this.makeUnit(v, 0),
      this.makeUnit(opponent(level).vehicle, 1),
    ];
    const obstacles: number[][] = [
      [-13, -8],
      [15, 7],
      [-23, 14],
      [21, -16],
      [-9, 24],
      [11, -26],
      ...(level > 12
        ? [
            [6, -19],
            [-11, 21],
            [28, 4],
            [-27, -6],
          ]
        : []),
      ...(level > 40
        ? [
            [18, 19],
            [-19, -21],
          ]
        : []),
    ];
    for (const [ox, oz] of obstacles) {
      const x = ox * ARENA_SCALE,
        z = oz * ARENA_SCALE;
      const size = 1.35 + (Math.abs(x) % 3) * 0.2,
        b = new C.Body({
          mass: 24,
          shape: new C.Box(new C.Vec3(size / 2, size / 2, size / 2)),
          position: new C.Vec3(x, size * 0.52, z),
          collisionFilterGroup: 16,
          linearDamping: 0.23,
        });
      b.quaternion.setFromEuler(0, x * 0.34, 0);
      this.world.addBody(b);
      this.obstacles.push({ body: b, hp: 38, alive: true, size });
    }
  }
  private circularBoundary(radius: number) {
    const segments = 48;
    const arc = (radius * 2 * Math.PI) / segments;
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      const body = new C.Body({
        mass: 0,
        position: new C.Vec3(Math.sin(a) * radius, 3, Math.cos(a) * radius),
        shape: new C.Box(new C.Vec3(arc / 2 + 0.8, 3, 0.9)),
        collisionFilterGroup: 8,
      });
      body.quaternion.setFromEuler(0, a, 0);
      this.world.addBody(body);
    }
  }
  private wall(pos: V3, half: V3) {
    this.world.addBody(
      new C.Body({
        mass: 0,
        position: cv(pos),
        shape: new C.Box(cv(half)),
        collisionFilterGroup: 8,
      }),
    );
  }
  private makeUnit(v: Vehicle, index: number): Unit {
    const com = new C.Vec3(),
      mass = v.parts.reduce((a, p) => a + DEF[p.key].mass * sizeFactor(p), 0);
    for (const p of v.parts) {
      const m = DEF[p.key].mass * sizeFactor(p);
      com.x += (p.pos[0] * m) / mass;
      com.y += (p.pos[1] * m) / mass;
      com.z += (p.pos[2] * m) / mass;
    }
    const body = new C.Body({
      mass,
      material: ASSEMBLY,
      linearDamping: 0.12,
      angularDamping: 0.56,
      collisionFilterGroup: index === 0 ? 1 : 2,
      allowSleep: false,
    });
    body.position.set(
      index === 0 ? SPAWN_PLAYER[0] : SPAWN_RIVAL[0],
      index === 0 ? SPAWN_PLAYER[1] : SPAWN_RIVAL[1],
      index === 0 ? SPAWN_PLAYER[2] : SPAWN_RIVAL[2],
    );
    body.quaternion.setFromEuler(0, index ? Math.PI : 0, 0);
    body.angularFactor.set(0.48, 1, 0.48);
    let max = 0;
    const parts = v.parts.map((part) => {
      const d = DEF[part.key],
        size = d.dimensions.map((n, i) => n * part.scale[i]),
        shape =
          d.kind === "wheel"
            ? new C.Sphere(size[1] * 0.47)
            : new C.Box(
                new C.Vec3(size[0] * 0.48, size[1] * 0.48, size[2] * 0.48),
              );
      const offset = cv(part.pos).vsub(com),
        q = new C.Quaternion();
      q.setFromEuler(...(part.rot.map((n) => (n * Math.PI) / 180) as V3));
      body.addShape(shape, offset, q);
      const hp = partHP(part);
      max += hp;
      return {
        part,
        hp,
        max: hp,
        mass: d.mass * sizeFactor(part),
        shape,
        offset,
        orientation: q,
        cooldown: index ? 0.8 : 0.1,
        active: 0,
        debris: null,
      };
    });
    // Start the lowest collision shape just above the deck, even with
    // downsized wheels or an unusual underside added in the workshop.
    body.updateAABB();
    body.position.y += 0.065 - body.aabb.lowerBound.y;
    body.aabbNeedsUpdate = true;
    this.world.addBody(body);
    const unit: Unit = {
      index,
      body,
      com,
      parts,
      vehicle: v,
      max,
      energy: 100,
      actionCooldown: 0,
      impactCooldown: 0,
      airtime: 0,
      boostTimer: 0,
      boostName: "",
      dashTimer: 0,
      teleportCooldown: 0,
      spikeCooldown: 0,
      padState: new Set<string>(),
      isClone: false,
      driveState: "drive",
      status: { slick: 0, paint: 0, confetti: 0 },
      powerMax: 100,
      powerGen: 12,
      powerDraw: 0,
      initialFront: v.parts.filter(
        (part) => DEF[part.key].kind === "wheel" && part.pos[2] < 0,
      ).length,
      initialRear: v.parts.filter(
        (part) => DEF[part.key].kind === "wheel" && part.pos[2] >= 0,
      ).length,
      traits: {},
      wobbleClock: 0,
    };
    body.addEventListener(
      "collide",
      (e: { body: C.Body; contact: C.ContactEquation }) => {
        if (
          this.finished ||
          unit.impactCooldown > 0 ||
          e.body.collisionFilterGroup === 8
        )
          return;
        const relative = Math.abs(e.contact.getImpactVelocityAlongNormal());
        if (relative < 3.8) return;
        const other = this.units.find((x) => x.body === e.body) ?? (this.clone?.body === e.body ? this.clone : undefined);
        if (
          !other &&
          e.body.collisionFilterGroup !== 32 &&
          e.body.collisionFilterGroup !== 16
        )
          return;
        unit.impactCooldown = 0.3;
        this.currentSource = other
          ? DEF[other.vehicle.parts[0]?.key ?? "core"].name
          : "arena collision";
        const at =
          e.contact.bi === body
            ? e.contact.ri.vadd(body.position)
            : e.contact.rj.vadd(body.position);
        const reduction = unit.parts.some(
          (p) => p.hp > 0 && DEF[p.part.key].kind === "spring",
        )
          ? 0.66
          : 1;
        this.damage(
          unit,
          this.nearest(unit, at),
          clamp((relative - 3) * 2.5, 2, 33) * reduction,
          at,
        );
        const dashClash = !!other &&
          !unit.isClone && !other.isClone &&
          unit.index !== other.index &&
          unit.dashTimer > 0 && other.dashTimer > 0;
        // Both bodies receive a collision callback. Emit the contact spark
        // marker once, from the player unit, to avoid duplicate bursts.
        this.events.push({
          type: "impact",
          pos: tuple(at),
          owner: index,
          clash: dashClash && index === 0,
        });
      },
    );
    return unit;
  }
  point(u: Unit, p: LivePart) {
    return u.body.pointToWorldFrame(p.offset);
  }
  health(u: Unit) {
    return Math.max(
      0,
      Math.ceil(u.parts.reduce((n, p) => n + Math.max(0, p.hp), 0)),
    );
  }
  nearest(u: Unit, point: C.Vec3, smart = false) {
    let best = u.parts.find((p) => p.part.key === "core")!,
      min = Infinity;
    for (const p of u.parts) {
      if (p.hp <= 0) continue;
      const distance =
        this.point(u, p).distanceSquared(point) *
        (smart && DEF[p.part.key].category === "Weapons" ? 0.65 : 1);
      if (distance < min) {
        min = distance;
        best = p;
      }
    }
    return best;
  }
  private comment(text: string, force = false) {
    if (!force && this.time - this.lastComment < 3.4) return;
    this.lastComment = this.time;
    this.events.push({ type: "comment", owner: 0, pos: [0, 0, 0], text });
  }
  damage(
    u: Unit,
    p: LivePart,
    amount: number,
    at: C.Vec3,
    spread = true,
    type: DamageType = "impact",
  ) {
    if (p.hp <= 0 || this.finished) return;
    const def = DEF[p.part.key],
      profile = MATERIAL_PROFILES[def.material];
    amount *= profile.resist[type] ?? 1;
    if (spread && p.part.key === "core") {
      const armor = u.parts
        .filter(
          (q) =>
            q.hp > 0 &&
            q.part.parent === p.part.id &&
            ["wood", "armor", "material"].includes(DEF[q.part.key].kind),
        )
        .sort(
          (a, b) =>
            this.point(u, a).distanceSquared(at) -
            this.point(u, b).distanceSquared(at),
        )[0];
      if (armor) {
        const absorbed = Math.min(armor.hp, amount * 0.7);
        this.damage(u, armor, absorbed, at, false);
        amount -= absorbed;
      }
    }
    const parent = u.parts.find((q) => q.part.id === p.part.parent);
    const parentDef = parent ? DEF[parent.part.key] : null;
    const shockMount =
      parentDef &&
      (parentDef.trait === "bracket" ||
        parentDef.trait === "connector" ||
        parentDef.trait === "hydraulic" ||
        parentDef.kind === "spring");
    amount *=
      parent && parent.hp > 0
        ? shockMount
          ? 0.68
          : parent.part.key === "hinge"
            ? 0.76
            : 1
        : 1;
    // Brittle and soft materials fail differently under shock. A weakened
    // connection gives way before the parent itself reaches zero HP.
    const brittleConnection = [
      "ceramic",
      "carbon",
      "wood",
      "cardboard",
      "box",
    ].includes(def.material);
    if (p.hp > 0 && p.hp / p.max < 0.4 && amount > 7) {
      const connected = u.parts.filter(
        (q) => q.hp > 0 && q.part.parent === p.part.id,
      );
      if (connected.length) {
        const stress = Math.min(
          0.32,
          (amount / Math.max(30, p.max)) * (brittleConnection ? 1.8 : 0.55),
        );
        if (Math.random() < stress) {
          const loose = connected[Math.floor(Math.random() * connected.length)];
          this.breakSubtree(u, loose);
          this.comment(
            `The damaged ${def.name.toLowerCase()} mount lets go of ${DEF[loose.part.key].name.toLowerCase()}!`,
            true,
          );
        }
      }
    }
    if (u.index === 0)
      this.damageLog.push({
        t: this.time,
        part: p.part.key,
        amount: Math.round(amount),
        cause: this.currentSource,
      });
    if (u.index === 1) this.damageDealt += Math.min(amount, p.hp);
    p.hp -= amount;
    if (p.hp <= 0) {
      this.detach(u, p);
      if (p.part.key === "core") {
        if (u.isClone) {
          this.removeClone("destroyed");
          return;
        }
        if (u.index === 0)
          this.lossCause = `${this.currentSource} destroyed your chassis`;
        this.end(u.index === 1);
        return;
      }
      const dependents = descendants(u.vehicle.parts, p.part.id);
      for (const child of u.parts)
        if (child.hp > 0 && dependents.has(child.part.id))
          this.detach(u, child);
      this.comment(
        `${u.index === 1 ? "Rival" : "Pip"} ${DEF[p.part.key].name.toLowerCase()} detached!`,
        true,
      );
    } else if (amount > 20)
      this.comment(
        u.index === 1
          ? "Clean hit! Their structure is taking damage."
          : "Pip takes a hit. Keep the machine moving.",
      );
    this.events.push({
      type: "impact",
      pos: tuple(at),
      owner: 1 - u.index,
      material: def.material,
    });
  }
  private breakSubtree(u: Unit, p: LivePart) {
    const ids = descendants(u.vehicle.parts, p.part.id);
    for (const child of u.parts)
      if (child.hp > 0 && ids.has(child.part.id)) this.detach(u, child);
  }
  private detach(u: Unit, p: LivePart) {
    if (p.debris) return;
    p.hp = 0;
    const def = DEF[p.part.key],
      profile = MATERIAL_PROFILES[def.material],
      position = this.point(u, p),
      q = u.body.quaternion.mult(p.orientation),
      b = new C.Body({
        mass: Math.max(0.25, p.mass),
        position,
        quaternion: q,
        linearDamping: 0.14,
        angularDamping: def.kind === "wheel" ? 0.06 : 0.18,
        collisionFilterGroup: 32,
      });
    u.body.removeShape(p.shape);
    b.addShape(p.shape);
    // Debris keeps the machine's actual motion at the former mount point.
    u.body.getVelocityAtWorldPoint(position, b.velocity);
    b.angularVelocity.copy(u.body.angularVelocity);
    const side = Math.sign(p.offset.x) || 1,
      spin = def.kind === "wheel" ? 8 + u.body.velocity.length() * 1.1 : 2.1;
    b.angularVelocity.x += side * spin * 0.35;
    b.angularVelocity.y +=
      (this.seq % 2 ? 1 : -1) * (def.kind === "wheel" ? 0.45 : 1.5);
    b.angularVelocity.z += (def.kind === "wheel" ? 1.4 : 0.5) * side;
    b.velocity.y += def.kind === "rotor" ? 1.7 : 0.55;
    u.body.mass = Math.max(1, u.body.mass - p.mass);
    const shift = new C.Vec3();
    for (const attached of u.parts)
      if (attached.hp > 0) {
        shift.x += (attached.offset.x * attached.mass) / u.body.mass;
        shift.y += (attached.offset.y * attached.mass) / u.body.mass;
        shift.z += (attached.offset.z * attached.mass) / u.body.mass;
      }
    const globalShift = u.body.vectorToWorldFrame(shift);
    u.body.position.vadd(globalShift, u.body.position);
    u.body.velocity.vadd(
      u.body.angularVelocity.cross(globalShift),
      u.body.velocity,
    );
    u.com.vadd(shift, u.com);
    for (const attached of u.parts) {
      if (attached.hp <= 0) continue;
      attached.offset.vsub(shift, attached.offset);
      const index = u.body.shapes.indexOf(attached.shape);
      if (index >= 0) u.body.shapeOffsets[index].copy(attached.offset);
    }
    u.body.updateMassProperties();
    u.body.updateBoundingRadius();
    u.body.aabbNeedsUpdate = true;
    this.world.addBody(b);
    p.debris = b;
    // Rotor blades are separate physical debris so lift loss looks and moves
    // like a real mechanical failure rather than one disappearing shape.
    if (def.kind === "rotor") {
      const bladeMass = Math.max(0.15, p.mass * 0.06);
      for (let i = 0; i < 3; i++) {
        const angle = (i / 3) * Math.PI * 2;
        const blade = new C.Body({
          mass: bladeMass,
          shape: new C.Box(new C.Vec3(0.62, 0.035, 0.14)),
          collisionFilterGroup: 32,
          position: new C.Vec3(
            position.x + Math.cos(angle) * 1.1,
            position.y + 0.05,
            position.z + Math.sin(angle) * 1.1,
          ),
          linearDamping: 0.08,
          angularDamping: 0.05,
        });
        blade.quaternion.setFromEuler(0.2, angle, 0.15);
        blade.velocity.set(
          b.velocity.x + Math.cos(angle) * 3.2,
          b.velocity.y + 2.2,
          b.velocity.z + Math.sin(angle) * 3.2,
        );
        blade.angularVelocity.set(
          4 * Math.sin(angle),
          6 + (this.seq % 3),
          4 * Math.cos(angle),
        );
        this.world.addBody(blade);
        this.extraDebris.push({
          body: blade,
          kind: "blade",
          color: profile.color,
        });
      }
    }
    if (u.index === 0 && def.kind === "wheel") this.stats.wheelLosses++;
    if (u.index === 1) this.broken++;
    const critical =
      def.kind === "wheel" ||
      def.kind === "rotor" ||
      def.category === "Weapons" ||
      p.part.key === "core";
    const sideName =
      p.offset.x < -0.1 ? "left" : p.offset.x > 0.1 ? "right" : "central";
    const placement =
      def.kind === "wheel"
        ? `${p.offset.z < 0 ? "front" : "rear"}-${sideName} `
        : "";
    this.events.push({
      type: "break",
      pos: tuple(position),
      owner: u.index,
      material: def.material,
      critical,
      label: `${placement}${def.name}`,
    });
    if (!p.part.key.startsWith("__"))
      this.comment(
        `${u.index ? "The challenger" : "Pip"} loses the ${placement}${def.name.toLowerCase()}! ${def.kind === "wheel" ? "The machine lurches onto its remaining support." : def.kind === "rotor" ? "Lift is failing." : def.category === "Weapons" ? "That weapon is out of the fight." : "The structure is compromised."}`,
        critical,
      );
  }
  private end(win: boolean) {
    if (this.finished) return;
    this.finished = {
      stats: { ...this.stats },
      win,
      score: Math.round(
        this.damageDealt * 3 +
          this.broken * 110 +
          (win ? 900 + this.level * 75 : 0) +
          this.health(this.units[0]) * 0.7,
      ),
      duration: Math.round(this.time),
      broken: this.broken,
      replay: {
        frames: this.replayFrames,
        events: this.replayEvents,
        damage: this.damageLog,
        lossCause: this.lossCause,
      },
    };
  }
  private rivalInput(dt: number): Input {
    void dt;
    if (!this.brain) return idleInput();
    const obstacles = this.obstacles
      .filter((o) => o.alive)
      .map((o) => ({
        x: o.body.position.x,
        z: o.body.position.z,
        r: o.size * 0.7,
      }));
    const intent: AiIntent = this.brain.decide(
      this.units[1],
      this.units[0],
      this.time,
      obstacles,
    );
    this.rivalMode = intent.mode;
    return {
      gas: intent.gas,
      steer: intent.steer,
      fire: intent.fire,
      action: intent.action,
      weapons: true,
      mobility: true,
      weaponIds: intent.weapons,
    };
  }
  private sample() {
    const player = this.units[0];
    const rival = this.units[1];
    if (!player || !rival) return;
    const p = player.body.position,
      e = rival.body.position;
    this.stats.samples++;
    if (p.y > 2.2) this.stats.airSamples++;
    if (Math.hypot(p.x - e.x, p.z - e.z) < 9) this.stats.closeSamples++;
  }
  private drive(u: Unit, input: Input, dt: number) {
    const b = u.body;
    u.actionCooldown -= dt;
    u.impactCooldown -= dt;
    u.boostTimer = Math.max(0, u.boostTimer - dt);
    u.wobbleClock -= dt;
    u.status.slick = Math.max(0, u.status.slick - dt);
    u.status.paint = Math.max(0, u.status.paint - dt);
    u.status.confetti = Math.max(0, u.status.confetti - dt);
    // Rebuild the electrical architecture from the components that survive.
    const traits: Partial<Record<Trait, number>> = {};
    let capacity = 100,
      generation = 12,
      powerEfficiency = 1;
    for (const p of u.parts) {
      if (p.hp <= 0) continue;
      const d = DEF[p.part.key],
        ratio = p.hp / p.max;
      if (d.trait !== "none") traits[d.trait] = (traits[d.trait] ?? 0) + 1;
      capacity += d.capacity * (0.25 + 0.75 * ratio);
      generation += d.powerGen * (0.2 + 0.8 * ratio);
      if (
        d.trait === "wire" ||
        d.trait === "switch" ||
        d.trait === "controller" ||
        d.trait === "breaker"
      )
        powerEfficiency += 0.035 * ratio;
      if (d.material === "copper") powerEfficiency += 0.01 * ratio;
    }
    u.traits = traits;
    u.powerMax = capacity;
    u.powerGen = generation * powerEfficiency;
    u.powerDraw = 0;
    u.energy = Math.min(u.powerMax, u.energy + u.powerGen * dt);
    let drive = 0,
      prop = 0,
      lift = 0,
      boost = 0,
      boostEnergy = 14,
      boostCooldown = 2.4,
      impulseBoost = 0,
      sprintBoost = 0,
      ionBoost = 0,
      vectorBoost = 0,
      afterBoost = 0,
      grip = 0,
      contactPower = 0,
      wheelContact = 0,
      wheels = 0,
      springs = 0,
      steering = 0,
      frontAlive = 0,
      rearAlive = 0,
      leftPower = 0,
      rightPower = 0,
      leftLoad = 0,
      rightLoad = 0,
      wheelDamage = 0;
    const motors = traits.motor ?? 0,
      gearboxes = traits.gearbox ?? 0,
      axles = traits.axle ?? 0,
      bearings = traits.bearing ?? 0,
      travelBonus =
        (traits.hydraulic ?? 0) +
        u.parts.filter((q) => q.hp > 0 && q.part.key === "spring").length;
    for (const p of u.parts) {
      p.cooldown -= dt;
      p.active = Math.max(0, p.active - dt);
      if (p.hp <= 0) continue;
      const d = DEF[p.part.key],
        condition = clamp(p.hp / p.max, 0, 1);
      if (d.kind === "wheel") {
        const eff = condition > 0.7 ? 1 : condition > 0.35 ? 0.62 : 0.28;
        wheelDamage += 1 - eff;
        const wheelPower =
          d.power *
          Math.sqrt(p.part.scale[1]) *
          (1 + motors * 0.055 + axles * 0.035) *
          eff;
        drive += wheelPower;
        wheels++;
        const front = p.part.pos[2] < 0;
        if (front) {
          frontAlive++;
          if (p.part.key === "steer" || front) steering += eff;
        } else rearAlive++;
        const wp = this.point(u, p),
          radius = (p.shape as C.Sphere).radius,
          travel = 0.19 + Math.min(0.19, travelBonus * 0.05),
          clearance = wp.y - radius,
          load = clamp((travel + 0.055 - clearance) / travel, 0, 1),
          compression = travel * 0.58 - clearance;
        wheelContact += load;
        contactPower += wheelPower * load;
        grip += d.grip * load * (1 + axles * 0.08);
        if (p.offset.x < 0) {
          leftLoad += load;
          leftPower += wheelPower * load;
        } else {
          rightLoad += load;
          rightPower += wheelPower * load;
        }
        if (compression > 0) {
          const localv = b.getVelocityAtWorldPoint(wp, this.temp),
            springForce = Math.max(
              0,
              compression * b.mass * 17 -
                localv.y * b.mass * (1.25 + travelBonus * 0.12),
            );
          b.applyForce(
            new C.Vec3(0, Math.min(b.mass * 8, springForce), 0),
            wp.vsub(b.position),
          );
        }
        // Wobbling, cracked wheels kick sideways and lose drive before failing.
        if (condition < 0.55 && load > 0.2 && u.wobbleClock <= 0) {
          const wobble =
            (1 - condition) * (0.7 + Math.min(3, b.velocity.length() * 0.18));
          b.applyImpulse(
            new C.Vec3(
              (p.offset.x < 0 ? -1 : 1) * wobble * 0.45,
              0,
              (this.seq++ % 2 ? 1 : -1) * wobble * 0.3,
            ),
            wp.vsub(b.position),
          );
          u.wobbleClock = 0.22;
          if (Math.random() < 0.22)
            this.events.push({
              type: "impact",
              pos: tuple(wp),
              owner: 1 - u.index,
              material: d.material,
              status: "damaged wheel",
            });
        }
      }
      if (d.kind === "propeller") prop += d.power * condition;
      if (d.kind === "rotor") {
        const liftFactor = condition < 0.25 ? 0.12 : Math.pow(condition, 1.5);
        lift += d.power * (0.22 + 0.78 * liftFactor);
        if (condition < 0.5 && input.action)
          b.torque.x +=
            Math.sin(this.time * 18 + u.index) *
            b.mass *
            (1 - condition) *
            0.55;
      }
      if (d.kind === "thruster") {
        const power = d.power * condition;
        boost += power;
        boostEnergy = Math.max(boostEnergy, d.energy);
        boostCooldown = Math.max(2.2, d.cooldown);
        if (d.booster === "impulse") impulseBoost += power;
        if (d.booster === "sprint") sprintBoost += power;
        if (d.booster === "ion") ionBoost += power;
        if (d.booster === "vector") vectorBoost += power;
        if (d.booster === "afterburn") afterBoost += power;
      }
      if (d.kind === "spring" || d.trait === "hydraulic") springs++;
      if (d.category === "Weapons") {
        u.powerDraw += d.energy / Math.max(0.4, d.cooldown);
        if (
          input.weapons !== false &&
          (!input.weaponIds || input.weaponIds.has(p.part.id)) &&
          input.fire &&
          p.cooldown <= 0 &&
          u.energy >= d.energy
        ) {
          const jamRisk = condition < 0.3 ? 0.36 : condition < 0.55 ? 0.1 : 0;
          if (Math.random() < jamRisk) {
            p.cooldown = 1.3 + Math.random();
            p.active = 0.12;
            u.energy = Math.max(0, u.energy - d.energy * 0.25);
            this.events.push({
              type: "jam",
              owner: u.index,
              pos: tuple(this.point(u, p)),
              kind: d.kind,
              label: d.name,
            });
            this.comment(
              `${u.index ? "The challenger's" : "Pip's"} ${d.name.toLowerCase()} jams! The damaged mechanism will not cycle.`,
            );
          } else this.fire(u, p);
        }
      }
    }
    b.vectorToWorldFrame(LOCAL_FORWARD, this.forward);
    b.vectorToWorldFrame(LOCAL_SIDE, this.side);
    b.vectorToWorldFrame(LOCAL_UP, this.up);
    this.forward.y = 0;
    if (this.forward.lengthSquared() < 0.001)
      this.forward.set(this.side.z, 0, -this.side.x);
    this.forward.normalize();
    this.side.set(-this.forward.z, 0, this.forward.x);
    if (b.aabbNeedsUpdate) b.updateAABB();
    const grounded = wheelContact > 0.15 || b.aabb.lowerBound.y < 0.16;
    const unseated = wheels > 0 && wheelContact < 0.45;
    const tipped = this.up.y < 0.32;
    const flying = lift > 0 && input.action && u.energy > 2;
    const slick = Math.min(1, u.status.slick);
    const missingWheels = u.initialFront + u.initialRear - wheels;
    const steerAuthority = clamp(steering / Math.max(1, u.initialFront), 0, 1);
    const effectiveDrive =
      input.mobility === false
        ? 0
        : tipped
          ? 0
          : Math.max(contactPower, grounded ? drive * 0.24 : 0);
    const dashing = u.dashTimer > 0;
    const forwardPower = effectiveDrive + prop + (flying ? lift * 0.38 : 0);
    const naturalTop = 9 + Math.min(8, drive * 0.058 + prop * 0.038);
    const maxSpeed =
      (unseated && grounded && !prop && !flying ? 3.6 : naturalTop) *
      (1 - 0.25 * slick) *
      (1 - Math.min(0.35, missingWheels * 0.08));
    const speed = b.velocity.dot(this.forward);
    const desiredSpeed =
      input.gas >= 0 ? input.gas * maxSpeed : input.gas * maxSpeed * 0.64;
    if (!dashing && forwardPower > 0) {
      const accel =
        clamp((forwardPower * 23) / Math.max(26, b.mass), 1.3, 29) *
        (1 - 0.15 * slick);
      const error = desiredSpeed - speed,
        reverseBrake = input.gas !== 0 && speed * input.gas < -0.25;
      const limit = input.gas
          ? accel * (reverseBrake ? 1.55 : 1)
          : Math.min(accel * 0.22, 3.8),
        response = input.gas ? 5.2 : 2;
      this.forward.scale(
        clamp(error * response, -limit, limit) * b.mass,
        this.force,
      );
      b.applyForce(this.force);
    } else if (!dashing && grounded && !boost) {
      this.forward.scale(
        -speed * b.mass * (tipped || !wheels ? 2.1 : 0.7),
        this.force,
      );
      b.applyForce(this.force);
    }
    const lateral = b.velocity.dot(this.side);
    const rearLoss = 1 - clamp(rearAlive / Math.max(1, u.initialRear), 0, 1);
    const lateralGrip =
      (grounded
        ? 1.15 + Math.min(5.8, grip * 1.1) * (1 - 0.6 * rearLoss)
        : flying
          ? 1.5
          : 0.21) *
      (1 - 0.7 * slick) *
      (input.mobility === false ? 0 : 1);
    this.side.scale(
      -lateral * b.mass * Math.max(0.08, lateralGrip),
      this.force,
    );
    b.applyForce(this.force);
    const maneuverability = Math.min(
      1,
      wheels * 0.4 + prop * 0.022 + lift * 0.01 + boost * 0.008,
    );
    const turn =
      (input.mobility === false
        ? 0
        : 2.65 * 0.22 + steerAuthority * 2.65 + gearboxes * 0.16) *
      maneuverability *
      (1 - 0.45 * slick);
    const turnResponse = grounded ? 7.8 : flying || prop ? 5 : 2.1;
    b.torque.y +=
      (input.steer * turn - b.angularVelocity.y * (1 + rearLoss * 1.7)) *
      Math.max(b.mass * 0.64, b.inertia.y) *
      turnResponse;
    // Losing a driven wheel on one side produces a real yaw moment.
    const asymmetry =
      (leftPower - rightPower) / Math.max(1, leftPower + rightPower);
    if (grounded && Math.abs(speed) > 0.45)
      b.torque.y += asymmetry * Math.abs(speed) * b.mass * 2.4;
    const loadAsymmetry =
      (leftLoad - rightLoad) / Math.max(0.1, leftLoad + rightLoad);
    b.torque.z += loadAsymmetry * b.mass * 3.6;
    // No invisible auto-levelling. Only an intact stabiliser supplies a small
    // righting moment; otherwise gravity, suspension and supports decide.
    const stabilizer = (traits.stabilizer ?? 0) > 0 ? 3.6 : 0;
    b.torque.x +=
      (this.up.z * -stabilizer -
        b.angularVelocity.x * (tipped ? 1.1 : 1.8 + springs * 0.25)) *
      b.mass;
    b.torque.z +=
      (this.up.x * stabilizer -
        b.angularVelocity.z * (tipped ? 1.1 : 1.8 + springs * 0.25)) *
      b.mass;
    u.driveState =
      tipped && grounded && (wheels || prop || lift || boost)
        ? "recover"
        : flying || (!wheels && !prop && lift > 0)
          ? "lift"
          : !wheels && !prop
            ? boost
              ? "boost"
              : "none"
            : u.status.slick > 0
              ? "slick"
              : (unseated && grounded && !prop) || missingWheels > 0
                ? "unstable"
                : "drive";
    if (
      tipped &&
      grounded &&
      input.action &&
      u.actionCooldown <= 0 &&
      u.energy >= 14
    ) {
      b.applyImpulse(new C.Vec3(0, b.mass * 3.4, 0));
      b.angularVelocity.x += (this.up.z <= 0 ? 1 : -1) * 6.8;
      b.angularVelocity.z += (this.up.x < 0 ? -1 : 1) * 2;
      u.actionCooldown = 1.5;
      u.energy -= 14;
    }
    if (input.action && lift > 0 && u.energy > 2 && b.position.y < 7.5) {
      b.applyForce(new C.Vec3(0, Math.min(lift * 16.6, b.mass * 24), 0));
      u.energy -= dt * 13;
      u.airtime += dt;
      if (u.airtime > 1 && u.airtime - dt <= 1) {
        this.comment(`${u.index ? "The challenger" : "Pip"} is airborne!`);
        this.events.push({
          type: "lift",
          owner: u.index,
          pos: tuple(b.position),
        });
      }
    } else u.airtime = 0;
    if (u.boostTimer > 0) {
      const burn =
        (afterBoost > 0 ? afterBoost * 0.5 : 0) +
        (ionBoost > 0 ? ionBoost * 0.7 : 0);
      if (burn > 0 && input.mobility !== false) {
        this.forward.scale(burn * b.mass, this.force);
        b.applyForce(this.force);
      }
    }
    if (
      input.action &&
      sprintBoost > 0 &&
      u.energy > 1 &&
      input.mobility !== false
    ) {
      this.forward.scale(sprintBoost * b.mass * 0.55, this.force);
      b.applyForce(this.force);
      u.energy -= dt * 12;
    }
    if (
      input.action &&
      u.actionCooldown <= 0 &&
      u.energy >= boostEnergy &&
      input.mobility !== false
    ) {
      if (traits.jumper) {
        b.applyImpulse(
          new C.Vec3(
            this.forward.x * b.mass * 3.1,
            b.mass * 6.4,
            this.forward.z * b.mass * 3.1,
          ),
        );
        u.energy -= 18;
        u.actionCooldown = 2.2;
        this.comment("Jump mechanism fired!");
      } else if (boost) {
        const modifier =
          1 +
          (impulseBoost > 0 ? 0.35 : 0) +
          (ionBoost > 0 ? 0.55 : 0) +
          (vectorBoost > 0 ? 0.25 : 0) +
          (afterBoost > 0 ? 0.85 : 0);
        const speed = Math.min(
          24,
          (boost * 8 * modifier) / Math.max(40, b.mass),
        );
        const impulse = this.forward.scale(b.mass * speed);
        b.applyImpulse(impulse);
        if (vectorBoost > 0) b.torque.y += input.steer * b.mass * 5.5;
        u.energy -= boostEnergy;
        u.actionCooldown = boostCooldown;
        u.boostTimer =
          afterBoost > 0
            ? 1.5
            : ionBoost > 0
              ? 1.1
              : sprintBoost > 0
                ? 1.2
                : 0.55;
        u.boostName =
          afterBoost > 0
            ? "NOVA DRIVE"
            : ionBoost > 0
              ? "ION BURNER"
              : vectorBoost > 0
                ? "VECTOR ROCKET"
                : sprintBoost > 0
                  ? "TURBOJET"
                  : "ROCKET ASSIST";
        this.comment(
          `${u.index ? "The challenger" : "Pip"} fires the ${u.boostName}!`,
        );
        this.events.push({
          type: "lift",
          owner: u.index,
          pos: tuple(b.position),
          label: u.boostName,
        });
      } else if (!lift && grounded && wheels) {
        b.applyImpulse(new C.Vec3(0, b.mass * 4.4, 0));
        u.energy -= 14;
        u.actionCooldown = 2.2;
        this.events.push({
          type: "lift",
          owner: u.index,
          pos: tuple(b.position),
        });
      }
    }
    if (b.position.y < -4) {
      b.position.set(
        u.index ? SPAWN_RIVAL[0] : SPAWN_PLAYER[0],
        1.3,
        u.index ? SPAWN_RIVAL[2] : SPAWN_PLAYER[2],
      );
      b.velocity.setZero();
      b.quaternion.setFromEuler(0, u.index ? Math.PI : 0, 0);
      u.energy = u.powerMax;
    }
  }
  private applyStatus(
    target: Unit,
    status: "slick" | "paint" | "confetti" | "foam",
    source: number,
  ) {
    if (status === "slick")
      target.status.slick = Math.max(target.status.slick, 5.2);
    if (status === "paint")
      target.status.paint = Math.max(target.status.paint, 6.5);
    if (status === "confetti")
      target.status.confetti = Math.max(target.status.confetti, 3);
    this.events.push({
      type: "impact",
      pos: tuple(target.body.position),
      owner: source,
      status,
    });
    if (status === "slick")
      this.comment(
        `${target.index ? "The challenger" : "Pip"} slides — traction is gone!`,
      );
    if (status === "paint")
      this.comment("Paint across the optics. Their aim is compromised!");
    if (status === "confetti") {
      this.comment("Confetti everywhere! The crowd loves it.");
      this.events.push({
        type: "comment",
        pos: [0, 0, 0],
        owner: source,
        text: "CONFETTI CANNON!",
      });
    }
  }
  private fire(u: Unit, p: LivePart) {
    this.currentSource = DEF[p.part.key].name;
    if (u.index === 0) {
      if (DEF[p.part.key].behavior === "melee") this.stats.shotsMelee++;
      else this.stats.shotsRanged++;
    }
    const enemy = this.units[1 - u.index];
    if (!enemy) return;
    const d = DEF[p.part.key],
      condition = clamp(p.hp / p.max, 0, 1),
      origin = this.point(u, p),
      toEnemy = enemy.body.position.vsub(origin),
      dist = toEnemy.length(),
      heading = u.body.vectorToWorldFrame(
        p.orientation.vmult(new C.Vec3(0, 0, -1)),
      ),
      gear = u.traits.gearbox ?? 0,
      bearings = u.traits.bearing ?? 0,
      motors = u.traits.motor ?? 0;
    if (
      d.behavior === "melee" &&
      dist > d.range + (u.traits.actuator ?? 0) * 0.22
    ) {
      p.active = 0.3;
      return;
    }
    toEnemy.normalize();
    const swivel = u.parts.some(
      (a) =>
        a.hp > 0 &&
        a.part.id === p.part.parent &&
        (DEF[a.part.key].trait === "platform" || a.part.key === "joint"),
    );
    if (d.behavior !== "melee" && !swivel && heading.dot(toEnemy) < -0.05)
      toEnemy.copy(heading);
    u.energy = Math.max(0, u.energy - d.energy);
    p.cooldown =
      d.cooldown *
      (1 - Math.min(0.26, bearings * 0.045)) *
      (1 + gear * 0.035) *
      (1 + (1 - condition) * 0.75) *
      (u.index === 1 && this.level < 5 ? 1.3 : 1);
    p.active = Math.max(0.16, Math.min(0.7, d.cooldown));
    const impactBoost =
      1 +
      gear * 0.11 +
      motors * 0.04 +
      (u.traits.piston ?? 0) * 0.06 +
      (u.traits.hydraulic ?? 0) * 0.1;
    const damage =
      d.power *
      Math.pow(sizeFactor(p.part), 0.55) *
      (0.58 + 0.42 * condition) *
      impactBoost *
      (u.index === 1 && this.level <= 3 ? 0.76 : 1);
    this.events.push({
      type: "fire",
      owner: u.index,
      pos: tuple(origin),
      kind: d.kind,
    });
    if (d.behavior === "melee") {
      const target = this.nearest(
          enemy,
          origin,
          this.level > 40 && u.index === 1,
        ),
        at = this.point(enemy, target);
      const speedBonus =
        p.part.key === "ram"
          ? 1 + Math.min(1.2, u.body.velocity.length() * 0.12)
          : 1;
      this.damage(enemy, target, damage * speedBonus, at, true, d.damageType);
      const direction = toEnemy.scale(
        (d.impulse || 1) *
          (1 +
            (u.traits.piston ?? 0) * 0.12 +
            (u.traits.hydraulic ?? 0) * 0.18) *
          enemy.body.mass,
      );
      if (d.damageType === "blunt" || d.damageType === "impact")
        direction.y += enemy.body.mass * (d.kind === "hammer" ? 0.18 : 0.06);
      enemy.body.applyImpulse(direction, at.vsub(enemy.body.position));
      if (d.kind === "club" || d.impulse > 2)
        enemy.body.angularVelocity.y += 0.8 + d.impulse * 0.35;
      return;
    }
    if (d.behavior === "ray") {
      const end = origin.vadd(toEnemy.scale(d.range)),
        ray = new C.RaycastResult();
      this.world.raycastClosest(
        origin,
        end,
        {
          collisionFilterMask: (u.index === 0 ? 2 : 1) | 8 | 16,
          skipBackfaces: true,
        },
        ray,
      );
      const at = ray.hasHit ? ray.hitPointWorld : end;
      this.events.push({
        type: "ray",
        owner: u.index,
        pos: tuple(origin),
        to: tuple(at),
        kind: d.kind,
      });
      if (ray.body === enemy.body) {
        const target =
          enemy.parts.find((q) => q.hp > 0 && q.shape === ray.shape) ||
          this.nearest(enemy, at);
        this.damage(enemy, target, damage, at, true, d.damageType);
        enemy.body.applyImpulse(toEnemy.scale(enemy.body.mass * 0.2));
      }
      u.body.applyImpulse(toEnemy.scale(-u.body.mass * 0.35));
      return;
    }
    const speed =
      d.status === "paint" || d.status === "confetti"
        ? 24
        : d.status === "slick"
          ? 20
          : d.kind === "catapult"
            ? 14
            : d.kind === "pillow"
              ? 17
              : d.key === "tennis"
                ? 26
                : 25;
    const time = Math.min(3.4, dist / speed),
      spawn = origin.vadd(toEnemy.scale(1.05));
    spawn.y = Math.max(0.75, spawn.y);
    const velocity = toEnemy.scale(speed);
    velocity.y += 7.9 * time + (d.kind === "catapult" ? 0.72 : 0.18);
    if (this.level > 23 && u.index === 1) {
      velocity.x += enemy.body.velocity.x * 0.55;
      velocity.z += enemy.body.velocity.z * 0.55;
    }
    for (let shot = 0; shot < d.shots; shot++) {
      const spread = d.shots > 1 ? (shot - (d.shots - 1) / 2) * 0.06 : 0;
      const v = velocity.clone();
      v.x += spread * speed * 1.5;
      v.z += Math.sin(shot + this.time) * spread * speed;
      this.spawnShot(
        spawn,
        v,
        u.index,
        p.part.key,
        damage,
        Math.min(6, d.range / speed + 0.35),
      );
    }
    u.body.applyImpulse(toEnemy.scale(-u.body.mass * (0.1 + d.impulse * 0.02)));
  }
  private spawnShot(
    pos: C.Vec3,
    vel: C.Vec3,
    owner: number,
    key: string,
    damage: number,
    life: number,
  ) {
    const def = DEF[key];
    let s = this.shots.find((x) => !x.active);
    if (!s) {
      if (this.shots.length >= 48) return;
      const body = new C.Body({
        mass: 0.9,
        shape: new C.Sphere(0.22),
        linearDamping: 0.012,
      });
      s = {
        body,
        owner,
        kind: def.kind,
        key,
        damage,
        life,
        active: true,
        hit: null,
        id: this.shots.length,
        damageType: def.damageType,
        status: def.status,
        impulse: def.impulse,
        color: def.artColor ?? "#f2e8cc",
        bounces: 0,
      };
      const shot = s;
      body.addEventListener("collide", (e: { body: C.Body }) => {
        if (shot.active && !shot.hit) shot.hit = e.body;
      });
      this.shots.push(s);
    }
    Object.assign(s, {
      owner,
      kind: def.kind,
      key,
      damage,
      life,
      active: true,
      hit: null,
      damageType: def.damageType,
      status: def.status,
      impulse: def.impulse,
      color: def.artColor ?? "#f2e8cc",
      bounces: 0,
    });
    s.body.position.copy(pos);
    s.body.velocity.copy(vel);
    s.body.angularVelocity.set(3, 1, 2);
    s.body.collisionFilterGroup = owner === 0 ? 4 : 64;
    s.body.collisionFilterMask = (owner === 0 ? 2 : 1) | 8 | 16 | 32;
    s.body.wakeUp();
    this.world.addBody(s.body);
  }
  private updateShots(dt: number) {
    for (const s of this.shots) {
      if (!s.active) continue;
      s.life -= dt;
      if (!s.hit && s.life > 0) continue;
      const enemy = this.units[1 - s.owner],
        at = s.body.position;
      // Bouncy projectiles survive their first wall contact and keep using momentum.
      if (
        s.hit &&
        s.hit !== enemy.body &&
        (s.key === "tennis" || s.kind === "egg") &&
        s.bounces < 1 &&
        s.life > 0.1
      ) {
        s.bounces++;
        const normal = enemy.body.position.vsub(at);
        normal.y = Math.abs(normal.y) + 0.5;
        normal.normalize();
        const v = s.body.velocity,
          along = v.dot(normal);
        v.set(
          v.x - 2 * along * normal.x,
          v.y - 2 * along * normal.y,
          v.z - 2 * along * normal.z,
        );
        v.scale(0.68, v);
        s.hit = null;
        continue;
      }
      const area =
        s.kind === "blast" || s.key === "foamcannon" || s.key === "confetti";
      if (
        s.hit === enemy.body ||
        (area && at.distanceTo(enemy.body.position) < 3.6)
      ) {
        this.currentSource = DEF[s.key].name;
        const hit = this.nearest(enemy, at, s.owner === 1 && this.level > 45);
        this.damage(enemy, hit, s.damage, at, true, s.damageType);
        const dir = enemy.body.position.vsub(this.units[s.owner].body.position);
        dir.y = 0;
        dir.normalize();
        const push =
          s.impulse ||
          (s.kind === "pillow" ? 3.2 : s.kind === "catapult" ? 2.1 : 0.75);
        enemy.body.applyImpulse(dir.scale(enemy.body.mass * push));
        if (s.status) this.applyStatus(enemy, s.status, s.owner);
        if (
          s.kind === "blast" ||
          s.key === "foamcannon" ||
          s.key === "confetti"
        ) {
          for (const p of enemy.parts)
            if (
              p !== hit &&
              p.hp > 0 &&
              this.point(enemy, p).distanceTo(at) < 2.2
            )
              this.damage(
                enemy,
                p,
                s.damage * (s.key === "confetti" ? 0.08 : 0.35),
                at,
                false,
                s.damageType,
              );
        }
      }
      const obstacle = this.obstacles.find((o) => o.alive && o.body === s.hit);
      if (obstacle) {
        obstacle.hp -= s.damage;
        if (obstacle.hp <= 0) {
          obstacle.alive = false;
          this.events.push({
            type: "obstacle",
            pos: tuple(obstacle.body.position),
            owner: s.owner,
          });
          this.world.removeBody(obstacle.body);
        }
      }
      if (s.hit)
        this.events.push({ type: "impact", pos: tuple(at), owner: s.owner });
      this.world.removeBody(s.body);
      s.active = false;
      s.hit = null;
    }
  }
  private cloneInput(): Input {
    if (!this.clone || !this.cloneBrain) return idleInput();
    const obstacles = this.obstacles
      .filter((o) => o.alive)
      .map((o) => ({
        x: o.body.position.x,
        z: o.body.position.z,
        r: o.size * 0.7,
      }));
    const intent = this.cloneBrain.decide(
      this.clone,
      this.units[1],
      this.time,
      obstacles,
    );
    return {
      gas: intent.gas,
      steer: intent.steer,
      fire: intent.fire,
      action: intent.action,
      weapons: true,
      mobility: true,
      weaponIds: intent.weapons,
    };
  }
  private spawnClone() {
    const player = this.units[0];
    const clone = this.makeUnit(player.vehicle, 0);
    clone.isClone = true;
    const r = { x: Math.cos(PORTAL.yaw), z: -Math.sin(PORTAL.yaw) };
    clone.body.position.set(PORTAL.x + r.x * 3.6, 1.1, PORTAL.z + r.z * 3.6);
    clone.body.quaternion.copy(player.body.quaternion);
    clone.body.velocity.set(0, 0, 0);
    this.clone = clone;
    this.cloneTimer = CLONE_SECONDS;
    this.portalCooldown = PORTAL_COOLDOWN;
    this.cloneBrain = new RivalBrain({
      name: "Clone",
      personality: {
        aggression: 0.8,
        caution: 0.35,
        creativity: 0.5,
        mobility: 0.7,
        risk: 0.7,
        defense: 0.4,
        adaptability: 0.5,
        preferredRange: 0.45,
      },
    });
    this.events.push({
      type: "impact",
      pos: tuple(clone.body.position),
      owner: 0,
      status: "portal",
    });
    this.comment("A portal clone joins the fight for six seconds!", true);
  }
  private removeClone(reason: string) {
    const c = this.clone;
    if (!c) return;
    this.world.removeBody(c.body);
    for (const p of c.parts) if (p.debris) this.world.removeBody(p.debris);
    this.clone = null;
    this.cloneTimer = 0;
    this.cloneBrain = null;
    this.comment(
      reason === "expired"
        ? "The portal clone powers down."
        : "The portal clone is destroyed!",
      true,
    );
  }
  private applyDash(u: Unit, pad: { x: number; z: number; yaw: number }) {
    const b = u.body;
    const f = padForward(pad);
    const along = b.velocity.x * f.x + b.velocity.z * f.z;
    const speed = Math.max(Math.abs(along), DASH_MIN_SPEED) * DASH_MULTIPLIER;
    b.velocity.set(f.x * speed, b.velocity.y, f.z * speed);
    u.dashTimer = DASH_SECONDS;
    this.events.push({
      type: "impact",
      pos: tuple(b.position),
      owner: u.index,
      status: "dash",
      label: "DASH PAD",
    });
    this.comment(
      `${u.index ? "The challenger" : "Pip"} hits a dash pad at 2.5x speed!`,
    );
  }
  private hazards(u: Unit, dt: number) {
    const b = u.body;
    const x = b.position.x;
    const z = b.position.z;
    u.dashTimer = Math.max(0, u.dashTimer - dt);
    u.teleportCooldown = Math.max(0, u.teleportCooldown - dt);
    u.spikeCooldown = Math.max(0, u.spikeCooldown - dt);
    DASH_PADS.forEach((pad, i) => {
      const key = `dash:${i}`;
      const inside = padContains(pad, x, z);
      if (!inside) u.padState.delete(key);
      else if (!u.padState.has(key)) {
        u.padState.add(key);
        this.applyDash(u, pad);
      }
    });
    JUMP_PADS.forEach((pad, i) => {
      const key = `jump:${i}`;
      const inside = padContains(pad, x, z);
      if (!inside) u.padState.delete(key);
      else if (!u.padState.has(key)) {
        u.padState.add(key);
        if (b.velocity.y < JUMP_SPEED) b.velocity.y = JUMP_SPEED;
        const jf = padForward(pad);
        if (Math.hypot(b.velocity.x, b.velocity.z) < 7) {
          b.velocity.x += jf.x * 5.5;
          b.velocity.z += jf.z * 5.5;
        }
        u.airtime = 0;
        this.events.push({
          type: "lift",
          pos: tuple(b.position),
          owner: u.index,
          label: "JUMP PAD",
        });
        this.comment(
          `${u.index ? "The challenger" : "Pip"} launches from a jump pad!`,
        );
      }
    });
    for (const pair of TELEPORT_PAIRS) {
      const ends = [
        ["a", pair.a, pair.b],
        ["b", pair.b, pair.a],
      ] as const;
      for (const [name, src, dst] of ends) {
        const key = `tp:${pair.id}:${name}`;
        if (!padContains(src, x, z, 0.45)) {
          u.padState.delete(key);
          continue;
        }
        if (u.padState.has(key)) continue;
        u.padState.add(key);
        if (u.teleportCooldown > 0) continue;
        const f = padForward(dst);
        const speed = Math.hypot(b.velocity.x, b.velocity.z);
        b.position.set(dst.x + f.x * 3.2, b.position.y, dst.z + f.z * 3.2);
        b.quaternion.setFromEuler(0, dst.yaw, 0);
        b.velocity.set(f.x * speed, 0, f.z * speed);
        u.teleportCooldown = TELEPORT_COOLDOWN;
        u.padState.add(`tp:${pair.id}:${name === "a" ? "b" : "a"}`);
        this.events.push({
          type: "lift",
          pos: tuple(b.position),
          owner: u.index,
          label: "TELEPORT",
        });
        this.comment(
          `${u.index ? "The challenger" : "Pip"} teleports across the arena!`,
        );
      }
    }
    if (u.index === 0 && !u.isClone) {
      const key = "portal";
      if (!padContains(PORTAL, x, z, 0.85)) u.padState.delete(key);
      else if (!u.padState.has(key)) {
        u.padState.add(key);
        if (!this.clone && this.portalCooldown <= 0) this.spawnClone();
      }
    }
    let contact: C.Vec3 | null = null;
    for (const p of u.parts) {
      if (p.hp <= 0 || p.debris) continue;
      const pt = this.point(u, p);
      if (Math.hypot(pt.x, pt.z) > SPIKE_RADIUS) {
        contact = pt;
        break;
      }
    }
    const core = u.parts.find((p) => p.part.key === "core");
    if (contact && core && core.hp > 0 && u.spikeCooldown <= 0) {
      u.spikeCooldown = SPIKE_COOLDOWN;
      const n = Math.hypot(contact.x, contact.z) || 1;
      b.applyImpulse(
        new C.Vec3(
          (-contact.x / n) * b.mass * 1.4,
          0,
          (-contact.z / n) * b.mass * 1.4,
        ),
        contact.vsub(b.position),
      );
      this.currentSource = "arena spikes";
      this.damage(u, core, SPIKE_DAMAGE, contact, false, "impact");
      this.events.push({
        type: "impact",
        pos: tuple(contact),
        owner: u.index,
        material: "steel",
        status: "spikes",
      });
      this.comment(
        `${u.index ? "The challenger" : "Pip"} grinds against the spike ring!`,
      );
    }
  }
  advance(delta: number, input: Input) {
    if (this.finished) return;
    this.accumulator += Math.min(delta, MAX_FRAME_SECONDS);
    const dt = 1 / 60;
    while (this.accumulator >= dt && !this.finished) {
      const eventStart = this.events.length;
      this.accumulator -= dt;
      this.time += dt;
      this.aiTimer -= dt;
      this.drive(this.units[0], input, dt);
      this.drive(this.units[1], this.rivalInput(dt), dt);
      if (this.clone) this.drive(this.clone, this.cloneInput(), dt);
      this.world.step(dt);
      this.hazards(this.units[0], dt);
      this.hazards(this.units[1], dt);
      if (this.clone) {
        this.hazards(this.clone, dt);
        this.cloneTimer -= dt;
        if (this.cloneTimer <= 0) this.removeClone("expired");
      }
      this.portalCooldown = Math.max(0, this.portalCooldown - dt);
      this.sample();
      this.updateShots(dt);
      for (let i = eventStart; i < this.events.length; i++) {
        const e = this.events[i];
        if (e.type === "comment" || e.type === "fire") continue;
        this.replayEvents.push({
          t: +this.time.toFixed(2),
          type: e.type,
          owner: e.owner,
          label: e.label,
          material: e.material,
          status: e.status,
          pos: e.pos,
          clash: e.clash,
        });
        if (this.replayEvents.length > 400) this.replayEvents.shift();
      }
      this.replayClock += dt;
      if (this.replayClock >= 0.2) {
        this.replayClock = 0;
        const snap = (
          u: Unit,
        ): [number, number, number, number, number, number, number] => {
          const b = u.body;
          return [
            b.position.x,
            b.position.y,
            b.position.z,
            b.quaternion.x,
            b.quaternion.y,
            b.quaternion.z,
            b.quaternion.w,
          ].map((n) => +n.toFixed(3)) as [
            number,
            number,
            number,
            number,
            number,
            number,
            number,
          ];
        };
        this.replayFrames.push({
          t: +this.time.toFixed(2),
          p: snap(this.units[0]),
          e: snap(this.units[1]),
        });
        if (this.replayFrames.length > 600) this.replayFrames.shift();
      }
      if (this.time >= this.duration)
        this.end(
          this.health(this.units[0]) / this.units[0].max >=
            this.health(this.units[1]) / this.units[1].max,
        );
      if (
        this.time > this.duration - 15 &&
        this.time - dt <= this.duration - 15
      )
        this.comment(
          "Fifteen seconds! The strongest remaining structure takes the round.",
          true,
        );
      if (
        this.health(this.units[1]) < this.units[1].max * 0.2 &&
        this.time - this.lastComment > 8
      )
        this.comment("The rival machine is barely holding together!");
    }
  }
}
