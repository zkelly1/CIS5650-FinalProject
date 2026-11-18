import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const code=ts.transpile((await readFile('src/paper-view.ts','utf8')).replace("import { DEPTH_LAYERS } from './gpu-grid';", 'const DEPTH_LAYERS = 8;'),{module:ts.ModuleKind.ESNext});
const {paperPoint}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
assert.equal(paperPoint(0,0,1,0,0,4).layer,0);
assert.equal(paperPoint(0,0,1,Math.PI,0,4).layer,7);
assert.equal(paperPoint(0,0,1,Math.PI/2,0,4),undefined);
assert.equal(paperPoint(.99,.99,1,0,0,4),undefined);
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu']});
try {
 const p=await browser.newPage({viewport:{width:1200,height:1000}});
 await p.goto((process.env.TEST_URL||'http://127.0.0.1:5181')+'/?test');await p.waitForFunction(()=>window.inkTest);await p.evaluate(()=>inkTest.pause());
 const c=p.locator('#canvas');const box=await c.boundingBox();
 // Real ray-picked clicks on both sides, then a boundary/stability stress case.
 const scrollBefore=await p.evaluate(()=>scrollY);
 await p.mouse.click(box.x+box.width/2,box.y+box.height/2);
 assert.equal(await p.evaluate(()=>scrollY),scrollBefore,'Canvas focus must not scroll the page away from the initial stroke');
 let state=await p.evaluate(()=>inkTest.read());assert(state.layers[0].pigment>0);assert.equal(state.layers[7].pigment,0);
 await p.evaluate(()=>{inkTest.clear();inkTest.view(Math.PI);});
 await p.mouse.click(box.x+box.width/2,box.y+box.height/2);
 state=await p.evaluate(()=>inkTest.read());assert(state.layers[7].pigment>0);assert.equal(state.layers[0].pigment,0);
 await p.evaluate(()=>{inkTest.params({thickness:.05,diffusion:.24,roughness:1});inkTest.clear();inkTest.stroke(0,0);inkTest.render();});
 const before=await p.evaluate(()=>inkTest.read());await p.evaluate(()=>inkTest.step(120));
 state=await p.evaluate(()=>inkTest.read());assert.equal(state.invalid,0);assert(Math.abs(state.pigment/before.pigment-1)<.0001);
 const timing=await p.evaluate(()=>inkTest.benchmark());assert(timing.wall.length===120);
 assert.equal(await p.locator('#status').getAttribute('data-error'),null);
 await p.setViewportSize({width:390,height:844});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 console.log('PASS: front/back mouse picking, edges, minimum-thickness stability, conservation, timestamp queries, mobile layout');
}finally{await browser.close();}
