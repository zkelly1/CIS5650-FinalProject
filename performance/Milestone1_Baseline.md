# Milestone 1 baseline — November 10, 2026

Hardware: NVIDIA GeForce RTX 3070 (Ampere), driver 32.0.16.1656; AMD Ryzen 7 3700X. Windows, Google Chrome 157.0.8103.40, headless with hardware WebGPU. Viewport 1100 × 900 at device scale 1. Simulation grid 1024 × 1024; full-grid dispatch uses 8 × 8 workgroups and 128 × 128 workgroups per step. State storage: two 16 MiB buffers.

## Measurements

| Measurement | Median | 95th percentile | Samples |
| --- | ---: | ---: | ---: |
| Wet full-grid simulation, GPU timestamp | 0.148 ms | 0.154 ms | 120 |
| Sparse, mostly dry dot, GPU timestamp | 0.158 ms | 0.160 ms | 120 |
| Wet compute submission + completion wait, wall time | 3.0 ms | 3.9 ms | 120 |
| Browser animation-frame interval | 6.1 ms | 6.2 ms | 300 |

Each compute benchmark warms up for 30 steps, then records 120 samples. GPU timestamps surround one transport/drying compute pass, excluding deposition and rendering. Submit-and-wait wall time includes CPU, queue, and completion-notification overhead; it is not GPU execution time. Dense wet workload: 32 horizontal strokes; wet coverage goes from 77.9% to 98.0% over the benchmark, with wet defined as water > 0.001. The subsequent six-second animation run includes rendering and fixed-rate simulation, but no continuous mouse drawing. The report retains its last 300 frame intervals.

These results support the 60 FPS target on this hardware: measured frame intervals are below 16.7 ms. Headless frame scheduling is not a visible-display FPS measurement, and GPU pass timing alone does not prove end-to-end interactive performance on other devices. Both sparse and wet cases process the entire grid; their small timing difference is not a claimed optimization.

## Correctness and browser checks

- GPU shaders compile; no uncaptured GPU errors or page exceptions.
- A single dot's wet area increases from 516 cells after one step to 2,504 after two simulated seconds.
- Pigment mass changes from 474.927211 to 474.927281 after 20 seconds: relative drift approximately 0.000015%.
- Surface water and mobile pigment both reach zero after 20 seconds; settled pigment remains.
- A corner deposit preserves pigment at the no-flux sheet boundaries.
- All checked water/pigment values are finite and nonnegative.
- Replaying the same one-second line with 15 versus 120 input segments changes total deposition by 0.50%, below the 3% test tolerance.
- Actual browser mouse dragging deposits pigment. Zoom, keyboard rotation, and reset preserve pigment; clear removes it.
- Wet/dry screenshots and rotated paper were visually inspected.

## Reproduce

Run `pnpm dev --port 5174` and, in another terminal, `pnpm test:gpu`. Installed Google Chrome is required. Set `TEST_URL` to override the server URL. Output is `performance/milestone1.json`, example screenshots, and ignored `img/frames/` captures. Run `python tests/make-gifs.py` with Pillow installed to assemble the two GIFs. Hardware model/driver above were read from Windows; the browser reports vendor/architecture in raw test results.

Captures use deterministic simulated steps. GIF labels show simulated time; drying playback is accelerated. The spreading close-up enlarges a 64 × 64 screenshot crop eightfold, intentionally showing the pixels. These are rendered simulation captures, not generated illustrations.
