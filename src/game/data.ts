import {
  MATERIAL_PARTS,
  EXTRA_WEAPONS,
  MECHANICAL_PARTS,
  POWER_PARTS,
  EXTRA_MOBILITY,
  ROCKETS,
} from "./expansion";
export type V3 = [number, number, number];

/* The arena is a circular stadium. The radius was doubled from the original
   21.45 units to 42.9, so the playable surface is four times larger. */
export const ARENA_ORIGINAL_RADIUS = 21.45;
export const ARENA_PREVIOUS_RADIUS = ARENA_ORIGINAL_RADIUS * 2;
export const ARENA_RADIUS = ARENA_PREVIOUS_RADIUS * 1.5;
export const ARENA_DECK_RADIUS = ARENA_RADIUS + 3.4;
export const EMBLEM_RADIUS = 6.8;
export const SPAWN_PLAYER: V3 = [0, 1.1, 36.75];
export const SPAWN_RIVAL: V3 = [0, 1.1, -36.75];
export type Category =
  "Structure" | "Mobility" | "Weapons" | "Mechanical" | "Power";
export type MaterialClass =
  | "wood"
  | "hardwood"
  | "cardboard"
  | "box"
  | "stone"
  | "iron"
  | "steel"
  | "reinforced-steel"
  | "aluminium"
  | "titanium"
  | "copper"
  | "brass"
  | "carbon"
  | "ceramic"
  | "composite"
  | "rubber"
  | "reinforced-rubber"
  | "foam"
  | "polymer"
  | "exotic";
export type DamageType =
  | "cut"
  | "impact"
  | "blunt"
  | "explosive"
  | "pierce"
  | "wet"
  | "paint"
  | "foam";
export type WeaponBehavior = "melee" | "projectile" | "ray" | "burst" | "none";
export type BoosterMode = "impulse" | "sprint" | "ion" | "vector" | "afterburn";
export type Trait =
  | "none"
  | "axle"
  | "bearing"
  | "gearbox"
  | "motor"
  | "piston"
  | "hydraulic"
  | "actuator"
  | "bracket"
  | "connector"
  | "platform"
  | "stabilizer"
  | "jumper"
  | "battery"
  | "generator"
  | "wire"
  | "switch"
  | "controller"
  | "breaker";
export type Rarity = "Common" | "Uncommon" | "Rare" | "Epic" | "Legendary";
export type Kind =
  | "core"
  | "wood"
  | "armor"
  | "beam"
  | "joint"
  | "wheel"
  | "rotor"
  | "propeller"
  | "thruster"
  | "spring"
  | "saw"
  | "egg"
  | "rail"
  | "pillow"
  | "catapult"
  | "hammer"
  | "club"
  | "blast"
  | "blade"
  | "pulse"
  | "material"
  | "mechanical"
  | "battery"
  | "generator"
  | "motor"
  | "controller";
export interface ComponentDef {
  key: string;
  name: string;
  category: Category;
  kind: Kind;
  art: string;
  cost: number;
  mass: number;
  hp: number;
  dimensions: V3;
  rarity: Rarity;
  coins: number;
  power: number;
  range: number;
  cooldown: number;
  energy: number;
  grip: number;
  description: string;
  material: MaterialClass;
  damageType: DamageType;
  behavior: WeaponBehavior;
  status?: "slick" | "paint" | "confetti" | "foam";
  shots: number;
  impulse: number;
  powerGen: number;
  capacity: number;
  trait: Trait;
  unlockLevel: number;
  requiredRival?: string;
  tier: number;
  color?: string;
  artColor?: string;
  booster?: BoosterMode;
}
export const MATERIAL_PROFILES: Record<
  MaterialClass,
  {
    label: string;
    color: string;
    metalness: number;
    roughness: number;
    density: number;
    elasticity: number;
    friction: number;
    hardness: number;
    resist: Partial<Record<DamageType, number>>;
    debris: string;
    sound: "wood" | "metal" | "stone" | "soft";
  }
