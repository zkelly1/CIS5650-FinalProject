import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
await mkdir('media/frames/bamboo',{recursive:true});
const b=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu']});
const p=await b.newPage({viewport:{width:1440,height:1000}});
await p.goto('http://127.0.0.1:5177/?test');await p.waitForFunction(()=>window.inkTest);
await p.evaluate(()=>{inkTest.pause();inkTest.clear()});
let frame=0;
async function snap(){await p.screenshot({path:'media/frames/bamboo/'+String(frame++).padStart(3,'0')+'.png'});}
async function param(k,v){await p.locator('[data-param="'+k+'"]').fill(String(v));}
async function stroke(points,r){await param('radius',r);for(let i=1;i<points.length;i++){await p.evaluate(async({a,c})=>{inkTest.stroke(...c,...a,1/40);await inkTest.step(2)},{a:points[i-1],c:points[i]});if(i%4===0)await snap();}}
function line(x,y,dx,dy,n=16){return Array.from({length:n+1},(_,i)=>[x+dx*i/n,y+dy*i/n]);}
await param('roughness',0.8);await param('waterLoad',6);
for(const [x,y,dx,dy] of [[.35,.84,.05,-.65],[.57,.86,-.03,-.72],[.73,.85,-.06,-.55]])await stroke(line(x,y,dx,dy,32),5);
for(const [x,y] of [[.38,.38],[.37,.57],[.55,.29],[.55,.5],[.68,.51]]){
for(const [dx,dy] of [[-.16,-.12],[.16,-.09],[-.12,.08],[.13,.09]]){
await stroke(line(x,y,dx,dy,12),3);
for(let j=5;j<=10;j+=5){const a=x+dx*j/12,c=y+dy*j/12;await stroke(line(a,c,dx*.3,-.075,8),7);}
}}
await snap();await p.screenshot({path:'media/interface-bamboo.png'});
await param('diffusion',.24);await param('waterLoad',10);await param('roughness',1);for(let i=0;i<6;i++)await snap();
for(let i=0;i<3;i++){await p.locator('#zoom-in').click();await snap();}
await p.locator('#canvas').focus();
for(let i=0;i<20;i++){await p.keyboard.press('ArrowRight');if(i%2===0)await p.keyboard.press('ArrowDown');await snap();}
await p.screenshot({path:'media/interface-bamboo-rotated.png'});
await p.locator('#reset').click();await snap();await b.close();console.log(frame);
