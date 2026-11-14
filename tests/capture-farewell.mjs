import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
await mkdir('media/frames/farewell-reference',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu']});
const page=await browser.newPage({viewport:{width:1280,height:900}});
await page.goto('http://127.0.0.1:5177/?test');await page.waitForFunction(()=>window.inkTest);
await page.evaluate(()=>{inkTest.pause();inkTest.clear()});
for(const [k,v] of Object.entries({diffusion:.07,roughness:.2,waterLoad:2,absorption:2,settling:3}))await page.locator(`[data-param="${k}"]`).fill(String(v));
await page.locator('#zoom-in').click();
let frame=0;
async function snap(){await page.evaluate(()=>inkTest.step(2));await page.screenshot({path:`media/frames/farewell-reference/${String(frame++).padStart(4,'0')}.png`});}
const glyphs={
 S:['M .8 .18 C .6 -.1 .15 .02 .22 .32 C .26 .5 .78 .45 .7 .75 C .6 1.06 .05 .94 .1 .69'],
 e:['M 0 .76 Q .48 .52 .37 .42 Q .24 .29 .13 .56 Q -.02 .95 .55 .7'],
 o:['M .4 .43 C .07 .29 .02 .9 .3 .82 Q .53 .73 .4 .43 Q .48 .63 .62 .53'],
 u:['M 0 .75 L .19 .4 Q -.05 1.05 .32 .77 L .52 .4 Q .3 1 .68 .7'],
 y:['M 0 .75 L .18 .4 Q -.04 1 .31 .76 L .53 .4 L .25 1.24 Q .02 1.59 -.06 1.24 Q -.1 1.05 .65 .7'],
 n:['M 0 .77 L .2 .4 L .08 .8 Q .39 .18 .48 .45 Q .5 .52 .37 .77 Q .39 .91 .65 .7'],
 x:['M .03 .46 Q .18 .28 .3 .65 Q .36 .97 .62 .72','M .57 .39 Q .29 .67 .04 .86'],
 t:['M 0 .77 Q .29 .54 .4 .05 L .2 .72 Q .15 .97 .58 .7','M .1 .38 L .55 .35'],
 i:['M 0 .77 L .21 .41 Q -.02 .98 .47 .7','M .27 .21 L .28 .19'],
 m:['M 0 .76 L .17 .4 L .06 .81 Q .32 .18 .42 .44 L .3 .8 Q .58 .18 .69 .43 L .56 .77 Q .57 .92 .85 .7'],
 '!':['M .25 .08 L .16 .64','M .14 .82 L .15 .8'],
 Д:['M .08 .79 Q .38 .55 .48 .08 Q .65 -.04 .68 .14 L .51 .76','M -.02 1.05 Q -.05 .75 .17 .75 L .7 .75 L .61 1.02'],
 в:['M 0 .76 Q .47 .34 .46 .05 C .38 -.2 .11 .31 .16 .69 C .2 1 .65 .8 .55 .56 Q .48 .4 .24 .57 Q .56 .58 .66 .7'],
 с:['M .43 .44 C .15 .18 -.05 .94 .36 .82 L .58 .7'],
 р:['M 0 .77 L .25 .38 L -.02 1.27','M .16 .65 Q .47 .16 .56 .48 Q .58 .86 .26 .82 L .68 .7'],
 ч:['M 0 .75 L .2 .4 Q -.01 .9 .43 .6','M .52 .4 L .36 .76 Q .36 .95 .69 .7'],
 и:['M 0 .75 L .18 .4 Q -.04 1 .3 .78 L .55 .4 Q .33 .98 .71 .7']
};
// Open loops and long exit strokes give the lettering a lighter, formal rhythm.
glyphs.S=['M .76 .24 C 1.03 -.12 .24 -.17 .18 .23 C .11 .53 .82 .39 .73 .72 C .66 1.06 .03 1.02 .03 .72 Q .03 .54 .22 .63'];
glyphs.y=['M 0 .75 L .18 .4 Q -.04 1 .31 .76 L .53 .4 L .25 1.24 C .05 1.63 -.31 1.36 -.07 1.16 Q .15 .99 .67 .7'];
glyphs.t=['M 0 .77 Q .28 .53 .4 .05 L .2 .72 Q .15 .97 .58 .7','M -.04 .4 Q .27 .32 .66 .35'];
glyphs['Д']=['M .34 .08 C .29 .32 .23 .59 .16 .79 C .1 1.01 -.14 .9 -.06 .73 Q -.01 .64 .13 .7','M -.02 .2 C .12 -.04 .69 -.1 .82 .16 C 1.04 .57 .46 1.05 .16 .79 Q .43 .96 .86 .71'];
glyphs['р']=['M 0 .77 L .25 .38 L -.02 1.27 C -.15 1.55 -.42 1.39 -.22 1.19 Q -.02 1.06 .26 1.07','M .16 .65 Q .47 .16 .56 .48 Q .58 .86 .26 .82 L .68 .7'];
glyphs['о']=glyphs.o;glyphs['е']=glyphs.e;glyphs['т']=glyphs.m;
const widths={S:.85,e:.55,o:.62,u:.68,y:.65,n:.65,x:.62,t:.58,i:.47,m:.85,'!':.4,'Д':.8,'в':.66,'с':.58,'р':.68,'ч':.69,'и':.71,'о':.62,'е':.55,'т':.85,' ':.35};
let scriptStyle='roundhand';
async function path(d,x,y,s,base=7){
 const points=await page.evaluate(({d,x,y,s,slant})=>{const p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('d',d);const len=p.getTotalLength(),n=Math.max(8,Math.ceil(len*s*1024/3));return Array.from({length:n+1},(_,i)=>{const q=p.getPointAtLength(len*i/n);return [x+(q.x+slant*(.8-q.y))*s,y+q.y*s]})},{d,x,y,s,slant:scriptStyle==='roundhand'?.42:scriptStyle==='cyrillic'?.28:0});
 for(let i=1;i<points.length;i++){
  const a=points[i-1],z=points[i],dy=z[1]-a[1],dx=z[0]-a[0];
  const pressure=scriptStyle==='xingshu' ? base*(.35+.65*Math.sin(Math.PI*i/points.length)**.65) : (dy>0 ? 1+(base-1)*Math.pow(dy/Math.hypot(dx,dy),2) : 1);
  const width=Math.max(1,Math.round(pressure*Math.min(1,i/6,(points.length-i)/6)));
  await page.locator('[data-param="radius"]').fill(String(width));
  await page.evaluate(async({a,z})=>{inkTest.stroke(...z,...a,.012);await inkTest.step(1)},{a,z});
  if(i%6===0)await snap();
 }
 await snap();
}
async function textLine(text,y,s){let total=[...text].reduce((v,c)=>v+widths[c],0)*s,x=(1-total)/2;for(const c of text){for(const d of glyphs[c]||[])await path(d,x,y,s);x+=widths[c]*s;}}
async function hold(n){for(let i=0;i<n;i++)await snap();}
await hold(8);
await path('M .15 .2 C -.35 -.15 -.5 .6 .2 .48 C .72 .4 .85 -.2 .4 -.14',.15,.17,.14,2);
await textLine('See you',.22,.15);await textLine('next time!',.51,.135);
await path('M .25 .2 C -.2 -.1 -.4 .45 .2 .44 C 1.15 .48 2.35 -.24 3.5 .1 C 4 .28 3.6 .65 3.25 .43',.22,.79,.15,3);
await page.screenshot({path:'media/farewell-english.png'});await hold(55);
await page.evaluate(()=>inkTest.clear());await hold(8);
scriptStyle='cyrillic';
await path('M .2 .2 C -.2 -.1 -.37 .46 .07 .45 Q .45 .44 .55 .08',.32,.13,.18,2);
await textLine('До',.17,.22);await textLine('встречи!',.49,.14);
await path('M .25 .2 C -.2 -.1 -.4 .45 .2 .44 C 1.15 .48 2.35 -.24 3.5 .1 C 4 .28 3.6 .65 3.25 .43',.22,.79,.15,3);
await page.screenshot({path:'media/farewell-russian.png'});await hold(55);
await page.evaluate(()=>inkTest.clear());await hold(8);
scriptStyle='xingshu';
// Running-script connections, curved turns and pressure-weighted exits.
for(const [x,paths] of [
 [.10,['M .03 .18 Q .4 .06 .96 .09 Q 1 .12 .87 .15','M .51 .12 C .43 .37 .52 .76 .41 .98','M .49 .39 Q .67 .42 .8 .59 Q .85 .7 .68 .58']],
 [.36,['M .04 .15 Q .16 .18 .2 .3 Q .1 .39 .06 .49 Q .01 .75 .25 .39','M .58 .05 Q .48 .3 .35 .4 Q .48 .25 .91 .24 Q .96 .28 .77 .44','M .64 .36 C .64 .62 .47 .87 .24 .99','M .61 .55 Q .77 .87 1.01 .91']],
 [.62,['M .16 .16 Q .1 .39 .13 .66','M .15 .16 Q .49 .09 .82 .1 Q .8 .37 .74 .6 Q .7 .67 .61 .57','M .46 .3 C .47 .65 .27 .85 .02 1.01','M .56 .5 C .48 .75 .44 .95 .69 .96 Q .96 .99 1 .69']]
])for(const d of paths)await path(d,x,.34,.23,9);
await path('M .23 .1 Q .2 .41 .14 .68',.87,.34,.2,7);await path('M .14 .89 L .15 .88',.87,.34,.2,5);
await page.screenshot({path:'media/farewell-chinese.png'});await hold(65);
await browser.close();console.log(frame);
