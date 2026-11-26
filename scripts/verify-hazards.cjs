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
const H = require("../src/game/hazards.ts");
const { ArenaSimulation } = require("../src/game/simulation.ts");

const IDLE = { gas: 0, steer: 0, fire: false, action: false };
const step = (sim, seconds) => {
  for (let t = 0; t < seconds; t += 0.05) {
    sim.advance(0.05, IDLE);
    sim.events.length = 0;
  }
};
function place(u, x, z, yaw, speed = 0) {
  const f = { x: -Math.sin(yaw), z: -Math.cos(yaw) };
  u.body.position.set(x, 1.0, z);
  u.body.quaternion.setFromEuler(0, yaw, 0);
  u.body.velocity.set(f.x * speed, 0, f.z * speed);
  u.body.angularVelocity.setZero();
}
const fresh = () => {
  const sim = new ArenaSimulation(D.starter(), 1);
  sim.brain = null;
  sim.units[1].body.position.set(0, 1, -50);
  return sim;
};

// 1. Arena radius is exactly 1.5x the previous radius.
assert.equal(D.ARENA_PREVIOUS_RADIUS, 42.9);
assert.equal(D.ARENA_RADIUS, 64.35);
assert.ok(Math.abs(D.ARENA_RADIUS / D.ARENA_PREVIOUS_RADIUS - 1.5) < 1e-9);
console.log("PASS: arena radius is 1.5x the previous radius (", D.ARENA_RADIUS, ")");

// 2. Dash pad: 150% speed boost for 0.7 seconds.
{
  const sim = fresh();
  const u = sim.units[0];
  const pad = H.DASH_PADS[0];
  const f = H.padForward(pad);
  place(u, pad.x, pad.z, pad.yaw, 8);
  sim.advance(0.05, IDLE);
  sim.events.length = 0;
  const along = u.body.velocity.x * f.x + u.body.velocity.z * f.z;
  assert.ok(along >= 8 * H.DASH_MULTIPLIER * 0.95, `dash raises speed to ${along.toFixed(1)}`);
  assert.ok(u.dashTimer > 0.6 && u.dashTimer <= 0.7, "dash lasts 0.7 seconds");
  step(sim, 0.8);
  assert.equal(u.dashTimer, 0, "dash expires");
  console.log("PASS: dash pad boosts speed by 150% for 0.7s (", along.toFixed(1), "units/s )");
}

// 3. Jump pad: launches into the air, landing prediction matches physics.
{
  const sim = fresh();
  const u = sim.units[0];
  const pad = H.JUMP_PADS[0];
  place(u, pad.x, pad.z, pad.yaw, 0);
  sim.advance(0.05, IDLE);
  sim.events.length = 0;
  assert.ok(u.body.velocity.y >= 10, "jump pad launches the vehicle upward");
  let peak = 0;
  let landedAt = null;
  for (let t = 0; t < 3; t += 0.05) {
    sim.advance(0.05, IDLE);
    sim.events.length = 0;
    peak = Math.max(peak, u.body.position.y);
    if (landedAt === null && t > 0.5 && u.body.position.y < 1.2) landedAt = t;
  }
  assert.ok(peak > 3.2, `vehicle clears obstacles (apex ${peak.toFixed(2)})`);
  assert.ok(landedAt !== null, "vehicle lands again");
  const predicted = H.predictLanding(0, 1.0, 0, 0, 12, 0, 0.9);
  assert.ok(predicted && predicted.t > 1.4 && predicted.t < 1.7, "landing shadow prediction is physically plausible");
  const measured = (() => { let t = 0; let y = 1.0; let v = 12; while (y > 0.9 && t < 5) { v -= 15.8 * 0.001; y += v * 0.001; t += 0.001; } return t; })();
  assert.ok(Math.abs(measured - predicted.t) < 0.03, "landing prediction matches integrated flight time");
  console.log("PASS: jump pad apex", peak.toFixed(2), "m, landing at", landedAt.toFixed(2), "s");
}

// 4. Teleport pad: paired destination, matched colours, 10 second cooldown.
{
  const sim = fresh();
  const u = sim.units[0];
  const pair = H.TELEPORT_PAIRS[0];
  place(u, pair.a.x, pair.a.z, pair.a.yaw, 0);
  sim.advance(0.05, IDLE);
  sim.events.length = 0;
  const near = (p) => Math.hypot(u.body.position.x - p.x, u.body.position.z - p.z);
  assert.ok(near(pair.b) < 5, `teleported to the paired pad (${near(pair.b).toFixed(1)}m away)`);
  assert.ok(u.teleportCooldown > 9.8 && u.teleportCooldown <= 10, "teleport cooldown starts at 10s");
  place(u, pair.a.x, pair.a.z, pair.a.yaw, 0);
  step(sim, 0.2);
  assert.ok(near(pair.a) < 5, "cooldown prevents a repeat teleport");
  assert.equal(H.TELEPORT_PAIRS.every((p) => p.color && p.a && p.b), true);
  console.log("PASS: teleport pads transport to the pair and respect the 10s cooldown");
}

// 5. Clone portal: clone is AI-controlled, lasts six seconds, then expires.
{
  const sim = fresh();
  const u = sim.units[0];
  place(u, H.PORTAL.x, H.PORTAL.z, H.PORTAL.yaw, 0);
  sim.advance(0.05, IDLE);
  sim.events.length = 0;
  assert.ok(sim.clone, "entering the portal spawns a clone");
  assert.equal(sim.clone.isClone, true);
  assert.equal(sim.clone.parts.length, u.parts.length, "the clone copies the vehicle");
  const start = { x: sim.clone.body.position.x, z: sim.clone.body.position.z };
  step(sim, 2.5);
  const moved = Math.hypot(sim.clone.body.position.x - start.x, sim.clone.body.position.z - start.z);
  assert.ok(moved > 0.5, `clone moves under AI control (${moved.toFixed(1)}m)`);
  step(sim, 3.8);
  assert.equal(sim.clone, null, "clone expires after six seconds");
  console.log("PASS: clone portal spawns an AI clone that moves and expires after 6s");
}

// 6. Spike ring damages the chassis moderately on contact.
{
  const sim = fresh();
  const u = sim.units[0];
  const core = u.parts.find((p) => p.part.key === "core");
  const hp0 = core.hp;
  place(u, 0, D.ARENA_RADIUS - 1.2, Math.PI, 0);
  sim.advance(0.05, IDLE);
  sim.events.length = 0;
  const lost = hp0 - core.hp;
  assert.ok(lost >= 2 && lost <= 12, `spikes deal moderate chassis damage (${lost.toFixed(1)})`);
  assert.ok(sim.damageLog.some((d) => d.cause === "arena spikes"), "spike damage is recorded with its cause");
  console.log("PASS: spike ring damages the chassis by", lost.toFixed(1));
}

console.log("PASS: dash pads, jump pads, teleporters, clone portal and spike boundary behave as specified.");
