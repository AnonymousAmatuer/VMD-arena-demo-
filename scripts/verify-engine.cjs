const fs = require("fs"),
  ts = require("typescript"),
  assert = require("node:assert/strict");
require.extensions[".ts"] = (mod, file) =>
  mod._compile(
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
      },
    }).outputText,
    file,
  );
const D = require("../src/game/data.ts"),
  { ArenaSimulation, idleInput } = require("../src/game/simulation.ts");
const start = D.starter(),
  m = D.metrics(start);
assert.equal(m.cost, 23);
assert.equal(start.parts.length, 8);
assert(D.validProfile(D.freshProfile()));
const longRoundProfile = D.freshProfile();
longRoundProfile.history.push({
  id: "round-150",
  level: 1,
  win: false,
  score: 0,
  rating: 0,
  duration: 150,
  broken: 0,
  at: 1,
  opponent: "Test rival",
});
assert(D.validProfile(longRoundProfile), "150-second match results remain valid");
for (const def of D.CATALOG) {
  const { part } = D.propose(def.key, start.parts, null);
  assert.equal(
    D.placementError(part, start.parts, 100),
    null,
    def.name + " placement",
  );
  assert(D.placementError(part, start.parts, 1), "budget enforced");
  const rotated = { ...part, rot: [15, 30, 45], scale: [1.1, 0.9, 1] };
  assert(D.extents(rotated).every((n) => n > 0 && Number.isFinite(n)));
}
assert(
  D.placementError(
    { ...D.makePart("overlap", "iron", [0, 0, 0]) },
    start.parts,
    100,
  ),
);
assert(
  D.placementError(
    D.makePart("far", "iron", [100, 100, 100]),
    start.parts,
    100,
  ),
);
assert(D.descendants(start.parts, "shell").has("turret"));
for (let level = 1; level <= 100; level++) {
  const sim = new ArenaSimulation(start, level);
  assert.equal(sim.units.length, 2);
  const z0 = sim.units[0].body.position.z;
  for (let i = 0; i < 55; i++)
    sim.advance(1 / 60, { gas: 1, steer: 0, fire: true, action: false });
  assert(Number.isFinite(sim.units[0].body.position.z));
  assert(sim.units[0].body.position.z < z0 - 3, "vehicle accelerates");
  assert(
    Math.hypot(sim.units[0].body.position.x, sim.units[0].body.position.z) < 60,
    "vehicle stays inside the doubled arena",
  );
}
for (const level of [1, 5, 20, 60, 100]) {
  const sim = new ArenaSimulation(start, level);
  let detached = 0;
  for (let i = 0; i <= sim.duration * 60 && !sim.finished; i++) {
    const b = sim.units[0].body,
      e = sim.units[1].body,
      d = e.position.vsub(b.position),
      f = b.vectorToWorldFrame(new (require("cannon-es").Vec3)(0, 0, -1)),
      angle = Math.atan2(-d.x, -d.z) - Math.atan2(-f.x, -f.z),
      steer = Math.max(
        -1,
        Math.min(1, Math.atan2(Math.sin(angle), Math.cos(angle)) * 2),
      );
    sim.advance(1 / 60, {
      gas: d.length() > 3 ? 0.7 : 0,
      steer,
      fire: true,
      action: false,
    });
    detached += sim.events.filter((x) => x.type === "break").length;
    sim.events.length = 0;
  }
  assert(sim.finished);
  assert(sim.damageDealt > 0);
  assert(detached > 0);
  console.log(
    "Round",
    level,
    JSON.stringify({ win: sim.finished.win, duration: sim.finished.duration, score: sim.finished.score }),
    "physical detachments",
    detached,
  );
}
const sim = new ArenaSimulation(start, 1),
  enemy = sim.units[1],
  target = enemy.parts.find((p) => /wheel/.test(p.part.key));
sim.damage(enemy, target, 10000, sim.point(enemy, target));
assert(target.debris && sim.world.bodies.includes(target.debris));
assert(!enemy.body.shapes.includes(target.shape));
sim.damage(enemy, enemy.parts[0], 10000, enemy.body.position);
assert(sim.finished.win);
const loss = new ArenaSimulation(start, 1);
loss.damage(
  loss.units[0],
  loss.units[0].parts[0],
  1e6,
  loss.units[0].body.position,
);
assert.equal(loss.finished.win, false);
const aircraft = D.starter();
aircraft.parts.push(D.makePart("lift", "rotor", [0, 1.8, 0], "turret"));
const flight = new ArenaSimulation(aircraft, 1);
for (let i = 0; i < 150; i++) {
  flight.advance(1 / 60, { gas: 0, steer: 0, fire: false, action: true });
  flight.events.length = 0;
}
assert(flight.units[0].body.position.y > 2, "rotor generates lift");
console.log(
  "PASS: 29 catalog entries, placement, budget, attachments, transforms, 100 playable rounds, movement, impacts, destruction, flight, victory and defeat.",
);
