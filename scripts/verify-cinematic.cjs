const { chromium } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (m, f) =>
  m._compile(
    ts.transpileModule(fs.readFileSync(f, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText,
    f,
  );
const D = require('../src/game/data.ts');
const { ArenaSimulation } = require('../src/game/simulation.ts');

(async () => {
  fs.mkdirSync('artifacts', { recursive: true });
  assert.equal(D.ARENA_RADIUS, 64.35, 'arena radius must be 1.5x the previous radius');
  assert.equal(D.ARENA_PREVIOUS_RADIUS, 42.9);
  assert.ok(D.EMBLEM_RADIUS < Math.min(Math.abs(D.SPAWN_PLAYER[2]), Math.abs(D.SPAWN_RIVAL[2])), 'spawns clear the emblem');
  assert.ok(D.SPAWN_PLAYER[2] * -1 === D.SPAWN_RIVAL[2], 'spawns are mirrored');
  const sim = new ArenaSimulation(D.starter(), 1);
  const radius = sim.world.bodies
    .filter((b) => b.mass === 0 && b.shapes.length)
    .map((b) => Math.hypot(b.position.x, b.position.z))
    .filter((r) => r > 5);
  assert.ok(radius.length >= 40, 'a circular boundary of many segments exists');
  assert.ok(Math.abs(Math.max(...radius) - D.ARENA_RADIUS) < 1.2, 'boundary sits on the arena radius');
  const p0 = sim.units[0].body.position, p1 = sim.units[1].body.position;
  assert.ok(Math.hypot(p0.x, p0.z) > D.EMBLEM_RADIUS + 5, 'player spawns outside the emblem');
  assert.ok(Math.hypot(p1.x, p1.z) > D.EMBLEM_RADIUS + 5, 'rival spawns outside the emblem');
  assert.ok(p0.distanceTo(p1) > 20, 'vehicles do not overlap');
  console.log('PASS: arena radius doubled to', D.ARENA_RADIUS, 'with a circular boundary and clear spawns');

  const browser = await chromium.launch({
    args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  await page.locator('.cinema-splash').waitFor({ timeout: 20000 });
  await page.waitForTimeout(2600);
  await page.screenshot({ path: 'artifacts/splash.jpg', quality: 88, timeout: 120000 });
  for (const item of ['ENTER CHAMPIONSHIP', 'WORKSHOP', 'GARAGE', 'TOURNAMENT', 'COMPONENTS', 'LEADERBOARD', 'SETTINGS']) {
    assert.ok((await page.getByRole('button', { name: item, exact: true }).count()) === 1, `splash menu missing ${item}`);
  }
  assert.ok((await page.locator('.cinema-titles h1').textContent()).includes('MASS DESTRUCTION'));
  console.log('PASS: cinematic splash with full main menu');

  await page.getByRole('button', { name: 'COMPONENTS', exact: true }).click();
  await page.locator('.compendium-modal').waitFor();
  const componentCount = await page.locator('.compendium-list button').count();
  assert.ok(componentCount > 80, `expected 80+ components, found ${componentCount}`);
  await page.getByRole('button', { name: 'Full materials guide' }).click();
  await page.locator('.encyclopedia').waitFor();
  const materialCount = await page.locator('.encyclopedia-list button').count();
  assert.ok(materialCount >= 20, `expected 20+ materials, found ${materialCount}`);
  await page.locator('.encyclopedia-list button').filter({ hasText: 'Carbon fibre' }).click();
  await page.waitForTimeout(400);
  const howTo = await page.locator('.encyclopedia-howto h4').innerText();
  assert.equal(howTo, 'HOW TO USE THIS MATERIAL');
  const props = await page.locator('.encyclopedia-prop').allInnerTexts();
  const density = props.find((t) => t.includes('Density index'));
  assert.ok(density.includes(String(D.MATERIAL_PROFILES.carbon.density)), 'encyclopedia density must match live data');
  const hp = props.find((t) => t.includes('Maximum HP'));
  assert.ok(hp.includes(String(Math.max(...D.CATALOG.filter((c) => c.material === 'carbon').map((c) => c.hp)))));
  await page.screenshot({ path: 'artifacts/encyclopedia.jpg', quality: 88, timeout: 120000 });
  console.log('PASS: component compendium and material encyclopedia show live stats and the HOW TO USE section');
  await page.getByRole('button', { name: 'Close dialog' }).click();

  await page.getByRole('button', { name: 'Enter arena', exact: true }).click();
  await page.waitForTimeout(900);
  assert.equal(await page.locator('.versus-intro').count(), 1, 'versus introduction must appear before the match');
  await page.waitForTimeout(1600);
  const panels = await page.evaluate(() => {
    const left = document.querySelector('.versus-fighter.left');
    const right = document.querySelector('.versus-fighter.right');
    return {
      leftName: left?.querySelector('h2')?.textContent ?? '',
      rightName: right?.querySelector('h2')?.textContent ?? '',
      leftRating: left?.querySelector('b')?.textContent ?? '',
      rightRating: right?.querySelector('b')?.textContent ?? '',
      leftThumb: left?.querySelectorAll('.versus-thumb canvas').length ?? 0,
      rightThumb: right?.querySelectorAll('.versus-thumb canvas').length ?? 0,
      vs: document.querySelector('.versus-vs')?.textContent ?? '',
    };
  });
  assert.equal(panels.leftName, 'PIP');
  assert.ok(panels.rightName.length > 1);
  assert.ok(/\d+ VR/.test(panels.leftRating));
  assert.ok(/\d+ VR/.test(panels.rightRating));
  assert.ok(panels.leftThumb > 0 && panels.rightThumb > 0, 'both vehicles render 3D thumbnails');
  assert.equal(panels.vs, 'VS');
  await page.screenshot({ path: 'artifacts/versus.jpg', quality: 88, timeout: 120000 });
  console.log('PASS: versus introduction shows', panels.leftName, 'and', panels.rightName, 'with vehicle ratings and 3D thumbnails');

  await page.locator('.versus-skip').click({ timeout: 4000 }).catch(() => {});
  await page.locator('.arena-canvas canvas').waitFor({ timeout: 30000 });
  await page.waitForTimeout(700);
  assert.ok((await page.locator('.cinema-bar').count()) > 0, 'cinematic letterbox bars appear');
  assert.equal(await page.locator('.countdown-numeral').count(), 0);
  await page.locator('.intro-skip').click();
  await page.locator('.countdown-numeral').waitFor({ timeout: 20000 });
  const numeral = await page.locator('.countdown-numeral b').innerText();
  assert.ok(['3', '2', '1', 'FIGHT!'].includes(numeral), `unexpected countdown value ${numeral}`);
  assert.ok(await page.locator('.drive-pad button[aria-label="Drive forward"]').isDisabled(), 'controls locked during countdown');
  await page.screenshot({ path: 'artifacts/countdown.jpg', quality: 88, timeout: 120000 });
  await page.locator('.drive-pad button[aria-label="Drive forward"]').waitFor({ state: 'visible' });
  await page.waitForFunction(() => !document.querySelector('.drive-pad button[aria-label="Drive forward"]')?.disabled, null, { timeout: 20000 });
  assert.equal(await page.locator('.countdown-numeral').count(), 0, 'countdown clears after FIGHT');
  await page.keyboard.down('w');
  await page.waitForFunction(() => +document.querySelector('.speed-readout').dataset.speed > 6, null, { timeout: 20000 });
  await page.keyboard.up('w');
  await page.screenshot({ path: 'artifacts/arena-expanded.jpg', quality: 88, timeout: 120000 });
  console.log('PASS: countdown gates movement and gameplay starts after FIGHT');
  assert.deepEqual(errors, []);
  await browser.close();
  console.log('PASS: cinematic splash, versus, arena arrival, countdown gating, encyclopedia.');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
