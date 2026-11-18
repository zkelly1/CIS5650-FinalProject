# Milestone 2 benchmarks — November 18, 2026

This report preserves the earlier 512 × 512 × 8 measurements. The [new run at Milestone 1's 1024 × 1024 resolution, extended to eight layers](Milestone2_Benchmarks_1024.md), supplies the current presentation's performance table.

Measured local `milestone-2` at `bdca300` on an NVIDIA GeForce RTX 3070 (driver 32.0.16.1656), AMD Ryzen 7 3700X, Windows, Chrome 158.0.8127.36, headless hardware WebGPU. The simulation has 512 × 512 × 8 cells and two 96 MiB state buffers. Viewport: 1100 × 900; canvas: 1050 × 583.

| Default thickness: 0.15 mm | Median | p95 |
| --- | ---: | ---: |
| GPU simulation update | 1.980 ms | 2.220 ms |
| GPU deposition + simulation + rendering | 1.992 ms | 2.243 ms |
| CPU encoding/submission + GPU completion wait | 4.2 ms | 5.8 ms |
| Headless animation-frame interval | 6.1 ms | 6.2 ms |

| Paper thickness | GPU simulation median | GPU simulation p95 | Substeps |
| --- | ---: | ---: | ---: |
| 0.06 mm | 1.966 ms | 2.200 ms | 2 |
| 0.15 mm | 1.980 ms | 2.220 ms | 2 |
| 0.60 mm | 2.065 ms | 2.337 ms | 2 |

The simulation query spans all substeps of one nominal 1/60-second update, excluding deposition and rendering. Each timing series has 30 warmups and 120 measured samples. The whole-frame benchmark adds one moving stroke segment per sample. The initial workload is 32 horizontal strokes; roughness .75, diffusion .18, drying .65, settling 1.1, water load 5 and radius 8. Raw samples, settings, wet-cell counts and conservation checks are in [milestone2.json](milestone2.json).

Frame intervals are the last 300 samples of a six-second headless run without continuous drawing. They measure browser scheduling, not displayed FPS. The measured times fit within 16.7 ms on this hardware; a visible-browser interaction test remains useful. Fibers are procedural and unseeded, so reruns do not reuse identical fiber maps. All cells, including dry cells, are processed. Small differences between thicknesses are not a wet-tile speedup.

The historical Milestone 1 fibers run used a 1024 × 1024 surface and 32 MiB of state. Milestone 2 doubles cell count and increases state storage sixfold, with added color/depth work and stability substeps. Browser versions and canvas sizes also differ; these are capability/cost measurements, not a controlled optimization comparison.

Validation passed: `pnpm build`, `tests/validate-color.mjs`, and `tests/validate-thickness.mjs`. The fresh benchmark also verified finite/nonnegative state, pigment conservation, and no reported GPU/page errors.

These measurements used the benchmark script at the recorded revision. The current `tests/benchmark-milestone2.mjs` runs the matched-resolution 1024 × 1024 × 8 experiment described in [the newer report](Milestone2_Benchmarks_1024.md). Installed Google Chrome is required. `TEST_URL` overrides the server URL. For the color/thickness checks, set `TEST_URL=http://127.0.0.1:5181`.

The saved seepage experiment in [seepage-results.json](seepage-results.json) uses different material settings and four simulated seconds: rear-layer pigment shares are 10.39%, 4.27%, and 0% for 0.06, 0.15, and 0.60 mm respectively. See `tests/capture-seepage.mjs` for that separate procedure.

[Milestone 2 Google Slides](https://docs.google.com/presentation/d/1sieYDvANQQT_IOQfqEdMMLktIRdc0vxmpZ8Adqcq-q4/edit)
