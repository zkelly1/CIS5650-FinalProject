import { DEFAULT_INK, hsvToRGB, parseHex, rgbToHSV, toHex, type RGB } from './ink-color';

export function initColorPicker(onChange: (hex: string) => void) {
  const field = document.querySelector<HTMLElement>('#color-field')!;
  const cursor = document.querySelector<HTMLElement>('#color-cursor')!;
  const hueInput = document.querySelector<HTMLInputElement>('#color-hue')!;
  const hexInput = document.querySelector<HTMLInputElement>('#color-hex')!;
  const rgbInputs = ['r','g','b'].map(c=>document.querySelector<HTMLInputElement>(`#color-${c}`)!);
  const swatch = document.querySelector<HTMLElement>('#color-preview')!;
  const error = document.querySelector<HTMLElement>('#color-error')!;
  let rgb = parseHex(DEFAULT_INK)!;
  let [h,s,v] = rgbToHSV(rgb);
  function sync() {
    const hex=toHex(rgb);
    hexInput.value=hex.toUpperCase(); hexInput.setCustomValidity(''); hexInput.removeAttribute('aria-invalid');
    rgbInputs.forEach((input,i)=>{input.value=String(rgb[i]);input.setCustomValidity('');input.removeAttribute('aria-invalid');});
    hueInput.value=String(Math.round(h));
    field.style.backgroundColor=`hsl(${h} 100% 50%)`;
    cursor.style.left=`${s*100}%`;cursor.style.top=`${(1-v)*100}%`;
    field.setAttribute('aria-valuenow',String(Math.round(s*100)));
    field.setAttribute('aria-valuetext',`Saturation ${Math.round(s*100)} percent, brightness ${Math.round(v*100)} percent; ${hex}`);
    swatch.style.backgroundColor=hex; swatch.setAttribute('aria-label',`Selected ink ${hex}`);
    error.textContent=''; onChange(hex);
    document.querySelectorAll<HTMLButtonElement>('[data-ink]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.ink===hex)));
  }
  function setHex(hex:string) {
    const next=parseHex(hex);if(!next)throw new Error('Expected a six-digit RGB hex color.');
    rgb=next;const hsv=rgbToHSV(rgb);if(hsv[1]>0)h=hsv[0];s=hsv[1];v=hsv[2];sync();
  }
  function fromHSV(){rgb=hsvToRGB(h,s,v);sync();}
  function pick(event:PointerEvent){
    const rect=field.getBoundingClientRect();
    s=Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width));
    v=1-Math.max(0,Math.min(1,(event.clientY-rect.top)/rect.height));fromHSV();
  }
  let active:number|undefined;
  field.addEventListener('pointerdown',e=>{if(e.button!==0)return;active=e.pointerId;field.setPointerCapture(e.pointerId);field.focus();pick(e);});
  field.addEventListener('pointermove',e=>{if(e.pointerId===active)pick(e);});
  field.addEventListener('pointerup',e=>{if(e.pointerId===active){pick(e);active=undefined;field.releasePointerCapture(e.pointerId);}});
  for(const name of ['pointercancel','lostpointercapture'])field.addEventListener(name,()=>{active=undefined;});
  field.addEventListener('keydown',e=>{
    const step=e.shiftKey?.1:.01;
    if(e.key==='ArrowLeft')s=Math.max(0,s-step);else if(e.key==='ArrowRight')s=Math.min(1,s+step);
    else if(e.key==='ArrowUp')v=Math.min(1,v+step);else if(e.key==='ArrowDown')v=Math.max(0,v-step);else return;
    e.preventDefault();fromHSV();
  });
  hueInput.addEventListener('input',()=>{h=Number(hueInput.value);fromHSV();});
  hexInput.addEventListener('input',()=>{
    if(parseHex(hexInput.value))setHex(hexInput.value);
    else {hexInput.setCustomValidity('Use six hex digits, for example #16BFE8.');hexInput.setAttribute('aria-invalid','true');error.textContent='Enter six hex digits, e.g. #16BFE8.';}
  });
  rgbInputs.forEach(input=>input.addEventListener('input',()=>{
    const valid=rgbInputs.every(el=>el.value!=='' && Number.isInteger(Number(el.value)) && Number(el.value)>=0 && Number(el.value)<=255);
    if(valid)setHex(toHex(rgbInputs.map(el=>Number(el.value)) as RGB));
    else {input.setAttribute('aria-invalid','true');error.textContent='RGB values must be whole numbers from 0 to 255.';}
  }));
  document.querySelectorAll<HTMLButtonElement>('[data-ink]').forEach(b=>b.addEventListener('click',()=>setHex(b.dataset.ink!)));
  sync(); return {setHex};
}
