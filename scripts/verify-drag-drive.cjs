const { chromium } = require("@playwright/test");
const { PerspectiveCamera, Vector3 } = require("three");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const url = process.env.VMD_URL || "http://localhost:3000";
const crateName = "Place Wooden crate, 1 salvage";
function project(rect, xyz, floor = 0.812) {
  const aspect = rect.width / rect.height;
  const camera = new PerspectiveCamera(36, aspect, 0.1, 180);
  camera.position.set(
    ...(aspect < 1.35 ? [4.9, 3.55, -7.1] : [4.05, 2.65, -5.18]),
  );
  camera.lookAt(0, 0.93, 0);
  camera.updateMatrixWorld();
  const point = new Vector3(xyz[0], xyz[1] + floor, xyz[2]).project(camera);
  return {
    x: rect.x + ((point.x + 1) * rect.width) / 2,
    y: rect.y + ((1 - point.y) * rect.height) / 2,
  };
}
const boxOf = async (locator) => {
  const box = await locator.boundingBox();
  assert(box);
  return box;
};
const middle = ({ x, y, width, height }) => ({
  x: x + width / 2,
  y: y + height / 2,
});
const store = (p) =>
  p.evaluate(() => JSON.parse(localStorage.getItem("vmd.engineer.v1")));
const waitParts = (p, n) =>
  p.waitForFunction(
    (n) =>
      JSON.parse(localStorage.getItem("vmd.engineer.v1"))?.vehicle.parts
        .length === n,
    n,
  );
