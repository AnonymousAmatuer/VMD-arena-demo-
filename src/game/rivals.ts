import {
  makePart,
  metrics,
  partCost,
  placementError,
  type Part,
  type V3,
  type Vehicle,
} from "./data";

/* ------------------------------------------------------------------ *
 * Personality. Each value is a 0..1 weight that the tactical brain
 * consumes directly (see ai.ts). preferredRange: 0 = brawler, 1 = sniper.
 * ------------------------------------------------------------------ */
export interface RivalPersonality {
  aggression: number;
  caution: number;
  creativity: number;
  mobility: number;
  risk: number;
  defense: number;
  adaptability: number;
  preferredRange: number;
}

export interface RivalProfile {
  id: string;
  name: string;
  species: string;
  art: string;
  title: string;
  philosophy: string;
  tagline: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  strengths: string[];
  weaknesses: string[];
  vehicleName: string;
  personality: RivalPersonality;
  spec: (tier: number, level: number) => Spec;
}

export type Spec = [string, string][];

/* Absolute positions in the vehicle frame, matching the player's starter
   machine so the same mounting logic and collision shapes apply. */
export const SLOTS: Record<string, { parent: string; pos: V3 }> = {
  hull: { parent: "chassis", pos: [0, 0.59, 0.24] },
  top: { parent: "hull", pos: [0, 1.13, 0.16] },
  platform: { parent: "hull", pos: [0, 1.02, -1.02] },
  platTop: { parent: "platform", pos: [0, 1.4, -1.02] },
  rotorTop: { parent: "hull", pos: [0, 1.2, 0.3] },
  frontL: { parent: "chassis", pos: [-0.78, 0.04, -2.3] },
  frontR: { parent: "chassis", pos: [0.78, 0.04, -2.3] },
  rear: { parent: "chassis", pos: [0, 0.17, 2.1] },
  sideL: { parent: "chassis", pos: [-1.07, 0.74, -0.4] },
  sideR: { parent: "chassis", pos: [1.07, 0.74, -0.4] },
  wFL: { parent: "chassis", pos: [-1.48, -0.13, -1.12] },
  wFR: { parent: "chassis", pos: [1.48, -0.13, -1.12] },
  wRL: { parent: "chassis", pos: [-1.48, -0.13, 1.12] },
  wRR: { parent: "chassis", pos: [1.48, -0.13, 1.12] },
  power: { parent: "chassis", pos: [0.7, 0.7, 0.9] },
  drive: { parent: "chassis", pos: [-0.7, 0.7, 0.9] },
  gear: { parent: "hull", pos: [0, 1.2, 0.82] },
  stab: { parent: "chassis", pos: [0, 0.16, 2.3] },
};

/** Salvage allowance grows with the round, so late rivals can afford more. */
export function budgetFor(level: number) {
  return Math.min(100, 35 + Math.round(level * 0.68));
}

/* Some rival parts are larger than the starter slots they inherited. Search
   nearby positions, nearest first, so a design keeps its requested equipment
   while still passing the same placement rules as a player-built machine. */
const MOUNT_OFFSETS: V3[] = [];
for (let x = -15; x <= 15; x++)
  for (let y = -15; y <= 15; y++)
    for (let z = -15; z <= 15; z++) {
      const distanceSquared = x * x + y * y + z * z;
      if (distanceSquared > 225 || distanceSquared === 0) continue;
      MOUNT_OFFSETS.push([x / 10, y / 10, z / 10]);
    }
MOUNT_OFFSETS.sort((a, b) =>
  a[0] ** 2 + a[1] ** 2 + a[2] ** 2 - (b[0] ** 2 + b[1] ** 2 + b[2] ** 2),
);