> = {
  wood: {
    label: "Wood",
    color: "#976139",
    metalness: 0.04,
    roughness: 0.84,
    density: 8,
    elasticity: 0.18,
    friction: 0.72,
    hardness: 0.28,
    resist: { cut: 1.34, impact: 1.12, blunt: 1.06, pierce: 1.2 },
    debris: "#9c7447",
    sound: "wood",
  },
  hardwood: {
    label: "Reinforced wood",
    color: "#b0814c",
    metalness: 0.06,
    roughness: 0.78,
    density: 10,
    elasticity: 0.22,
    friction: 0.69,
    hardness: 0.42,
    resist: { cut: 1.12, impact: 0.96, blunt: 0.94 },
    debris: "#a07a49",
    sound: "wood",
  },
  cardboard: {
    label: "Cardboard",
    color: "#b68a59",
    metalness: 0.02,
    roughness: 0.94,
    density: 3,
    elasticity: 0.08,
    friction: 0.62,
    hardness: 0.08,
    resist: { cut: 1.55, impact: 1.5, blunt: 1.4, pierce: 1.6 },
    debris: "#c5a174",
    sound: "wood",
  },
  box: {
    label: "Shipping box",
    color: "#b98e5e",
    metalness: 0.02,
    roughness: 0.93,
    density: 4,
    elasticity: 0.1,
    friction: 0.65,
    hardness: 0.1,
    resist: { cut: 1.48, impact: 1.4, blunt: 1.3, pierce: 1.52 },
    debris: "#c8a77c",
    sound: "wood",
  },
  stone: {
    label: "Stone",
    color: "#75726b",
    metalness: 0.04,
    roughness: 0.91,
    density: 24,
    elasticity: 0.04,
    friction: 0.82,
    hardness: 0.86,
    resist: {
      cut: 1.08,
      impact: 0.79,
      blunt: 0.66,
      explosive: 1.14,
      pierce: 0.88,
    },
    debris: "#76736a",
    sound: "stone",
  },
  iron: {
    label: "Iron",
    color: "#59636b",
    metalness: 0.82,
    roughness: 0.45,
    density: 19,
    elasticity: 0.24,
    friction: 0.54,
    hardness: 0.73,
    resist: { cut: 0.83, impact: 0.82, blunt: 0.74, pierce: 0.8 },
    debris: "#69747c",
    sound: "metal",
  },
  steel: {
    label: "Steel",
    color: "#66747c",
    metalness: 0.89,
    roughness: 0.35,
    density: 17,
    elasticity: 0.3,
    friction: 0.5,
    hardness: 0.82,
    resist: { cut: 0.7, impact: 0.72, blunt: 0.7, pierce: 0.78 },
    debris: "#77858d",
    sound: "metal",
  },
  "reinforced-steel": {
    label: "Reinforced steel",
    color: "#6c777a",
    metalness: 0.86,
    roughness: 0.41,
    density: 22,
    elasticity: 0.23,
    friction: 0.53,
    hardness: 0.93,
    resist: { cut: 0.6, impact: 0.6, blunt: 0.6, pierce: 0.68 },
    debris: "#818d8f",
    sound: "metal",
  },
  aluminium: {
    label: "Aluminium alloy",
    color: "#a5afb1",
    metalness: 0.82,
    roughness: 0.4,
    density: 8,
    elasticity: 0.46,
    friction: 0.42,
    hardness: 0.58,
    resist: { cut: 0.92, impact: 0.9, blunt: 0.86, pierce: 0.9 },
    debris: "#b8c2c3",
    sound: "metal",
  },
  titanium: {
    label: "Titanium alloy",
    color: "#93a5b0",
    metalness: 0.87,
    roughness: 0.32,
    density: 11,
    elasticity: 0.38,
    friction: 0.48,
    hardness: 0.94,
    resist: {
      cut: 0.65,
      impact: 0.64,
      blunt: 0.6,
      pierce: 0.6,
      explosive: 0.76,
    },
    debris: "#9dabb4",
    sound: "metal",
  },
  copper: {
    label: "Copper",
    color: "#b8733e",
    metalness: 0.78,
    roughness: 0.43,
    density: 14,
    elasticity: 0.5,
    friction: 0.48,
    hardness: 0.46,
    resist: { cut: 0.94, impact: 0.82, blunt: 0.78 },
    debris: "#bd8050",
    sound: "metal",
  },
  brass: {
    label: "Brass",
    color: "#aa8c53",
    metalness: 0.83,
    roughness: 0.39,
    density: 13,
    elasticity: 0.4,
    friction: 0.45,
    hardness: 0.56,
    resist: { cut: 0.87, impact: 0.86, blunt: 0.8 },
    debris: "#b89a61",
    sound: "metal",
  },
  carbon: {
    label: "Carbon fibre",
    color: "#363f42",
    metalness: 0.28,
    roughness: 0.5,
    density: 5,
    elasticity: 0.64,
    friction: 0.4,
    hardness: 0.75,
    resist: { cut: 0.82, impact: 1.22, blunt: 0.94, pierce: 0.86 },
    debris: "#3c464a",
    sound: "wood",
  },
  ceramic: {
    label: "Ceramic",
    color: "#b9b9ac",
    metalness: 0.08,
    roughness: 0.71,
    density: 12,
    elasticity: 0.02,
    friction: 0.55,
    hardness: 0.96,
    resist: {
      cut: 0.44,
      impact: 0.84,
      blunt: 1.52,
      pierce: 1.2,
      explosive: 1.3,
    },
    debris: "#cdcdc0",
    sound: "stone",
  },
  composite: {
    label: "Composite armour",
    color: "#555e56",
    metalness: 0.38,
    roughness: 0.58,
    density: 10,
    elasticity: 0.42,
    friction: 0.55,
    hardness: 0.84,
    resist: {
      cut: 0.6,
      impact: 0.62,
      blunt: 0.68,
      pierce: 0.7,
      explosive: 0.8,
    },
    debris: "#5b665e",
    sound: "metal",
  },
  rubber: {
    label: "Rubber",
    color: "#343b3b",
    metalness: 0.02,
    roughness: 0.92,
    density: 6,
    elasticity: 0.9,
    friction: 0.96,
    hardness: 0.2,
    resist: { cut: 1.3, impact: 0.58, blunt: 0.5, pierce: 1.1 },
    debris: "#434b4b",
    sound: "soft",
  },
  "reinforced-rubber": {
    label: "Reinforced rubber",
    color: "#414845",
    metalness: 0.05,
    roughness: 0.79,
    density: 8,
    elasticity: 0.85,
    friction: 1,
    hardness: 0.38,
    resist: { cut: 1.06, impact: 0.48, blunt: 0.43, pierce: 0.96 },
    debris: "#4d5551",
    sound: "soft",
  },
  foam: {
    label: "Shock foam",
    color: "#c8b995",
    metalness: 0.01,
    roughness: 1,
    density: 2,
    elasticity: 0.98,
    friction: 0.72,
    hardness: 0.03,
    resist: { cut: 1.7, impact: 0.32, blunt: 0.34, pierce: 1.8 },
    debris: "#d6c9aa",
    sound: "soft",
  },
  polymer: {
    label: "Industrial polymer",
    color: "#4e6662",
    metalness: 0.12,
    roughness: 0.67,
    density: 7,
    elasticity: 0.55,
    friction: 0.58,
    hardness: 0.47,
    resist: { cut: 1.02, impact: 0.86, blunt: 0.82, pierce: 0.92 },
    debris: "#59736f",
    sound: "soft",
  },
  exotic: {
    label: "Experimental alloy",
    color: "#7e948c",
    metalness: 0.83,
    roughness: 0.27,
    density: 12,
    elasticity: 0.52,
    friction: 0.56,
    hardness: 0.98,
    resist: {
      cut: 0.5,
      impact: 0.47,
      blunt: 0.45,
      pierce: 0.48,
      explosive: 0.62,
    },
    debris: "#90a79f",
    sound: "metal",
  },
};
export const materialProfile = (key: string) =>
  MATERIAL_PROFILES[DEF[key]?.material ?? "steel"];
