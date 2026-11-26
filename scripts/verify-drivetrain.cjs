const fs = require("node:fs");
const assert = require("node:assert/strict");
const { Vec3 } = require("cannon-es");
const ts = require("typescript");
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
const stock = D.starter();
const drive = (gas, steer) => {
  const sim = new ArenaSimulation(stock, 1);
  const body = sim.units[0].body;
  const z0 = body.position.z;
  for (let i = 0; i < 45; i++) sim.advance(1 / 60, { gas, steer, fire: false, action: false });
  body.__z0 = z0;
  return body;
};
const forward = drive(1, 0),
  reverse = drive(-1, 0),
  left = drive(0, 1),
  right = drive(0, -1);
assert(
  forward.position.z < forward.__z0 - 3 && forward.velocity.z < -7,
  "forward must move and accelerate against the actual arena floor",
);
assert(
  reverse.position.z > reverse.__z0 + 2.4 && reverse.velocity.z > 4,
  "reverse must move without needing to hop",
);
assert(
  left.quaternion.vmult(new Vec3(0, 0, -1)).x < -0.7,
  "left must turn from rest",
);
assert(
  right.quaternion.vmult(new Vec3(0, 0, -1)).x > 0.7,
  "right must turn from rest",
);
const irregular = new ArenaSimulation(
  {
    ...stock,
    parts: [...stock.parts, D.makePart("skid", "crate", [0, -0.91, 0])],
  },
  1,
);
const skidZ = irregular.units[0].body.position.z;
for (let i = 0; i < 45; i++)
  irregular.advance(1 / 60, { gas: 1, steer: 0, fire: false, action: false });
assert(
  irregular.units[0].body.position.z < skidZ - 0.7,
  "a belly-grounded custom build can creep instead of being stuck",
);
const noDrive = new ArenaSimulation(
  { ...stock, parts: stock.parts.slice(0, 1) },
  1,
);
noDrive.advance(0.1, { gas: 1, steer: 0, fire: false, action: false });
assert.equal(noDrive.units[0].driveState, "none");
const anchor = stock.parts[0],
  template = D.makePart("test", "crate", [0, 0, 0]);
const leftMount = D.snapPartAt(
    template,
    anchor,
    "Front",
    [-0.25, 0.08, -1.675],
    0.25,
  ),
  rightMount = D.snapPartAt(
    template,
    anchor,
    "Front",
    [0.56, 0.08, -1.675],
    0.25,
  );
assert.equal(leftMount.pos[0], -0.25);
assert.equal(rightMount.pos[0], 0.5);
assert.equal(rightMount.pos[2], leftMount.pos[2]);
assert.equal(D.placementError(rightMount, stock.parts, 30), null);
assert.equal(
  D.placementError(rightMount, stock.parts, 23),
  "Not enough salvage for this component.",
);
const custom = D.snapPartAt(
  template,
  anchor,
  "Front",
  [0.565, 0.094, -1.675],
  0,
);
assert.equal(custom.pos[0], 0.565);
assert.equal(custom.pos[1], 0.094);
const rotated = {
  ...D.makePart("rotated", "iron", [0, 0, 0], null),
  rot: [0, 45, 0],
};
const onto = D.snapPartAt(template, rotated, "Front", [-0.35, 0, -0.35]);
assert(onto.pos[0] < -0.65 && onto.pos[2] < -0.65);
assert.equal(D.placementError(onto, [rotated], 30), null);
const child = D.makePart("child", "crate", [0, 1, 0], template.id);
const moved = D.translateAttachmentGroup([template, child], custom);
assert.equal(moved[1].pos[1], 1.094);
assert.equal(moved[1].parent, template.id);
console.log(
  "PASS: physical forward and reverse acceleration, steering both ways, clearance, unpowered warnings, off-center snapping, free placement, rotated mount collisions, salvage enforcement, and moving attachment groups.",
);
