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

This layout follows the source, test, image, and performance organization used in our earlier CIS 5650 projects. The repository currently contains the pitch and directory scaffold; implementation and setup instructions will follow as the application is built.
