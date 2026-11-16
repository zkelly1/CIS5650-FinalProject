// 48 bytes per cell; optical quantities are extensive (pigment-mass weighted).
struct Cell { state: vec4f, mobile: vec4f, settled: vec4f }
struct Params { diffusion: f32, absorption: f32, settling: f32, roughness: f32, vertical: f32, scale: f32, pad0: f32, pad1: f32 }
@group(0) @binding(0) var<storage, read> old: array<Cell>;
@group(0) @binding(1) var<storage, read_write> next: array<Cell>;
@group(0) @binding(2) var<uniform> params: Params;
@group(0) @binding(3) var<storage, read> fiber: array<f32>;
@compute @workgroup_size(8, 8)
fn simulate(@builtin(global_invocation_id) id: vec3u) {
  if (any(id.xy >= vec2u(N))) { return; }
  let i = id.z * N * N + id.y * N + id.x;
  let a = old[i];
  var water = a.state.x;
  var optical = a.mobile.rgb;
  var pigment = a.state.y;
  let fa = fiber[id.y*N+id.x];
  // Roughness spreads diffusion along a fiber
  let ka = params.diffusion * (1.0 + params.roughness * (1.0 - 2.0 * fa));
  let offsets = array<vec3i, 6>(vec3i(-1,0,0), vec3i(1,0,0), vec3i(0,-1,0), vec3i(0,1,0), vec3i(0,0,-1), vec3i(0,0,1));
  for (var k = 0; k < 6; k++) {
    let q = vec3i(id) + offsets[k];
    if (any(q < vec3i(0)) || any(q >= vec3i(i32(N),i32(N),i32(LAYERS)))) { continue; }
    let j = u32(q.z)*N*N + u32(q.y)*N + u32(q.x);
    let b = old[j];
    let kb = params.diffusion * (1.0 + params.roughness * (1.0 - 2.0 * fiber[u32(q.y)*N+u32(q.x)]));
    //both sides must see the same flux (conservation of mass)
    let coeff = select(clamp(0.5 * (ka + kb), 0.0, 0.24), params.vertical, k >= 4) * params.scale;
    let flux = coeff * (a.state.x - b.state.x);
    water -= flux;
    // Carry pigment mass and its absorption with the exact same donor-cell flux.
    let donorWater = select(b.state.x, a.state.x, flux > 0);
    let donorMass = select(b.state.y, a.state.y, flux > 0);
    let donorOptical = select(b.mobile.rgb, a.mobile.rgb, flux > 0);
    pigment -= flux * donorMass / max(donorWater, 0.000001);
    optical -= flux * donorOptical / max(donorWater, 0.000001);
  }
  // Stable substeps of 1/60 s. Effective drying removes water, never pigment.
  // Seepage itself conserves water: it is the vertical neighbor flux above.
  // modulate absorption based on fiber density, denser fibers absorb less
  let absorb = params.absorption * (1.0 + params.roughness * (2.0 * fa - 1.0));
  water = max(0.0, water * exp(-absorb * params.scale / 60.0) - 0.00003 * params.scale);
  pigment = max(0.0, pigment);
  optical = max(optical, vec3f(0));
  let fraction = select(1.0 - exp(-params.settling * params.scale / 60.0), 1.0, water < 0.0001);
  let fixedMass = pigment * fraction;
  let fixedOptical = optical * fraction;
  var out: Cell;
  out.state = vec4f(select(water, 0.0, water < 0.0001), pigment - fixedMass, a.state.z + fixedMass, 0);
  out.mobile = vec4f(optical - fixedOptical, 0);
  out.settled = vec4f(a.settled.rgb + fixedOptical, 0);
  next[i] = out;
}
