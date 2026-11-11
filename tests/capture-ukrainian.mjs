import {demoLabel} from './demo-label.mjs';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
await mkdir('media/frames/sunflower-labeled-final',{recursive:true});
const b=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu']});
const p=await b.newPage({viewport:{width:1280,height:900}});
await p.goto(process.env.TEST_URL||'http://127.0.0.1:5177/?test');await p.waitForFunction(()=>window.inkTest);
await p.evaluate(()=>{inkTest.pause();inkTest.clear()});
let frame=0;
async function snap(){await p.evaluate(()=>inkTest.step(2));await p.screenshot({path:'media/frames/sunflower-labeled-final/'+String(frame++).padStart(4,'0')+'.png'});}
async function param(k,v){await p.locator('[data-param="'+k+'"]').fill(String(v));}
await param('diffusion',.06);await param('roughness',.15);await param('waterLoad',2);await param('absorption',2.2);await param('settling',3);
await p.locator('#zoom-in').click();
await demoLabel(p,'Sunflower · Crisp Calligraphy','Less water + smooth paper + fast settling → sharp, controlled lines');
for(let i=0;i<20;i++)await snap();
let minimumRadius=3;
async function curve(a,c,z,width,n=36){
for(let i=1;i<=n;i++){
const t=i/n,u=(i-1)/n;
const pt=q=>[(1-q)**2*a[0]+2*(1-q)*q*c[0]+q*q*z[0],(1-q)**2*a[1]+2*(1-q)*q*c[1]+q*q*z[1]];
await param('radius',Math.max(minimumRadius,Math.round(width*Math.sin(Math.PI*t)**.7)));
await p.evaluate(async({a,z})=>{inkTest.stroke(...z,...a,.012);await inkTest.step(1)},{a:pt(u),z:pt(t)});
if(i%6===0)await snap();
}}
// Sunflower: a ring of pointed petals, a seeded center, stem, and leaves.
const center=[.5,.31],at=(angle,r)=>[center[0]+Math.cos(angle)*r,center[1]+Math.sin(angle)*r];
for(let k=0;k<16;k++){
 const a=k*Math.PI/8;
 await curve(at(a-.18,.075),at(a-.13,.155),at(a,.19),3,12);
 await curve(at(a,.19),at(a+.13,.155),at(a+.18,.075),3,12);
}
for(let k=0;k<24;k++){
 const a=k*Math.PI/12;
 await curve(at(a,.075),at(a+.13,.078),at(a+Math.PI/12,.075),3,6);
}
for(let k=0;k<30;k++){
 const a=k*2.39996,r=.06*Math.sqrt(k/30),q=at(a,r);
 await curve(q,[q[0]+.002,q[1]+.002],[q[0]+.004,q[1]+.004],3,6);
}
await curve([.50,.5],[.49,.55],[.48,.6],4,18);
await curve([.49,.55],[.40,.48],[.35,.53],4,18);
await curve([.35,.53],[.42,.57],[.49,.55],3,18);
await curve([.49,.57],[.57,.5],[.62,.53],4,18);
await curve([.62,.53],[.57,.58],[.49,.57],3,18);
// Copperplate-inspired Cyrillic: fine upstrokes, shaded downstrokes and open flourishes.
minimumRadius=1;
for(const [a,c,z,w] of [
[[.13,.735],[.075,.685],[.065,.755],2],
[[.065,.755],[.06,.835],[.15,.79],2],
[[.15,.79],[.20,.75],[.24,.65],2],
[[.24,.65],[.245,.73],[.275,.79],8],
[[.275,.79],[.315,.72],[.36,.65],2],
[[.36,.65],[.335,.74],[.345,.78],8],
[[.345,.78],[.36,.815],[.415,.75],2],
[[.415,.75],[.44,.70],[.46,.65],2],
[[.46,.65],[.43,.74],[.435,.775],8],
[[.435,.775],[.445,.81],[.49,.765],2],
[[.49,.765],[.535,.71],[.565,.65],2],
[[.565,.65],[.535,.74],[.545,.78],8],
[[.545,.78],[.565,.805],[.615,.74],2],
[[.615,.74],[.65,.69],[.68,.64],2],
[[.68,.64],[.64,.79],[.615,.875],8],
[[.615,.875],[.59,.945],[.50,.925],2],
[[.50,.925],[.435,.91],[.48,.875],2],
[[.48,.875],[.54,.84],[.65,.86],2],
[[.65,.86],[.81,.90],[.895,.845],2],
[[.895,.845],[.94,.81],[.89,.80],2],
[[.66,.70],[.70,.635],[.765,.655],2],
[[.765,.655],[.83,.675],[.79,.735],7],
[[.79,.735],[.755,.79],[.705,.78],3],
[[.705,.78],[.76,.82],[.87,.735],2],
[[.87,.735],[.925,.69],[.91,.665],2],
[[.91,.665],[.895,.64],[.865,.67],2]
]) await curve(a,c,z,w,30);
await p.locator('h1').click();await p.screenshot({path:'media/ukrainian-sunflower.png'});
for(let i=0;i<35;i++)await snap();
const rect=await p.locator('#canvas').boundingBox(),y=rect.y+rect.height*.5;
await p.mouse.move(240,y);
for(let i=0;i<30;i++){await p.mouse.wheel(0,-5);await p.evaluate(()=>inkTest.render());await snap();}
await p.mouse.down({button:'right'});
for(let i=1;i<=180;i++){const t=i/180,ease=(1-Math.cos(t*Math.PI))/2;await p.mouse.move(240+(Math.PI*2/.008)*ease,y);await p.evaluate(()=>inkTest.render());await snap();}
await p.mouse.up({button:'right'});
for(let i=0;i<25;i++)await snap();
await p.locator('#clear').click();for(let i=0;i<8;i++)await snap();
await b.close();console.log(frame);