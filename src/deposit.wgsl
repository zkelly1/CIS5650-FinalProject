// 48 bytes per cell; optical quantities are extensive (pigment-mass weighted).
struct Cell { state: vec4f, mobile: vec4f, settled: vec4f }
// params.x = time scale, params.y = brush core radius (px), params.z = water load, params.w = destination depth layer.
struct Segment { ends: vec4f, params: vec4f, absorption: vec4f }
@group(0) @binding(0) var<storage, read_write> cells: array<Cell>;
@group(0) @binding(1) var<uniform> stroke: Segment;
@group(0) @binding(2) var<storage, read> fiber: array<f32>;
@compute @workgroup_size(8, 8)
fn deposit(@builtin(global_invocation_id) id: vec3u) {
  //handle parameterized stroke width/radius
  let radius = stroke.params.y;
  let margin = radius * 1.5 + 1.0;
  let origin = vec2u(max(vec2f(0), floor(min(stroke.ends.xy, stroke.ends.zw) - vec2f(margin))));
  let xy = origin + id.xy;
  if (any(xy >= vec2u(N))) { return; }
  let p = vec2f(xy) + 0.5;
  let ab = stroke.ends.zw - stroke.ends.xy;
  let t = clamp(dot(p - stroke.ends.xy, ab) / max(dot(ab, ab), 0.0001), 0.0, 1.0);
  let d = distance(p, stroke.ends.xy + t * ab);
  let footprint = 1.0 - smoothstep(radius, radius * 1.5, d);
  // Dry brush: a drier brush only reaches the paper's high points, leaving the
  // valleys bare. contact level rises with dryness
  let dryness = stroke.absorption.w;
  let front = fiber[xy.y * N + xy.x];
  let height = select(1.0 - front, front, stroke.params.w < 0.5);
  let level = dryness - 0.15;
  let contact = smoothstep(level - 0.15, level + 0.15, height);
  // Normalize a swept capsule by its length: equal time deposits equal mass.
  let amount = footprint * contact * stroke.params.x / (1.0 + length(ab) / 16.0);
  let i = u32(stroke.params.w) * N * N + xy.y * N + xy.x;
  let mass = amount * 1.5;
  let stuck = mass * min(1.0, dryness * 2.0);
  let water = amount * stroke.params.z * (1.0 - 0.9 * dryness);
  cells[i].state += vec4f(water, mass - stuck, stuck, 0);
  cells[i].mobile += vec4f(stroke.absorption.rgb * (mass - stuck), 0);
  cells[i].settled += vec4f(stroke.absorption.rgb * stuck, 0);
}
