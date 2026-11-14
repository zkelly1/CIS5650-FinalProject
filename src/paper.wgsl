// 48 bytes per cell; optical quantities are extensive (pigment-mass weighted).
struct Cell { state: vec4f, mobile: vec4f, settled: vec4f }
// TypeScript uploads four floats (16 bytes) before each draw.
struct View {
  aspect: f32,
  yaw: f32,
  pitch: f32,
  distance: f32,
}
@group(0) @binding(0) var<uniform> view: View;

@group(0) @binding(1) var<storage, read> cells: array<Cell>;
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}
@vertex
fn vertexMain(@builtin(vertex_index) index: u32) -> VertexOutput {
  // Two triangles make a square in the XY plane, centered at the origin.
  // Generate these six vertices here; this tiny mesh needs no vertex buffer.
  let corners = array<vec2f, 6>(
    vec2f(-1, -1), vec2f(1, -1), vec2f(-1, 1),
    vec2f(-1, 1), vec2f(1, -1), vec2f(1, 1)
  );
  let p = corners[index];

  // Rotate around local X (pitch), then world Y (yaw).
  let tilted = vec3f(p.x, p.y * cos(view.pitch), p.y * sin(view.pitch));
  let rotated = vec3f(
    tilted.x * cos(view.yaw) + tilted.z * sin(view.yaw),
    tilted.y,
    -tilted.x * sin(view.yaw) + tilted.z * cos(view.yaw)
  );

  // A camera at (0, 0, 4) looks toward the origin along negative Z.
  let cameraPosition = rotated - vec3f(0, 0, view.distance);
  let near = 0.1;
  let far = 100.0;
  let focalLength = 1.0 / tan(0.785398 / 2.0); // 45-degree field of view.
  // Fit the paper in narrow viewports too, without stretching its shape.
  let scale = focalLength * min(view.aspect, 1.0);

  // Perspective projection into homogeneous clip coordinates.
  // The GPU divides XYZ by W, so points farther away appear smaller.
  // WebGPU's visible depth range after that division is 0..1.
  var output: VertexOutput;
  output.uv = vec2f((p.x + 1.0) * 0.5, (1.0 - p.y) * 0.5);
  output.position = vec4f(
    cameraPosition.x * scale / view.aspect,
    cameraPosition.y * scale,
    (far * cameraPosition.z + far * near) / (near - far),
    -cameraPosition.z
  );
  return output;
}

// sRGB transfer functions: W3C CSS Color 4, color conversion sample code.
fn toLinear(c: vec3f) -> vec3f {
  return select(pow((c + 0.055) / 1.055, vec3f(2.4)), c / 12.92, c <= vec3f(0.04045));
}
fn toSRGB(c: vec3f) -> vec3f {
  return select(1.055 * pow(c, vec3f(1.0/2.4)) - 0.055, 12.92*c, c <= vec3f(0.0031308));
}
fn opticalAt(i: u32) -> vec4f {
  return vec4f(cells[i].mobile.rgb + cells[i].settled.rgb, cells[i].state.x);
}
@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  let xy = clamp(input.uv * 1024.0 - 0.5, vec2f(0), vec2f(1023));
  let p = vec2u(xy);
  let q = min(p + vec2u(1), vec2u(1023));
  let f = fract(xy);
  let optical = mix(mix(opticalAt(p.y*1024u+p.x), opticalAt(p.y*1024u+q.x), f.x),
                    mix(opticalAt(q.y*1024u+p.x), opticalAt(q.y*1024u+q.x), f.x), f.y);
  // Beer-Lambert: T = exp(-sum(m_i * k_i)). A 3-channel transparent-ink approximation.
  // k is calibrated so 0.5 units of pigment reproduce the selected color on white.
  let paper = toLinear(vec3f(0.965, 0.949, 0.906));
  let color = paper * exp(-2.0 * max(optical.rgb, vec3f(0)));
  return vec4f(toSRGB(color * (1.0 - 0.07 * clamp(optical.a, 0.0, 1.0))), 1);
}
