// bristle brush validation
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const base = process.env.TEST_URL || 'http://127.0.0.1:5173';
await mkdir('performance', { recursive: true });
await mkdir('media', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu', '--disable-background-timer-throttling'] });
const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text()); });
try {
  await page.goto(`${base}/?test`);
  await page.waitForFunction(() => window.inkTest || document.querySelector('#status').dataset.error);
  assert.equal(await page.locator('#status').getAttribute('data-error'), null, await page.locator('#status').textContent());
  await page.evaluate(() => window.inkTest.pause());
  const line = (len, bristle, params = {}) => page.evaluate(async ({ len, bristle, params }) => {
    const t = window.inkTest; t.clear(); t.bristles.setParams(params);
    const s = bristle ? t.bristles.stroke : t.stroke;
    if (bristle) t.bristles.begin();
    const n = Math.max(1, Math.round(len / .01));
    for (let i = 1; i <= n; i++) s(.3 + len * i / n, .5, .3 + len * (i - 1) / n, .5, 1 / 60);
    await t.step(1); return t.read();
  }, { len, bristle, params });
  const round = await line(.2, false);
  const short = await line(.1, true, { bristleCount: 24, bristleRadius: 1.5, deformation: 0, pressure: 0, depletion: 0 });
  const long = await line(.2, true);
  assert(short.pigment > 0 && long.pigment > 0, 'Bristle path deposits pigment');
  assert.equal(long.invalid, 0);
  assert(Math.abs(long.pigment / short.pigment - 2) < 0.2, `Pigment scales with stroke length (${long.pigment / short.pigment})`);
  assert(Math.abs(long.pigment / round.pigment - 1) < 0.15, `Comparable to round brush (${long.pigment / round.pigment})`);
  const counts = [];
  for (const bristleCount of [4, 64, 512]) counts.push((await line(.2, true, { bristleCount })).pigment / round.pigment);
  for (const c of counts) assert(Math.abs(c - 1) < 0.2, `Ink stays comparable across N (${counts})`);
  const deformed = await line(.2, true, { bristleCount: 24, deformation: 1 });
  assert(deformed.pigment > 0 && deformed.invalid === 0, 'Deformed brush deposits');
  const depShort = await line(.05, true, { bristleCount: 192, bristleRadius: 0.6, deformation: 0, depletion: 1 });
  const depLong = await line(.6, true);
  assert(depLong.pigment / depShort.pigment < 0.6 * 12, `Bristles run dry over a long stroke (${depLong.pigment / depShort.pigment})`);
  const dry = await line(.2, true, { depletion: 0, wetness: 0 });
  assert(dry.pigment > 0 && dry.water === 0, 'Dry brush deposits pigment without water');
  const circles = () => page.evaluate(async () => {
    const t = window.inkTest; t.clear(); t.bristles.setParams({ bristleCount: 64, bristleRadius: 2, deformation: .5 }); t.bristles.begin();
    let q = [.5 + .02, .5];
    for (let i = 1; i <= 400; i++) { const a = i / 400 * Math.PI * 16, p = [.5 + .02 * Math.cos(a), .5 + .02 * Math.sin(a)]; t.bristles.stroke(p[0], p[1], q[0], q[1], 1 / 60); q = p; }
    await t.step(1); return t.read();
  });
  const [c1, c2] = [await circles(), await circles()];
  assert.equal(c1.pigment, c2.pigment, 'Overlapping deposit is deterministic (no write races)');
  await page.evaluate(() => window.inkTest.clear());
  await page.locator('#bristle-toggle').check();
  assert.match(await page.locator('#status').textContent(), /Bristle brush/);
  await page.locator('#canvas').scrollIntoViewIfNeeded();
  const box = await page.locator('#canvas').boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await page.mouse.move(cx - 120, cy); await page.mouse.down(); await page.mouse.move(cx + 120, cy + 40, { steps: 30 }); await page.mouse.up();
  assert((await page.evaluate(() => window.inkTest.read())).pigment > 0, 'Mouse stroke with bristles deposits');
  await page.locator('#canvas').screenshot({ path: 'media/bristle-stroke.png' });
  const median = a => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
  let frame = null;
  if (await page.evaluate(() => window.inkTest.hardware && navigator.gpu && true)) {
    try {
      const bench = async on => page.evaluate(async on => { const t = window.inkTest; t.clear(); t.bristles.setParams({ bristleCount: 24, bristleRadius: 1.5, deformation: 0 }); t.bristles.enable(on); return t.benchmarkFrame(); }, on);
      const r = await bench(false), b = await bench(true);
      frame = { roundGpuMs: median(r.gpu), bristleGpuMs: median(b.gpu) };
    } catch (e) { frame = { skipped: String(e.message) }; }
  }
  assert.deepEqual(errors, []);
  const result = { round, short, long, countRatios: counts, deformed, depShort, depLong, dry, circles: c1, frame };
  await writeFile('performance/bristles.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally { await browser.close(); }
