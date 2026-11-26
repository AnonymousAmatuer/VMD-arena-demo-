const fs = require("node:fs");
const assert = require("node:assert/strict");
const ts = require("typescript");
const { Vec3 } = require("cannon-es");
require.extensions[".ts"] = (m, f) =>
  m._compile(
    ts.transpileModule(fs.readFileSync(f, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
      },
    }).outputText,
    f,
  );
const D = require("../src/game/data.ts");
const { ArenaSimulation } = require("../src/game/simulation.ts");
const run = (sim, input, seconds = 1) => {
  for (let i = 0; i < seconds * 60; i++) {
    sim.advance(1 / 60, input);
    sim.events.length = 0;
  }
};
const heading = (body) => body.vectorToWorldFrame(new Vec3(0, 0, -1));
const partOf = (u, key, posTest = () => true) =>
  u.parts.find((p) => p.part.key === key && posTest(p));
const stock = D.starter();

// Independent attachment and wheel-specific failure consequences.
const base = new ArenaSimulation(stock, 1);
run(base, { gas: 1, steer: 0, fire: false, action: false }, 1.5);
const missingFront = new ArenaSimulation(stock, 1);
run(missingFront, { gas: 1, steer: 0, fire: false, action: false }, 0.3);
const frontWheel = partOf(
  missingFront.units[0],
  "wheel",
  (p) => p.part.pos[2] < 0 && p.part.pos[0] < 0,
);
const beforeMass = missingFront.units[0].body.mass,
  wheelMass = frontWheel.mass;
missingFront.damage(
  missingFront.units[0],
  frontWheel,
  1e6,
  missingFront.point(missingFront.units[0], frontWheel),
  true,
  "impact",
);
assert(frontWheel.debris, "failed wheel becomes an independent rigid body");
assert(frontWheel.debris.mass > 0, "wheel debris retains mass");
assert(
  !missingFront.units[0].body.shapes.includes(frontWheel.shape),
  "wheel shape is removed from the vehicle compound body",
);
assert(
  Math.abs(missingFront.units[0].body.mass - (beforeMass - wheelMass)) < 0.01,
  "vehicle mass drops with the lost wheel",
);
assert(
  frontWheel.debris.angularVelocity.length() > 0.5,
  "wheel keeps rotation after detaching",
);
assert(missingFront.extraDebris.length === 0);
run(missingFront, { gas: 1, steer: 0, fire: false, action: false }, 1.2);
const baseHeading = heading(base.units[0].body),
  missingHeading = heading(missingFront.units[0].body);
assert(
  Math.abs(missingHeading.x) > Math.abs(baseHeading.x) + 0.02,
  "front wheel loss causes uneven yaw instead of perfectly straight driving",
);
assert.notEqual(
  missingFront.units[0].driveState,
  "drive",
  "lost wheel is reflected in the operating state",
);
const baseDist = Math.abs(base.units[0].body.position.z - 8),
  missingDist = Math.abs(missingFront.units[0].body.position.z - 8);
assert(
  missingFront.units[0].body.velocity.length() <
    base.units[0].body.velocity.length() * 0.88,
  "missing a driven wheel strongly reduces achievable speed",
);
assert(
  missingDist > baseDist,
  "the lurching machine can travel off-axis, which must not be scripted back onto a rail",
);
console.log(
  "Wheel loss: independent spinning body, mass removed, asymmetric steering, reduced drive",
);

// Rotor damage reduces lift, and detaching a rotor sheds independent blades.
const air = D.starter();
air.parts.push(D.makePart("rotor_test", "rotor", [0, 1.8, 0], "turret"));
const freshFlight = new ArenaSimulation(air, 1),
  damagedFlight = new ArenaSimulation(air, 1);
const rotorLive = partOf(damagedFlight.units[0], "rotor");
damagedFlight.damage(
  damagedFlight.units[0],
  rotorLive,
  rotorLive.max * 0.58,
  damagedFlight.point(damagedFlight.units[0], rotorLive),
  true,
  "impact",
);
run(freshFlight, { gas: 0, steer: 0, fire: false, action: true }, 1.2);
run(damagedFlight, { gas: 0, steer: 0, fire: false, action: true }, 1.2);
assert(freshFlight.units[0].body.position.y > 1.35, "undamaged rotor lifts");
assert(
  damagedFlight.units[0].body.position.y <
    freshFlight.units[0].body.position.y - 0.05,
  "damaged rotor produces measurably less lift",
);
const rotorKill = new ArenaSimulation(air, 1),
  rotorPart = partOf(rotorKill.units[0], "rotor");
rotorKill.damage(
  rotorKill.units[0],
  rotorPart,
  1e6,
  rotorKill.point(rotorKill.units[0], rotorPart),
  true,
  "impact",
);
assert.equal(
  rotorKill.extraDebris.length,
  3,
  "three rotor blades become separate physical bodies",
);
assert(
  rotorKill.extraDebris.every(
    (d) => d.body.mass > 0 && rotorKill.world.bodies.includes(d.body),
  ),
);
console.log(
  "Rotor failure: lift falls with condition, complete loss creates three physical blades",
);

