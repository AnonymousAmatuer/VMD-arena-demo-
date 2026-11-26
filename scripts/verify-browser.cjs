const { chromium } = require("@playwright/test");
const fs = require("fs");
const assert = require("node:assert/strict");
(async () => {
  fs.mkdirSync("artifacts", { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--enable-unsafe-swiftshader",
      "--use-angle=swiftshader",
    ],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => {
    errors.push(e.message);
    console.log("BROWSER ERROR", e.message);
  });
  page.on("console", (m) => {
    if (m.type() === "error") console.log("CONSOLE", m.text().slice(0, 240));
  });
  const state = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem("vmd.engineer.v1")));
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await page.keyboard.press("Escape");
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: "artifacts/workshop-desktop.jpg",
    quality: 90,
  });
  console.log(
    "Desktop layout",
    await page.evaluate(() => ({
      page: document.documentElement.scrollWidth,
      view: innerWidth,
      hero: document
        .querySelector(".vehicle-stage")
        .getBoundingClientRect()
        .toJSON(),
      library: document
        .querySelector(".component-library")
        .getBoundingClientRect()
        .toJSON(),
    })),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "artifacts/workshop-mobile.jpg",
    fullPage: true,
    quality: 82,
  });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  console.log("Mobile layout: no horizontal overflow");
  await page.setViewportSize({ width: 1280, height: 820 });
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Low", exact: true }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  console.log("Graphics preferences changed");
  await page.getByRole("button", { name: "Search components" }).click();
  await page.getByRole("searchbox").fill("wooden crate");
  await page
    .getByRole("button", { name: "Place Wooden crate, 1 salvage", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Attach component", exact: true })
    .waitFor();
  await page.waitForTimeout(500);
  await page.screenshot({ path: "artifacts/placement.jpg", quality: 88 });
  await page
    .getByRole("button", { name: "Attach component", exact: true })
    .click();
  await page.waitForTimeout(400);
  assert.equal((await state()).vehicle.parts.length, 9);
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(250);
  assert.equal((await state()).vehicle.parts.length, 8);
  await page.keyboard.press("Control+Shift+z");
  await page.waitForTimeout(250);
  assert.equal((await state()).vehicle.parts.length, 9);
  console.log("Box placement, undo and redo passed");
  await page.getByRole("button", { name: "Custom", exact: true }).click();
  await page.getByRole("searchbox").fill("iron block");
  await page
    .getByRole("button", { name: "Place Iron block, 3 salvage" })
    .click();
  const xp = page.getByRole("spinbutton", { name: "X position", exact: true }),
    old = await xp.inputValue();
  await xp.fill("8");
  await xp.press("Tab");
  assert(
    await page
      .getByRole("button", { name: "Attach component", exact: true })
      .isDisabled(),
  );
  await xp.fill(old);
  await xp.press("Tab");
  await page
    .getByRole("button", { name: "Attach component", exact: true })
    .click();
  await page.waitForTimeout(200);
  assert.equal((await state()).vehicle.parts.length, 10);
  console.log("Custom placement and invalid attachment checks passed");
  await page.getByRole("button", { name: "Save build", exact: true }).click();
  await page
    .getByRole("textbox", { name: "VEHICLE NAME" })
    .fill("Browser test machine");
  await page
    .getByRole("button", { name: "Save memory slot", exact: true })
    .click();
  await page.waitForTimeout(900);
  assert((await state()).garage.some((x) => x.name === "Browser test machine"));
  await page.getByRole("button", { name: "Garage", exact: true }).click();
  await page
    .getByRole("button", { name: "Load original", exact: true })
    .click();
  await page.waitForTimeout(250);
  assert.equal((await state()).vehicle.parts.length, 8);
  await page.getByRole("button", { name: "Garage", exact: true }).click();
  await page.getByRole("button", { name: "Recall build", exact: true }).click();
  await page.waitForTimeout(200);
  assert.equal((await state()).vehicle.name, "Browser test machine");
  console.log("Blueprint save, factory restore, and load passed");
  await page.getByRole("button", { name: "Tournament", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Championship rounds" })
    .selectOption("9");
  await page.locator(".round-card").last().click();
  assert(
    await page
      .getByRole("button", { name: "Complete round 99 first" })
      .isDisabled(),
  );
  await page.getByRole("button", { name: "Workshop", exact: true }).click();
  await page.getByRole("button", { name: "Enter arena", exact: true }).click();
  await page.waitForTimeout(550);
  await page.screenshot({ path: "artifacts/match-briefing.jpg", quality: 87 });
  await page.getByRole("button", { name: "Start engines" }).click();
  await page.locator(".arena-canvas canvas").waitFor({ timeout: 30000 });
  await page.waitForTimeout(1000);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Resume match" }).waitFor();
  await page.getByRole("button", { name: "Resume match" }).click();
  console.log("Match entry and pause/resume passed");
  await page.keyboard.down("f");
  await page.keyboard.down("w");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "artifacts/arena.jpg", quality: 85 });
  await page.keyboard.up("w");
  await page.locator(".result-banner").waitFor({ timeout: 150000 });
  await page.keyboard.up("f");
  const s = await state();
  console.log("Match record", s.history[0] || "match not yet finished");
  assert(s.history.length > 0, "a real match has resolved");
  assert(s.xp > 0);
  if (s.history[0].win) {
    assert.equal(s.level, 2);
    assert.equal(s.salvage, 34);
    assert.equal(s.coins, 2);
  }
  let synced;
  for (let attempt = 0; attempt < 50; attempt++) {
    await page.waitForTimeout(200);
    synced = await page.evaluate(async () => {
      const r = await fetch("/api/save", {
        cache: "no-store",
        headers: { "x-device-key": localStorage.getItem("vmd.device") },
      });
      return (await r.json()).profile;
    });
    if (synced?.history?.[0]?.id === s.history[0].id) break;
  }
  assert(synced.history.length, "a completed match must be backed up");
  assert.equal(synced.history[0].id, s.history[0].id);
  await page.reload({ waitUntil: "networkidle" });
  assert.equal((await state()).garage.length, 1);
  assert.equal((await state()).history.length, s.history.length);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: render, responsive layout, both editors, invalid placements, history, saves, reload, tournament locks, battle, rewards, and PostgreSQL backup.",
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