function findLegalMount(part: Part, parts: Part[], budget: number) {
  if (!placementError(part, parts, budget)) return part;
  for (const [dx, dy, dz] of MOUNT_OFFSETS) {
    const candidate = {
      ...part,
      pos: [
        +(part.pos[0] + dx).toFixed(2),
        +(part.pos[1] + dy).toFixed(2),
        +(part.pos[2] + dz).toFixed(2),
      ] as V3,
    };
    if (!placementError(candidate, parts, budget)) return candidate;
  }
  return null;
}

/**
 * Builds a design from [slot, component] pairs using the player's rules.
 * Anything that would exceed the budget or fails the attachment/overlap test
 * is left out, so opponents can never produce an illegal machine.
 */
export function assemble(spec: Spec, budget: number) {
  const parts: Part[] = [makePart("chassis", "core", [0, 0, 0], null)];
  let spent = partCost(parts[0]);
  const skipped: string[] = [];
  for (const [id, key] of spec) {
    const slot = SLOTS[id];
    if (!slot) {
      skipped.push(id);
      continue;
    }
    const part = makePart(id, key, slot.pos, slot.parent);
    const cost = partCost(part);
    const mounted =
      spent + cost > budget ? null : findLegalMount(part, parts, budget);
    if (!mounted) {
      skipped.push(id);
      continue;
    }
    parts.push(mounted);
    spent += cost;
  }
  return { parts, skipped, spent };
}

const wheels = (key: string): Spec => [
  ["wFL", key],
  ["wFR", key],
  ["wRL", key],
  ["wRR", key],
];

/* ------------------------------------------------------------------ *
 * The roster. Every engineer is a different engineering problem.
 * Specs list [slot, component]; only mounts that pass the real placement
 * rules are kept, so every mount below was chosen to fit its slot.
 * ------------------------------------------------------------------ */
