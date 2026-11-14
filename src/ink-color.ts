export type RGB = [number, number, number];
export const DEFAULT_INK = '#0e1116';
export function parseHex(text: string): RGB | undefined {
  const match = /^#?([0-9a-f]{6})$/i.exec(text.trim());
  if (!match) return;
  return [0,2,4].map(i => parseInt(match[1].slice(i,i+2),16)) as RGB;
}
export function toHex(rgb: RGB): string { return '#' + rgb.map(c => Math.round(c).toString(16).padStart(2,'0')).join(''); }
// IEC sRGB transfer function (W3C CSS Color 4). Absorption uses linear light.
export function linearChannel(byte: number): number {
  const c = byte/255;
  return c <= .04045 ? c/12.92 : ((c+.055)/1.055)**2.4;
}
// Beer-Lambert: optical depths add. Clamp zero transmission to keep GPU values finite.
// RGB coefficients approximate transparent dyes; they are not measured pigment spectra.
export function absorptionFromHex(hex: string): RGB {
  const rgb = parseHex(hex);
  if (!rgb) throw new Error('Expected a six-digit RGB hex color.');
  return rgb.map(c => -Math.log(Math.max(.001,linearChannel(c)))) as RGB;
}
export function hsvToRGB(h: number, s: number, v: number): RGB {
  const c=v*s, x=c*(1-Math.abs((h/60)%2-1)), m=v-c;
  const rgb = h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];
  return rgb.map(n => Math.round((n+m)*255)) as RGB;
}
export function rgbToHSV(rgb: RGB): [number,number,number] {
  const [r,g,b]=rgb.map(c=>c/255), max=Math.max(r,g,b), min=Math.min(r,g,b), d=max-min;
  const h=d===0?0:max===r?60*(((g-b)/d+6)%6):max===g?60*((b-r)/d+2):60*((r-g)/d+4);
  return [h,max===0?0:d/max,max];
}
