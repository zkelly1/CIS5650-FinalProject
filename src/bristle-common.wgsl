
struct Brush {
  center: vec2f,       // brush center
  prevCenter: vec2f,   // brush center (previous)
  dir: vec2f,          // smoothed stroke directuin
  radius: f32,         // brush radius
  bristleRadius: f32,  // X
  deformation: f32,    // how deformed the bristle tips get (0 no deformation)
  amount: f32,         // ink per unit footprint for this sub-step
  depletion: f32,      // how quickly bristles dry up
  reset: f32,          // how quickly bristle tips reset
  count: f32,          // numb of bristles
  maxReach: f32,       // max splayed bristle distance
  p0: f32,
  p1: f32,
}
struct Bristle {
  tip: vec2f,
  prev: vec2f,
  ink: f32,
  p0: f32,
  p1: vec2f,
}
const FIXED = 65536.0;
fn hash(i: u32) -> f32 {
  var x = i * 747796405u + 2891336453u;
  x = ((x >> ((x >> 28u) + 4u)) ^ x) * 277803737u;
  x = (x >> 22u) ^ x;
  return f32(x) / 4294967295.0;
}
