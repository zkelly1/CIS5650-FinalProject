import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

// Capture the real interface, with fixed simulation steps for repeatable timing.
const base = process.env.TEST_URL || 'http://127.0.0.1:5174';
await mkdir('media/frames/interface', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/?test`);
  await page.waitForFunction(() => window.inkTest || document.querySelector('#status').dataset.error);
  assert.equal(await page.locator('#status').getAttribute('data-error'), null);
  await page.evaluate(() => { window.inkTest.pause(); window.inkTest.clear(); });
  await page.locator('[data-param="radius"]').fill('8');
  await page.locator('[data-param="roughness"]').fill('0.8');
  await page.locator('#zoom-in').click();
  const points = Array.from({ length: 96 }, (_, i) => {
    const a = i / 95 * Math.PI * 2.14;
    return [0.49 + 0.23 * Math.sin(a), 0.46 - 0.26 * Math.cos(a)];
  });
  for (let f = 0; f < 48; f++) {
    await page.evaluate(async ({ points, f }) => {
      const t = window.inkTest;
      for (let j = f * 2; j < f * 2 + 2; j++) {
        const p = points[j], q = points[Math.max(0, j - 1)];
        t.stroke(...p, ...q, 1 / 30);
      }
      await t.step(4);
    }, { points, f });
    await page.screenshot({ path: `media/frames/interface/${String(f).padStart(3, '0')}.png` });
  }
  await page.screenshot({ path: 'media/interface-drawing.png' });
  await page.locator('#canvas').focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await page.screenshot({ path: 'media/interface-perspective.png' });
  for (let f = 48; f < 64; f++) {
    await page.evaluate(() => window.inkTest.step(20));
    await page.screenshot({ path: `media/frames/interface/${String(f).padStart(3, '0')}.png` });
  }
  assert.deepEqual(errors, []);
  console.log('Captured drawing, controls, and perspective; no browser errors.');
} finally { await browser.close(); }
