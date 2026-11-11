import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
await mkdir('media/frames/russian',{recursive:true});
const b=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu']});
const p=await b.newPage({viewport:{width:1280,height:900}});
await p.goto(process.env.TEST_URL||'http://127.0.0.1:5177/?test');await p.waitForFunction(()=>window.inkTest);
await p.evaluate(()=>{inkTest.pause();inkTest.clear()});
let frame=0;
async function snap(){await p.screenshot({path:'media/frames/russian/'+String(frame++).padStart(4,'0')+'.png'});}
async function param(k,v){await p.locator('[data-param="'+k+'"]').fill(String(v));}
await param('roughness',.75);await param('waterLoad',3);await param('absorption',1.2);
await p.locator('#zoom-in').click();
async function curve(a,c,z,width,n=36){
for(let i=1;i<=n;i++){
const t=i/n,u=(i-1)/n;
const pt=q=>[(1-q)**2*a[0]+2*(1-q)*q*c[0]+q*q*z[0],(1-q)**2*a[1]+2*(1-q)*q*c[1]+q*q*z[1]];
await param('radius',Math.max(3,Math.round(width*Math.sin(Math.PI*t)**.7)));
await p.evaluate(async({a,z})=>{inkTest.stroke(...z,...a,.012);await inkTest.step(1)},{a:pt(u),z:pt(t)});
if(i%6===0)await snap();
}}
// Cyrillic МИР ("peace"), drawn stroke by stroke with tapered ink.
for(const [a,c,z,w] of [
[[.16,.61],[.18,.48],[.20,.33],6],
[[.20,.33],[.24,.42],[.29,.53],5],
[[.29,.53],[.35,.42],[.40,.33],5],
[[.40,.33],[.38,.48],[.37,.61],7],
[[.47,.33],[.46,.47],[.45,.61],7],
[[.45,.61],[.55,.47],[.64,.33],5],
[[.64,.33],[.63,.47],[.62,.61],7],
[[.72,.65],[.73,.49],[.75,.33],7],
[[.75,.33],[.91,.29],[.90,.40],6],
[[.90,.40],[.88,.51],[.735,.47],5],
[[.11,.67],[.38,.74],[.70,.69],3],
[[.70,.69],[.86,.65],[.91,.72],3],
[[.14,.29],[.20,.32],[.25,.30],3],
[[.36,.30],[.40,.33],[.44,.31],3]
]) await curve(a,c,z,w,30);
await p.locator('h1').click();await p.screenshot({path:'media/russian-interface.png'});
for(let i=0;i<65;i++)await snap();
await p.locator('#clear').click();for(let i=0;i<8;i++)await snap();
await b.close();console.log(frame);