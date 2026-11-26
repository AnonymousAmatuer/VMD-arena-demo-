const { chromium } = require("@playwright/test"),
  assert = require("node:assert/strict"),
  fs = require("fs");
(async () => {
  const b = await chromium.launch({
    args: [
      "--no-sandbox",
      "--enable-unsafe-swiftshader",
      "--use-angle=swiftshader",
    ],
  });
  const c = await b.newContext({ viewport: { width: 1440, height: 1080 } });
  const p = await c.newPage(),
    errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(process.env.VMD_URL || "http://localhost:3000", {
    waitUntil: "networkidle",
  });
  await p.keyboard.press("Escape");
  await p.getByRole("button", { name: "Settings", exact: true }).click();
  await p.getByRole("button", { name: "Low", exact: true }).click();
  await p.getByRole("button", { name: "Done", exact: true }).click();
  const state = () =>
    p.evaluate(() => JSON.parse(localStorage.getItem("vmd.engineer.v1")));
  const click = (name) => p.getByRole("button", { name, exact: true }).click();
  assert.equal(await p.locator(".number-badge").innerText(), "90");
  console.log("catalog count", await p.locator(".number-badge").innerText());
  await click("Mechanics");
  assert((await p.locator(".part-grid .part-card").count()) > 0);
  console.log("Mechanics tab rendered");
  await click("Power");
  assert(
    await p.getByRole("button", { name: /Place Small battery/ }).isVisible(),
  );
  await click("All parts");
  await p.getByRole("button", { name: "Search components" }).click();
  await p.getByRole("searchbox").fill("battery");
  assert(await p.getByRole("button", { name: /Small battery/ }).count());
  await p.getByRole("button", { name: /Place Small battery/ }).click();
  await p
    .getByRole("button", { name: "Attach component", exact: true })
    .click();
  await p.waitForTimeout(250);
  assert((await state()).vehicle.parts.some((x) => x.key === "battery_s"));
  console.log("Placed battery");
  await p.getByRole("searchbox").fill("motor");
  assert(
    (await p.getByRole("button", { name: /Locked Electric motor/ }).count()) ===
      1,
  );
  await p.getByRole("searchbox").fill("wiring");
  await p.getByRole("button", { name: /Place Power wiring/ }).click();
  await p
    .getByRole("button", { name: "Attach component", exact: true })
    .click();
  await p.waitForTimeout(250);
  assert((await state()).vehicle.parts.some((x) => x.key === "wiring"));
  console.log("Motor is correctly locked; placed power wiring instead");
  await p.getByRole("button", { name: "Analyze", exact: true }).click();
  await p.getByRole("dialog", { name: "Engineering analysis" }).waitFor();
  assert(await p.getByText("Battery capacity", { exact: true }).isVisible());
  assert(await p.getByText("Generation", { exact: true }).isVisible());
  await p.screenshot({
    path: "artifacts/engineering-analysis.jpg",
    quality: 88,
  });
  await p.getByRole("button", { name: "Components", exact: true }).click();
  assert((await p.locator(".inspect-list button").count()) >= 10);
  await p
    .locator(".inspect-list button")
    .filter({ hasText: "Power wiring" })
    .click();
  assert(await p.getByText("Mechanical role", { exact: true }).isVisible());
  await p.getByRole("button", { name: "Materials", exact: true }).click();
  assert((await p.locator(".material-swatches button").count()) > 0);
  await p.getByRole("button", { name: "Overview", exact: true }).click();
  await p.getByRole("button", { name: "Centre of mass", exact: true }).click();
  await p
    .getByRole("button", { name: "Structural connections", exact: true })
    .click();
  await p.getByRole("button", { name: "Close dialog" }).click();
  await p.waitForTimeout(300);
  await p.screenshot({ path: "artifacts/expanded-workshop.jpg", quality: 88 });
  await click("Enter arena");
  await click("Start engines");
  await p.locator(".arena-canvas canvas").waitFor();
  await p.waitForTimeout(600);
  assert(
    await p.getByRole("button", { name: "Toggle weapons power" }).isVisible(),
  );
  assert((await p.locator(".system-toggle.on").count()) === 2);
  await p.getByRole("button", { name: "Toggle weapons power" }).click();
  assert((await p.locator(".system-toggle.on").count()) === 1);
  await p.getByRole("button", { name: "Toggle weapons power" }).click();
  await p.keyboard.down("w");
  await p.waitForTimeout(300);
  await p.getByRole("button", { name: "Toggle mobility power" }).click();
  await p.waitForTimeout(250);
  assert(
    (await p.locator(".speed-readout").getAttribute("data-speed")) !== "0",
  );
  await p.getByRole("button", { name: "Toggle mobility power" }).click();
  await p.keyboard.down("w");
  await p.waitForFunction(
    () => +document.querySelector(".speed-readout").dataset.speed > 8,
  );
  await p.keyboard.up("w");
  await p.keyboard.press("Escape");
  await p.screenshot({ path: "artifacts/expanded-arena.jpg", quality: 88 });
  console.log(
    "systems toggled, drove to",
    await p.locator(".speed-readout").getAttribute("data-speed"),
    "km/h",
  );
  assert.deepEqual(errors, []);
  await b.close();
  console.log(
    "PASS expanded catalogue, mechanisms, analysis, overlays, power toggles, arena",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
