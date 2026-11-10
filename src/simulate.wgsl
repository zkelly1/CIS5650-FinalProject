@group(0) @binding(0) var<storage, read> old: array<vec4f>;
@group(0) @binding(1) var<storage, read_write> next: array<vec4f>;
@compute @workgroup_size(8, 8)
fn simulate(@builtin(global_invocation_id) id: vec3u) {
  if (any(id.xy >= vec2u(1024))) { return; }
  let i = id.y * 1024u + id.x;
  let a = old[i];
  var water = a.x;
  var pigment = a.y;
  let offsets = array<vec2i, 4>(vec2i(-1,0), vec2i(1,0), vec2i(0,-1), vec2i(0,1));
  for (var k = 0; k < 4; k++) {
    let q = vec2i(id.xy) + offsets[k];
    if (any(q < vec2i(0)) || any(q >= vec2i(1024))) { continue; }
    let b = old[u32(q.y) * 1024u + u32(q.x)];
    // Symmetric flux; at most 4 * 0.18 of a cell's water leaves per step.
    let flux = 0.18 * (a.x - b.x);
    water -= flux;
    if (flux > 0) { pigment -= flux * a.y / max(a.x, 0.000001); }
    else { pigment -= flux * b.y / max(b.x, 0.000001); }
  }
  // Fixed 1/60 s step. Absorption/evaporation removes water, never pigment.
  water = max(0.0, water * exp(-0.65 / 60.0) - 0.00003);
  pigment = max(0.0, pigment);
  let settled = pigment * (1.0 - exp(-1.1 / 60.0));
  var out = vec4f(water, pigment - settled, a.z + settled, 0);
  if (water < 0.0001) { out = vec4f(0, 0, a.z + pigment, 0); }
  next[i] = out;
}
