# CIS5650 Final Project — WebGPU Calligraphy

An interactive calligraphy tool for exploring how pens, brushes, ink, and paper affect a stroke. We plan to simulate ink deposition, spreading, absorption, and drying with WebGPU compute shaders, then compare a full-grid simulation with updates limited to wet tiles.

See the [project pitch](admin/WebGPU_Calligraphy_Pitch.md) for the proposed features, technical approach, existing work, milestones, and evaluation plan.

## Project layout

```text
admin/        Project pitch, milestone writeups, and course documents
src/          TypeScript application code and WGSL shaders
tests/       Simulation correctness tests and stroke replay fixtures
performance/  Benchmark scripts, timing data, and analysis
img/          Screenshots, comparison images, and demo GIFs
public/       Static assets served by the application
scripts/      Development and data-processing utilities
```

This layout follows the source, test, image, and performance organization used in our earlier CIS 5650 projects.

## Run the first experiment

With Node.js 22.12+ (or a supported newer version) and pnpm installed:

```sh
pnpm install
pnpm dev
```

Open the localhost URL printed by Vite in a WebGPU-capable browser. WebGPU requires a secure context: localhost works for development; a remotely hosted copy needs HTTPS. The browser displaying the page must provide a WebGPU adapter.

```sh
pnpm build
```

The build command checks TypeScript and produces the production site in `dist/`.

## What this version does

WebGPU renders one warm ivory, smooth paper sheet in perspective. A fixed round brush draws dark, continuous static marks into a 1024 × 1024 paper-space texture. Marks remain attached to the sheet when rotated or zoomed, including on the reverse side. Paper color is visual only; there is no material simulation yet.

- Left-drag to draw; click for a round dot.
- Right-drag or Shift-drag to rotate; focused arrow keys also rotate.
- Scroll, use the zoom buttons, or press +/− while focused to zoom.
- Reset view (or R) restores rotation and zoom without erasing marks.
- Clear paper erases the marks.

The brush has a fixed 12-texel diameter in paper space, so its screen size follows perspective and zoom. Input outside the paper is ignored. Leaving the sheet breaks the stroke before reentry. Navigation is held fixed during a drawing gesture.

This is a drawing foundation only: no water/pigment deposition, spreading, absorption, drying, pressure response, or wet-tile simulation. Marks are held in memory and disappear on reload.

## Read the code in this order

1. `index.html`: canvas, navigation controls, clear button, and status text.
2. `src/main.ts`: GPU setup, paper texture, static brush drawing, rendering, and input.
3. `src/paper-view.ts`: ray/plane intersection converts viewport positions to paper texture coordinates.
4. `src/paper.wgsl`: rotates and projects the sheet, then samples its texture using perspective-correct UVs.
5. `src/style.css`: page layout and styling.

The HTML canvas is a viewport. The paper is geometry inside it. A 16-byte uniform buffer carries aspect ratio, yaw, pitch, and camera distance. Static marks are rasterized with Canvas 2D and uploaded to a WebGPU texture; this is temporary drawing infrastructure for the later GPU simulation. Rendering happens on input and resize.
