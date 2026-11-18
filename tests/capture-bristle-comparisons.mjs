// Captures one panel per setting for media/bristle-dryness.png,
// media/bristle-counts.png and media/bristle-depletion.png. Each panel is the same stroke on a fresh sheet,
// with only one setting changed. Every panel is real GPU output.
// Run with the dev server up:  TEST_URL=http://127.0.0.1:5173 node tests/capture-bristle-comparisons.mjs
// then:                        python tests/make-bristle-comparisons.py
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = `${root}media/frames/bristle-compare`;
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 1000 }, deviceScaleFactor: 2 });
const errors = []; page.on('pageerror', e => errors.push(e.message));
const DISTANCE = 2.7;

try {
  await page.goto((process.env.TEST_URL || 'http://127.0.0.1:5173') + '/?test');
  await page.waitForFunction(() => window.inkTest || document.querySelector('#status').dataset.error);
  assert.equal(await page.locator('#status').getAttribute('data-error'), null, await page.locator('#status').textContent());
  await page.evaluate(() => inkTest.pause());
  await page.check('#bristle-toggle');
  await page.locator('#canvas').scrollIntoViewIfNeeded();

  // Size of the sheet on screen at this camera distance (45° fov, as in paper.wgsl).
  const c = await page.locator('#canvas').boundingBox();
  const side = c.height * (1 / Math.tan(Math.PI / 8)) / DISTANCE;
  const sheet = { x: c.x + (c.width - side) / 2, y: c.y + (c.height - side) / 2, size: side };
  // Crop each panel to the band the stroke occupies.
  const band = { x0: 0.02, x1: 0.98, y0: 0.3, y1: 0.7 };
  const clip = { x: sheet.x + band.x0 * side, y: sheet.y + band.y0 * side, width: (band.x1 - band.x0) * side, height: (band.y1 - band.y0) * side };

  const panel = async (name, { paper, params, bristles, color = '#0e1116' }) => {
    await page.selectOption('#paper', paper);
    await page.waitForFunction(() => !document.querySelector('#paper').disabled);
    const totals = await page.evaluate(async ({ params, bristles, color, distance }) => {
      inkTest.clear(); inkTest.params(params); inkTest.color(color); inkTest.bristles.setParams(bristles); inkTest.view(0, 0, distance);
      // Same S-shaped stroke every time, drawn at a steady hand speed.
      const n = 72, point = i => [0.1 + 0.8 * i / n, 0.5 + 0.1 * Math.sin(i / n * Math.PI * 2)];
      inkTest.bristles.begin();
      for (let i = 1; i <= n; i++) { const [p, q] = [point(i), point(i - 1)]; inkTest.bristles.stroke(p[0], p[1], q[0], q[1], 1 / 60); if (i % 3 === 0) await inkTest.step(1); }
      await inkTest.step(240); // let the wet ink spread and dry before the snapshot
      inkTest.render();
      const r = await inkTest.read();
      return { pigment: r.pigment, invalid: r.invalid };
    }, { params, bristles, color, distance: DISTANCE });
    assert.equal(totals.invalid, 0);
    await page.screenshot({ path: `${out}/${name}.png`, clip });
    return totals;
  };

  const base = { radius: 12, waterLoad: 5, diffusion: 0.18, absorption: 0.65, settling: 1.1, roughness: 0, dryness: 0 };
  const hairs = { bristleCount: 192, bristleRadius: 0.6, deformation: 0.4, pressure: 0.3, depletion: 0.4, wetness: 0.15 };
  const results = { dryness: {}, counts: {}, depletion: {} };
  for (const dryness of [0, 0.25, 0.5, 0.75])
    results.dryness[dryness] = await panel(`dryness-${dryness}`, { paper: 'rough-cardboard', params: { ...base, dryness }, bristles: hairs });
  for (const bristleCount of [8, 32, 128, 512])
    results.counts[bristleCount] = await panel(`count-${bristleCount}`, { paper: 'default-paper', params: base, bristles: { ...hairs, bristleCount, wetness: 0 } });
  for (const depletion of [0, 0.25, 0.5, 1])
    results.depletion[depletion] = await panel(`depletion-${depletion}`, { paper: 'default-paper', params: base, bristles: { ...hairs, depletion, wetness: 0 } });

  assert.deepEqual(errors, []);
  await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
} finally { await browser.close(); }
