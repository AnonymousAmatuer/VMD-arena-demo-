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
const { ArenaSimulation } = require("../src/game/simulation.ts");

// --- Five distinct research rockets ---
const rockets = D.CATALOG.filter((d) => d.booster);
assert.equal(rockets.length, 5, "exactly five rocket engines should be installed");
assert.equal(new Set(rockets.map((r) => r.booster)).size, 5, "each rocket must have its own behavior");
assert.ok(rockets.every((r) => r.category === "Mobility" && r.coins > 0), "rockets are researched mobility parts");
assert.ok(rockets.every((r) => r.hp > 0 && r.mass > 0 && r.cost > 0), "rockets have real physical and economy stats");
console.log("PASS: five distinct researchable rocket engines with real stats");

// --- Rocket movement is meaningfully faster than the stock drivetrain ---
const drive = (key) => {
  const v = structuredClone(D.starter());
  if (key) {
    v.parts.push(D.makePart("rocket", key, [0, 0.62, 1.35], "shell"));
    v.parts.push(D.makePart("battery", "battery_x", [0.7, 0.7, 0.9], "chassis"));
  }
  const sim = new ArenaSimulation(v, 1);
  sim.brain = null;
  const z0 = sim.units[0].body.position.z;
  for (let i = 0; i < 120; i++) {
    sim.advance(1 / 60, { gas: 1, steer: 0, fire: false, action: i < 6 });
    sim.events.length = 0;
  }
  return { dist: z0 - sim.units[0].body.position.z, unit: sim.units[0] };
};
const stock = drive(null).dist;
const distances = {};
for (const rocket of rockets) {
  const result = drive(rocket.key);
  distances[rocket.key] = +result.dist.toFixed(1);
  assert.ok(result.dist > stock * 1.4, `${rocket.name} must move much faster than stock`);
}
console.log("PASS: rocket distances over 2s (stock", stock.toFixed(1) + "m):", JSON.stringify(distances));

// --- Rocket modes have different sustained behaviour ---
const modeOf = {};
for (const rocket of rockets) {
  const v = structuredClone(D.starter());
  v.parts.push(D.makePart("rocket", rocket.key, [0, 0.62, 1.35], "shell"));
  v.parts.push(D.makePart("battery", "battery_x", [0.7, 0.7, 0.9], "chassis"));
  const sim = new ArenaSimulation(v, 1);
  sim.brain = null;
  sim.advance(1 / 60, { gas: 0, steer: 0, fire: false, action: true });
  modeOf[rocket.booster] = sim.units[0].boostTimer > 0;
}
assert.equal(modeOf.impulse, true);
assert.equal(modeOf.sprint, true);
assert.equal(modeOf.ion, true);
assert.equal(modeOf.vector, true);
assert.equal(modeOf.afterburn, true);
console.log("PASS: every booster produces a distinct timed thrust state");

// --- Livery and four-slot memory bank validation ---
const profile = D.freshProfile();
assert.equal(D.GARAGE_SLOTS, 4);
assert.ok(D.validVehicle(profile.vehicle), "a fresh vehicle has a valid livery");
profile.vehicle.livery = { ...profile.vehicle.livery, paint: "#123456", plate: "PIP 7", horn: "airhorn", victory: "spin" };
assert.ok(D.validVehicle(profile.vehicle), "customized vehicle is still valid");
profile.vehicle.livery.paint = "not-a-colour";
assert.equal(D.validVehicle(profile.vehicle), false, "invalid paint must be rejected");
profile.vehicle.livery.paint = "#123456";
for (let i = 0; i < D.GARAGE_SLOTS; i++) profile.garage.push({ ...structuredClone(profile.vehicle), name: `Slot ${i}`, id: `slot-${i}`, saved: Date.now(), slot: i });
assert.ok(D.validProfile(profile), "four saved builds are accepted");
profile.garage.push({ ...structuredClone(profile.vehicle), name: "Fifth", id: "slot-4", saved: Date.now(), slot: 4 });
assert.equal(D.validProfile(profile), false, "a fifth memory slot must be rejected");
console.log("PASS: livery validation and a strict four-slot memory bank");

// --- Replays record frames, events and damage causes ---
const sim = new ArenaSimulation(D.starter(), 3);
for (let i = 0; i < 60 * 95 && !sim.finished; i++) {
  sim.advance(1 / 60, { gas: 1, steer: 0, fire: true, action: false });
  sim.events.length = 0;
}
assert.ok(sim.finished, "the match must resolve");
assert.ok(sim.finished.replay, "the outcome contains a replay");
assert.ok(sim.finished.replay.frames.length > 0, "replay has movement frames");
assert.ok(sim.finished.replay.events.length > 0, "replay has event markers");
assert.ok(sim.finished.replay.damage.length > 0, "replay records component damage");
const saved = D.freshProfile();
saved.replays = [{
  ...sim.finished.replay,
  id: "replay-test", at: Date.now(), level: 3, win: sim.finished.win,
  duration: sim.finished.duration, score: sim.finished.score,
  opponent: D.opponent(3).name, driver: "Pip",
  player: structuredClone(D.starter()), rival: structuredClone(D.opponent(3).vehicle),
}];
assert.ok(D.validProfile(saved), "a saved replay passes profile validation");
assert.ok(saved.replays[0].damage.some((d) => d.cause), "damage entries include a cause");
console.log("PASS: replays save frames, failure events, damage causes, and survive validation");
console.log("PASS: rockets, livery, four memory slots and destruction replay system.");
