// Bristle brush, step 1 of 3: advance each bristle tip and spend its ink
// (one thread per bristle). Brush, Bristle and hash come from bristle-common.wgsl.
@group(0) @binding(0) var<storage, read_write> bristles: array<Bristle>;
@group(0) @binding(1) var<uniform> brush: Brush;

// Sunflower (Vogel) layout: evenly fills the brush disc for any bristle count.
fn restOffset(i: u32, n: u32) -> vec2f {
  let r = brush.radius * sqrt((f32(i) + 0.5) / f32(n));
  let a = f32(i) * 2.39996323;
  return r * vec2f(cos(a), sin(a));
}

@compute @workgroup_size(64)
fn update(@builtin(global_invocation_id) id: vec3u) {
  let n = u32(brush.count);
  let i = id.x;
  if (i >= n) { return; }
  let def = brush.deformation;
  // Drag-lag: bristles trail behind the motion by a per-bristle amount (streaky splay)...
  let trail = def * brush.radius * (0.4 + 0.6 * hash(i));
  let goal = brush.center + restOffset(i, n) - brush.dir * trail;
  var b = bristles[i];
  let reset = brush.reset > 0.5;
  // ...and only close part of the gap to their rest position each sub-step.
  var tip = select(mix(b.tip, goal, 1.0 - 0.85 * def), goal, reset);
  let off = tip - brush.center;
  let len = length(off);
  if (len > brush.maxReach) { tip = brush.center + off * (brush.maxReach / len); }
  // Ink depletion: each bristle spends ink per cell travelled at its own rate,
  // so hairs drop out one by one and the stroke ends in a broken dry-brush edge.
  // At depletion 1 an average hair runs dry after ~120 cells; at 0.5 after ~240.
  let rate = brush.depletion * (0.4 + 1.2 * hash(i + 7919u)) / 120.0;
  let travelled = select(distance(b.tip, tip), 0.0, reset);
  b.ink = select(max(0.0, b.ink - rate * travelled), 1.0, reset);
  b.prev = select(b.tip, tip, reset);
  b.tip = tip;
  bristles[i] = b;
}