// Material-dependent response to the same cut.
const woodV = { name: "w", parts: [D.makePart("chassis","core",[0,0,0],null), D.makePart("plank","hardwood",[0,0.6,0.5],"chassis")] };
const steelV = { name: "s", parts: [D.makePart("chassis","core",[0,0,0],null), D.makePart("plate","steel",[0,0.6,0.5],"chassis")] };
const wooden = new ArenaSimulation(woodV, 1), steel = new ArenaSimulation(steelV, 15);
const woodPart = partOf(wooden.units[0], "hardwood"),
  steelPart = partOf(steel.units[0], "steel");
woodPart.hp = woodPart.max;
steelPart.hp = steelPart.max;
wooden.damage(
  wooden.units[0],
  woodPart,
  20,
  wooden.point(wooden.units[0], woodPart),
  false,
  "cut",
);
steel.damage(
  steel.units[0],
  steelPart,
  20,
  steel.point(steel.units[0], steelPart),
  false,
  "cut",
);
const woodDamage = woodPart.max - woodPart.hp,
  steelDamage = steelPart.max - steelPart.hp;
assert(
  woodDamage > steelDamage * 1.25,
  `wood should lose more to a cut than steel (${woodDamage} vs ${steelDamage})`,
);
console.log(
  "Material solver: same 20 cut damage removes",
  woodDamage.toFixed(1),
  "wood but only",
  steelDamage.toFixed(1),
  "steel",
);

// Structural support: children become independent bodies when the connection fails.
const tree = D.starter();
tree.parts.push(
  D.makePart("trunk", "steel", [0, 0.62, 0.4], "shell"),
  D.makePart("topper", "crate", [0, 1.4, 0.4], "trunk"),
  D.makePart("flag", "cardboard", [0, 2.1, 0.4], "topper"),
);
const collapse = new ArenaSimulation(tree, 1),
  u = collapse.units[0];
const trunk = partOf(u, "steel", (p) => p.part.pos[1] > 0.5),
  topper = partOf(u, "crate"),
  flag = partOf(u, "cardboard");
collapse.damage(u, trunk, 1e6, collapse.point(u, trunk), false, "impact");
assert(
  trunk.debris && topper.debris && flag.debris,
  "unsupported children leave the body with their failed parent",
);
assert(
  !u.body.shapes.some((s) => [trunk, topper, flag].some((p) => p.shape === s)),
  "collapsed structure is no longer rigidly supported",
);
console.log(
  "Structural cascade: parent failure independently releases every unsupported child",
);

// Power architecture, battery loss, jamming, and projectile mechanisms.
const powered = D.starter();
powered.parts.push(
  D.makePart("bat", "battery_i", [0.7, 0.5, 1.2], "chassis"),
  D.makePart("gen", "generator", [-0.7, 0.5, 1.2], "chassis"),
);
const psim = new ArenaSimulation(powered, 1);
psim.advance(0.1, { gas: 0, steer: 0, fire: false, action: false });
assert(
  psim.units[0].powerMax > 200,
  "battery adds energy capacity to the live unit",
);
assert(
  psim.units[0].powerGen > 30,
  "generator adds regeneration to the live unit",
);
const battery = partOf(psim.units[0], "battery_i");
const beforeCap = psim.units[0].powerMax;
psim.damage(
  psim.units[0],
  battery,
  1e6,
  psim.point(psim.units[0], battery),
  false,
  "impact",
);
psim.advance(0.1, { gas: 0, steer: 0, fire: false, action: false });
assert(
  psim.units[0].powerMax < beforeCap - 100,
  "destroyed battery immediately removes its capacity",
);
console.log(
  "Power architecture: capacity",
  Math.round(beforeCap),
  "falls to",
  Math.round(psim.units[0].powerMax),
  "when the battery is destroyed",
);

const jam = new ArenaSimulation(stock, 1),
  gun = partOf(jam.units[0], "saw");
gun.hp = gun.max * 0.08;
let jammed = false;
for (let i = 0; i < 600 && !jammed; i++) {
  jam.advance(1 / 60, { gas: 0, steer: 0, fire: true, action: false });
  jammed = jam.events.some((e) => e.type === "jam");
  jam.events.length = 0;
}
assert(
  jammed,
  "a severely damaged weapon must eventually jam instead of firing perfectly",
);
console.log("Conditional weapon failure: damaged saw jams");

for (const def of D.CATALOG.filter((d) => d.category === "Weapons")) {
  const v = D.starter();
  v.parts = v.parts.filter((p) => D.DEF[p.key].category !== "Weapons");
  v.parts.push(D.makePart("test_weapon", def.key, [0, 1.25, -0.4], "shell"));
  const sim = new ArenaSimulation(v, 1);
  sim.brain = null;
  sim.units[0].body.position.set(0, 1, 0.9);
  sim.units[1].body.position.set(0, 1, -0.9);
  let fired = 0;
  for (let i = 0; i < 420 && !sim.finished; i++) {
    sim.advance(1 / 60, { gas: 0.3, steer: 0, fire: true, action: false });
    fired += sim.events.filter(
      (e) => e.type === "fire" && e.owner === 0,
    ).length;
    sim.events.length = 0;
  }
  assert(
    fired > 0 && sim.damageDealt > 0,
    `${def.name} must fire and deal physical damage`,
  );
}
console.log(
  "All",
  D.CATALOG.filter((d) => d.category === "Weapons").length,
  "weapons fire and damage with their own behavior",
);
console.log(
  "PASS: independent wheel physics, rotor lift failure, material damage multipliers, structural collapse, power loss, jamming, and every weapon behavior.",
);
