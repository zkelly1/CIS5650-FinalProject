# Milestone 1 progress — November 9, 2026

## Existing foundation before this change

- TypeScript, Vite, WebGPU, and WGSL project setup with build checking.
- A square sheet made of two GPU-rendered triangles with perspective projection.
- Mouse-drag rotation, arrow-key rotation, and reset view.
- Both faces visible, responsive high-DPI canvas sizing, GPU initialization and error reporting.
- Rendering on input/resize; no animation loop or ink simulation.

## Paper and brush increment

- One smooth ivory paper appearance and one fixed round dark brush.
- Continuous static strokes and click dots in a 1024 × 1024 texture.
- Perspective-aware ray picking for rotated and zoomed paper.
- Separate drawing/rotation gestures, bounded zoom, and clear paper.
- Reset view preserves the drawing; reload clears it.
- Coalesced pointer samples preserve fast curved strokes, with one texture upload per input event.

## Validation

- `pnpm build` passes TypeScript checking and the production build.
- 729 projection/picking round trips passed across three aspect ratios, three yaw angles, three pitch angles, three zoom distances, and nine paper positions, including back-facing views.
- Browser interaction and GPU rendering still need a visual check on the test hardware. These checks do not establish simulation performance or the 60 FPS target.

## Still needed for the pitch's Milestone 1

Ink deposition with water/pigment state, spreading, and drying remain deferred at the user's request. Confirm test hardware and collect baseline performance measurements; assess the 60 FPS target at 1024 × 1024 once the simulation exists.