export const RIVALS: RivalProfile[] = [
  {
    id: "rivet",
    name: "Rivet",
    species: "Raccoon",
    art: "rivet",
    title: "The Scavenger",
    philosophy:
      "Cheap, quick and opportunistic. Rivet builds from junk, keeps the machine light, and waits for a mistake to pounce on.",
    tagline: "Every scrap has a second life.",
    difficulty: 2,
    strengths: [
      "Fast on light ground",
      "Cheap to rebuild mid-round",
      "Punishes close mistakes",
    ],
    weaknesses: ["Fragile chassis", "Short weapon reach"],
    vehicleName: "Scrap Runner",
    personality: {
      aggression: 0.55,
      caution: 0.45,
      creativity: 0.5,
      mobility: 0.7,
      risk: 0.55,
      defense: 0.3,
      adaptability: 0.5,
      preferredRange: 0.35,
    },
    spec: (t) => {
      const s: Spec = [
        ["hull", t < 3 ? "polymer" : t < 6 ? "steel" : "carbon"],
      ];
      s.push(...wheels(t < 3 ? "smallwheel" : "wheel"));
      s.push(["top", t < 2 ? "egg" : "rail"]);
      s.push(
        ["frontL", "saw"],
        ["sideL", "shippingbox"],
        ["sideR", "shippingbox"],
      );
      if (t >= 2)
        s.push(["power", t >= 6 ? "battery_i" : "battery_s"]);
      s.push(["rear", t >= 4 ? "rocket_assist" : "bumper"]);
      if (t >= 7) s.push(["drive", "generator"]);
      if (t >= 6) s.push(["platform", "platform"], ["platTop", "tennis"]);
      return s;
    },
  },
  {
    id: "bruno",
    name: "Bruno",
    species: "Badger",
    art: "bruno",
    title: "The Rhino Engineer",
    philosophy:
      "Heavy assault. Bruno builds the thickest armour he can afford, leans on impact hammers, and accepts poor mobility as the price of overpowering a rival.",
    tagline: "Armour first. Everything else is negotiable.",
    difficulty: 3,
    strengths: [
      "Enormous structural integrity",
      "Crushing impact weapons",
      "Hard to push off course",
    ],
    weaknesses: [
      "Slow to turn",
      "Struggles on lost wheels",
      "Vulnerable to fast flanking",
    ],
    vehicleName: "Iron Burrow",
    personality: {
      aggression: 0.8,
      caution: 0.25,
      creativity: 0.25,
      mobility: 0.15,
      risk: 0.6,
      defense: 0.7,
      adaptability: 0.25,
      preferredRange: 0.2,
    },
    spec: (t) => {
      const s: Spec = [
        ["hull", t < 3 ? "steel" : t < 6 ? "heavyarmor" : "composite"],
      ];
      s.push(...wheels("heavywheel"));
      s.push(["frontL", "drophammer"], ["frontR", "iron"]);
      s.push(["sideL", "heavyarmor"], ["sideR", "iron"]);
      s.push(["rear", t >= 6 ? "rocket_assist" : "iron"]);
      if (t >= 3)
        s.push(["power", t >= 7 ? "battery_i" : "battery_s"]);
      if (t >= 2) s.push(["stab", "stabilizer"]);
      if (t >= 4) s.push(["gear", "gearbox"]);
      if (t >= 5) s.push(["platform", "platform"], ["platTop", "hammer"]);
      if (t >= 7) s.push(["drive", "generator"]);
      return s;
    },
  },
  {
    id: "vesper",
    name: "Vesper",
    species: "Fox",
    art: "vesper",
    title: "The Tactician",
    philosophy:
      "Balanced and unconventional. Vesper combines splashing, sticky and piercing weapons on a swivel mount, and studies where a machine is weakest before attacking.",
    tagline: "Find the seam. Then open it.",
    difficulty: 3,
    strengths: [
      "Swivel aim",
      "Removes grip with water and paint",
      "Adapts to what it sees",
    ],
    weaknesses: ["Thin front armour", "Relies on a long approach"],
    vehicleName: "Foxglove",
    personality: {
      aggression: 0.5,
      caution: 0.55,
      creativity: 0.8,
      mobility: 0.55,
      risk: 0.45,
      defense: 0.45,
      adaptability: 0.85,
      preferredRange: 0.6,
    },
    spec: (t) => {
      const s: Spec = [["hull", t < 3 ? "steel" : "composite"]];
      s.push(
        ["wFL", t >= 2 ? "steer" : "wheel"],
        ["wFR", "wheel"],
        ["wRL", "wheel"],
        ["wRR", "wheel"],
      );
      s.push(["platform", "platform"], ["platTop", t < 4 ? "tennis" : "rail"]);
      s.push(
        ["frontL", "water"],
        ["sideL", "composite"],
        ["sideR", "composite"],
      );
      if (t >= 2)
        s.push(
          ["frontR", "paint"],
          ["power", t >= 6 ? "battery_i" : "battery_s"],
        );
      if (t >= 4) s.push(["drive", t >= 7 ? "generator" : "controller"]);
      if (t >= 5) s.push(["rear", "rocket_assist"]);
      return s;
    },
  },
  {
    id: "talon",
    name: "Talon",
    species: "Falcon",
    art: "falcon",
    title: "The Aerial Specialist",
    philosophy:
      "Lightweight flight. Talon keeps the mass low, lifts with rotors, and attacks from above where ground machines have limited reach.",
    tagline: "The arena is three-dimensional. So am I.",
    difficulty: 4,
    strengths: [
      "Flight over obstacles",
      "Contests altitude",
      "Very high power to weight",
    ],
    weaknesses: [
      "Fragile when rotors are damaged",
      "Little armour",
      "Loses lift quickly when overloaded",
    ],
    vehicleName: "Sky Talon",
    personality: {
      aggression: 0.6,
      caution: 0.5,
      creativity: 0.55,
      mobility: 0.95,
      risk: 0.6,
      defense: 0.25,
      adaptability: 0.6,
      preferredRange: 0.8,
    },
    spec: (t) => {
      const s: Spec = [["hull", "carbon"]];
      s.push(["wFL", "smallwheel"], ["wFR", "smallwheel"]);
      s.push(["rotorTop", t < 3 ? "rotor" : "dualrotor"], ["rear", "prop"]);
      s.push(["frontL", "egg"], ["frontR", "tennis"]);
      if (t >= 2) s.push(["power", "battery_s"]);
      if (t >= 5) s.push(["drive", "motor"]);
      return s;
    },
  },
  {
    id: "snapper",
    name: "Snapper",
    species: "Crocodile",
    art: "crocodile",
    title: "The Close-Range Specialist",
    philosophy:
      "Durable and relentless. Snapper builds a rugged, heavy machine, drags opponents into contact, and uses cutters, drills and punches that do their work at arm's length.",
    tagline: "Get close enough to lose.",
    difficulty: 4,
    strengths: [
      "Strong at contact",
      "Punishes stationary machines",
      "Hard to kite",
    ],
    weaknesses: [
      "No meaningful long-range attack",
      "Loses against well-spaced weapons",
    ],
    vehicleName: "Jaw Breaker",
    personality: {
      aggression: 0.85,
      caution: 0.3,
      creativity: 0.3,
      mobility: 0.4,
      risk: 0.8,
      defense: 0.6,
      adaptability: 0.3,
      preferredRange: 0.05,
    },
    spec: (t) => {
      const s: Spec = [["hull", t < 2 ? "steel" : "ceramic"]];
      s.push(...wheels("heavywheel"));
      s.push(
        ["frontL", "disc"],
        ["frontR", "drill"],
        ["sideL", "rrubber"],
        ["sideR", "rrubber"],
      );
      s.push(["rear", t >= 5 ? "rocket_assist" : "bumper"]);
      if (t >= 2)
        s.push(["power", t >= 5 ? "battery_i" : "battery_s"]);
      if (t >= 1) s.push(["top", "glove"]);
      if (t >= 4) s.push(["gear", "gearbox"]);
      if (t >= 6) s.push(["drive", "generator"]);
      return s;
    },
  },
  {
    id: "oktavia",
    name: "Oktavia",
    species: "Octopus",
    art: "octopus",
    title: "The Experimental Engineer",
    philosophy:
      "Many arms, many mechanisms. Oktavia mounts a dozen small weapons on independent arms, runs them from a shared power bus, and reacts unpredictably but coherently.",
    tagline: "Eight arms. One plan. Probably.",
    difficulty: 5,
    strengths: [
      "Many weapons at once",
      "Unpredictable engagement",
      "Good damage spread",
    ],
    weaknesses: ["Power is split across many systems", "Each weapon is light"],
    vehicleName: "Kraken Mk.II",
    personality: {
      aggression: 0.5,
      caution: 0.45,
      creativity: 0.95,
      mobility: 0.6,
      risk: 0.55,
      defense: 0.4,
      adaptability: 0.7,
      preferredRange: 0.5,
    },
    spec: (t) => {
      const s: Spec = [["hull", t < 2 ? "steel" : "polymer"]];
      s.push(["platform", "platform"], ["platTop", "flail"]);
      s.push(
        ["frontL", "tennis"],
        ["frontR", "paint"],
        ["sideL", "water"],
        ["sideR", "snow"],
      );
      s.push(["rear", "glove"]);
      s.push(...wheels("wheel"));
      if (t >= 1)
        s.push(["power", t >= 5 ? "battery_i" : "battery_s"]);
      if (t >= 2) s.push(["drive", t >= 4 ? "generator" : "motor"]);
      if (t >= 3) s.push(["gear", "gearbox"]);
      return s;
    },
  },
  {
    id: "atlas",
    name: "Atlas",
    species: "Grizzly",
    art: "atlas",
    title: "The Foundry Champion",
    philosophy:
      "The veteran. Atlas builds the strongest hull the round allows, concentrates weight on a few excellent weapons, and targets whatever part of a rival is weakest.",
    tagline: "I have seen every trick. Show me another.",
    difficulty: 5,
    strengths: [
      "Excellent structure",
      "Balanced power and weight",
      "Precise weapon placement",
    ],
    weaknesses: ["Expensive", "Slower than the light rivals"],
    vehicleName: "The Foundry",
    personality: {
      aggression: 0.65,
      caution: 0.5,
      creativity: 0.6,
      mobility: 0.5,
      risk: 0.6,
      defense: 0.6,
      adaptability: 0.75,
      preferredRange: 0.45,
    },
    spec: (t) => {
      const s: Spec = [["hull", t < 4 ? "composite" : "xalloy"]];
      s.push(...wheels("powered"));
      s.push(
        ["frontL", "drophammer"],
        ["frontR", t >= 7 ? "nova" : "heavyarmor"],
      );
      if (t < 7) s.push(["top", "nova"]);
      s.push(["rear", t >= 8 ? "rocket_assist" : "bumper"]);
      if (t >= 3)
        s.push(["power", t >= 7 ? "battery_s" : "battery_i"]);
      if (t >= 5 && t < 7)
        s.push(
          ["platform", "platform"],
          ["platTop", "rail"],
        );
      if (t >= 5) s.push(["stab", "stabilizer"]);
      if (t >= 6) s.push(["drive", t >= 7 ? "controller" : "generator"]);
      if (t >= 7) s.push(["rotorTop", "dualrotor"]);
      return s;
    },
  },
];

