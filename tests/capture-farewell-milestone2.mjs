// Three languages from Milestone 1, redrawn with colored ink, paper presets,
// editable brush styles and actual GPU bristles. No text or artwork overlays.
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {glyphs,widths,chineseGlyphs} from './farewell-glyphs.mjs';
const out='media/frames/farewell-milestone2';await mkdir(out,{recursive:true});
const preview=process.env.PREVIEW==='1';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu']});
const page=await browser.newPage({viewport:{width:1400,height:1240},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const durations=[];let frame=0,mode='roundhand',palette=['#438fcc','#9f67c5'];
const snap=async(ms=40)=>{if(preview)return;durations.push(ms);await page.screenshot({path:`${out}/${String(frame++).padStart(4,'0')}.png`,fullPage:true});};
const blend=(a,b,t)=>'#'+[1,3,5].map(i=>Math.round(parseInt(a.slice(i,i+2),16)*(1-t)+parseInt(b.slice(i,i+2),16)*t).toString(16).padStart(2,'0')).join('');
async function params(values){for(const [k,v] of Object.entries(values))await page.locator(`[data-param="${k}"]`).fill(String(v));}
async function hairs(values){for(const [k,v] of Object.entries(values))await page.locator(`[data-bristle="${k}"]`).fill(String(v));}
async function trace(d,x,y,s,base=4,bristle=false){
 const points=await page.evaluate(({d,x,y,s,slant})=>{const p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('d',d);const length=p.getTotalLength(),n=Math.max(10,Math.ceil(length*s*512/2));return Array.from({length:n+1},(_,i)=>{const q=p.getPointAtLength(length*i/n);return [x+(q.x+slant*(.8-q.y))*s,y+q.y*s];});},{d,x,y,s,slant:bristle?0:mode==='roundhand'?.38:mode==='cyrillic'?.28:0});
 if(bristle)await page.evaluate(()=>inkTest.bristles.begin());
 const segments=[];
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],dx=b[0]-a[0],dy=b[1]-a[1];
  const pressure=mode==='xingshu'?base*(.35+.65*Math.sin(Math.PI*i/points.length)**.65):(dy>0?1+(base-1)*(dy/Math.max(1e-9,Math.hypot(dx,dy)))**2:1);
  segments.push({a,b,r:bristle?base:Math.max(1,Math.round(pressure*Math.min(1,i/4,(points.length-i)/4))),color:blend(...palette,Math.max(0,Math.min(1,(b[0]-.08)/.84)))});
 }
 for(let i=0;i<segments.length;i+=6){
  await page.evaluate(async({segments,bristle,seconds})=>{const input=document.querySelector('[data-param="radius"]');for(const q of segments){input.value=String(q.r);input.dispatchEvent(new Event('input',{bubbles:true}));inkTest.color(q.color);(bristle?inkTest.bristles.stroke:inkTest.stroke)(...q.b,...q.a,seconds);}await inkTest.step(1);},{segments:segments.slice(i,i+6),bristle,seconds:bristle?.0016:mode==='xingshu'?.0024:.005});await snap();
 }
}
async function textLine(text,y,s){let x=(1-[...text].reduce((n,c)=>n+widths[c],0)*s)/2;for(const c of text){for(const d of glyphs[c]||[])await trace(d,x,y,s);x+=widths[c]*s;}}
async function scene(paper,style,colors){
 await page.locator('#paper').selectOption(paper);await page.waitForFunction(()=>!document.querySelector('#paper').disabled);
 await page.locator('#bristle-toggle').uncheck();await page.locator('#brush-style').selectOption('fine-detail');
 await params({thickness:.06,diffusion:.04,waterLoad:1.5,absorption:2,settling:3,roughness:.25,dryness:paper==='rough-cardboard'?.1:0});
 await page.evaluate(()=>{inkTest.clear();inkTest.view(0,0,2.65);});mode=style;palette=colors;await snap(400);
}
async function flourish(colors,dryness=.2){
 palette=colors;await page.locator('#brush-style').selectOption('flowing-ink');await params({radius:5,diffusion:.04,waterLoad:3,absorption:2,settling:3,roughness:.35,dryness});
 await page.locator('#bristle-toggle').check();await hairs({bristleCount:96,bristleRadius:.6,deformation:.65,pressure:.45,depletion:.4,wetness:.3});await snap(500);
 await trace('M .06 .78 C .23 .98 .48 .69 .67 .80 C .82 .90 .96 .83 .93 .73',0,0,1,5,true);
 await hairs({bristleCount:48,pressure:.2,deformation:.8,depletion:.65});await snap(200);
 palette=[...colors].reverse();
 await trace('M .12 .87 C .30 .98 .67 .72 .88 .79',0,0,1,3,true);
}
async function still(name){await page.evaluate(()=>inkTest.step(8));await page.screenshot({path:`media/farewell-m2-${name}.png`,fullPage:true});await snap(1700);}
try{
 await page.addInitScript(()=>{let seed=56502;Math.random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};});
 await page.goto((process.env.TEST_URL||'http://127.0.0.1:5182')+'/?test');await page.waitForFunction(()=>window.inkTest);await page.evaluate(()=>inkTest.pause());
 await scene('default-paper','roundhand',['#237aa9','#b45b9a']);
 await textLine('See you',.24,.15);await textLine('next time!',.51,.135);
 await flourish(['#2cabb8','#dd7b70']);await still('english');
 await scene('crumpled-paper','cyrillic',['#6e549f','#bb4e78']);
 await textLine('До',.18,.22);await textLine('встречи!',.48,.14);
 await flourish(['#8e6ab6','#e3a34e'],.3);await still('russian');
 await scene('rough-cardboard','xingshu',['#207e86','#345594']);
 for(const [x,paths] of chineseGlyphs)for(const d of paths)await trace(d,x,.33,.23,5);
 await trace('M .23 .1 Q .2 .41 .14 .68',.87,.33,.2,4);await trace('M .14 .89 L .15 .88',.87,.33,.2,3);
 await flourish(['#49a29a','#b68150'],.55);
 await page.locator('#bristle-toggle').uncheck();await page.locator('#brush-style').selectOption('fine-detail');await params({radius:1,dryness:.15});palette=['#c45147','#c45147'];
 await trace('M .80 .65 L .87 .65 L .87 .72 L .80 .72 Z',0,0,1,2);
 await trace('M .82 .67 L .85 .70 M .85 .67 L .82 .70',0,0,1,1);
 await still('chinese');
 if(!preview){
  for(let i=1;i<=8;i++){await page.evaluate(d=>inkTest.view(0,0,d),2.65+.55*i/8);await snap(40);}
  for(let i=1;i<=72;i++){const a=i/72*Math.PI*2;await page.evaluate(a=>inkTest.view(a,.12*Math.sin(a),3.2),a);await snap(i===36?700:40);}
  await page.evaluate(()=>inkTest.view(0,0,2.65));await snap(1400);
 }
 assert.deepEqual(errors,[]);assert.equal(await page.locator('#status').getAttribute('data-error'),null);assert.equal((await page.evaluate(()=>inkTest.read())).invalid,0);
 await writeFile('performance/farewell-milestone2-capture.json',JSON.stringify({frames:frame,frameDirectory:out,durationsMs:durations,languages:['English','Russian','Chinese'],phrases:['See you next time!','До встречи!','下次见!'],papers:['default-paper','crumpled-paper','rough-cardboard'],thicknessMm:.06,rotationDegrees:preview?0:360,errors},null,2));
 console.log(JSON.stringify({frames:frame,errors}));
}finally{await browser.close();}
