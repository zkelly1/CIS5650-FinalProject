// A deterministic, original landscape drawn with the application's actual GPU brush.
// Composition inspired by the landscape reference supplied for Milestone 2.
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='media/frames/landscape-presets';await mkdir(out,{recursive:true});
// Longer brush contact restores rich front colors after ink spreads through the
// thin sheet; lettering uses a lighter pass to preserve the tapered strokes.
const inkLoad=3.2, letteringLoad=1.6;
const sun={x:.265,y:.255,r:.046};
let seed=56502;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
const strokes=[];
const stages=[];
const crisp={diffusion:.06,absorption:2,settling:3,waterLoad:1.5,roughness:.25};
const stage=(id,adjust)=>stages.push({start:strokes.length,id,adjust});
stage('soft-wash',{...crisp,radius:3});
function line(a,b,color,radius=1,mass=.22){const n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.055));for(let i=0;i<n;i++){const p=a.map((v,k)=>v+(b[k]-v)*i/n),q=a.map((v,k)=>v+(b[k]-v)*(i+1)/n);const length=Math.hypot(q[0]-p[0],q[1]-p[1])*512;strokes.push({a:p,b:q,color,radius,seconds:Math.min(.1,mass/90*(1+length/16))});}}
function path(points,color,radius=1,mass=.22){for(let i=1;i<points.length;i++)line(points[i-1],points[i],color,radius,mass);}
function curve(a,b,c,d,color,radius=1,mass=.22){const p=[];for(let i=0;i<=18;i++){const t=i/18,u=1-t;p.push([u**3*a[0]+3*u*u*t*b[0]+3*u*t*t*c[0]+t**3*d[0],u**3*a[1]+3*u*u*t*b[1]+3*u*t*t*c[1]+t**3*d[1]]);}path(p,color,radius,mass);}
function polygon(points,color,mass=.12,spacing=.009,reserveSun=typeof color==='function'){
 spacing*=.6;const min=Math.min(...points.map(p=>p[1])),max=Math.max(...points.map(p=>p[1]));
 for(let y=min+spacing/2;y<max;y+=spacing){
  const xs=[];for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];if((a[1]<=y&&b[1]>y)||(b[1]<=y&&a[1]>y))xs.push(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]));}xs.sort((a,b)=>a-b);
  for(let i=0;i+1<xs.length;i+=2){
   let spans=[[xs[i],xs[i+1]]];const r=sun.r+.005;
   // Clip complete sky strokes at the circular boundary: midpoint rejection
   // lets long stroke ends cut across the sun and produces the old notch.
   if(reserveSun&&Math.abs(y-sun.y)<r){const half=Math.sqrt(r*r-(y-sun.y)**2);spans=[[xs[i],Math.min(xs[i+1],sun.x-half)],[Math.max(xs[i],sun.x+half),xs[i+1]]];}
   for(const [start,endX] of spans){let x=start;while(x<endX){const end=Math.min(endX,x+.012+random()*.026),length=(end-x)*512;strokes.push({a:[x,y],b:[end,y],color:typeof color==='function'?color(y):color,radius:spacing*512*.88,seconds:mass*.60/90*(1+length/16)});x=end;}}
  }
 }
}
function dab(x,y,dx,dy,color,r=1,m=.27){line([x,y],[x+dx,y+dy],color,r,m);}
// Dusk washes: violet overhead, rose clouds, warm orange near the horizon.
const sunset=y=>{const stops=[[.035,[81,63,170]],[.15,[220,91,159]],[.28,[255,157,90]],[.45,[255,213,134]]];let i=0;while(i<stops.length-2&&y>stops[i+1][0])i++;const t=Math.max(0,Math.min(1,(y-stops[i][0])/(stops[i+1][0]-stops[i][0])));return '#'+stops[i][1].map((v,c)=>Math.round(v+(stops[i+1][1][c]-v)*t).toString(16).padStart(2,'0')).join('');};
polygon([[.035,.035],[.965,.035],[.965,.055],[.91,.10],[.85,.07],[.73,.17],[.68,.13],[.59,.21],[.53,.18],[.46,.26],[.4,.24],[.36,.33],[.26,.45],[.035,.45]],sunset,.27,.008);
for(const [y,x,end,c] of [[.085,.19,.64,'#b476e0'],[.125,.17,.48,'#f47db1'],[.18,.19,.39,'#ff9d73'],[.23,.035,.18,'#ffb960'],[.35,.04,.28,'#ffb65c']]){polygon([[x,y],[x+.04,y-.008],[end,y-.015],[end-.025,y+.006],[x+.025,y+.014]],c,.18,.004,true);}
polygon(Array.from({length:72},(_,i)=>[sun.x+Math.cos(i*Math.PI/36)*sun.r,sun.y+Math.sin(i*Math.PI/36)*sun.r]),'#ffd56c',.20,.004);
// Leave the banks unpainted by water: transparent ochre over blue would still
// look submerged even if the land were drawn later.
polygon([[.035,.57],[.14,.56],[.155,.59],[.20,.625],[.28,.615],[.31,.585],[.30,.555],[.56,.59],[.8,.55],[.965,.58],[.965,.7],[.89,.71],[.78,.77],[.72,.85],[.54,.88],[.4,.965],[.27,.965],[.22,.925],[.16,.90],[.10,.885],[.035,.875]],'#04b9d9',.20,.012);
polygon([[.035,.75],[.19,.71],[.42,.77],[.56,.83],[.37,.9],[.25,.91],[.16,.89],[.10,.875],[.035,.865]],'#2689ce',.07,.015);
// Distant blue ridges and the golden cliff, kept to the right of the calligraphy.
polygon([[.23,.37],[.36,.26],[.42,.28],[.49,.19],[.55,.23],[.64,.16],[.71,.21],[.83,.095],[.89,.14],[.965,.08],[.965,.46],[.78,.43],[.58,.47],[.4,.42]],'#7d75ac',.10);
polygon([[.26,.45],[.36,.33],[.4,.24],[.46,.26],[.53,.18],[.59,.21],[.68,.13],[.73,.17],[.85,.07],[.91,.10],[.965,.055],[.965,.49],[.78,.42],[.66,.45],[.54,.38],[.43,.46]],'#e6b638',.26);
// Broken ridge contours and downhill rock texture.
stage('dry-ink',{roughness:.35,radius:2,waterLoad:1.5});
path([[.3,.43],[.36,.33],[.4,.24],[.46,.26],[.53,.18],[.59,.21],[.68,.13],[.73,.17],[.85,.07]],'#554369',1.5,.25);
for(let i=0;i<65;i++){const x=.37+random()*.55,top=.39-(x-.34)*.5;const y=top+random()*.12;const l=.015+random()*.05;curve([x,y],[x-.008,y+.016],[x-.02,y+l*.7],[x-.026,y+l],i%3?'#706046':'#866547',.5+random()*.8,.04+random()*.05);}
// Foliage forms irregular groves on the actual slopes, with smaller, lighter
// marks on the distant ridges instead of a single straight band of speckles.
const ridge=[[.36,.33],[.4,.24],[.46,.26],[.53,.18],[.59,.21],[.68,.13],[.73,.17],[.85,.07],[.91,.10],[.965,.055]];
const foot=[[.26,.45],[.43,.46],[.54,.38],[.66,.45],[.78,.42],[.965,.49]];
function heightAt(points,x){let i=0;while(i<points.length-2&&x>points[i+1][0])i++;const [a,b]=[points[i],points[i+1]];return a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]);}
for(let g=0;g<30;g++){
 const x=.375+random()*.55,near=1-(x-.375)/.55,top=heightAt(ridge,x),bottom=heightAt(foot,x);
 const y=top+.025+random()*Math.min(.16,bottom-top-.055),spread=.012+.018*near;
 const palette=near>.5?['#682da8','#74458e','#9861ac']:['#9c86b7','#897ba1','#b593bd'];
 for(let j=0;j<16;j++){
  const a=random()*Math.PI*2,r=Math.sqrt(random()),xx=x+Math.cos(a)*r*spread,yy=y+Math.sin(a)*r*spread*.6;
  if(yy<heightAt(ridge,xx)+.012||yy>heightAt(foot,xx)-.015)continue;
  dab(xx,yy,-(.002+random()*.004)*(1+near),(.002+random()*.004)*(1+near),palette[j%3],.65+near*.55,.10+near*.18);
 }
}
// A soft green shore and a distant pavilion.
stage('soft-wash',{...crisp,radius:3});
polygon([[.035,.49],[.14,.47],[.25,.5],[.38,.47],[.52,.49],[.6,.46],[.73,.5],[.81,.49],[.965,.53],[.965,.59],[.78,.55],[.53,.56],[.3,.55],[.15,.58],[.035,.55]],'#a9b65d',.15);
function pavilion(x,y,s){polygon([[x-.25*s,y],[x+.25*s,y],[x+.25*s,y+.28*s],[x-.25*s,y+.28*s]],'#ca963d',.24,.004);for(const dx of [-.23,-.08,.08,.23])line([x+dx*s,y],[x+dx*s,y+.29*s],'#42362c',.85,.35);line([x-.26*s,y+.25*s],[x+.26*s,y+.25*s],'#4e3e2a',1,.3);polygon([[x-.42*s,y],[x-.25*s,y-.08*s],[x-.15*s,y-.19*s],[x+.17*s,y-.19*s],[x+.28*s,y-.06*s],[x+.42*s,y]],'#3e3b42',.37,.004);curve([x-.43*s,y-.015*s],[x-.18*s,y+.02*s],[x+.22*s,y+.025*s],[x+.44*s,y-.02*s],'#403229',1.15,.28);path([[x-.17*s,y-.19*s],[x-.13*s,y-.23*s],[x+.17*s,y-.21*s]],'#4b3c2d',.85,.24);line([x-.18*s,y-.11*s],[x+.20*s,y-.11*s],'#d3a748',1,.12);}
stage('fine-detail',{roughness:.25,radius:1});
pavilion(.58,.485,.21);pavilion(.89,.38,.12);
// Open water replaces the two ambiguous curved bridge shapes.
stage('soft-wash',{...crisp,radius:3});
polygon([[.965,.7],[.89,.71],[.78,.77],[.72,.85],[.54,.88],[.4,.94],[.965,.965]],'#c8a951',.24);
// Visible banks beneath the left trees connect their roots to dry land.
polygon([[.145,.54],[.22,.535],[.29,.55],[.31,.585],[.28,.615],[.20,.625],[.155,.59]],'#c9ac62',.20);
polygon([[.15,.54],[.23,.54],[.29,.565],[.275,.60],[.215,.61],[.165,.575]],'#9dab59',.12);
polygon([[.035,.875],[.10,.885],[.16,.90],[.22,.925],[.27,.965],[.035,.965]],'#c6a35a',.24);
polygon([[.035,.88],[.10,.89],[.165,.915],[.20,.945],[.035,.95]],'#a1ac54',.13);
// Pine: tapered trunks, radiating twigs, and narrow needle strokes.
function pine(x,y,size){curve([x,y],[x-.03*size,y-.18*size],[x-.15*size,y-.43*size],[x-.12*size,y-.7*size],'#5d4d35',4*size,.22);curve([x+.006,y],[x-.015*size,y-.18*size],[x-.13*size,y-.43*size],[x-.11*size,y-.7*size],'#8c7a38',1.5*size,.16);for(let j=0;j<9;j++){const h=.2+j*.05,cx=x-.12*size*(h/.7),cy=y-h*size;const side=j%2?-1:1;const ex=cx+side*(.11+random()*.12)*size,ey=cy-(.03+random()*.035)*size;curve([cx,cy],[cx+side*.06*size,cy],[ex,ey+.025*size],[ex,ey],'#484f3a',1.4*size,.18);for(let k=0;k<115;k++){const fx=ex+(random()-.5)*.23*size,fy=ey+(random()-.5)*.12*size;const angle=random()*Math.PI*2,len=(.01+random()*.024)*size;dab(fx,fy,Math.cos(angle)*len,Math.sin(angle)*len,['#168cea','#5544c8','#17b5ce','#287acc','#6946d4'][k%5],(1.1+random()*.5)*size,.32);}}
 // Close the crown around both trunk tips, including the formerly bare leader.
 for(let k=0;k<160;k++){const a=random()*Math.PI*2,r=Math.sqrt(random()),fx=x-.115*size+Math.cos(a)*r*.075*size,fy=y-.68*size+Math.sin(a)*r*.075*size;const angle=random()*Math.PI*2,len=(.012+random()*.018)*size;dab(fx,fy,Math.cos(angle)*len,Math.sin(angle)*len,['#168cea','#5544c8','#17b5ce','#287acc','#6946d4'][k%5],1.25*size,.30);}
}
stage('flowing-ink',{diffusion:.08,absorption:1.8,settling:2.8,waterLoad:2,roughness:.25,radius:2});
pine(.91,.95,.67);pine(.81,.82,.42);
// Autumn and blossom trees on the left bank.
function blossom(x,y,s,palette){curve([x,y],[x+.035*s,y-.10*s],[x-.015*s,y-.21*s],[x+.04*s,y-.32*s],'#66503d',1.7*s,.24);for(let i=0;i<7;i++){const yy=y-(.10+i*.026)*s,dx=(i%2?-1:1)*(.06+random()*.07)*s;line([x,yy],[x+dx,yy-.08*s],'#695240',.75*s,.25);}for(let i=0;i<280;i++){const a=random()*Math.PI*2,r=Math.sqrt(random()),xx=x+Math.cos(a)*r*.16*s,yy=y-.25*s+Math.sin(a)*r*.12*s;dab(xx,yy,(random()-.5)*.018*s,(random()-.5)*.018*s,palette[i%palette.length],(1.9+random()*1.2)*s,.56);}}
stage('round-brush',{...crisp,radius:2});
blossom(.23,.60,.62,['#ff6724','#ff9c16','#f64328','#ffbf3f']);
blossom(.13,.925,.65,['#9e25f3','#cc44e8','#6933e5','#2c81eb']);
blossom(.74,.94,.38,['#ff8721','#ffbd35','#f94938','#e65cba']);
// Ripples and small islands keep open water visible between the trees.
stage('fine-detail',{roughness:.25,radius:1});
for(let i=0;i<24;i++){const x=.05+random()*.58,y=.65+random()*.22;const len=.018+random()*.065;curve([x,y],[x+len*.3,y-.007],[x+len*.7,y-.007],[x+len,y],'#078baf',.5,.07);}
// Running-script 山清水秀: curved turns, lifted connecting strokes, and tapered
// pressure. Each path is still deposited by the application's GPU ink brush.
const glyphs=[
 ['M .48 .04 C .62 .12 .49 .40 .47 .76 Q .46 .86 .42 .89',
  'M .10 .31 C .18 .29 .17 .49 .15 .67 Q .10 .86 .23 .84 C .43 .81 .67 .77 .78 .72 C .81 .57 .82 .40 .88 .27 Q .90 .23 .87 .22'],
 ['M .06 .09 Q .20 .11 .22 .23 Q .22 .27 .16 .26',
  'M .03 .36 Q .18 .35 .17 .47 C .16 .55 .06 .67 .09 .78 Q .11 .87 .18 .79 L .30 .51',
  'M .37 .16 C .51 .19 .75 .08 .91 .10',
  'M .64 .02 C .70 .11 .58 .30 .60 .39',
  'M .40 .29 Q .61 .28 .84 .23',
  'M .31 .44 C .50 .47 .77 .34 .96 .38',
  'M .41 .52 C .46 .63 .37 .86 .34 .98',
  'M .43 .55 C .55 .53 .74 .46 .84 .51 C .88 .57 .78 .85 .76 .94 Q .71 1.01 .60 .87',
  'M .44 .67 C .56 .67 .74 .58 .78 .63 Q .74 .71 .48 .79 Q .63 .78 .74 .76'],
 ['M .45 .03 C .64 .11 .48 .35 .48 .59 C .49 .78 .50 .97 .40 .98 Q .33 .97 .24 .85',
  'M .06 .34 C .19 .39 .28 .29 .35 .33 C .31 .49 .19 .70 .02 .78',
  'M .90 .20 C .90 .29 .74 .39 .57 .46',
  'M .54 .39 C .65 .53 .71 .73 .98 .78 Q 1.01 .79 1.02 .77'],
 ['M .78 .04 C .76 .12 .39 .20 .16 .20',
  'M .12 .36 C .29 .39 .62 .26 .92 .29',
  'M .52 .15 C .57 .26 .45 .42 .48 .56',
  'M .44 .34 C .34 .45 .17 .58 .02 .60',
  'M .56 .34 C .71 .43 .83 .50 .98 .48',
  'M .26 .65 C .42 .65 .55 .56 .67 .59 Q .72 .62 .61 .75 C .70 .75 .82 .67 .86 .73 C .89 .81 .78 .99 .69 1.01 Q .62 .99 .56 .89',
  'M .46 .63 C .47 .78 .32 .98 .12 1.03']
];
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu','--disable-background-timer-throttling']});
try{
 const page=await browser.newPage({viewport:{width:1400,height:1240},deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{let s=56502;Math.random=()=>{s=(1664525*s+1013904223)>>>0;return s/4294967296;};});
 await page.goto((process.env.TEST_URL||'http://127.0.0.1:5181')+'/?test');await page.waitForFunction(()=>window.inkTest);
 await page.evaluate(()=>{inkTest.pause();inkTest.params({thickness:.05});inkTest.clear();inkTest.view(0,0,2.65);});
 // Keep a square artwork still, but record the complete webpage in every GIF frame.
 const box=await page.locator('#canvas').boundingBox();const side=Math.floor(Math.min(box.width,box.height));const clip={x:Math.floor(box.x+(box.width-side)/2),y:Math.floor(box.y+(box.height-side)/2),width:side,height:side};
 let frame=0;const durationsMs=[];
 const snap=async(duration=50)=>{durationsMs.push(duration);await page.screenshot({path:`${out}/${String(frame++).padStart(4,'0')}.png`,fullPage:true});};
 await snap(800);
 const choose=async(id,adjust)=>{
  await page.locator('#brush-style').selectOption(id);
  if(!process.env.PREVIEW)await snap(800);
  for(const [key,value] of Object.entries(adjust)){
   await page.locator(`[data-param="${key}"]`).fill(String(value));
   if(!process.env.PREVIEW)await snap(220);
  }
 };
 for(let index=0;index<stages.length;index++){
  const current=stages[index],end=stages[index+1]?.start??strokes.length;
  await choose(current.id,current.adjust);
  for(let i=current.start;i<end;i+=64){
   await page.evaluate(async({batch,inkLoad})=>{const input=document.querySelector('[data-param="radius"]');for(const s of batch){input.value=String(Math.max(1,Math.round(s.radius)));input.dispatchEvent(new Event('input',{bubbles:true}));inkTest.color(s.color);inkTest.stroke(...s.b,...s.a,s.seconds*inkLoad);}await inkTest.step(1);},{batch:strokes.slice(i,Math.min(i+64,end)),inkLoad});
   if(!process.env.PREVIEW)await snap();
  }
 }
 await choose('fine-detail',{diffusion:.03,absorption:2.5,settling:3.5,waterLoad:1,roughness:.12,radius:1});
 for(let g=0;g<glyphs.length;g++)for(const d of glyphs[g]){
  const pts=await page.evaluate(d=>{const p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('d',d);const n=Math.ceil(p.getTotalLength()*28);return Array.from({length:n+1},(_,i)=>{const q=p.getPointAtLength(p.getTotalLength()*i/n);return [q.x,q.y];});},d);
  const x=.052+[0,.002,-.002,.003][g],y=.078+g*.080,scale=.073;
  await page.evaluate(async({pts,x,y,scale,weight,letteringLoad})=>{inkTest.color('#22313b');const input=document.querySelector('[data-param="radius"]');for(let i=1;i<pts.length;i++){const t=i/pts.length,pressure=Math.sin(Math.PI*t)**.8;input.value=String(Math.round(1+pressure*weight));input.dispatchEvent(new Event('input',{bubbles:true}));const a=pts[i-1],b=pts[i];inkTest.stroke(x+(b[0]+.13*(.8-b[1]))*scale,y+b[1]*scale,x+(a[0]+.13*(.8-a[1]))*scale,y+a[1]*scale,(.0007+.0025*pressure)*letteringLoad);}await inkTest.step(1);},{pts,x,y,scale,weight:g===1?.42:.60,letteringLoad});if(!process.env.PREVIEW)await snap(100);
 }
 // Small red seal, drawn through the same ink deposition path.
 await page.evaluate(async()=>{inkTest.color('#bd4739');inkTest.params({radius:1});for(const [a,b] of [[[.066,.416],[.091,.416]],[[.091,.416],[.091,.440]],[[.091,.440],[.066,.440]],[[.066,.440],[.066,.416]],[[.073,.421],[.083,.434]],[[.083,.421],[.073,.434]]])inkTest.stroke(...b,...a,.009);await inkTest.step(2);});
 await page.screenshot({path:'media/landscape-final.png',clip});await page.screenshot({path:'media/landscape-interface.png',fullPage:true});await snap(1800);
 const rotationStart=frame;
 if(!process.env.PREVIEW){
  for(let i=1;i<=8;i++){await page.evaluate(d=>inkTest.view(0,0,d),2.65+.55*i/8);await snap(60);}
  for(let i=1;i<=96;i++){const angle=i/96*Math.PI*2;await page.evaluate(a=>inkTest.view(a,.12*Math.sin(a),3.2),angle);await snap(60);}
  for(let i=1;i<=8;i++){await page.evaluate(d=>inkTest.view(0,0,d),3.2-.55*i/8);await snap(i===8?2000:60);}
 }
 assert.equal(await page.locator('#status').getAttribute('data-error'),null);assert.deepEqual(errors,[]);
 const state=await page.evaluate(()=>inkTest.read());assert.equal(state.invalid,0);
 const backFraction=state.layers.at(-1).pigment/state.pigment;
 await page.evaluate(()=>inkTest.view(Math.PI,0,3.2));
 await page.screenshot({path:'media/landscape-reverse.png',fullPage:true});
 await writeFile('performance/landscape-capture.json',JSON.stringify({strokes:strokes.length,frames:frame,frameDirectory:out,durationsMs,rotationStart,rotationDegrees:process.env.PREVIEW?0:360,thicknessMm:.05,inkLoad,letteringLoad,backFraction,styles:[...new Set(stages.map(s=>s.id))],seed:56502,inscription:'山清水秀',method:'Real preset selection and slider input events; longer brush contact deposits richer ink on thin paper; GPU-rendered painting, handwritten running-script paths, then a frozen-state 360-degree rotation.',errors},null,2));
 console.log(JSON.stringify({strokes:strokes.length,frames:frame,clip,errors}));
}finally{await browser.close();}