const item = (
  key: string,
  name: string,
  category: Category,
  kind: Kind,
  art: string,
  cost: number,
  mass: number,
  hp: number,
  dimensions: V3,
  description: string,
  extra: Partial<ComponentDef> = {},
): ComponentDef => ({
  key,
  name,
  category,
  kind,
  art,
  cost,
  mass,
  hp,
  dimensions,
  description,
  rarity: "Common",
  coins: 0,
  power: 0,
  range: 0,
  cooldown: 1,
  energy: 0,
  grip: 1,
  material: "steel",
  damageType: "impact",
  behavior: ["saw", "hammer", "club", "blade"].includes(kind)
    ? "melee"
    : ["rail", "pulse"].includes(kind)
      ? "ray"
      : ["egg", "pillow", "catapult", "blast"].includes(kind)
        ? "projectile"
        : "none",
  shots: 1,
  impulse: 0,
  powerGen: 0,
  capacity: 0,
  trait: "none",
  unlockLevel: 1,
  tier: 1,
  ...extra,
});
export const CORE = item(
  "core",
  "Engineering chassis",
  "Structure",
  "core",
  "armor",
  4,
  44,
  160,
  [2.35, 0.65, 3.35],
  "The heart of your machine. Protect the chassis to stay in the match.",
);
export const CATALOG: ComponentDef[] = [
  item(
    "crate",
    "Wooden crate",
    "Structure",
    "wood",
    "crate",
    1,
    8,
    38,
    [1, 1, 1],
    "Light, inexpensive timber bracing. A versatile starting point for any build.",
  ),
  item(
    "iron",
    "Iron block",
    "Structure",
    "armor",
    "armor",
    3,
    21,
    96,
    [1, 1, 1],
    "A dense, riveted iron block. Excellent protection at the cost of added weight.",
  ),
  item(
    "wheel",
    "Off-road wheel",
    "Mobility",
    "wheel",
    "wheel",
    2,
    9,
    45,
    [0.55, 1.32, 1.32],
    "Deep-tread powered wheels offer dependable grip and all-terrain traction.",
    { power: 22, grip: 1.2 },
  ),
  item(
    "saw",
    "Rotary saw",
    "Weapons",
    "saw",
    "saw",
    4,
    14,
    64,
    [0.45, 1.32, 1.32],
    "A spinning close-range cutter. Hold fire beside a rival to tear away exposed components.",
    { power: 19, range: 3.9, cooldown: 0.46, rarity: "Uncommon" },
  ),
  item(
    "rotor",
    "Lift rotor",
    "Mobility",
    "rotor",
    "rotor",
    5,
    11,
    48,
    [2.8, 0.54, 2.8],
    "Generates lift for up to 180 kg. Hold the action control to rise above the arena.",
    { power: 180, rarity: "Uncommon", energy: 3 },
  ),
  item(
    "egg",
    "Egg launcher",
    "Weapons",
    "egg",
    "launcher",
    4,
    12,
    52,
    [0.9, 0.56, 1.4],
    "A pneumatic twin-barrel launcher. Fast ceramic eggs deliver a satisfying impact.",
    { power: 28, range: 25, cooldown: 0.76, energy: 8 },
  ),
  item(
    "steel",
    "Steel plate",
    "Structure",
    "armor",
    "armor",
    3,
    17,
    105,
    [1.76, 0.56, 1.65],
    "Sloped steel armor spreads incoming impacts across a durable outer shell.",
  ),
  item(
    "hardwood",
    "Reinforced wood",
    "Structure",
    "wood",
    "crate",
    2,
    13,
    74,
    [1.2, 0.9, 1.2],
    "Cross-braced hardwood with reinforced corners, tougher than a standard crate.",
  ),
  item(
    "smallwheel",
    "Small wheel",
    "Mobility",
    "wheel",
    "wheel",
    1,
    4,
    24,
    [0.36, 0.88, 0.88],
    "A light, nimble powered wheel for compact builds.",
    { power: 13, grip: 0.87 },
  ),
  item(
    "heavywheel",
    "Heavy-duty wheel",
    "Mobility",
    "wheel",
    "wheel",
    3,
    16,
    84,
    [0.7, 1.65, 1.65],
    "Deep lugs and a tough hub keep a heavy machine moving.",
    { power: 36, grip: 1.45, rarity: "Uncommon" },
  ),
  item(
    "steer",
    "Steering wheel",
    "Mobility",
    "wheel",
    "wheel",
    2,
    7,
    38,
    [0.48, 1.14, 1.14],
    "A steerable wheel hub increases turning response.",
    { power: 16, grip: 1.4 },
  ),
  item(
    "powered",
    "Powered wheel",
    "Mobility",
    "wheel",
    "wheel",
    4,
    12,
    51,
    [0.63, 1.38, 1.38],
    "An integrated drive motor provides extra acceleration.",
    { power: 48, grip: 1.25, rarity: "Rare", coins: 3 },
  ),
  item(
    "alloy",
    "Alloy block",
    "Structure",
    "armor",
    "armor",
    3,
    8,
    69,
    [1, 0.85, 1],
    "A featherweight alloy with an excellent strength-to-weight ratio.",
    { rarity: "Uncommon" },
  ),
  item(
    "heavyarmor",
    "Heavy armor",
    "Structure",
    "armor",
    "armor",
    5,
    31,
    185,
    [1.45, 0.72, 1.35],
    "Thick layered armor absorbs repeated heavy impacts.",
    { rarity: "Rare", coins: 4 },
  ),
  item(
    "beam",
    "Structural beam",
    "Structure",
    "beam",
    "armor",
    2,
    10,
    73,
    [0.45, 0.4, 2.4],
    "A long steel support for extended chassis and unusual mounting points.",
  ),
  item(
    "rod",
    "Connecting rod",
    "Structure",
    "beam",
    "armor",
    1,
    4,
    29,
    [0.22, 0.22, 1.6],
    "Lightweight load-bearing linkage between distant components.",
  ),
  item(
    "hinge",
    "Flex hinge",
    "Structure",
    "joint",
    "armor",
    2,
    5,
    43,
    [0.54, 0.34, 0.58],
    "A compliant mount that reduces impact damage transmitted to its child parts.",
    { grip: 0.72 },
  ),
  item(
    "joint",
    "Rotating joint",
    "Structure",
    "joint",
    "rotor",
    3,
    6,
    54,
    [0.65, 0.36, 0.65],
    "A rotating weapon mount that expands its attached weapon’s targeting arc.",
    { rarity: "Uncommon" },
  ),
  item(
    "spring",
    "Suspension unit",
    "Mobility",
    "spring",
    "wheel",
    2,
    6,
    56,
    [0.52, 0.9, 0.52],
    "Adds damping and travel to the wheel suspension, reducing collision damage.",
  ),
  item(
    "prop",
    "Propeller",
    "Mobility",
    "propeller",
    "rotor",
    3,
    7,
    38,
    [1.6, 1.6, 0.48],
    "A powered rear propeller adds forward thrust without wheel contact.",
    { power: 44, energy: 1 },
  ),
  item(
    "boost",
    "Pulse thruster",
    "Mobility",
    "thruster",
    "launcher",
    5,
    12,
    49,
    [0.7, 0.7, 1.35],
    "Channels energy into a short forward boost. Press the action control to dash.",
    { power: 85, rarity: "Rare", coins: 5, energy: 18 },
  ),
  item(
    "pillow",
    "Pillow thrower",
    "Weapons",
    "pillow",
    "launcher",
    3,
    6,
    40,
    [0.8, 0.6, 1.22],
    "Launches buoyant cushions. Low damage, spectacular knockback.",
    { power: 13, range: 17, cooldown: 0.65, energy: 5 },
  ),
  item(
    "catapult",
    "Spring catapult",
    "Weapons",
    "catapult",
    "launcher",
    4,
    15,
    65,
    [1.1, 1.05, 1.7],
    "Lobs a weighted arena ball in an arc over low obstacles.",
    { power: 43, range: 24, cooldown: 1.8, energy: 12, rarity: "Uncommon" },
  ),
  item(
    "hammer",
    "Power hammer",
    "Weapons",
    "hammer",
    "saw",
    5,
    21,
    88,
    [0.85, 1.3, 1.6],
    "A heavy overhead swing deals burst damage and knocks the rival upward.",
    {
      power: 49,
      range: 4.4,
      cooldown: 1.45,
      energy: 9,
      rarity: "Rare",
      coins: 4,
    },
  ),
  item(
    "club",
    "Swing arm",
    "Weapons",
    "club",
    "saw",
    3,
    14,
    57,
    [0.5, 0.5, 2.1],
    "Sweeps a heavy pendulum sideways, spinning nearby rivals off course.",
    { power: 26, range: 4.6, cooldown: 0.95, energy: 4 },
  ),
  item(
    "rail",
    "Arc railgun",
    "Weapons",
    "rail",
    "launcher",
    6,
    19,
    57,
    [0.75, 0.68, 2.2],
    "A charged arcade pulse hits a distant component instantly, with strong recoil.",
    {
      power: 54,
      range: 38,
      cooldown: 2.2,
      energy: 23,
      rarity: "Epic",
      coins: 10,
    },
  ),
  item(
    "blast",
    "Impact pod",
    "Weapons",
    "blast",
    "launcher",
    5,
    11,
    41,
    [0.8, 0.86, 1.1],
    "Lobs a foam-burst pod that damages several nearby components on impact.",
    {
      power: 32,
      range: 21,
      cooldown: 1.65,
      energy: 16,
      rarity: "Epic",
      coins: 8,
    },
  ),
  item(
    "blades",
    "Twin blades",
    "Weapons",
    "blade",
    "saw",
    5,
    16,
    71,
    [1.8, 0.44, 1.8],
    "A fast horizontal spinner cuts through anything within its reach.",
    {
      power: 22,
      range: 4.4,
      cooldown: 0.36,
      energy: 3,
      rarity: "Rare",
      coins: 6,
    },
  ),
  item(
    "nova",
    "Nova projector",
    "Weapons",
    "pulse",
    "launcher",
    7,
    18,
    70,
    [1.1, 0.72, 1.65],
    "A slow-charging championship pulse shoves and damages a rival at mid range.",
    {
      power: 68,
      range: 15,
      cooldown: 2.8,
      energy: 29,
      rarity: "Legendary",
      coins: 22,
    },
  ),
];
CATALOG.push(
  ...MATERIAL_PARTS,
  ...EXTRA_WEAPONS,
  ...MECHANICAL_PARTS,
  ...POWER_PARTS,
  ...EXTRA_MOBILITY,
  ...ROCKETS,
);
const MATERIAL_KEYS: Record<string, MaterialClass> = {
  crate: "wood",
  hardwood: "hardwood",
  iron: "iron",
  steel: "reinforced-steel",
  alloy: "aluminium",
  heavyarmor: "reinforced-steel",
  beam: "steel",
  rod: "aluminium",
  hinge: "steel",
  joint: "brass",
  spring: "steel",
  wheel: "rubber",
  smallwheel: "rubber",
  heavywheel: "reinforced-rubber",
  steer: "rubber",
  powered: "reinforced-rubber",
  saw: "steel",
  egg: "steel",
  pillow: "polymer",
  catapult: "wood",
  hammer: "steel",
  club: "steel",
  rail: "steel",
  blast: "steel",
  blades: "steel",
  nova: "exotic",
  rotor: "aluminium",
  prop: "aluminium",
  boost: "steel",
};
for (const d of CATALOG)
  if (MATERIAL_KEYS[d.key]) d.material = MATERIAL_KEYS[d.key];
