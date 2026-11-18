// Step 2: Each bristle (one thread) scatters ink along the path it swept from previous time to current.
 //Bristles overlap, so ink goes into a fixed-point atomic accumulator
 //bristle-resolve.wgsl handles moving ink into
// the ink cells
@group(0) @binding(0) var<storage, read> bristles: array<Bristle>;
@group(0) @binding(1) var<storage, read_write> accum: array<atomic<u32>>;
@group(0) @binding(2) var<uniform> brush: Brush;

const MAX_EXTENT = 48u; // bounds the per-thread loop (cells per side)

@compute @workgroup_size(64)
fn deposit(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= u32(brush.count)) { return; }
  let b = bristles[i];
  // assign a per hair strength so some bristles run out of ink faster
  let strength = (0.55 + 0.45 * hash(i * 3u + 1u)) / 0.775;
  let w = smoothstep(0.0, 0.25, b.ink) * strength * brush.amount;
  if (w <= 0.0) { return; }
  let r = brush.bristleRadius;
  let m = r * 1.5 + 1.0;
  let lo = vec2u(clamp(floor(min(b.tip, b.prev) - m), vec2f(0), vec2f(f32(N - 1u))));
  let hi = min(vec2u(clamp(ceil(max(b.tip, b.prev) + m), vec2f(0), vec2f(f32(N - 1u)))), lo + vec2u(MAX_EXTENT - 1u));
  let ab = b.tip - b.prev;
  for (var y = lo.y; y <= hi.y; y++) {
    for (var x = lo.x; x <= hi.x; x++) {
      let p = vec2f(f32(x), f32(y)) + 0.5;
      let t = clamp(dot(p - b.prev, ab) / max(dot(ab, ab), 0.0001), 0.0, 1.0);
      let f = 1.0 - smoothstep(r, r * 1.5, distance(p, b.prev + t * ab));
      if (f > 0.0) { atomicAdd(&accum[y * N + x], u32(f * w * FIXED + 0.5)); }
    }
  }
}
