import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const browser = await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu','--disable-background-timer-throttling']});
const summary = a => { const s=[...a].sort((a,b)=>a-b); return {samples:s.length,medianMs:s[Math.floor(s.length*.5)],p95Ms:s[Math.floor(s.length*.95)]}; };
try {
  const page=await browser.newPage({viewport:{width:1100,height:900},deviceScaleFactor:1});
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto((process.env.TEST_URL||'http://127.0.0.1:5181')+'/?test');
  await page.waitForFunction(()=>window.inkTest);
  await page.evaluate(()=>inkTest.pause());
  const hardware=await page.evaluate(()=>({vendor:inkTest.hardware.vendor,architecture:inkTest.hardware.architecture,description:inkTest.hardware.description}));
  const results=[];
  for (const thickness of [.06,.15,.60]) {
    await page.evaluate(t=>{inkTest.params({thickness:t,roughness:.75});inkTest.clear();for(let i=0;i<32;i++)inkTest.stroke(.97,(i+.5)/32,.03,(i+.5)/32,.1);},thickness);
    await page.evaluate(()=>inkTest.step(1));
    const settings=await page.evaluate(()=>Object.fromEntries([...document.querySelectorAll('[data-param]')].map(e=>[e.dataset.param,Number(e.value)])));
    const before=await page.evaluate(()=>inkTest.read());
    const timing=await page.evaluate(()=>inkTest.benchmark());
    const after=await page.evaluate(()=>inkTest.read());
    const frame=await page.evaluate(()=>inkTest.benchmarkFrame());
    await page.evaluate(()=>inkTest.resume());await page.waitForTimeout(6000);
    const frames=await page.evaluate(()=>{inkTest.pause();return inkTest.frames().slice(-300)});
    assert.equal(before.invalid,0);assert.equal(after.invalid,0);
    const drift=Math.abs(after.pigment/before.pigment-1);assert(drift<.0001);
    assert.equal(await page.locator('#status').getAttribute('data-error'),null);
    const substeps=Math.max(1,Math.ceil((.96+2*(.0012/60/(thickness/8)**2))/.95));
    results.push({thickness,substeps,settings,canvas:frame.canvas,wetCellsBefore:before.wet,wetCellsAfter:after.wet,pigmentRelativeDrift:drift,simulationGPU:summary(timing.gpu),simulationWall:summary(timing.wall),fullFrameGPU:summary(frame.gpu),fullFrameWall:summary(frame.wall),animationFrame:summary(frames),raw:{simulation:timing,frame,frames}});
  }
  assert.deepEqual(errors,[]);
  const result={date:new Date().toISOString(),commit:execFileSync('git',['rev-parse','--short','HEAD'],{encoding:'utf8'}).trim(),browser:browser.version(),hardware,grid:[512,512,8],stateMiB:192,viewport:[1100,900],warmupSamples:30,measurementSamples:120,method:'32 horizontal strokes, roughness 0.75; simulation timestamp encloses all substeps of one nominal 1/60-second step; full frame adds one stroke segment and rendering; RAF is headless scheduling, not displayed FPS.',results,errors};
  await writeFile('performance/milestone2.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify({...result,results:results.map(({raw,...r})=>r)},null,2));
} finally {await browser.close();}