for (const d of CATALOG) {
  if (d.category === "Weapons" && d.behavior === "none")
    d.behavior = ["saw", "hammer", "club", "blade"].includes(d.kind)
      ? "melee"
      : ["rail", "pulse"].includes(d.kind)
        ? "ray"
        : "projectile";
  const existingDamage: Record<string, DamageType> = {
    saw: "cut",
    blades: "cut",
    drill: "pierce",
    twin_saw: "cut",
    disc: "cut",
    drum: "blunt",
    flail: "blunt",
    hammer: "impact",
    rotary_hammer: "impact",
    club: "blunt",
    glove: "blunt",
    bumper: "blunt",
    pendulum: "blunt",
    pillow: "blunt",
    foamcannon: "foam",
    tennis: "impact",
    paint: "paint",
    water: "wet",
    snow: "wet",
    confetti: "impact",
    rail: "pierce",
    pulse: "explosive",
    blast: "explosive",
    catapult: "impact",
    egg: "impact",
  };
  if (d.category === "Weapons" && existingDamage[d.key])
    d.damageType = existingDamage[d.key];
}
export const DEF: Record<string, ComponentDef> = Object.fromEntries(
  [CORE, ...CATALOG].map((x) => [x.key, x]),
);
export interface Part {
  id: string;
  key: string;
  pos: V3;
  rot: V3;
  scale: V3;
  parent: string | null;
}
export type PaintPattern = "solid" | "stripe" | "checker" | "camo" | "flame";
export type DecalKind = "none" | "bolt" | "paw" | "skull" | "vmd";
export type ExhaustKind = "smoke" | "flame" | "spark" | "ice";
export type HornKind = "stock" | "airhorn" | "whistle" | "siren";
export type VictoryKind = "spin" | "leap" | "confetti" | "salute";
export interface Livery {
  paint: string;
  accent: string;
  pattern: PaintPattern;
  decal: DecalKind;
  lights: string;
  exhaust: ExhaustKind;
  plate: string;
  horn: HornKind;
  victory: VictoryKind;
}
export const DEFAULT_LIVERY: Livery = {
  paint: "#3f4b50",
  accent: "#ff8747",
  pattern: "stripe",
  decal: "vmd",
  lights: "#8dfcf2",
  exhaust: "flame",
  plate: "VMD 01",
  horn: "stock",
  victory: "confetti",
};
export const PAINT_COLORS = [
  "#3f4b50",
  "#e2702c",
  "#2f7d84",
  "#8d3b34",
  "#c8b46a",
  "#3d4f8a",
  "#6a8b5b",
  "#22272a",
] as const;
export const PATTERNS: { key: PaintPattern; label: string }[] = [
  { key: "solid", label: "Solid" },
  { key: "stripe", label: "Racing stripe" },
  { key: "checker", label: "Checker" },
  { key: "camo", label: "Camouflage" },
  { key: "flame", label: "Flame" },
];
export const DECALS: { key: DecalKind; label: string; glyph: string }[] = [
  { key: "none", label: "None", glyph: "" },
  { key: "bolt", label: "Lightning", glyph: "⚡" },
  { key: "paw", label: "Paw print", glyph: "🐾" },
  { key: "skull", label: "Skull", glyph: "☠" },
  { key: "vmd", label: "VMD crest", glyph: "V" },
];
export const EXHAUSTS: { key: ExhaustKind; label: string; color: string }[] = [
  { key: "smoke", label: "Diesel smoke", color: "#9aa5a6" },
  { key: "flame", label: "Orange flame", color: "#ff8a3d" },
  { key: "spark", label: "Metal sparks", color: "#ffd67b" },
  { key: "ice", label: "Ion mist", color: "#80e9ff" },
];
export const HORNS: { key: HornKind; label: string }[] = [
  { key: "stock", label: "Workshop bell" },
  { key: "airhorn", label: "Stadium airhorn" },
  { key: "whistle", label: "Pip's whistle" },
  { key: "siren", label: "Championship siren" },
];
export const VICTORIES: { key: VictoryKind; label: string }[] = [
  { key: "spin", label: "Donut spin" },
  { key: "leap", label: "Victory leap" },
  { key: "confetti", label: "Confetti storm" },
  { key: "salute", label: "Engineer's salute" },
];

