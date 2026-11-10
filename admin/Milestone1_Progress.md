# Milestone 1 progress — November 10, 2026

Implemented on `experimental`; changes are intentionally uncommitted.

## Completed

- Perspective paper canvas, drawing, rotation, zoom, reset, and clear.
- One uniform smooth paper and a fixed soft round brush.
- GPU deposition of water and mobile pigment, with time-scaled stroke segments.
- Full-grid, ping-pong WGSL transport at a fixed 60 Hz simulation timestep.
- Combined water absorption/evaporation and permanent pigment settling.
- Rendering of mobile/settled ink and subtle wetness darkening.
- Browser screenshots, animated examples, reproducible GPU tests, and baseline timings.
- Test hardware identified: NVIDIA GeForce RTX 3070; AMD Ryzen 7 3700X.

## Validation

`pnpm build` passes. `pnpm test:gpu` checks actual GPU state for pigment conservation, spreading, drying, nonnegative finite values, edge handling, event-sampling consistency, clear, and mouse/navigation behavior. Shader compilation and uncaptured GPU errors are checked. Browser screenshots were inspected for paper, strokes, and rotation. The prior projection/picking round-trip validation is recorded in the earlier revision of this note.

See [performance report](../performance/Milestone1_Baseline.md) for measured results and headless-browser limitations. The 60 FPS target is supported by this baseline on the test GPU, but should also be confirmed in a normal visible browser during the milestone demo.

## Examples

- [Drawing and drying GIF](../img/ink-stroke.gif)
- [Magnified spreading GIF](../img/ink-spread.gif)
- [Wet ink screenshot](../img/ink-wet.png)
- [Rotated paper screenshot](../img/rotated-ink.png)

The core implementation items from the pitch's first milestone are complete. Presentation/submission and a visible-browser demo remain user-facing course tasks. Material presets, pen variants, stroke replay, rewetting, wet-tile optimization, and PNG export remain later work.
