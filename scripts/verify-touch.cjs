const { chromium } = require("@playwright/test");
const A = require("node:assert/strict");
(async () => {
  const b = await chromium.launch({
    args: [
      "--no-sandbox",
      "--enable-unsafe-swiftshader",
      "--use-angle=swiftshader",
    ],
  });
  const context = await b.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 1,
  });
  const p = await context.newPage(),
    errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto("http://localhost:3000", { waitUntil: "networkidle" });
  const state = () =>
      p.evaluate(() => JSON.parse(localStorage.getItem("vmd.engineer.v1"))),
    tap = async (name) => p.getByRole("button", { name, exact: true }).tap();
  await p.keyboard.press("Escape");
  await tap("Settings");
  await tap("Low");
  await tap("Done");
  await tap("Place Wooden crate, 1 salvage");
  await tap("Attach component");
  await tap("Duplicate component");
  await tap("Attach component");
  A.equal((await state()).vehicle.parts.length, 10);
  await tap("Remove component and child attachments");
  A.equal((await state()).vehicle.parts.length, 9);
  for (let i = 0; i < 2; i++) {
    await tap("Place Iron block, 3 salvage");
    await tap("Attach component");
  }
  await tap("Place Wooden crate, 1 salvage");
  A(
    await p
      .getByRole("button", { name: "Attach component", exact: true })
      .isDisabled(),
  );
  A(
    await p
      .getByText("Not enough salvage for this component.", { exact: true })
      .isVisible(),
  );
  await tap("Cancel placement");
  console.log(
    "PASS: touch construction, duplicate, delete, and enforced salvage budget",
  );
  await tap("Save build");
  await p
    .getByRole("textbox", { name: "VEHICLE NAME" })
    .fill("Touch prototype");
  await tap("Save memory slot");
  await tap("Garage");
  await tap("Load original");
  await tap("Enter arena");
  await tap("Start engines");
  await p.locator(".arena-canvas canvas").waitFor();
  await p.waitForTimeout(700);
  const fire = p.getByRole("button", { name: "FIRE WEAPONS", exact: true }),
    rect = await fire.boundingBox(),
    cdp = await context.newCDPSession(p);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }],
  });
  await p.locator(".result-banner").waitFor({ timeout: 180000 });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  const after = await state();
  A.equal(after.history.length, 1);
  A(after.xp > 0);
  console.log(
    "PASS: one-on-one match resolved using only touch controls; score",
    after.history[0].score,
  );
  await tap("Close dialog");
  await p.waitForTimeout(850);
  await p.evaluate(() => localStorage.removeItem("vmd.engineer.v1"));
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(700);
  A.equal((await state()).history[0].id, after.history[0].id);
  A.equal((await state()).garage[0].name, "Touch prototype");
  console.log(
    "PASS: recovery from PostgreSQL after the local save was removed",
  );
  await tap("Settings");
  await tap("Reset progress");
  await tap("Keep my progress");
  A.equal((await state()).history.length, 1);
  await tap("Reset progress");
  await tap("Reset everything");
  await p.waitForTimeout(750);
  const fresh = await state();
  A.equal(fresh.history.length, 0);
  A.equal(fresh.coins, 0);
  A.equal(fresh.salvage, 30);
  A.equal(fresh.level, 1);
  A.equal(fresh.garage.length, 0);
  A.deepEqual(errors, []);
  console.log(
    "PASS: cancel and confirm reset, clean profile, no browser exceptions",
  );
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