export interface Vehicle {
  name: string;
  parts: Part[];
  livery?: Livery;
}
export const GARAGE_SLOTS = 4;
export const REPLAY_LIMIT = 8;
export interface ReplayFrame {
  t: number;
  p: [number, number, number, number, number, number, number];
  e: [number, number, number, number, number, number, number];
}
export interface ReplayEvent {
  t: number;
  type: string;
  owner: number;
  label?: string;
  material?: string;
  status?: string;
  pos?: V3;
  clash?: boolean;
}
export interface ReplayDamage {
  t: number;
  part: string;
  amount: number;
  cause: string;
}
export interface MatchReplay {
  frames: ReplayFrame[];
  events: ReplayEvent[];
  damage?: ReplayDamage[];
  lossCause?: string;
}
export interface StoredReplay extends MatchReplay {
  id: string;
  at: number;
  level: number;
  win: boolean;
  duration: number;
  score: number;
  opponent: string;
  driver: string;
  player: Vehicle;
  rival: Vehicle;
}
export interface StoredBuild extends Vehicle {
  id: string;
  saved: number;
  slot?: number;
}
export interface MatchResult {
  id: string;
  level: number;
  win: boolean;
  score: number;
  rating: number;
  duration: number;
  broken: number;
  at: number;
  opponent: string;
  driver?: string;
  replayId?: string;
}
export type Quality = "Low" | "Medium" | "High" | "Ultra";
export type CrowdQuality = "Low" | "Medium" | "High";
export interface Settings {
  quality: Quality;
  sound: number;
  crowd: number;
  voice: boolean;
  muted: boolean;
  shake: boolean;
  cinematic: boolean;
  crowdQuality: CrowdQuality;
  cameraIntensity: number;
  countdownVolume: number;
  announcerVolume: number;
  motionBlur: boolean;
  reducedMotion: boolean;
}
export const DEFAULT_SETTINGS: Settings = {
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
export interface EngineerRecord {
  name: string;
  level: number;
  rating: number;
  wins: number;
  score: number;
}
export interface MatchStats {
  shotsRanged: number;
  shotsMelee: number;
  samples: number;
  airSamples: number;
  closeSamples: number;
  wheelLosses: number;
}
/** Long-term memory of one player's style, kept per rival. Values are 0..1. */
export interface RivalMemory {
  matches: number;
  rangedShare: number;
  meleeShare: number;
  airShare: number;
  closeShare: number;
  wheelLosses: number;
}
export interface Profile {
  rivalMemory?: Record<string, RivalMemory>;
  records?: EngineerRecord[];
  version: 1;
  engineer: string;
  level: number;
  salvage: number;
  coins: number;
  xp: number;
  unlocked: string[];
  vehicle: Vehicle;
  garage: StoredBuild[];
  history: MatchResult[];
  replays?: StoredReplay[];
  settings: Settings;
  completed: boolean;
  updated: number;
}
export const makePart = (
  id: string,
  key: string,
  pos: V3,
  parent: string | null = "chassis",
): Part => ({ id, key, pos, rot: [0, 0, 0], scale: [1, 1, 1], parent });
export const starter = (): Vehicle => ({
  name: "Mudskipper MK. I",
  livery: { ...DEFAULT_LIVERY },
  parts: [
    makePart("chassis", "core", [0, 0, 0], null),
    ...[-1, 1].flatMap((side) =>
      [-1, 1].map((end) =>
        makePart(`wheel${side}${end}`, "wheel", [
          side * 1.31,
          -0.13,
          end * 1.12,
        ]),
      ),
    ),
    makePart("shell", "steel", [0, 0.59, 0.24]),
    makePart("cutter", "saw", [-0.78, 0.04, -1.94]),
    makePart("turret", "egg", [0, 1.13, 0.16], "shell"),
  ],
});
export const freshProfile = (): Profile => ({
  version: 1,
  records: [],
  engineer: "Pip",
  level: 1,
  coins: 0,
  salvage: 30,
  xp: 0,
  unlocked: [],
  vehicle: starter(),
  garage: [],
  history: [],
  replays: [],
  settings: { ...DEFAULT_SETTINGS },
  completed: false,
  updated: 0,
});
export const uid = () =>
  typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const sizeFactor = (p: Part) => p.scale[0] * p.scale[1] * p.scale[2];
export const partCost = (p: Part) =>
  Math.max(1, Math.ceil(DEF[p.key].cost * sizeFactor(p) - 0.0001));
export const partHP = (p: Part) => Math.round(DEF[p.key].hp * sizeFactor(p));
export function componentLock(d: ComponentDef, p: Profile): string | null {
  if (d.unlockLevel > p.level && !p.completed)
    return `Available from round ${String(d.unlockLevel).padStart(2, "0")}`;
  if (
    d.requiredRival &&
    !p.completed &&
    !p.history.some((r) => r.win && r.opponent === d.requiredRival)
  )
    return `Defeat ${d.requiredRival} to unlock`;
  if (d.coins && !p.unlocked.includes(d.key))
    return `Research required · ${d.coins} coins`;
  return null;
}
export function itemRating(d: ComponentDef) {
  return Math.round(
    d.hp * 0.28 +
      d.mass * 0.8 +
      d.power * 2.2 +
      d.capacity * 0.22 +
      d.powerGen * 2.4 +
      (d.category === "Weapons" ? (d.power / d.cooldown) * 2 : 0),
  );
}
export function metrics(v: Vehicle) {
  let cost = 0,
    mass = 0,
    hp = 0,
    drive = 0,
    damage = 0,
    lift = 0,
    power = 0,
    quality = 0,
    cx = 0,
    cy = 0,
    cz = 0,
    front = 0,
    rear = 0,
    left = 0,
    right = 0,
    armor = 0,
    powerCapacity = 100,
    powerGen = 12,
    structural = 0,
    weapons = 0,
    mechanisms = 0,
    powerParts = 0,
    torque = 0,
    impulse = 0,
    efficiencyBonus = 0;
  const kinds = new Set<string>(),
    materials = new Set<MaterialClass>();
  for (const p of v.parts) {
    const d = DEF[p.key],
      f = sizeFactor(p),
      m = d.mass * f,
      hpPart = partHP(p);
    cost += partCost(p);
    mass += m;
    hp += hpPart;
    cx += p.pos[0] * m;
    cy += p.pos[1] * m;
    cz += p.pos[2] * m;
    if (p.pos[2] < 0) front += m;
    else rear += m;
    if (p.pos[0] < 0) left += m;
    else right += m;
    kinds.add(d.kind);
    materials.add(d.material);
    const profile = MATERIAL_PROFILES[d.material];
    armor +=
      hpPart *
      Math.min(
        1.4,
        0.35 +
          profile.hardness +
          0.25 *
            (profile.resist.impact ? 1.3 - (profile.resist.impact ?? 1) : 0),
      );
    structural += hpPart * (0.4 + profile.hardness * 0.6);
    quality += ["Common", "Uncommon", "Rare", "Epic", "Legendary"].indexOf(
      d.rarity,
    );
    powerCapacity += d.capacity * f;
    powerGen += d.powerGen * f;
    if (d.kind === "wheel" || d.kind === "propeller" || d.kind === "thruster")
      drive += d.power * d.grip;
    if (d.kind === "rotor") lift += d.power;
    if (d.category === "Weapons") {
      damage +=
        (d.power / d.cooldown) * (0.7 + Math.min(1, d.range / 25) * 0.3);
      power += d.energy / d.cooldown;
      weapons++;
    }
    if (d.category === "Mechanical") mechanisms++;
    if (d.category === "Power") powerParts++;
    if (d.trait === "gearbox") {
      torque += 0.12;
      impulse += 0.05;
    }
    if (d.trait === "bearing") efficiencyBonus += 0.035;
    if (d.trait === "motor") {
      drive += 18;
      torque += 0.03;
    }
    if (d.trait === "axle") drive += 12;
    if (d.trait === "piston" || d.trait === "hydraulic") impulse += 0.08;
    if (d.trait === "actuator") impulse += 0.05;
    if (
      d.trait === "wire" ||
      d.trait === "switch" ||
      d.trait === "controller" ||
      d.trait === "breaker"
    )
      efficiencyBonus += 0.02;
    if (d.category === "Power") efficiencyBonus += 0.01;
  }
  const com: V3 = [
    cx / Math.max(1, mass),
    cy / Math.max(1, mass),
    cz / Math.max(1, mass),
  ];
  const balance = Math.max(0.3, 1 - Math.hypot(com[0], com[2]) * 0.3),
    mobility = Math.min(
      100,
      Math.round(((drive + lift * 0.3) / Math.max(1, mass)) * 85 * balance),
    ),
    firepower = Math.min(100, Math.round(damage)),
    durability = Math.min(100, Math.round(hp / 9)),
    efficiency = Math.min(1, 18 / Math.max(1, power)),
    armorRating = Math.min(100, Math.round(armor / 8)),
    flight = Math.min(100, Math.round((lift / Math.max(1, mass)) * 70)),
    integrity = Math.min(100, Math.round(structural / 8)),
    totalPower = Math.max(0, power * 1.15 - (powerGen + powerCapacity * 0.005));
  return {
    cost,
    mass: Math.round(mass),
    hp,
    drive,
    damage,
    lift,
    balance,
    mobility,
    firepower,
    durability,
    efficiency,
    armor: armorRating,
    structural: integrity,
    flight,
    com,
    front: Math.round((front / Math.max(1, mass)) * 100),
    rear: Math.round((rear / Math.max(1, mass)) * 100),
    left: Math.round((left / Math.max(1, mass)) * 100),
    right: Math.round((right / Math.max(1, mass)) * 100),
    powerCapacity: Math.round(powerCapacity),
    powerGen: Math.round(powerGen * (1 + efficiencyBonus)),
    powerDraw: Math.round(power),
    powerBalance: Math.round(powerCapacity + powerGen - power * 1.2),
    weapons,
    mechanisms,
    powerParts,
    materials: materials.size,
    complexity: kinds.size,
    rating: Math.round(
      hp * 0.25 +
        mobility * 1.25 +
        damage * 1.35 +
        balance * 22 +
        efficiency * 12 +
        Math.min(1, lift / mass) * 28 +
        quality * 3 +
        kinds.size * 3 +
        armorRating * 0.8 +
        Math.min(50, powerCapacity * 0.06) +
        Math.min(40, powerGen * 0.5),
    ),
    parts: v.parts.length,
  };
}
export function traitTotals(parts: Part[]) {
  const result: Partial<Record<Trait, number>> = {};
  for (const p of parts) {
    const t = DEF[p.key].trait;
    if (t !== "none") result[t] = (result[t] ?? 0) + 1;
  }
  return result;
}
export const FACES = [
  "Top",
  "Front",
  "Rear",
  "Left",
  "Right",
  "Bottom",
] as const;
export type Face = (typeof FACES)[number];
export const DIRECTIONS: Record<Face, V3> = {
  Top: [0, 1, 0],
  Bottom: [0, -1, 0],
  Front: [0, 0, -1],
  Rear: [0, 0, 1],
  Left: [-1, 0, 0],
  Right: [1, 0, 0],
};
export interface MountHit {
  id: string;
  face: Face;
  point: V3;
  normal: V3;
}
type OrientedBox = { center: V3; half: V3; axes: [V3, V3, V3] };
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
function bounds(p: Part): OrientedBox {
  const [a, b, c] = p.rot.map((n) => (n * Math.PI) / 180);
  const ca = Math.cos(a),
    sa = Math.sin(a),
    cb = Math.cos(b),
    sb = Math.sin(b),
    cc = Math.cos(c),
    sc = Math.sin(c);
  return {
    center: p.pos,
    half: DEF[p.key].dimensions.map((n, i) => (n * p.scale[i]) / 2) as V3,
    axes: [
      [cb * cc, sa * sb * cc + ca * sc, -ca * sb * cc + sa * sc],
      [-cb * sc, -sa * sb * sc + ca * cc, ca * sb * sc + sa * cc],
      [sb, -sa * cb, ca * cb],
    ],
  };
}
const radius = (box: OrientedBox, direction: V3) =>
  Math.abs(dot(box.axes[0], direction)) * box.half[0] +
  Math.abs(dot(box.axes[1], direction)) * box.half[1] +
  Math.abs(dot(box.axes[2], direction)) * box.half[2];
export function extents(p: Part): V3 {
  const b = bounds(p);
  return [radius(b, [1, 0, 0]), radius(b, [0, 1, 0]), radius(b, [0, 0, 1])];
}
// Keep the normal flush against the clicked face. Only the two tangential
// coordinates are affected by the grid, preserving left/right placement.
export function snapPartAt(
  p: Part,
  anchor: Part,
  face: Face,
  point: V3,
  step = 0,
): Part {
  const a = bounds(anchor),
    b = bounds(p),
    directions = DIRECTIONS[face];
  const axis = directions.findIndex((n) => n !== 0),
    sign = directions[axis];
  const relative = point.map((n, i) => n - anchor.pos[i]) as V3;
  const local: V3 = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    if (i === axis) {
      local[i] = sign * (a.half[i] + radius(b, a.axes[i]) - 0.035);
      continue;
    }
    const offset = dot(relative, a.axes[i]);
    const value = step ? Math.round(offset / step) * step : offset;
    const limit = Math.max(0, a.half[i] - Math.min(0.045, a.half[i] * 0.15));
    local[i] = Math.max(-limit, Math.min(limit, value));
  }
  return {
    ...p,
    parent: anchor.id,
    pos: anchor.pos.map(
      (n, i) =>
        +(
          n +
          a.axes[0][i] * local[0] +
          a.axes[1][i] * local[1] +
          a.axes[2][i] * local[2]
        ).toFixed(3),
    ) as V3,
  };
}
export function snapPart(p: Part, anchor: Part, face: Face): Part {
  return snapPartAt(p, anchor, face, anchor.pos);
}
// Separation along the 15 oriented-box axes, including rotated surfaces.
function separation(a: OrientedBox, b: OrientedBox) {
  const delta = a.center.map((n, i) => n - b.center[i]) as V3;
  let max = -Infinity;
  const test = (axis: V3) =>
    Math.abs(dot(delta, axis)) - radius(a, axis) - radius(b, axis);
  for (const axis of a.axes) max = Math.max(max, test(axis));
  for (const axis of b.axes) max = Math.max(max, test(axis));
  if (max > 0.24) return max;
  for (const da of a.axes)
    for (const db of b.axes) {
      const axis = cross(da, db),
        length = Math.hypot(...axis);
      if (length > 1e-5)
        max = Math.max(max, test(axis.map((n) => n / length) as V3));
    }
  return max;
}
export function resolveMount(p: Part, parts: Part[]): string | null {
  const a = bounds(p);
  let best: string | null = null,
    bestGap = Infinity;
  for (const part of parts) {
    const gap = separation(a, bounds(part));
    if (gap > 0.24) continue;
    if (part.id === p.parent) return part.id;
    const score = Math.abs(gap + 0.035);
    if (score < bestGap) {
      bestGap = score;
      best = part.id;
    }
  }
  return best;
}
export function placementError(
  p: Part,
  parts: Part[],
  allowance: number,
): string | null {
  return assemblyPlacementError([p], parts, allowance);
}
export function assemblyPlacementError(
  group: Part[],
  parts: Part[],
  allowance: number,
): string | null {
  if (
    parts.reduce((s, x) => s + partCost(x), 0) +
      group.reduce((s, x) => s + partCost(x), 0) >
    allowance
  )
    return "Not enough salvage for this component.";
  if (parts.length + group.length > 60)
    return "The 60-component build limit is reached.";
  const stationary = parts.map((part) => ({ id: part.id, box: bounds(part) }));
  let mounted = false;
  for (let i = 0; i < group.length; i++) {
    const test = bounds(group[i]);
    for (const { id, box } of stationary) {
      const gap = separation(test, box);
      const allowedOverlap = Math.min(
        0.16,
        Math.min(...test.half, ...box.half) * 1.1,
      );
      if (gap < -allowedOverlap)
        return "Parts overlap. Choose another mount or position.";
      if (i === 0 && gap <= 0.24 && id === group[0].parent) mounted = true;
    }
  }
  return mounted ? null : "No attachment. Move the part closer to the vehicle.";
}
export function translateAttachmentGroup(originals: Part[], root: Part) {
  const delta = root.pos.map((n, i) => n - originals[0].pos[i]);
  return [
    root,
    ...originals.slice(1).map((p) => ({
      ...p,
      pos: p.pos.map((n, i) => +(n + delta[i]).toFixed(3)) as V3,
    })),
  ];
}
export function propose(
  key: string,
  parts: Part[],
  anchorId: string | null,
): { part: Part; face: Face } {
  const p = makePart(uid(), key, [0, 0, 0]);
  const ordered = [...parts].sort(
    (a, b) =>
      (a.id === anchorId ? -2 : a.key === "core" ? -1 : 0) -
      (b.id === anchorId ? -2 : b.key === "core" ? -1 : 0),
  );
  for (const a of ordered)
    for (const f of FACES) {
      const candidate = snapPart(p, a, f);
      if (!placementError(candidate, parts, Infinity))
        return { part: candidate, face: f };
    }
  return { part: snapPart(p, ordered[0], "Top"), face: "Top" };
}
export function descendants(parts: Part[], id: string) {
  const ids = new Set([id]);
  for (let i = 0; i < parts.length; i++)
    for (const p of parts) if (p.parent && ids.has(p.parent)) ids.add(p.id);
  return ids;
}
export { opponent } from "./rivals";

