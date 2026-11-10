// TypeScript uploads four floats (16 bytes) before each draw.
struct View {
  aspect: f32,
  yaw: f32,
  pitch: f32,
  distance: f32,
}
@group(0) @binding(0) var<uniform> view: View;

@group(0) @binding(1) var paper: texture_2d<f32>;
@group(0) @binding(2) var paperSampler: sampler;
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

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  return textureSample(paper, paperSampler, input.uv);
}
