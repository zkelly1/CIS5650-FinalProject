import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
const frameDir='media/frames/color-mixing-light-glazes';
const preview=process.env.PREVIEW_ONLY==='1';
await mkdir(frameDir,{recursive:true});
const b=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu']});
const p=await b.newPage({viewport:{width:1440,height:1240}});
await p.goto((process.env.TEST_URL||'http://127.0.0.1:5180')+'/?test');await p.waitForFunction(()=>window.inkTest);
await p.evaluate(()=>{inkTest.pause();inkTest.clear()});
await p.locator('#brush-style').selectOption('soft-wash');
await p.locator('[data-param="thickness"]').fill('0.6');
// Soft Wash defaults and short brush contact leave enough transmitted light
// to distinguish all three pairwise blends and the shared central overlap.
await p.locator('#zoom-in').click();await p.locator('#zoom-in').click();
let frame=0;
async function snap(){if(!preview)await p.screenshot({path:`${frameDir}/${String(frame++).padStart(4,'0')}.png`,fullPage:true});}
async function stroke(a,z,seconds=.00055){await p.evaluate(async({a,z,seconds})=>{inkTest.stroke(...z,...a,seconds);await inkTest.step(1)},{a,z,seconds});}
for(let i=0;i<8;i++)await snap();
// Light cyan, rose and golden-yellow glazes produce visible violet, green,
// peach and muted three-way mixtures instead of an opaque-looking black center.
for(const [hex,cx,cy] of [['#58D6E8',.36,.36],['#EF85BB',.64,.36],['#FFE277',.5,.61]]){
 await p.locator('#color-hex').fill(hex);await p.locator('h1').click();
 for(let i=0;i<12;i++)await snap();
 const radius=.235;
 for(let row=0;row<=18;row++){
  const dy=-radius+row*radius*2/18,half=Math.sqrt(Math.max(0,radius*radius-dy*dy));
  const a=cx-half,z=cx+half,n=Math.max(1,Math.ceil((z-a)/.012));
  for(let j=1;j<=n;j++){
   const xa=a+(z-a)*(j-1)/n,xb=a+(z-a)*j/n;
   await stroke([xa,cy+dy],[xb,cy+dy]);
   if(j%8===0)await snap();
  }
  await snap();
 }
 for(let i=0;i<15;i++){await p.evaluate(()=>inkTest.step(2));await snap();}
}
for(let i=0;i<40;i++){await p.evaluate(()=>inkTest.step(4));await snap();}
await p.screenshot({path:preview?'.presentation-build/milestone2/mixing-preview.png':'media/color-mixing-page.png',fullPage:true});
await b.close();console.log(frame,'frames');
