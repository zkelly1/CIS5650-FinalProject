// Step 3 (Bristle sim) - once per frame, move the accumulated ink into the
// ink cells over the frame's bounding box, then zero out the accumulator.
// Cell layout matches simulate.wgsl / deposit.wgsl (48 bytes, pigment-mass
// weighted optical absorption).
struct Cell { state: vec4f, mobile: vec4f, settled: vec4f }
// layer = destination depth layer (0 = front face, LAYERS-1 = back face);
// absorption = ink colour; dryness = brush dryness, as in deposit.wgsl.
struct Resolve { origin: vec2f, water: f32, layer: f32, absorption: vec3f, dryness: f32 }
@group(0) @binding(0) var<storage, read_write> cells: array<Cell>;
@group(0) @binding(1) var<storage, read_write> accum: array<atomic<u32>>;
@group(0) @binding(2) var<uniform> frame: Resolve;
@group(0) @binding(3) var<storage, read> fiber: array<f32>;

@compute @workgroup_size(8, 8)
fn resolve(@builtin(global_invocation_id) id: vec3u) {
  let xy = vec2u(frame.origin) + id.xy;
  if (any(xy >= vec2u(N))) { return; }
  let k = xy.y * N + xy.x;
  let v = atomicExchange(&accum[k], 0u);
  if (v == 0u) { return; }
  // Same paper contact as the round brush (deposit.wgsl): a dry brush only
  // reaches the paper's peaks, and the back face sees the front's valleys as peaks.
  let front = fiber[k];
  let height = select(1.0 - front, front, frame.layer < 0.5);
  let level = frame.dryness - 0.15;
  let amount = f32(v) / FIXED * smoothstep(level - 0.15, level + 0.15, height);
  if (amount <= 0.0) { return; }
  let i = u32(frame.layer) * N * N + k;
  let mass = amount * 1.5;
  let stuck = mass * min(1.0, frame.dryness * 2.0);
  cells[i].state += vec4f(amount * frame.water * (1.0 - 0.9 * frame.dryness), mass - stuck, stuck, 0);
  cells[i].mobile += vec4f(frame.absorption * (mass - stuck), 0);
  cells[i].settled += vec4f(frame.absorption * stuck, 0);
}