const STAGES = [
  [1, "Scrapyard qualifiers"],
  [20, "Iron division"],
  [40, "Skyline circuit"],
  [60, "Foundry league"],
  [80, "Specialist series"],
  [100, "Elite championship"],
] as const;

export function stageFor(level: number) {
  if (level === 100) return "Championship final";
  for (const [limit, name] of STAGES) if (level < limit) return name;
  return "Elite championship";
}

/** The rival scheduled for a round. Round 100 is always the Foundry Champion. */
export function rivalIndexFor(level: number) {
  return level === 100 ? RIVALS.length - 1 : (level - 1) % RIVALS.length;
}

const designCache = new Map<
  number,
  { parts: Part[]; skipped: string[]; spent: number }
>();

function cloneParts(parts: Part[]) {
  return parts.map((part) => ({
    ...part,
    pos: [...part.pos] as V3,
    rot: [...part.rot] as V3,
    scale: [...part.scale] as V3,
  }));
}

/** Designs the rival's machine for a round using only legal, budgeted parts. */
export function rivalAt(level: number) {
  const index = rivalIndexFor(level);
  const profile = RIVALS[index];
  const tier = Math.floor((level - 1) / 10);
  const budget = budgetFor(level);
  let design = designCache.get(level);
  if (!design) {
    const assembled = assemble(profile.spec(tier, level), budget);
    design = {
      parts: cloneParts(assembled.parts),
      skipped: [...assembled.skipped],
      spent: assembled.spent,
    };
    designCache.set(level, design);
  }
  const { skipped, spent } = design;
  const suffix = ["", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"][
    tier
  ];
  const vehicle: Vehicle = {
    name: profile.vehicleName + (suffix ? " " + suffix : ""),
    parts: cloneParts(design.parts),
  };
  return {
    id: profile.id,
    name: profile.name,
    species: profile.species,
    art: profile.art,
    title: profile.title,
    philosophy: profile.philosophy,
    style: profile.philosophy,
    tagline: profile.tagline,
    difficulty: profile.difficulty,
    strengths: profile.strengths,
    weaknesses: profile.weaknesses,
    personality: profile.personality,
    level,
    vehicle,
    budget,
    spent,
    skipped,
    index,
    tier,
    stage: stageFor(level),
    metrics: metrics(vehicle),
  };
}

/** Public entry point used across the game. */
export const opponent = rivalAt;
