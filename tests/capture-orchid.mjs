import {demoLabel} from './demo-label.mjs';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
await mkdir('media/frames/orchid-labeled-final',{recursive:true});
const b=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu']});
const p=await b.newPage({viewport:{width:1280,height:900}});
await p.goto(process.env.TEST_URL||'http://127.0.0.1:5177/?test');await p.waitForFunction(()=>window.inkTest);
await p.evaluate(()=>{inkTest.pause();inkTest.clear()});
let frame=0;
async function snap(){await p.evaluate(()=>inkTest.step(2));await p.screenshot({path:'media/frames/orchid-labeled-final/'+String(frame++).padStart(4,'0')+'.png'});}
async function param(k,v){await p.locator('[data-param="'+k+'"]').fill(String(v));}
await param('diffusion',.22);await param('roughness',.9);await param('waterLoad',8);await param('absorption',.4);await param('settling',.4);
await p.locator('#zoom-in').click();
await demoLabel(p,'Orchid · Wet Ink on Textured Paper','More water + rough paper + slow drying → soft, feathered edges');
for(let i=0;i<20;i++)await snap();
async function curve(a,c,z,width,n=36){
for(let i=1;i<=n;i++){
const t=i/n,u=(i-1)/n;
const pt=q=>[(1-q)**2*a[0]+2*(1-q)*q*c[0]+q*q*z[0],(1-q)**2*a[1]+2*(1-q)*q*c[1]+q*q*z[1]];
await param('radius',Math.max(3,Math.round(width*Math.sin(Math.PI*t)**.7)));
await p.evaluate(async({a,z})=>{inkTest.stroke(...z,...a,.012);await inkTest.step(1)},{a:pt(u),z:pt(t)});
if(i%6===0)await snap();
}}
for(const [a,c,z,w] of [
[[.36,.89],[.43,.38],[.87,.13],11],
[[.36,.89],[.24,.58],[.22,.22],8],
[[.36,.89],[.57,.45],[.60,.28],7],
[[.36,.89],[.44,.48],[.16,.52],6],
[[.36,.89],[.31,.63],[.11,.73],5],
[[.36,.89],[.56,.61],[.83,.70],7],
[[.36,.89],[.66,.75],[.92,.43],6],
])await curve(a,c,z,w,48);
for(const [x,y] of [[.25,.32],[.32,.54],[.57,.38],[.76,.58]]){
await curve([.36,.88],[x-.08,y+.16],[x,y],3,30);
for(const [dx,dy,w] of [[-.10,-.055,10],[.09,-.07,11],[.11,.025,9],[-.06,.065,8],[.025,.10,7]])
await curve([x,y],[x+dx*.25,y+dy*.15],[x+dx,y+dy],w,18);
}
// Handwritten èŠ± in the open upper-left corner, using the same ink simulation.
for(const [a,c,z,w] of [
[[.075,.12],[.15,.115],[.23,.115],4],
[[.12,.085],[.12,.12],[.115,.15],4],
[[.19,.085],[.19,.12],[.18,.15],4],
[[.14,.16],[.12,.19],[.08,.215],4],
[[.115,.19],[.113,.225],[.11,.27],4],
[[.225,.17],[.20,.20],[.16,.22],4],
[[.165,.16],[.16,.205],[.165,.25],4],
[[.165,.25],[.20,.267],[.23,.245],4],
[[.23,.245],[.232,.23],[.23,.225],3]
]) await curve(a,c,z,w,18);
await p.locator('h1').click();await p.screenshot({path:'media/orchid-interface.png'});
for(let i=0;i<16;i++)await snap();
// Keep the wet, textured-paper preset throughout the orchid sequence.
for(let i=0;i<15;i++)await snap();
const box=await p.locator('#canvas').boundingBox(),x=box.x+box.width*.5,y=box.y+box.height*.5;
await p.mouse.move(x,y);
for(let i=0;i<30;i++){await p.mouse.wheel(0,-5);await p.evaluate(()=>inkTest.render());await snap();}
await p.mouse.move(240,y); await p.mouse.down({button:'right'});
for(let i=1;i<=180;i++){const t=i/180, ease=(1-Math.cos(t*Math.PI))/2;await p.mouse.move(240+(Math.PI*2/.008)*ease,y);await p.evaluate(()=>inkTest.render());await snap();}
await p.mouse.up({button:'right'});
await p.screenshot({path:'media/orchid-perspective.png'});
for(let i=0;i<20;i++)await snap();
await b.close();console.log(frame);
