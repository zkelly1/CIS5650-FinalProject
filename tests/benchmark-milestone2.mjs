import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const browser = await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu','--disable-background-timer-throttling']});
const baseline = JSON.parse(await readFile('performance/milestone1-fibers.json','utf8'));
const summary = a => { const s=[...a].sort((a,b)=>a-b); return {samples:s.length,medianMs:s[Math.floor(s.length*.5)],p95Ms:s[Math.floor(s.length*.95)]}; };
try {
  const page=await browser.newPage({viewport:{width:1100,height:900},deviceScaleFactor:1});
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  const url=new URL(process.env.TEST_URL||'http://127.0.0.1:5181');
  url.searchParams.set('test','');url.searchParams.set('grid','1024');
  await page.goto(url.href);
  await page.waitForFunction(()=>window.inkTest||document.querySelector('#status').dataset.error);
  assert.equal(await page.locator('#status').getAttribute('data-error'),null);
  await page.evaluate(()=>inkTest.pause());
  const hardware=await page.evaluate(()=>({vendor:inkTest.hardware.vendor,architecture:inkTest.hardware.architecture,description:inkTest.hardware.description}));
  const configuration=await page.evaluate(()=>inkTest.configuration);
  assert.deepEqual(configuration.grid,[1024,1024,8]);
  const results=[];
  for (const thickness of [.06,.15,.60]) {
    await page.evaluate(({thickness,settings})=>{inkTest.params({...settings,thickness});inkTest.color('#0e1116');inkTest.clear();for(let i=0;i<32;i++)inkTest.stroke(.97,(i+.5)/32,.03,(i+.5)/32,.1);},{thickness,settings:baseline.settings});
    await page.evaluate(()=>inkTest.step(1));
    const settings=await page.evaluate(()=>Object.fromEntries([...document.querySelectorAll('[data-param]')].map(e=>[e.dataset.param,Number(e.value)])));
    for(const [key,value] of Object.entries(baseline.settings))assert.equal(settings[key],value,`Matches Milestone 1 ${key}`);
    const before=await page.evaluate(()=>inkTest.read());
    const timing=await page.evaluate(()=>inkTest.benchmark());
    const after=await page.evaluate(()=>inkTest.read());
    const frame=await page.evaluate(()=>inkTest.benchmarkFrame());
    assert.deepEqual(frame.canvas,baseline.canvas,'Matches Milestone 1 canvas');
    await page.evaluate(()=>inkTest.resume());await page.waitForTimeout(6000);
    const frames=await page.evaluate(()=>{inkTest.pause();return inkTest.frames().slice(-300)});
    assert.equal(before.invalid,0);assert.equal(after.invalid,0);
    const drift=Math.abs(after.pigment/before.pigment-1);assert(drift<.0001);
    assert.equal(await page.locator('#status').getAttribute('data-error'),null);
    const substeps=Math.max(1,Math.ceil((.96+2*(.0012/60/(thickness/8)**2))/.95));
    assert(frames.every(ms=>Number.isFinite(ms)&&ms>0));
    const rates=summary(frames.map(ms=>1000/ms));
    const animationFPS={samples:rates.samples,medianFPS:rates.medianMs,p95FPS:rates.p95Ms};
    results.push({thickness,substeps,settings,canvas:frame.canvas,wetCellsBefore:before.wet,wetCellsAfter:after.wet,pigmentRelativeDrift:drift,simulationGPU:summary(timing.gpu),simulationWall:summary(timing.wall),fullFrameGPU:summary(frame.gpu),fullFrameWall:summary(frame.wall),animationFrame:summary(frames),animationFPS,raw:{simulation:timing,frame,frames}});
  }
  assert.deepEqual(errors,[]);
  const result={date:new Date().toISOString(),commit:execFileSync('git',['rev-parse','--short','HEAD'],{encoding:'utf8'}).trim(),workingTree:execFileSync('git',['status','--short'],{encoding:'utf8'}).trim(),browser:browser.version(),hardware,...configuration,viewport:[1100,900],warmupSamples:30,measurementSamples:120,baseline:{source:'performance/milestone1-fibers.json',browser:baseline.browser,settings:baseline.settings,grid:baseline.grid,canvas:baseline.canvas},method:'Milestone 1 settings, 1024-square resolution, canvas and workload; extended to eight depth layers. 32 horizontal strokes, roughness 0.75; simulation timestamp encloses all substeps of one nominal 1/60-second step; full frame adds one stroke segment and rendering; RAF is headless scheduling, not displayed FPS. Chrome is the currently installed version; procedural fibers are unseeded as in Milestone 1.',results,errors};
  await writeFile('performance/milestone2-1024.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify({...result,results:results.map(({raw,...r})=>r)},null,2));
} finally {await browser.close();}
