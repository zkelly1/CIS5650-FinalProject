import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
await mkdir('.presentation-build/milestone2', { recursive: true });
const browser = await chromium.launch({ channel:'chrome', headless:true, args:['--enable-unsafe-webgpu'] });
try {
  const page = await browser.newPage({ viewport:{width:1400,height:1160} });
  const errors=[]; page.on('pageerror',error=>errors.push(error.message));
  await page.goto((process.env.TEST_URL||'http://127.0.0.1:5181')+'/?test');
  await page.waitForFunction(()=>window.inkTest);
  await page.evaluate(()=>{inkTest.pause();inkTest.params({thickness:.6});inkTest.color('#ED32A0');inkTest.stroke(.5,.5);inkTest.render();});
  const before=await page.evaluate(()=>inkTest.read());
  const style=page.locator('#brush-style'), value=k=>page.locator(`[data-param="${k}"]`).inputValue();
  await style.selectOption('soft-wash');
  assert.equal(await value('radius'),'18');assert.equal(await value('waterLoad'),'8');
  await page.locator('[data-param="radius"]').fill('13');
  assert.equal(await value('radius'),'13');
  await page.locator('#reset-sliders').click();
  assert.equal(await value('radius'),'18');
  await style.selectOption('fine-detail');
  assert.equal(await value('radius'),'2');assert.equal(await value('waterLoad'),'1.5');
  // Every style and restoration preserves the existing GPU drawing, sheet, and color.
  for(const preset of ['dry-ink','flowing-ink','round-brush'])await style.selectOption(preset);
  assert.equal(await value('thickness'),'0.6');assert.equal(await page.locator('#color-hex').inputValue(),'#ED32A0');
  const after=await page.evaluate(()=>inkTest.read());
  assert.equal(after.pigment,before.pigment);assert.deepEqual(after.opticalMass,before.opticalMass);
  // A selected style is an editable starting point, and browser keyboard selection works.
  await style.focus();await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
  assert.equal(await style.inputValue(),'soft-wash');
  await page.locator('[data-param="diffusion"]').fill('0.09');
  await page.locator('[data-param="roughness"]').fill('0.45');
  assert.equal(await value('diffusion'),'0.09');assert.equal(await value('roughness'),'0.45');
  for(const width of [1400,1000,390]) {
    await page.setViewportSize({width,height:1160});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`No overflow at ${width}px`);
    assert(await style.isVisible());
    await page.screenshot({path:`.presentation-build/milestone2/presets-${width}.png`,fullPage:true});
  }
  assert.equal(await page.locator('#status').getAttribute('data-error'),null);assert.deepEqual(errors,[]);
  console.log('PASS: preset selection, editable defaults, restore, keyboard, drawing/color/thickness preservation, responsive layout');
} finally {await browser.close();}
