import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const b=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu']});
const p=await b.newPage({viewport:{width:1440,height:1040}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
try {
 await p.goto((process.env.TEST_URL||'http://127.0.0.1:5180')+'/?test');await p.waitForFunction(()=>window.inkTest||document.querySelector('#status').dataset.error);
 console.log(await p.locator('#status').textContent());assert.equal(await p.locator('#status').getAttribute('data-error'),null);
 await p.evaluate(()=>inkTest.pause());
 // Strict color validation; invalid input never changes selected ink.
 await p.locator('#color-hex').fill('#16BFE8');assert.equal(await p.locator('#color-r').inputValue(),'22');
 await p.locator('#color-hex').fill('#NOPE');assert.equal(await p.locator('#color-hex').getAttribute('aria-invalid'),'true');
 await p.locator('#color-hex').fill('#16BFE8');
 const k=hex=>hex.match(/[a-f\d]{2}/gi).map(v=>{const c=parseInt(v,16)/255;return -Math.log(Math.max(.001,c<=.04045?c/12.92:((c+.055)/1.055)**2.4));});
 const cyan=k('16bfe8'),yellow=k('ffe52b');
 async function deposit(first,second,extra=0){return p.evaluate(async({first,second,extra})=>{
  inkTest.clear();inkTest.color(first);inkTest.stroke(.5,.5,.5,.5,.03);
  inkTest.color(second);inkTest.stroke(.5,.5,.5,.5,.03);
  for(let j=0;j<extra;j++)inkTest.stroke(.5,.5,.5,.5,.03);
  inkTest.render();return inkTest.sample(.5,.5);
 },{first,second,extra});}
 const mixed=await deposit('#16bfe8','#ffe52b');const mass=mixed.state[1];
 for(let c=0;c<3;c++)assert(Math.abs(mixed.mobileAbsorption[c]/mass-(cyan[c]+yellow[c])/2)<1e-5,'Mass-weighted mixture');
 const reverse=await deposit('#ffe52b','#16bfe8');
 for(let c=0;c<3;c++)assert(Math.abs(reverse.mobileAbsorption[c]-mixed.mobileAbsorption[c])<1e-5,'Order independent');
 const more=await deposit('#16bfe8','#ffe52b',2);
 for(let c=0;c<3;c++)assert(Math.abs(more.mobileAbsorption[c]/more.state[1]-(cyan[c]+3*yellow[c])/4)<1e-5,'Unequal pigment amounts');
 const before=await p.evaluate(()=>inkTest.read());await p.evaluate(()=>inkTest.step(120));const wet=await p.evaluate(()=>inkTest.read());
 assert(wet.wet>before.wet);assert(wet.water<before.water);assert.equal(wet.invalid,0);
 for(let c=0;c<3;c++)assert(Math.abs(wet.opticalMass[c]/before.opticalMass[c]-1)<.0001,'Optical mass conserved while spreading');
 await p.evaluate(()=>inkTest.step(1080));const dry=await p.evaluate(()=>inkTest.read());assert.equal(dry.water,0);assert.equal(dry.mobile,0);assert.equal(dry.invalid,0);
 for(let c=0;c<3;c++)assert(Math.abs(dry.opticalMass[c]/before.opticalMass[c]-1)<.0001,'Optical mass conserved through drying');
 await p.evaluate(()=>inkTest.clear());const cleared=await p.evaluate(()=>inkTest.read());assert.equal(cleared.pigment,0);assert(cleared.opticalMass.every(n=>n===0));
 // Native controls, keyboard access, and responsive overflow.
 await p.locator('#color-r').fill('200');assert((await p.locator('#color-hex').inputValue()).startsWith('#C8'));
 await p.locator('#color-field').focus();await p.keyboard.press('ArrowLeft');
 await p.screenshot({path:'media/color-picker-desktop.png'});
 await p.setViewportSize({width:390,height:844});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:'media/color-picker-mobile.png',fullPage:true});
 assert.equal(await p.locator('#status').getAttribute('data-error'),null);
 assert.deepEqual(errors,[]);console.log('PASS: shader startup, weighted mixing, order independence, transport/settling conservation, drying, clear, picker inputs, keyboard, responsive layout');
}finally{await b.close();}
