import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
await mkdir('media/frames/color-mixing',{recursive:true});
const b=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu']});
const p=await b.newPage({viewport:{width:1440,height:1120}});
await p.goto((process.env.TEST_URL||'http://127.0.0.1:5180')+'/?test');await p.waitForFunction(()=>window.inkTest);
await p.evaluate(()=>{inkTest.pause();inkTest.clear()});
for(const [k,v] of Object.entries({radius:20,waterLoad:5,roughness:.3,diffusion:.18,absorption:.7,settling:.8}))await p.locator(`[data-param="${k}"]`).fill(String(v));
await p.locator('#zoom-in').click();await p.locator('#zoom-in').click();
let frame=0;
async function snap(){await p.screenshot({path:`media/frames/color-mixing/${String(frame++).padStart(4,'0')}.png`});}
async function stroke(a,z,seconds=.003){await p.evaluate(async({a,z,seconds})=>{inkTest.stroke(...z,...a,seconds);await inkTest.step(1)},{a,z,seconds});}
for(let i=0;i<8;i++)await snap();
// Three hand-painted disks: cyan+magenta=blue, cyan+yellow=green, magenta+yellow=red.
for(const [hex,cx,cy] of [['#16BFE8',.36,.36],['#ED32A0',.64,.36],['#FFE52B',.5,.61]]){
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
await p.screenshot({path:'media/color-mixing-page.png',fullPage:true});
await b.close();console.log(frame,'frames');
