export type Point = { x: number; y: number };

// Invert the shader's perspective projection, then intersect the ray with
// the rotated paper plane. Coordinates are normalized to the paper texture.
export function paperPoint(nx: number, ny: number, aspect: number, yaw: number,
  pitch: number, distance: number): Point | undefined {
  const scale = (1 / Math.tan(0.785398 / 2)) * Math.min(aspect, 1);
  const dx = nx * aspect / scale;
  const dy = ny / scale;
  const sy = Math.sin(yaw), cy = Math.cos(yaw);
  const sp = Math.sin(pitch), cp = Math.cos(pitch);
  const normal = [sy * cp, -sp, cy * cp];
  const denominator = normal[0] * dx + normal[1] * dy - normal[2];
  if (Math.abs(denominator) < 1e-6) return;
  const t = -distance * normal[2] / denominator;
  if (t <= 0) return;
  const z = distance - t;
  const x = cy * t * dx - sy * z;
  const y = sy * sp * t * dx + cp * t * dy + cy * sp * z;
  if (Math.abs(x) > 1 || Math.abs(y) > 1) return;
  return { x: (x + 1) / 2, y: (1 - y) / 2 };
}
