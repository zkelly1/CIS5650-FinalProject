# Milestone 2 benchmark at Milestone 1 resolution — November 18, 2026

Reran the current eight-layer simulation at **1024 × 1024 × 8** using the settings and workload saved in `milestone1-fibers.json`. Hardware: NVIDIA GeForce RTX 3070, driver 32.0.16.1656; AMD Ryzen 7 3700X; Windows 11 Pro 25H2, build 26200.9974; Chrome 158.0.8127.36, headless hardware WebGPU.

The run matches Milestone 1's 1100 × 900 viewport, device scale 1, 1050 × 583 canvas, 32 horizontal strokes, 30 warmup samples and 120 measured samples. Parameters are diffusion 0.18, drying 0.65, settling 1.1, water load 5, brush radius 8 and paper roughness 0.75. The script asserts these matches against the saved baseline.

| Measurement (median / 95th percentile) | 0.06 mm | 0.15 mm | 0.60 mm |
| --- | ---: | ---: | ---: |
| GPU ink simulation | 8.918 / 9.177 ms | 8.956 / 9.264 ms | 9.375 / 9.648 ms |
| Whole GPU frame | 9.326 / 9.946 ms | 9.389 / 9.993 ms | 9.726 / 9.910 ms |
| CPU encoding/submission through GPU completion | 11.0 / 12.2 ms | 11.5 / 12.8 ms | 11.4 / 12.8 ms |
| Headless animation-frame interval | 6.1 / 6.1 ms | 6.1 / 6.2 ms | 6.1 / 6.2 ms |
| Headless Browser FPS | 163.9 / 166.7 FPS | 163.9 / 166.7 FPS | 163.9 / 166.7 FPS |

The simulation timestamp encloses both stable substeps of one nominal 1/60-second update. Whole-frame timing includes adding one moving stroke segment, simulation and rendering. Animation intervals are the last 300 samples from six seconds without continuous drawing; they measure browser scheduling, not displayed FPS.

Headless Browser FPS is derived from each recorded interval as `1000 / interval_ms`, then sorted to obtain the median and 95th percentile. Its p95 is the upper percentile of rates, not the reciprocal of the interval p95. This added row uses the existing run's samples; no new GPU run was needed.

Two 384 MiB state buffers total **768 MiB**, excluding fibers, rendering resources and temporary readback. The benchmark requests the larger WebGPU storage-binding and buffer limits and checks adapter support. Regular app sessions retain the existing 512 × 512 × 8 grid; the matched-resolution run is selected explicitly with `?test&grid=1024`.

This matches the baseline's user-controlled settings, but it is not an identical historical environment: Chrome updated from 157.0.8103.40 to 158.0.8127.36, and Windows build 26200.9711 became 26200.9974. Milestone 1 was a single-layer scalar simulation; this run adds eight depth layers, color transport, twelve floats per cell and stability substeps. Procedural fibers remain unseeded as in Milestone 1, so their exact maps differ.

Validation passed for all three cases: no reported page/GPU errors, finite nonnegative state, and pigment conservation (largest relative drift 1.493e-9). Production build, preset interaction checks and default-grid thickness tests also passed.

Run Vite on port 5181, then `node tests/benchmark-milestone2.mjs`; use `TEST_URL` for another port. The script automatically selects 1024 × 1024 × 8 and writes [raw samples and provenance](milestone2-1024.json). The [earlier 512 × 512 × 8 run](Milestone2_Benchmarks.md) remains available as historical evidence. This run used the working tree based on commit `f10e1c1`, with local changes recorded in the raw output.
