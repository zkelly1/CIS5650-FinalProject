import {chromium} from 'playwright';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu','--disable-background-timer-throttling']});
try{
const page=await browser.newPage({viewport:{width:1100,height:900}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(process.env.TEST_URL||'http://127.0.0.1:5177/?test');
await page.waitForFunction(()=>window.inkTest);
await page.evaluate(()=>inkTest.pause());
await page.locator('[data-param="roughness"]').fill('0.75');
const setup=await page.evaluate(()=>({hardware:{vendor:inkTest.hardware.vendor,architecture:inkTest.hardware.architecture},settings:Object.fromEntries([...document.querySelectorAll('[data-param]')].map(e=>[e.dataset.param,Number(e.value)]))}));
const wetBefore=await page.evaluate(async()=>{inkTest.clear();for(let i=0;i<32;i++)inkTest.stroke(.97,(i+.5)/32,.03,(i+.5)/32,.1);await inkTest.step(1);return inkTest.read()});
const timing=await page.evaluate(()=>inkTest.benchmark());
const wetAfter=await page.evaluate(()=>inkTest.read());
const fullFrame=await page.evaluate(()=>inkTest.benchmarkFrame());
await page.evaluate(()=>inkTest.resume());await page.waitForTimeout(6000);
const frames=await page.evaluate(()=>{inkTest.pause();return inkTest.frames().slice(-300)});
const summary=a=>{assert(a.length>0);const s=[...a].sort((a,b)=>a-b);return {samples:s.length,medianMs:s[Math.floor(s.length*.5)],p95Ms:s[Math.floor(s.length*.95)]}};
assert.deepEqual(errors,[]);assert.equal(wetBefore.invalid,0);assert.equal(wetAfter.invalid,0);
const result={date:'2026-11-11',browser:browser.version(),...setup,grid:[1024,1024],warmupSteps:30,wetBefore,wetAfter,fullFrameGPU:summary(fullFrame.gpu),fullFrameWall:summary(fullFrame.wall),canvas:fullFrame.canvas,simulationGPU:summary(timing.gpu),simulationSubmitAndWait:summary(timing.wall),animationFrame:summary(frames),raw:{fullFrameGPU:fullFrame.gpu,fullFrameWall:fullFrame.wall,gpuMs:timing.gpu,submitWaitMs:timing.wall,frameIntervalsMs:frames},errors};
await writeFile('performance/milestone1-fibers.json',JSON.stringify(result,null,2));console.log(JSON.stringify({...result,raw:undefined},null,2));
}finally{await browser.close()}
