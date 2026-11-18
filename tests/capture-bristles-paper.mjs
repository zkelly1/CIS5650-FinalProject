// Captures frames for media/bristle-paper-demo.gif: the round brush, then the
// bristle brush on three paper presets. Every frame is real GPU output.
// Run with the dev server up:  TEST_URL=http://127.0.0.1:5173 node tests/capture-bristles-paper.mjs
// then:                        python tests/make-bristle-paper-gif.py
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = `${root}media/frames/bristle-paper-full-page`;
await mkdir(out, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1240 } });
const errors = []; page.on('pageerror', e => errors.push(e.message));
let frame = 0;
const capture = async () => page.screenshot({ path: `${out}/${String(frame++).padStart(4, '0')}.png`, fullPage: true });
const hold = async n => { for (let i = 0; i < n; i++) { await page.evaluate(() => inkTest.step(2)); await capture(); } };

try {
  await page.goto((process.env.TEST_URL || 'http://127.0.0.1:5173') + '/?test');
  await page.waitForFunction(() => window.inkTest || document.querySelector('#status').dataset.error);
  assert.equal(await page.locator('#status').getAttribute('data-error'), null, await page.locator('#status').textContent());
  await page.evaluate(() => inkTest.pause());

  // Capture annotation only, placed right above the canvas. The paper, ink and brush are the real application.
  const label = text => page.evaluate(text => {
    let e = document.querySelector('#experiment');
    if (!e) { e = document.createElement('p'); e.id = 'experiment'; e.style.cssText = 'margin:8px 0;color:#b9dbe8;font:600 20px system-ui;text-align:center'; document.querySelector('#canvas').before(e); }
    e.textContent = text;
  }, text);
  await label(' ');
  // Keep the full webpage and controls visible, like the other presentation GIFs.
  const setHairs = async params => {
    for (const [key, value] of Object.entries(params))
      await page.locator(`[data-bristle="${key}"]`).fill(String(value));
  };

  // A wave across the sheet, drawn a few segments per frame like a hand moving.
  const wave = async ({ bristles, y, amp = 0.06, n = 60, perFrame = 3 }) => {
    const point = i => [0.14 + 0.72 * i / n, y + amp * Math.sin(i / n * Math.PI * 2.2)];
    if (bristles) await page.evaluate(() => inkTest.bristles.begin());
    for (let i = 1; i <= n; i += perFrame) {
      await page.evaluate(({ segs, bristles }) => {
        for (const [p, q] of segs) (bristles ? inkTest.bristles.stroke : inkTest.stroke)(p[0], p[1], q[0], q[1], 1 / 60);
        return inkTest.step(1);
      }, { segs: Array.from({ length: Math.min(perFrame, n - i + 1) }, (_, k) => [point(i + k), point(i + k - 1)]), bristles });
      await capture();
    }
  };
  const scene = async (paper, text, params, bristleParams, color) => {
    await page.selectOption('#paper', paper);
    await page.waitForFunction(() => !document.querySelector('#paper').disabled);
    await page.evaluate(({ params, bristleParams, color }) => {
      inkTest.clear(); inkTest.params(params); inkTest.color(color);
      inkTest.view(0, 0, 2.7);
    }, { params, bristleParams, color });
    if (bristleParams) await setHairs(bristleParams);
    await label(text);
  };

  const base = { radius: 12, waterLoad: 5, diffusion: 0.18, absorption: 0.65, settling: 1.1, roughness: 0, dryness: 0 };
  const hairs = { bristleCount: 192, bristleRadius: 0.6, deformation: 0.5, pressure: 0.35, depletion: 0.6, wetness: 0.15 };

  await scene('default-paper', 'Round brush | default paper', base, null, '#0e1116');
  await hold(4);
  await wave({ bristles: false, y: 0.5 });
  await hold(10);

  await page.check('#bristle-toggle');
  await scene('default-paper', 'Bristle brush | individual hairs splay, drag and run dry', base, hairs, '#0e1116');
  await hold(4);
  await wave({ bristles: true, y: 0.38 });
  await setHairs({ pressure: 0.8, deformation: 0.8 });
  await wave({ bristles: true, y: 0.64 });
  await hold(10);

  await scene('crumpled-paper', 'Bristle brush | crumpled-paper preset', { ...base, roughness: 0.5 }, hairs, '#e85b36');
  await hold(4);
  await wave({ bristles: true, y: 0.42 });
  await wave({ bristles: true, y: 0.62, amp: -0.06 });
  await hold(10);

  await scene('rough-cardboard', 'Dry bristle brush | rough-cardboard preset: hairs catch the peaks', { ...base, dryness: 0.6 }, { ...hairs, depletion: 0.4 }, '#1d3a8a');
  await hold(4);
  await wave({ bristles: true, y: 0.4 });
  await wave({ bristles: true, y: 0.62, amp: -0.05 });
  await hold(16);

  assert.deepEqual(errors, []);
  console.log(frame, 'frames in media/frames/bristle-paper-full-page');
} finally { await browser.close(); }