const finite = (n: unknown, min = 0, max = 1e9): n is number =>
  typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;
const validLivery = (l: unknown): l is Livery => {
  if (!l || typeof l !== "object") return false;
  const v = l as Livery;
  const hex = (c: unknown) =>
    typeof c === "string" && /^#[0-9a-fA-F]{6}$/.test(c);
  return (
    hex(v.paint) &&
    hex(v.accent) &&
    hex(v.lights) &&
    PATTERNS.some((x) => x.key === v.pattern) &&
    DECALS.some((x) => x.key === v.decal) &&
    EXHAUSTS.some((x) => x.key === v.exhaust) &&
    HORNS.some((x) => x.key === v.horn) &&
    VICTORIES.some((x) => x.key === v.victory) &&
    typeof v.plate === "string" &&
    v.plate.length <= 12
  );
};
export function validVehicle(value: unknown): value is Vehicle {
  if (!value || typeof value !== "object") return false;
  const v = value as Vehicle;
  if (
    typeof v.name !== "string" ||
    !v.name.trim() ||
    v.name.length > 60 ||
    !Array.isArray(v.parts) ||
    v.parts.length === 0 ||
    v.parts.length > 60
  )
    return false;
  const ids = new Set<string>();
  let cores = 0;
  for (const p of v.parts) {
    if (
      !p ||
      typeof p !== "object" ||
      typeof p.id !== "string" ||
      !p.id ||
      p.id.length > 100 ||
      ids.has(p.id) ||
      typeof p.key !== "string" ||
      !Object.prototype.hasOwnProperty.call(DEF, p.key)
    )
      return false;
    ids.add(p.id);
    if (
      ![p.pos, p.rot, p.scale].every(
        (vec) =>
          Array.isArray(vec) &&
          vec.length === 3 &&
          vec.every((n) => finite(n, -999, 999)),
      ) ||
      !p.scale.every((n) => finite(n, 0.4, 2))
    )
      return false;
    if (p.key === "core") {
      if (p.parent !== null) return false;
      cores++;
    } else if (typeof p.parent !== "string") return false;
  }
  if (cores !== 1) return false;
  if (v.livery !== undefined && !validLivery(v.livery)) return false;
  const byId = new Map(v.parts.map((p) => [p.id, p]));
  for (const part of v.parts) {
    const seen = new Set<string>();
    let p: Part | undefined = part;
    while (p?.parent) {
      if (seen.has(p.id) || !byId.has(p.parent)) return false;
      seen.add(p.id);
      p = byId.get(p.parent);
    }
  }
  return true;
}
export function validProfile(value: unknown): value is Profile {
  if (!value || typeof value !== "object") return false;
  const p = value as Profile;
  if (
    p.version !== 1 ||
    typeof p.engineer !== "string" ||
    !p.engineer.trim() ||
    p.engineer.length > 32 ||
    !Number.isInteger(p.level) ||
    !finite(p.level, 1, 100) ||
    !finite(p.salvage, 30, 1e7) ||
    !finite(p.coins) ||
    !finite(p.xp) ||
    !finite(p.updated, 0, Number.MAX_SAFE_INTEGER) ||
    typeof p.completed !== "boolean" ||
    !validVehicle(p.vehicle) ||
    metrics(p.vehicle).cost > p.salvage
  )
    return false;
  if (
    !Array.isArray(p.garage) ||
    p.garage.length > GARAGE_SLOTS ||
    !p.garage.every(
      (b) =>
        validVehicle(b) &&
        typeof b.id === "string" &&
        finite(b.saved, 0, Number.MAX_SAFE_INTEGER) &&
        (b.slot === undefined || finite(b.slot, 0, GARAGE_SLOTS - 1)),
    )
  )
    return false;
  if (
    !Array.isArray(p.unlocked) ||
    !p.unlocked.every(
      (k) =>
        typeof k === "string" && Object.prototype.hasOwnProperty.call(DEF, k),
    )
  )
    return false;
  if (
    !Array.isArray(p.history) ||
    p.history.length > 500 ||
    !p.history.every(
      (r) =>
        r &&
        typeof r.id === "string" &&
        typeof r.win === "boolean" &&
        finite(r.level, 1, 100) &&
        finite(r.score) &&
        finite(r.rating) &&
        finite(r.duration, 0, 150) &&
        finite(r.broken, 0, 60) &&
        finite(r.at, 0, Number.MAX_SAFE_INTEGER) &&
        typeof r.opponent === "string" &&
        (r.driver === undefined || typeof r.driver === "string"),
    )
  )
    return false;
  if (
    p.records !== undefined &&
    (!Array.isArray(p.records) ||
      p.records.length > 100 ||
      !p.records.every(
        (r) =>
          r &&
          typeof r.name === "string" &&
          r.name.length <= 32 &&
          finite(r.level, 0, 100) &&
          finite(r.rating) &&
          finite(r.wins) &&
          finite(r.score),
      ))
  )
    return false;
  if (
    p.rivalMemory !== undefined &&
    (typeof p.rivalMemory !== "object" || p.rivalMemory === null)
  )
    return false;
  if (
    p.replays !== undefined &&
    (!Array.isArray(p.replays) ||
      p.replays.length > REPLAY_LIMIT ||
      !p.replays.every(
        (r) =>
          r &&
          typeof r.id === "string" &&
          finite(r.at, 0, Number.MAX_SAFE_INTEGER) &&
          finite(r.level, 1, 100) &&
          typeof r.win === "boolean" &&
          Array.isArray(r.frames) &&
          r.frames.length <= 600 &&
          Array.isArray(r.events) &&
          r.events.length <= 400 &&
          (r.damage === undefined ||
            (Array.isArray(r.damage) && r.damage.length <= 400)) &&
          validVehicle(r.player) &&
          validVehicle(r.rival),
      ))
  )
    return false;
  const s = p.settings;
  if (
    !s ||
    !["Low", "Medium", "High", "Ultra"].includes(s.quality) ||
    !finite(s.sound, 0, 100) ||
    !finite(s.crowd, 0, 100) ||
    ![s.muted, s.voice, s.shake].every((v) => typeof v === "boolean")
  )
    return false;
  if (s.cinematic !== undefined && typeof s.cinematic !== "boolean")
    return false;
  if (
    s.crowdQuality !== undefined &&
    !["Low", "Medium", "High"].includes(s.crowdQuality)
  )
    return false;
  if (s.cameraIntensity !== undefined && !finite(s.cameraIntensity, 0, 100))
    return false;
  if (s.countdownVolume !== undefined && !finite(s.countdownVolume, 0, 100))
    return false;
  if (s.announcerVolume !== undefined && !finite(s.announcerVolume, 0, 100))
    return false;
  if (s.motionBlur !== undefined && typeof s.motionBlur !== "boolean")
    return false;
  if (s.reducedMotion !== undefined && typeof s.reducedMotion !== "boolean")
    return false;
  return true;
}

export function recordMatch(
  records: EngineerRecord[],
  r: MatchResult,
): EngineerRecord[] {
  const name = r.driver || "Pip",
    old = records.find((x) => x.name === name) || {
      name,
      level: 0,
      rating: 0,
      wins: 0,
      score: 0,
    };
  const entry = {
    name,
    level: Math.max(old.level, r.win ? r.level : 0),
    rating: Math.max(old.rating, r.rating),
    wins: old.wins + (r.win ? 1 : 0),
    score: Math.max(old.score, r.score),
  };
  return [entry, ...records.filter((x) => x.name !== name)].slice(0, 100);
}
export function engineerRecords(p: Profile): EngineerRecord[] {
  if (p.records?.length) return p.records;
  return p.history.reduce<EngineerRecord[]>((a, r) => recordMatch(a, r), []);
}
