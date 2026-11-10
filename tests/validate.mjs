import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const base = process.env.TEST_URL || 'http://127.0.0.1:5174';
await mkdir('performance', {recursive:true});
await mkdir('img/frames', {recursive:true});
const browser = await chromium.launch({channel:'chrome', headless:true, args:['--enable-unsafe-webgpu','--disable-background-timer-throttling']});
const page = await browser.newPage({viewport:{width:1100,height:900},deviceScaleFactor:1});
const errors = [];
page.on('pageerror', e=>errors.push(e.message));
page.on('console', m=>{if(m.type()==='error' && !m.text().includes('404')) errors.push(m.text());});
try {
  await page.goto(`${base}/?test`);
  await page.waitForFunction(()=>window.inkTest || document.querySelector('#status').dataset.error);
  assert.equal(await page.locator('#status').getAttribute('data-error'),null,await page.locator('#status').textContent());
  const setup = await page.evaluate(()=>{const t=window.inkTest;t.pause();t.clear();return {userAgent:navigator.userAgent,vendor:t.hardware.vendor,architecture:t.hardware.architecture};});
  const deposit = await page.evaluate(async()=>{const t=window.inkTest;t.stroke(.5,.5);await t.step(1);return t.read();});
  const spread = await page.evaluate(async()=>{const t=window.inkTest;await t.step(119);return t.read();});
  const dry = await page.evaluate(async()=>{const t=window.inkTest;await t.step(1080);return t.read();});
  assert(spread.wet>deposit.wet, 'Wet footprint spreads');
  assert(spread.water<deposit.water, 'Water dries');
  assert(dry.water===0 && dry.mobile===0, 'All ink settles after 20 seconds');
  for(const state of [deposit,spread,dry]) {assert.equal(state.invalid,0);assert(Math.abs(state.pigment/deposit.pigment-1)<0.0001,'Pigment conserved');}
  await page.evaluate(()=>{window.inkTest.clear();window.inkTest.stroke(0,0);});
  const edgeStart=await page.evaluate(async()=>{await window.inkTest.step(1);return window.inkTest.read();});
  const edgeEnd=await page.evaluate(async()=>{await window.inkTest.step(240);return window.inkTest.read();});
  assert(Math.abs(edgeEnd.pigment/edgeStart.pigment-1)<0.0001,'No pigment lost at sheet edges');
  await page.locator('#clear').click();
  assert.equal((await page.evaluate(()=>window.inkTest.read())).pigment,0);
  // Real mouse input, zoom/rotation/reset must preserve simulation contents.
  const box=await page.locator('#canvas').boundingBox();
  const cx=box.x+box.width/2, cy=box.y+box.height/2;
  await page.mouse.move(cx-70,cy);await page.mouse.down();await page.mouse.move(cx+70,cy,{steps:25});await page.mouse.up();
  const mouse=await page.evaluate(()=>window.inkTest.read());assert(mouse.pigment>0);
  await page.locator('#zoom-in').click();await page.locator('#canvas').focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowDown');
  await page.screenshot({path:'img/rotated-ink.png'});
  await page.locator('#reset').click();
  assert.equal((await page.evaluate(()=>window.inkTest.read())).pigment,mouse.pigment);
  const sampling=[];
  for (const count of [15,120]) {
    sampling.push(await page.evaluate(async(count)=>{const t=window.inkTest;t.clear();for(let i=1;i<=count;i++)t.stroke(.25+.5*i/count,.5,.25+.5*(i-1)/count,.5,1/count);t.render();return t.read();},count));
  }
  assert(Math.abs(sampling[0].pigment/sampling[1].pigment-1)<0.03,'Deposition is stable across sample rates');
  // A deterministic looping brush stroke with overlapping strokes.
  await page.locator('#clear').click();await page.locator('#zoom-in').click();await page.locator('#zoom-in').click();
  const points=[];
  for(let i=0;i<=90;i++){const a=i/90*Math.PI*2.35;points.push([.48+.23*Math.sin(a),.45-.26*Math.cos(a)]);}
  for(let i=0;i<=30;i++)points.push([.25+i/30*.52,.72-.08*Math.sin(i/30*Math.PI)]);
  await page.evaluate(()=>window.inkTest.clear());
  for(let f=0;f<61;f++){
    await page.evaluate(async({points,f})=>{const t=window.inkTest;for(let j=f*2;j<Math.min(points.length,f*2+2);j++){const p=points[j],q=(j===0||j===91)?p:points[j-1];t.stroke(p[0],p[1],q[0],q[1],1/30);}await t.step(4);},{points,f});
    await page.locator('#canvas').screenshot({path:`img/frames/stroke-${String(f).padStart(3,'0')}.png`});
  }
  await page.screenshot({path:'img/ink-wet.png'});
  for(let f=61;f<91;f++){
    await page.evaluate(()=>window.inkTest.step(20));
    await page.locator('#canvas').screenshot({path:`img/frames/stroke-${String(f).padStart(3,'0')}.png`});
  }
  await page.screenshot({path:'img/ink-dry.png'});
  // Close-up crop of a wet dot: captures are actual GPU output at fixed steps.
  await page.evaluate(async()=>{const t=window.inkTest;t.clear();t.stroke(.5,.5,.5,.5,.1);await t.step(1);});
  const crop={x:cx-65,y:cy-65,width:130,height:130};
  for(let f=0;f<61;f++){
    await page.screenshot({path:`img/frames/spread-${String(f).padStart(3,'0')}.png`,clip:crop});
    await page.evaluate(()=>window.inkTest.step(10));
  }
  const dryTiming=await page.evaluate(()=>window.inkTest.benchmark());
  const wetBefore=await page.evaluate(async()=>{const t=window.inkTest;t.clear();for(let i=0;i<32;i++)t.stroke(.97,(i+.5)/32,.03,(i+.5)/32,.1);await t.step(1);return t.read();});
  const timing=await page.evaluate(()=>window.inkTest.benchmark());
  const wetAfter=await page.evaluate(()=>window.inkTest.read());
  await page.evaluate(()=>window.inkTest.resume());await page.waitForTimeout(6000);
  const frames=await page.evaluate(()=>{window.inkTest.pause();return window.inkTest.frames().slice(-300);});
  const summary=arr=>{const a=[...arr].sort((a,b)=>a-b);return {samples:a.length,medianMs:a[Math.floor(a.length*.5)],p95Ms:a[Math.floor(a.length*.95)]};};
  assert.deepEqual(errors,[]);
  const result={date:'2026-11-10',browser:browser.version(),...setup,grid:[1024,1024],deposit,spread,dry,edgeStart,edgeEnd,mouse,sampling,wetBefore,wetAfter,sparseSimulationGPU:summary(dryTiming.gpu),simulationGPU:summary(timing.gpu),simulationSubmitAndWait:summary(timing.wall),animationFrame:summary(frames),errors};
  await writeFile('performance/milestone1.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
} finally {await browser.close();}
