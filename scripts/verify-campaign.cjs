const fs = require("fs"),
  ts = require("typescript"),
  assert = require("node:assert/strict"),
  { Vec3 } = require("cannon-es");
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
const D = require("../src/game/data.ts"),
  { ArenaSimulation } = require("../src/game/simulation.ts");
const report = { rounds: [], weapons: [], passed: false };
for (let level = 1; level <= 100; level++) {
  const sim = new ArenaSimulation(D.starter(), level);
  for (let i = 0; i <= sim.duration * 60 && !sim.finished; i++) {
    const b = sim.units[0].body,
      d = sim.units[1].body.position.vsub(b.position),
      f = b.vectorToWorldFrame(new Vec3(0, 0, -1)),
      angle = Math.atan2(-d.x, -d.z) - Math.atan2(-f.x, -f.z);
    sim.advance(1 / 60, {
      gas: d.length() > 3 ? 0.7 : 0,
      steer: Math.max(
        -1,
        Math.min(1, Math.atan2(Math.sin(angle), Math.cos(angle)) * 2),
      ),
      fire: true,
      action: false,
    });
    sim.events.length = 0;
  }
  assert(sim.finished, `Round ${level} must resolve`);
  assert(sim.units.length === 2);
  assert(
    sim.units.every((u) =>
      [u.body.position.x, u.body.position.y, u.body.position.z].every(
        Number.isFinite,
      ),
    ),
  );
  report.rounds.push({ level, ...sim.finished });
}
for (const d of D.CATALOG.filter((d) => d.category === "Weapons")) {
  const v = D.starter();
  v.parts = v.parts.filter((p) => D.DEF[p.key].category !== "Weapons");
  v.parts.push(D.makePart("test-weapon", d.key, [0, 1.25, -0.4], "shell"));
  const sim = new ArenaSimulation(v, 1);
  sim.brain = null;
  // Isolate the weapon: the machine holds still and the idle rival stands in reach.
  sim.units[0].body.position.set(0, 1, 0);
  sim.units[1].body.position.set(0, 1, -2.2);
  let fired = 0;
  for (let i = 0; i < 300 && !sim.finished; i++) {
    sim.advance(1 / 60, { gas: 0, steer: 0, fire: true, action: false });
    fired += sim.events.filter(
      (e) => e.type === "fire" && e.owner === 0,
    ).length;
    sim.events.length = 0;
  }
  assert(
    fired > 0 && sim.damageDealt > 0,
    d.name + " must fire and damage the rival",
  );
  report.weapons.push({
    name: d.name,
    activations: fired,
    damage: Math.round(sim.damageDealt),
  });
}
const invalid = D.freshProfile();
invalid.vehicle.parts[1].parent = "missing";
assert.equal(D.validProfile(invalid), false);
invalid.vehicle.parts[1].parent = invalid.vehicle.parts[1].id;
assert.equal(D.validProfile(invalid), false);
invalid.vehicle.parts = [null];
assert.equal(D.validProfile(invalid), false);
const valid = D.freshProfile();
assert(D.validProfile(valid));
report.passed = true;
fs.mkdirSync("artifacts", { recursive: true });
fs.writeFileSync(
  "artifacts/campaign-verification.json",
  JSON.stringify(report, null, 2),
);
console.log(
  "PASS: all 100 championship rounds completed with finite physics and exactly two contestants.",
);
console.log(
  "PASS:",
  report.weapons.length,
  "distinct weapons fired and inflicted damage.",
);
console.log("PASS: malformed, missing-parent, and cyclic saves rejected.");
