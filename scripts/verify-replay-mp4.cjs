const { chromium } = require("@playwright/test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

/** Minimal MP4 box walker: returns top-level boxes and the movie duration. */
function inspectMp4(buf) {
  const boxes = [];
  let off = 0;
  while (off + 8 <= buf.length) {
    const size = buf.readUInt32BE(off);
    const type = buf.toString("ascii", off + 4, off + 8);
    boxes.push(type);
    if (size < 8) break;
    off += size;
  }
  const mvhd = buf.indexOf(Buffer.from("mvhd"));
  let seconds = 0;
  if (mvhd > 0) {
    const version = buf[mvhd + 4];
    const timescale = version === 1 ? buf.readUInt32BE(mvhd + 24) : buf.readUInt32BE(mvhd + 16);
    const duration =
      version === 1 ? Number(buf.readBigUInt64BE(mvhd + 28)) : buf.readUInt32BE(mvhd + 20);
    seconds = duration / timescale;
  }
  const avc = buf.indexOf(Buffer.from("avcC")) > 0;
  const tkhd = buf.indexOf(Buffer.from("tkhd"));
  let width = 0, height = 0;
  if (tkhd > 0) {
    const version = buf[tkhd + 4];
    const base = tkhd + (version === 1 ? 92 : 80);
    width = buf.readUInt32BE(base) >> 16;
    height = buf.readUInt32BE(base + 4) >> 16;
  }
  return { boxes, seconds, avc, width, height };
}

(async () => {
  fs.mkdirSync("artifacts", { recursive: true });
  const browser = await chromium.launch({
    args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
  });
  const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  const supported = await page.evaluate(() => "VideoEncoder" in window);
  console.log("WebCodecs VideoEncoder available:", supported);

  // Play a real match to produce a replay.
  await page.getByRole("button", { name: "Enter arena", exact: true }).click();
  await page.locator(".versus-intro").waitFor({ timeout: 20000 });
  await page.waitForTimeout(1000);
  await page.locator(".versus-skip").click({ timeout: 5000 }).catch(() => {});
  await page.locator(".arena-canvas canvas").waitFor({ timeout: 30000 });
  await page.waitForTimeout(600);
  await page.locator(".intro-skip").click({ force: true, timeout: 6000 }).catch(() => {});
  await page.waitForFunction(
    () => !document.querySelector('.drive-pad button[aria-label="Drive forward"]')?.disabled,
    null,
    { timeout: 25000 },
  );
  await page.keyboard.down("f");
  await page.keyboard.down("w");
  await page.locator(".result-banner").waitFor({ timeout: 180000 });
  await page.keyboard.up("w");
  await page.keyboard.up("f");
  console.log("Match finished");

  await page.getByRole("button", { name: "Watch replay" }).click();
  await page.locator(".replay-dialog").waitFor();
  await page.waitForTimeout(800);
  assert.ok(await page.getByRole("button", { name: "Download MP4" }).isVisible(), "download button shown");

  // The sandbox renders WebGL on the CPU, so use the fast preset here.
  await page.getByRole("button", { name: "480p", exact: true }).click();
  await page.locator(".replay-check input").uncheck();
  const start = Date.now();
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 420000 }),
    page.getByRole("button", { name: "Download MP4" }).click(),
  ]);
  const name = download.suggestedFilename();
  const target = `artifacts/${name}`;
  await download.saveAs(target);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  const buf = fs.readFileSync(target);
  const info = inspectMp4(buf);
  console.log("Downloaded", name, (buf.length / 1048576).toFixed(2) + " MB in", elapsed + "s", JSON.stringify(info));
  assert.ok(name.endsWith(".mp4"), "file has an .mp4 name");
  assert.equal(info.boxes[0], "ftyp", "file starts with an MP4 ftyp box");
  assert.ok(info.boxes.includes("moov") && info.boxes.includes("mdat"), "MP4 contains moov and mdat");
  assert.ok(info.avc, "video track is H.264 (avcC)");
  assert.equal(info.width, 854);
  assert.equal(info.height, 480);
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem("vmd.engineer.v1")));
  const replay = state.replays[0];
  assert.ok(info.seconds >= replay.duration * 0.9, `video length ${info.seconds.toFixed(1)}s covers the ${replay.duration}s match`);
  await page.waitForTimeout(400);
  assert.ok(await page.locator(".replay-export-done").isVisible(), "completion message shown");
  await page.screenshot({ path: "artifacts/replay-export.jpg", quality: 85, timeout: 120000 });

  // Cancel works and leaves the viewer usable.
  await page.getByRole("button", { name: "Download MP4" }).click();
  await page.locator(".replay-export-progress").waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("button", { name: "Download MP4" }).waitFor({ timeout: 15000 });
  console.log("Cancel returned the viewer to its idle state");

  assert.deepEqual(errors, [], "no page errors");
  await browser.close();
  console.log("PASS: replay renders to a valid H.264 MP4 covering the full match, downloads with a descriptive name, and export can be cancelled.");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
