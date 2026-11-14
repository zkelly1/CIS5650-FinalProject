// 48 bytes per cell; optical quantities are extensive (pigment-mass weighted).
struct Cell { state: vec4f, mobile: vec4f, settled: vec4f }
struct Params { diffusion: f32, absorption: f32, settling: f32, roughness: f32 }
@group(0) @binding(0) var<storage, read> old: array<Cell>;
@group(0) @binding(1) var<storage, read_write> next: array<Cell>;
@group(0) @binding(2) var<uniform> params: Params;
@group(0) @binding(3) var<storage, read> fiber: array<f32>;
@compute @workgroup_size(8, 8)
fn simulate(@builtin(global_invocation_id) id: vec3u) {
  if (any(id.xy >= vec2u(1024))) { return; }
  let i = id.y * 1024u + id.x;
  let a = old[i];
  var water = a.state.x;
  var optical = a.mobile.rgb;
  var pigment = a.state.y;
  let fa = fiber[i];
  // Roughness spreads diffusion along a fiber
  let ka = params.diffusion * (1.0 + params.roughness * (1.0 - 2.0 * fa));
  let offsets = array<vec2i, 4>(vec2i(-1,0), vec2i(1,0), vec2i(0,-1), vec2i(0,1));
  for (var k = 0; k < 4; k++) {
    let q = vec2i(id.xy) + offsets[k];
    if (any(q < vec2i(0)) || any(q >= vec2i(1024))) { continue; }
    let j = u32(q.y) * 1024u + u32(q.x);
    let b = old[j];
    let kb = params.diffusion * (1.0 + params.roughness * (1.0 - 2.0 * fiber[j]));
    //both sides must see the same flux (conservation of mass)
    let coeff = clamp(0.5 * (ka + kb), 0.0, 0.24);
    let flux = coeff * (a.state.x - b.state.x);
    water -= flux;
    // Carry pigment mass and its absorption with the exact same donor-cell flux.
    let donorWater = select(b.state.x, a.state.x, flux > 0);
    let donorMass = select(b.state.y, a.state.y, flux > 0);
    let donorOptical = select(b.mobile.rgb, a.mobile.rgb, flux > 0);
    pigment -= flux * donorMass / max(donorWater, 0.000001);
    optical -= flux * donorOptical / max(donorWater, 0.000001);
  }
  // Fixed 1/60 s step. Absorption/evaporation removes water, never pigment.
  // modulate absorption based on fiber density, denser fibers absorb less
  let absorb = params.absorption * (1.0 + params.roughness * (2.0 * fa - 1.0));
  water = max(0.0, water * exp(-absorb / 60.0) - 0.00003);
  pigment = max(0.0, pigment);
  optical = max(optical, vec3f(0));
  let fraction = select(1.0 - exp(-params.settling / 60.0), 1.0, water < 0.0001);
  let fixedMass = pigment * fraction;
  let fixedOptical = optical * fraction;
  var out: Cell;
  out.state = vec4f(select(water, 0.0, water < 0.0001), pigment - fixedMass, a.state.z + fixedMass, 0);
  out.mobile = vec4f(optical - fixedOptical, 0);
  out.settled = vec4f(a.settled.rgb + fixedOptical, 0);
  next[i] = out;
}
