import { DEPTH_LAYERS } from './gpu-grid';
export type Point = { x: number; y: number; layer: number };

// Inverse camera ray / closed slab intersection, matching the rendered cuboid.
// The thin edges can be inspected but only the two broad faces accept strokes.
export function paperPoint(nx: number, ny: number, aspect: number, yaw: number,
  pitch: number, distance: number, halfDepth = 0.015): Point | undefined {
  const scale = (1 / Math.tan(0.785398 / 2)) * Math.min(aspect, 1);
  const sy = Math.sin(yaw), cy = Math.cos(yaw), sp = Math.sin(pitch), cp = Math.cos(pitch);
  const inverse = (x: number, y: number, z: number) =>
    [cy*x-sy*z, sp*sy*x+cp*y+sp*cy*z, cp*sy*x-sp*y+cp*cy*z];
  const origin = inverse(0, 0, distance);
  const direction = inverse(nx*aspect/scale, ny/scale, -1);
  const bounds = [1, 1, halfDepth];
  let enter = -Infinity, leave = Infinity, axis = -1;
  for (let i=0; i<3; i++) {
    if (Math.abs(direction[i]) < 1e-9) { if (Math.abs(origin[i]) > bounds[i]) return; continue; }
    const a = (-bounds[i]-origin[i])/direction[i], b = (bounds[i]-origin[i])/direction[i];
    if (Math.min(a,b) > enter) { enter = Math.min(a,b); axis = i; }
    leave = Math.min(leave, Math.max(a,b));
  }
  if (enter < 0 || enter > leave || axis !== 2) return;
  const point = origin.map((v,i) => v+enter*direction[i]);
  return {x: (point[0]+1)/2, y: (1-point[1])/2, layer: point[2] > 0 ? 0 : DEPTH_LAYERS-1};
}
