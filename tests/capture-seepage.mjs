import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu']});
const page=await browser.newPage({viewport:{width:1440,height:1240}});
const errors=[]; page.on('pageerror',e=>errors.push(e.message));
await mkdir('media/frames/seepage',{recursive:true});
let frame=0;
const capture=async()=>page.screenshot({path:`media/frames/seepage/${String(frame++).padStart(4,'0')}.png`,fullPage:true});
try {
 await page.goto((process.env.TEST_URL||'http://127.0.0.1:5181')+'/?test');
 await page.waitForFunction(()=>window.inkTest||document.querySelector('#status').dataset.error);
 assert.equal(await page.locator('#status').getAttribute('data-error'),null);
 await page.evaluate(()=>inkTest.pause());
 const results=[];
 for(const thickness of [.06,.15,.6]) {
  await page.locator('#brush-style').selectOption('flowing-ink');
  await page.evaluate(t=>{inkTest.params({thickness:t,diffusion:.18,absorption:.3,settling:.4,waterLoad:8,radius:12,roughness:0});inkTest.clear();inkTest.view(0,0,3.6);},thickness);
  // Capture annotation only. The paper, ink and controls are the real application.
  const label=async text=>page.evaluate(text=>{let e=document.querySelector('#experiment');if(!e){e=document.createElement('p');e.id='experiment';e.style.cssText='margin:8px 0;color:#b9dbe8;font:600 18px system-ui';document.querySelector('#canvas').before(e);}e.textContent=text;},text);
  await label(`${thickness.toFixed(2)} mm paper | Same ink, water and drying settings | Painting the front`);
  const strokes=[];
  // Three flowing colored waves, with real overlapping strokes.
  for(let c=0;c<3;c++)for(let j=0;j<48;j++) {
   const x=.2+j*.6/48, x1=.2+(j+1)*.6/48;
   const y=x=>.35+c*.15+.10*Math.sin((x-.2)*Math.PI*4);
   strokes.push({x:x1,y:y(x1),px:x,py:y(x),color:['#16bfe8','#ed32a0','#ffe52b'][c]});
  }
  for(let i=0;i<strokes.length;i+=4) {
   await page.evaluate(strokes=>{for(const s of strokes){inkTest.color(s.color);inkTest.stroke(s.x,s.y,s.px,s.py,.025);}inkTest.render();},strokes.slice(i,i+4));await capture();
  }
  const initial=await page.evaluate(()=>inkTest.read());
  assert.equal(initial.layers[7].pigment,0,'No front pigment appears on back before transport');
  await label(`${thickness.toFixed(2)} mm paper | 4 seconds of seepage and drying`);
  for(let i=0;i<40;i++){await page.evaluate(()=>inkTest.step(6));await capture();}
  const final=await page.evaluate(()=>inkTest.read());
  assert.equal(final.invalid,0);assert(Math.abs(final.pigment/initial.pigment-1)<.0001,'Pigment conservation');
  for(let c=0;c<3;c++)assert(Math.abs(final.opticalMass[c]/initial.opticalMass[c]-1)<.0001,'Color conservation');
  results.push({thickness,backFraction:final.layers[7].pigment/final.pigment,layers:final.layers,initialPigment:initial.pigment,finalPigment:final.pigment});
  for(let i=0;i<=96;i++) {
   const angle=i/96*Math.PI*2;
   await label(`${thickness.toFixed(2)} mm paper | ${i>24&&i<72?'Back: only pigment that penetrated the sheet':'Front and edges'} | 360 degree inspection`);
   await page.evaluate(a=>inkTest.view(a,.16*Math.sin(a),3.6),angle);await capture();
   if(i===48){await page.screenshot({path:`media/seepage-back-${thickness}.png`,fullPage:true});for(let j=0;j<18;j++)await capture();}
  }
 }
 assert(results[0].backFraction>results[1].backFraction*2);
 assert(results[1].backFraction>results[2].backFraction*10);
 // Painting the back deposits there only; changing thickness starts a fresh sheet.
 await page.evaluate(()=>{inkTest.clear();inkTest.stroke(.5,.5,.5,.5,.03,7);inkTest.render();});
 const backPaint=await page.evaluate(()=>inkTest.read());assert.equal(backPaint.layers[0].pigment,0);assert(backPaint.layers[7].pigment>0);
 await page.locator('[data-param="thickness"]').evaluate(el=>{el.value='.2';el.dispatchEvent(new Event('input',{bubbles:true}));});
 assert.equal((await page.evaluate(()=>inkTest.read())).pigment,0);
 assert.deepEqual(errors,[]);assert.equal(await page.locator('#status').getAttribute('data-error'),null);
 await writeFile('performance/seepage-results.json',JSON.stringify({simulatedSeconds:4,results,frames:frame},null,2));
 console.log(JSON.stringify(results.map(({thickness,backFraction})=>({thickness,backFraction})),null,2));
 console.log(`PASS: depth transport, mass conservation, thickness ordering, back deposition, clearing; ${frame} frames`);
}finally{await browser.close();}