const speed = (p) => p.locator(".speed-readout");
const click = (p, name) => p.getByRole("button", { name, exact: true }).click();
const stage = (p) => p.locator(".workshop-canvas");
const drop = (p) => p.locator(".drop-status");
async function open(context) {
  const p = await context.newPage();
  await p.goto(url, { waitUntil: "networkidle" });
  await p.keyboard.press("Escape");
  await click(p, "Settings");
  await click(p, "Low");
  await click(p, "Done");
  return p;
}
async function launch(p) {
  await click(p, "Enter arena");
  await click(p, "Start engines");
  await p.locator(".arena-canvas canvas").waitFor({ timeout: 30000 });
  await p.waitForFunction(() =>
    document.activeElement?.classList.contains("battle-screen"),
  );
}
async function desktop(browser) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1040 },
  });
  const p = await open(context),
    errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  const crate = p.getByRole("button", { name: crateName, exact: true });
  const start = middle(await boxOf(crate));
  await p.mouse.move(start.x, start.y);
  await p.mouse.down();
  await p.mouse.move(start.x + 10, start.y - 26, { steps: 3 });
  await stage(p).locator("canvas").waitFor();
  let rect = await boxOf(stage(p)),
    spot = project(rect, [0.57, 0.05, -1.675]);
  await p.mouse.move(spot.x, spot.y, { steps: 9 });
  await p
    .locator(
      '.drop-status[data-valid="true"][data-mount="chassis"][data-face="Front"]',
    )
    .waitFor();
  await p.screenshot({ path: "artifacts/direct-placement.jpg", quality: 86 });
  await p.mouse.up();
  await waitParts(p, 9);
  let placed = (await store(p)).vehicle.parts.find((x) => x.key === "crate");
  assert.equal(placed.parent, "chassis");
  assert.equal(placed.pos[0], 0.5);
  assert.equal(placed.pos[2], -2.14);
  assert.equal(
    await p
      .getByRole("button", { name: "Attach component", exact: true })
      .count(),
    0,
  );
  console.log(
    "Pointer drop attached the crate at the off-center point on the chassis",
  );
  rect = await boxOf(stage(p));
  const grab = project(rect, placed.pos);
  await p.mouse.move(grab.x, grab.y);
  await p.mouse.down();
  await p.mouse.move(grab.x - 28, grab.y - 24, { steps: 4 });
  let moved = false;
  for (const angle of [
    [0.57, 0.25, -1.675],
    [0.82, 0.2, -1.675],
    [0.18, 0.324, -1.22],
    [0.8, 0.324, -1.15],
    [0.5, 0.324, -0.9],
  ]) {
    const target = project(rect, angle);
    await p.mouse.move(target.x, target.y, { steps: 4 });
    await p.waitForTimeout(175);
    const valid = await drop(p).getAttribute("data-valid");
    if (valid === "true") {
      moved = true;
      break;
    }
  }
  assert(moved, "mounted crate found a valid new placement");
  await p.mouse.up();
  await p.waitForFunction(
    ({ id, pos }) =>
      JSON.parse(localStorage.getItem("vmd.engineer.v1"))
        .vehicle.parts.find((x) => x.id === id)
        ?.pos.some((n, i) => Math.abs(n - pos[i]) > 0.05),
    placed,
  );
  assert.equal((await store(p)).vehicle.parts.length, 9);
  await click(p, "Undo build change");
  await p.waitForFunction(
    ({ id, pos }) =>
      JSON.parse(localStorage.getItem("vmd.engineer.v1"))
        .vehicle.parts.find((x) => x.id === id)
        ?.pos.every((n, i) => n === pos[i]),
    placed,
  );
  console.log(
    "Moving an already mounted part retained its identity and was undoable",
  );
  const iron = p.getByRole("button", { name: "Place Iron block, 3 salvage" });
  const from = middle(await boxOf(iron));
  await p.mouse.move(from.x, from.y);
  await p.mouse.down();
  await p.mouse.move(rect.x + 40, rect.y + 100, { steps: 8 });
  await p.locator('.drop-status[data-valid="false"]').waitFor();
  await p.mouse.up();
  await p.getByRole("status").filter({ hasText: "No part moved" }).waitFor();
  assert.equal((await store(p)).vehicle.parts.length, 9);
  await launch(p);
  await p.keyboard.down("w");
  await p
    .locator('.drive-pad button[aria-label="Drive forward"][data-held="true"]')
    .waitFor();
  await p.waitForFunction(
    () =>
      Number(
        document.querySelector(".speed-readout")?.getAttribute("data-speed"),
      ) >= 12,
  );
  const reached = Number(await speed(p).getAttribute("data-speed"));
  await p.keyboard.up("w");
  const heading = Number(await speed(p).getAttribute("data-heading"));
  await p.keyboard.down("a");
  await p.waitForFunction((h) => {
    const d = Math.abs(
      Number(
        document.querySelector(".speed-readout")?.getAttribute("data-heading"),
      ) - h,
    );
    return Math.min(d, 360 - d) > 18;
  }, heading);
  await p.keyboard.up("a");
  await click(p, "Center follow camera");
  await p.locator(".arena-toolbar .following").waitFor();
  await p.screenshot({ path: "artifacts/drive-camera.jpg", quality: 86 });
  assert.deepEqual(errors, []);
  console.log(
    "Keyboard controls reached",
    reached,
    "km/h and physically changed heading",
  );
  await context.close();
}
async function touch(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
  });
  const p = await open(context),
    errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  const grip = p
    .getByRole("button", { name: crateName, exact: true })
    .locator(".part-drag-grip");
  await grip.scrollIntoViewIfNeeded();
  const cdp = await context.newCDPSession(p),
    initial = middle(await boxOf(grip));
  const send = (type, point, id = 1) =>
    cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: point ? [{ x: point.x, y: point.y, id }] : [],
    });
  await send("touchStart", initial);
  await send("touchMove", { x: initial.x - 8, y: initial.y - 35 });
  await stage(p).locator("canvas").waitFor();
  await p.waitForTimeout(250);
  const rect = await boxOf(stage(p)),
    spot = project(rect, [0.57, 0.05, -1.675]);
  await send("touchMove", spot);
  await p
    .locator(
      '.drop-status[data-valid="true"][data-mount="chassis"][data-face="Front"]',
    )
    .waitFor();
  await send("touchEnd");
  await waitParts(p, 9);
  assert.equal(
    (await store(p)).vehicle.parts.find((x) => x.key === "crate").pos[0],
    0.5,
  );
  console.log(
    "Touch dragging by the catalog grip attached precisely to the pointed face",
  );
  await launch(p);
  const forward = middle(
    await boxOf(p.getByRole("button", { name: "Drive forward", exact: true })),
  );
  await send("touchStart", forward);
  await p
    .locator('.drive-pad button[aria-label="Drive forward"][data-held="true"]')
    .waitFor();
  await p.waitForFunction(
    () =>
      Number(
        document.querySelector(".speed-readout")?.getAttribute("data-speed"),
      ) >= 12,
  );
  await send("touchEnd");
  await p
    .locator('.drive-pad button[aria-label="Drive forward"][data-held="false"]')
    .waitFor();
  assert.deepEqual(errors, []);
  console.log("Touch accelerator reached driving speed and released correctly");
  await context.close();
}
(async () => {
  fs.mkdirSync("artifacts", { recursive: true });
  const browser = await chromium.launch({
    args: [
      "--no-sandbox",
      "--enable-unsafe-swiftshader",
      "--use-angle=swiftshader",
    ],
  });
  try {
    await desktop(browser);
    await touch(browser);
    console.log(
      "PASS: exact drop, mounted drag, invalid drop, undo, keyboard driving, camera follow, and touch driving.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
