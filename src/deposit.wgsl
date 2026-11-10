// params.x = time scale, params.y = brush core radius (px), params.z = water load.
struct Segment { ends: vec4f, params: vec4f }
@group(0) @binding(0) var<storage, read_write> cells: array<vec4f>;
@group(0) @binding(1) var<uniform> stroke: Segment;
@compute @workgroup_size(8, 8)
fn deposit(@builtin(global_invocation_id) id: vec3u) {
  //handle parameterized stroke width/radius
  let radius = stroke.params.y;
  let margin = radius * 1.5 + 1.0;
  let origin = vec2u(max(vec2f(0), floor(min(stroke.ends.xy, stroke.ends.zw) - vec2f(margin))));
  let xy = origin + id.xy;
  if (any(xy >= vec2u(1024))) { return; }
  let p = vec2f(xy) + 0.5;
  let ab = stroke.ends.zw - stroke.ends.xy;
  let t = clamp(dot(p - stroke.ends.xy, ab) / max(dot(ab, ab), 0.0001), 0.0, 1.0);
  let d = distance(p, stroke.ends.xy + t * ab);
  let footprint = 1.0 - smoothstep(radius, radius * 1.5, d);
  // Normalize a swept capsule by its length: equal time deposits equal mass.
  let amount = footprint * stroke.params.x / (1.0 + length(ab) / 16.0);
  let i = xy.y * 1024u + xy.x;
  cells[i] += vec4f(amount * stroke.params.z, amount * 1.5, 0, 0);
}
