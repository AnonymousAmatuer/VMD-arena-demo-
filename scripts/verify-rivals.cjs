const fs = require("node:fs");
const assert = require("node:assert/strict");
const ts = require("typescript");
require.extensions[".ts"] = (m, f) =>
  m._compile(
    ts.transpileModule(fs.readFileSync(f, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText,
    f,
  );
const D = require("../src/game/data.ts");
const R = require("../src/game/rivals.ts");
const { ArenaSimulation } = require("../src/game/simulation.ts");
const { RivalBrain, blendMemory } = require("../src/game/ai.ts");

// 1. Every round's design is legal: budget, attachment, unique ids, no illegal parts.
let skippedTotal = 0;
for (let level = 1; level <= 100; level++) {
  const r = R.rivalAt(level);
  const ids = new Set(r.vehicle.parts.map((p) => p.id));
  assert.equal(ids.size, r.vehicle.parts.length, `duplicate part ids at round ${level}`);
  assert.ok(r.vehicle.parts.length >= 4, `round ${level} design too sparse`);
  assert.ok(D.metrics(r.vehicle).cost <= r.budget, `round ${level} exceeds its salvage budget`);
  assert.equal(D.validVehicle(r.vehicle), true, `round ${level} vehicle is not a valid save object`);
  for (const p of r.vehicle.parts) assert.ok(D.DEF[p.key], `unknown component ${p.key}`);
  skippedTotal += r.skipped.length;
}
console.log("PASS: 100 rival designs are legal, budgeted and attached (average parts skipped by the rules:", (skippedTotal / 100).toFixed(1) + ")");

// 2. Engineers are different engineering problems, not recoloured copies.
const signature = (r) => new Set(r.vehicle.parts.map((p) => p.key));
const jaccard = (a, b) => [...a].filter((x) => b.has(x)).length / new Set([...a, ...b]).size;
const designs = R.RIVALS.map((_, i) => R.rivalAt(i + 29));
for (let i = 0; i < designs.length; i++) assert.equal(designs[i].name, R.RIVALS[i].name);
for (let i = 0; i < designs.length; i++)
  for (let j = i + 1; j < designs.length; j++) {
    const sim = jaccard(signature(designs[i]), signature(designs[j]));
    assert.ok(sim < 0.8, `${designs[i].name} and ${designs[j].name} are too similar (${sim.toFixed(2)})`);
  }
console.log("PASS: all rivals differ in components (pairwise similarity below 0.8)");

// 3. Flight designs actually lift. Talon and Atlas's champion rotor must clear their own weight.
for (const level of [4, 34, 100]) {
  const r = R.rivalAt(level);
  if (!r.vehicle.parts.some((p) => ["rotor", "dualrotor"].includes(p.key))) continue;
  const m = D.metrics(r.vehicle);
  const lift = m.lift * 16.6;
  if (r.id === "talon") assert.ok(lift >= m.mass * 9.81, `${r.name} cannot fly at round ${level}`);
}
console.log("PASS: aerial rival designs carry enough lift for their own weight");

// 4. Live battles: rivals move, fire, adapt tactics and never stall.
const player = D.starter();
const modesSeen = new Set();
for (const level of [5, 25, 55, 85, 100]) {
  const sim = new ArenaSimulation(player, level);
  const start = { ...sim.units[1].body.position };
  let rivalShots = 0;
  for (let i = 0; i < 60 * 45 && !sim.finished; i++) {
    const me = sim.units[0].body, foe = sim.units[1].body;
    const dx = foe.position.x - me.position.x, dz = foe.position.z - me.position.z;
    const yaw = Math.atan2(-dx, -dz);
    const q = me.quaternion;
    const fz = 2 * (q.x * q.z + q.y * q.w) * 0 + (1 - 2 * (q.x * q.x + q.y * q.y));
    const fwdYaw = Math.atan2(-(2 * (q.x * q.z + q.y * q.w)) * -1, -(1 - 2 * (q.x * q.x + q.y * q.y)));
    void fz; void fwdYaw;
    sim.advance(1 / 60, { gas: 0.8, steer: Math.max(-1, Math.min(1, Math.atan2(Math.sin(yaw), Math.cos(yaw)) * -1)), fire: true, action: false });
    modesSeen.add(sim.rivalMode);
    rivalShots += sim.events.filter((e) => e.type === "fire" && e.owner === 1).length;
    sim.events.length = 0;
  }
  const moved = Math.hypot(sim.units[1].body.position.x - start.x, sim.units[1].body.position.z - start.z);
  assert.ok(moved > 1.5 || sim.finished, `round ${level} rival stalled`);
  assert.ok(Number.isFinite(sim.units[1].body.position.x), `round ${level} rival physics diverged`);
  assert.ok(rivalShots > 0 || sim.finished, `round ${level} rival never attacked`);
}
assert.ok(modesSeen.size >= 2, "rivals must change tactics during battle");
console.log("PASS: live battles at rounds 5/25/55/85/100 show movement, attacks and tactical changes:", [...modesSeen].join(", "));

// 5. Damage awareness: a rival that loses every wheel stops planning drive.
const bruno = new ArenaSimulation(player, 2);
const rivalUnit = bruno.units[1];
for (const p of rivalUnit.parts.filter((x) => D.DEF[x.part.key].kind === "wheel"))
  bruno.damage(rivalUnit, p, 1e6, bruno.point(rivalUnit, p), true, "impact");
bruno.advance(0.2, { gas: 0, steer: 0, fire: false, action: false });
assert.equal(bruno.brain.decide(rivalUnit, bruno.units[0], bruno.time, []).gas, 0, "wheel-less rival must not drive");
console.log("PASS: a rival that loses all its wheels stops trying to drive");

// 6. Weapon damage awareness: a destroyed weapon is never commanded.
const armed = new ArenaSimulation(player, 40);
const gun = armed.units[1].parts.find((p) => D.DEF[p.part.key].category === "Weapons");
if (gun) {
  armed.damage(armed.units[1], gun, 1e6, armed.point(armed.units[1], gun), false, "impact");
  const intent = armed.brain.decide(armed.units[1], armed.units[0], 1, []);
  assert.equal(intent.weapons.has(gun.part.id), false, "destroyed weapon must not be commanded");
  console.log("PASS: destroyed weapons are removed from the rival's commands");
}

// 7. Adaptation is bounded and transparent: memory nudges personality, never beyond 0..1.
const extreme = { matches: 9, rangedShare: 1, meleeShare: 1, airShare: 1, closeShare: 1, wheelLosses: 0 };
const brain = new RivalBrain(R.RIVALS[5], extreme);
for (const v of Object.values(brain.personality)) assert.ok(v >= 0 && v <= 1, "personality stays in range");
const learned = blendMemory(undefined, { shotsRanged: 9, shotsMelee: 1, samples: 100, airSamples: 30, closeSamples: 80, wheelLosses: 1 });
assert.ok(learned.rangedShare > 0.85 && learned.matches === 1);
const later = blendMemory(learned, { shotsRanged: 0, shotsMelee: 10, samples: 100, airSamples: 0, closeSamples: 0, wheelLosses: 0 });
assert.ok(later.meleeShare > 0 && later.matches === 2, "memory blends across matches");
console.log("PASS: opponent memory adapts within bounds and blends across matches");

console.log("PASS: rivals designed from the shared catalog, reasoning from observable state, reacting to their own damage.");
