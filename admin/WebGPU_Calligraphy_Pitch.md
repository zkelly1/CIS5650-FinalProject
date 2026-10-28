# WebGPU Calligraphy

CIS 5650 Fall 2026 · Final project pitch

## Project idea

We want to build an interactive calligraphy tool where users can experiment with different pens, brushes, inks and papers. We are interested in how these choices change the same stroke, from the shape of a pen mark to the way diluted ink spreads into paper. The application will run in the browser and use mouse input for drawing.

Our main goal is to implement the tool and material behavior using WebGPU. We also want to investigate whether updating only wet areas of the paper can make the simulation faster while keeping the result close to a version that updates the entire canvas.

## Planned features

- **Pens and brushes.** A broad-edge calligraphy pen and a flexible round brush, with fine/wide pen and soft/firm brush settings. Users can adjust tip size, simulated pressure and angle through on-screen controls.

- **Inks and papers.** Concentrated and diluted ink presets, adjustable ink load, and smooth and absorbent paper presets. Paper roughness, absorption and fiber direction will affect the stroke.

- **Ink behavior.** Ink deposition, spreading and drying, including interaction between overlapping strokes and new ink added to a previously dry area.

- **Drawing controls.** Tool selection, mouse drawing, controls for simulated pressure and brush angle, clear canvas and PNG export.

- **Replay and comparison.** Record strokes and replay them with different materials or simulation versions. Use these recordings for visual comparisons and performance tests.

## Technical approach

We will use TypeScript, WebGPU and WGSL, with Vite for development and native browser APIs for mouse input and PNG export. TypeScript will handle the interface and stroke recording, while custom WGSL compute shaders will handle ink deposition, spreading, absorption and drying. We will write the core simulation ourselves and credit any reused code or assets.

**Turning mouse movement into strokes.** We will record mouse positions and timestamps along with the selected tool, ink load, size, simulated pressure and angle. We will interpolate between positions so fast movements still leave a continuous stroke. The broad-edge pen will use a rotated rectangular contact area, while the round brush will start with a soft elliptical footprint that changes with the pressure setting and direction of movement. A deposition pass will add water and pigment to the cells covered by each stroke segment. We will scale deposition by elapsed time and distribute it across interpolated samples so the result does not depend mainly on how many mouse events the browser sends.

**Representing ink and paper.** We will start with a 2D grid stored in GPU textures or buffers. Each cell will track surface water, mobile pigment and pigment that has settled into the paper. Separate paper maps will describe roughness, absorption and fiber direction. These maps will stay fixed during a drawing, while the water and pigment values change each simulation step. Ink presets will control the ratio of water to pigment, and paper presets will change how quickly water is absorbed and how easily ink spreads in different directions.

**Updating the simulation.** Our first version will use a local transport model in which each cell exchanges water and mobile pigment with its immediate neighbors. Differences in water level will drive spreading, with paper properties controlling the transfer rate and preferred direction. Pigment will move with the transferred water. An absorption and drying pass will remove surface water and move some mobile pigment into the settled layer. Adding water over an old stroke will allow a controlled amount of settled pigment to become mobile again. We will use a fixed simulation timestep and limit outgoing transfers to the amount available in a cell, then check that transport does not create extra water or pigment. This gives us a manageable starting point for overlapping strokes, bleeding edges and rewetting before considering a more complex fluid solver.

**Organizing GPU work.** Each compute pass will update many grid cells in parallel. For neighbor-dependent updates, we will read the previous state from one set of textures or buffers and write the next state into another, then swap them. This prevents threads from reading partially updated neighbors. We will keep the state on the GPU between passes, and a rendering pass will combine mobile and settled pigment with the paper texture to produce the final image. We will begin with a simple mapping from pigment concentration to ink darkness and use water content to vary the appearance of wet areas. Full 3D bristles and complex color mixing will remain possible extensions.

**Skipping dry regions.** Once the full-grid version works, we will divide the canvas into tiles and track which tiles still contain water or changing pigment. A GPU pass will mark active tiles and the neighboring tiles needed for the next transport step. We plan to compact these flags into an active-tile list and dispatch simulation work over that list, keeping the tracking data on the GPU. New strokes will reactivate the tiles they touch. We will keep neighboring tiles active while ink can cross a boundary and preserve the stored state of skipped tiles. Tests will cover strokes crossing tile boundaries, tiles drying out, and new ink landing on dry areas.

**Comparing the two versions.** We will replay the same recorded strokes with the same timestep and material settings through both implementations. Image comparisons and checks on total pigment will help catch missing transfers or visible seams in the tiled version. We will measure simulation passes and tile-tracking overhead separately where GPU timing is available, and compare different grid resolutions, workgroup sizes and amounts of wet paper. The main question is whether the GPU work saved by skipping dry cells outweighs the cost of finding and scheduling active tiles, especially as more of the canvas becomes wet.

## Existing work

[MUJŌ](https://andrewvoirol.com/work/mujo-watercolor), by Andrew Voirol, is a browser-based watercolor and sumi-e painting project built with WebGPU compute shaders. Its examples show diluted pigment spreading through wet paper and overlapping washes bleeding into each other. The project models ink flow, absorption through paper fibers, pigment mixing, and brush bristles. Its [source repository](https://github.com/AndrewVoirol/watercolor-workbook) and development notes are useful references for connecting brush input to a changing ink simulation.

We want to build on this idea by focusing our project on comparing calligraphy tools and materials: how a broad-edge pen and a round brush produce different strokes, and how those strokes change with ink load and paper absorption. Our main performance question is whether updating only wet tiles can preserve the appearance of a full-grid simulation while reducing GPU work. MUJŌ already explores calligraphy and includes visual tests, so our focus is on implementing and evaluating this particular set of tools and the full-grid versus wet-tile comparison. We plan to write our own core simulation, using MUJŌ as a reference and crediting any code or assets we end up reusing. Full 3D bristles and complex pigment mixing will remain possible extensions.

## Milestone plan

- November 11 — Milestone 1. Working canvas, input, one brush and paper type, ink deposition, spreading and drying. Confirm test hardware and record baseline timings.

- November 18 — Milestone 2. Add the pen model, pen and brush variants, ink and paper presets, and stroke replay. Demonstrate material differences and begin wet-tile tracking.

- November 30 — Milestone 3. Finish wet-tile updates, boundary and rewetting tests, canvas controls and export. Show performance results and image comparisons against the full-grid version.

- December 6 — Final submission. Submit code, documentation, reproducible tests and a demo video. Present the application and results on December 7. Dates follow the overview, subject to course updates.

## Evaluation

We will aim for 60 FPS at a 1024 × 1024 simulation grid and assess that target at Milestone 1. Tests will vary resolution and the amount of wet paper. We will report median and 95th-percentile frame times, GPU timings where available, and image differences between versions. Controlled stroke comparisons will show how pressure, tool choice, ink and paper affect the result.

## Initial references

- [WebGPU API and WGSL specifications](https://www.w3.org/TR/webgpu/)

- Madono and Simo-Serra, [Data-Driven Ink Painting Brushstroke Rendering (2023)](https://esslab.jp/publications/MadonoPG2023.pdf)
