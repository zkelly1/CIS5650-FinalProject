# CIS5650 Final Project â€” WebGPU Calligraphy

An interactive calligraphy tool for exploring how pens, brushes, ink, and paper affect a stroke. We plan to simulate ink deposition, spreading, absorption, and drying with WebGPU compute shaders, then compare a full-grid simulation with updates limited to wet tiles.

See the [project pitch](admin/WebGPU_Calligraphy_Pitch.md) for the proposed features, technical approach, existing work, milestones, and evaluation plan.

## Project layout

```text
admin/        Project pitch, milestone writeups, and course documents
src/          HTML entry point, TypeScript configuration, application code, and WGSL shaders
tests/        Simulation correctness tests, capture utilities, and stroke replay fixtures
performance/  Benchmark scripts, timing data, and analysis
media/        Screenshots, comparison images, and demo GIFs
```

This layout follows the source, test, image, and performance organization used in our earlier CIS 5650 projects.

The root keeps `package.json`, `pnpm-lock.yaml`, and `pnpm-workspace.yaml` together for dependency management. Application files live in `src`; benchmark JSON belongs in `performance`. Generated presentation builds and raw capture frames are ignored by Git.

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

The landing page is the flat-paper experiment with RGB ink mixing, adjustable sheet thickness, and porous seepage through the paper.

WebGPU renders a closed ivory paper slab and simulates ink on a 512 x 512 x 8 layered grid. The brush deposits on the face you touch. Water carries mobile pigment laterally and into the material; drying removes water and settling traps pigment. The back shows the ink that actually reaches its outer layer. Thickness ranges from 0.05 to 0.8 mm, default 0.15 mm; changing it starts a fresh sheet.

- Left-drag to draw; click for a round dot.
- Right-drag or Shift-drag to rotate; focused arrow keys also rotate.
- Scroll, use the zoom buttons, or press +/âˆ’ while focused to zoom.
- Reset view (or R) restores rotation and zoom without erasing ink.
- Clear paper clears both simulation buffers; reload also clears the drawing.

The brush has a soft 24-texel diameter in paper space. Its screen size follows perspective and zoom. Input outside the paper is ignored; leaving the sheet breaks the stroke. Navigation is held fixed during drawing. Stroke segments use sample timestamps and swept-footprint normalization to reduce dependence on mouse event frequency. A starting dot receives one nominal 1/60-second dose; per-segment elapsed time is capped at 100 ms to prevent a stalled browser from depositing a large burst.

## Simulation

Two 96 MiB GPU storage buffers hold twelve floats per cell: water/mobile/settled pigment mass, mobile RGB absorption, settled RGB absorption, and alignment padding. Deposition touches only the selected face. Six-neighbor symmetric flux reads one buffer and writes the other, then swaps them. Pigment and optical mass follow donor-water concentration; settled pigment stays fixed. All sheet boundaries have zero outward transport flux.

The simulation advances nominal 1/60-second steps, split into stable substeps depending on thickness. Up to six nominal catch-up steps run per animation frame. Hidden tabs pause; long stalls discard excess elapsed time. Rendering bilinearly interpolates optical mass on each face, samples depth layers on the edges, and computes RGB transmission with subtle wet-paper darkening. The display enlarges thickness by 10x for visible edges; the physical transport calculation uses the slider's actual millimeters. All layers are processed, including dry cells.

This is a simple local transport model with procedural paper fibers, not a full fluid solver. Separate material presets, pressure controls, rewetting of settled pigment, wet-tile optimization, export, and saved stroke replay remain later-milestone work.

## Validation and examples

```sh
# Terminal 1
pnpm dev --port 5174
# Terminal 2 (installed Google Chrome required)
pnpm test:gpu
# Optional GIF assembly: Python + Pillow required
python tests/make-gifs.py
```

Set `TEST_URL` to use another server URL. The browser suite launches headless Chrome with WebGPU, checks shader/GPU errors, conservation, drying, boundaries, sample-rate stability, and mouse/navigation controls. It records GPU timestamps when supported, frame intervals, screenshots, and deterministic capture frames. The test interface is exposed only when the URL contains `?test`. Raw frames are ignored by Git.

See [baseline measurements](performance/Milestone1_Baseline.md) and [raw results](performance/milestone1.json). GIFs show actual GPU-rendered output; timestamps indicate simulated time, and GIF playback is compressed during drying.

![Drawing and drying](media/ink-stroke.gif)

![Magnified ink spreading and drying](media/ink-spread.gif)

## Read the code in this order

1. `src/main.ts`: initializes WebGPU, the paper interface, input controls, and rendering.
2. `src/ink-simulation.ts`: simulation buffers, compute pipelines, readback, and timing helpers.
3. `src/deposit.wgsl`: soft swept brush deposition of water and pigment.
4. `src/simulate.wgsl`: conservative neighbor transport, water loss, and pigment settling.
5. `src/paper.wgsl`: paper projection and simulation-state shading.
6. `src/paper-view.ts`: perspective ray picking into paper coordinates.

## Milestone 2: ink color and mixing

The color panel has a saturation/brightness field, hue strip, synchronized RGB (0â€“255) and six-digit hex inputs, and quick swatches. Arrow keys adjust the field; Shift makes larger steps. Changing color affects new deposits only. Reset sliders does not erase the selected color.

We use a **three-channel Beerâ€“Lambert transparent-ink approximation**, not additive screen-color averaging or a full spectral paint model:

1. Decode the chosen sRGB color to linear light using the standard piecewise sRGB transfer function.
2. For each channel, compute an effective absorption coefficient `k = -ln(max(0.001, colorLinear))`.
3. Deposit optical mass `q = pigmentMass * k` alongside the existing pigment mass. Capture the color when each stroke segment is queued.
4. Transport `q` with exactly the same donor-cell water flux as mobile pigment. Settling transfers the same fraction of both into the fixed channels. Water removal does not delete optical mass.
5. Render `linearColor = paperLinear * exp(-2 * (qMobile + qSettled))`, then encode back to sRGB. The factor 2 calibrates 0.5 units of pigment to the selected transmission on white paper.

At any cell, `qTotal = sum(m_i * k_i)`: twice as much of one ink contributes twice as much absorption. Equivalently, its mixture coefficient is `sum(m_i*k_i)/sum(m_i)`. Equal cyan and yellow deposits make green; magenta and cyan make blue; yellow and magenta make red/orange. Additional layers darken the result. Overlap is order independent for identical deposited states; strokes made at different times can differ because the simulation moves and dries ink between them. Dry pigment stays fixed, but contributes optically under later strokes.

**Scope:** arbitrary RGB inputs do not determine real pigment spectra. This channel approximation is suitable for transparent dye-like inks; it does not reproduce every physical paint mixture (for example artist blue/yellow pigments), opaque white, scattering, chemical reactions, or rewetting. White contributes no absorption and behaves like a transparent wash. The 0.001 transmission floor avoids infinite coefficients for zero RGB channels. No measured pigment database or Kubelkaâ€“Munk solver is claimed.

### References

- [IUPAC Gold Book: Beerâ€“Lambert law](https://goldbook.iupac.org/terms/view/B00626): exponential light attenuation with concentration and path length; basis of our optical model.
- [W3C CSS Color 4: color conversion code](https://www.w3.org/TR/css-color-4/#color-conversion-code): sRGB decoding/encoding equations. The color square uses the standard HSV parameterization solely for selection; mixing happens in optical-depth space.
- [Curtis et al., Computer-Generated Watercolor, SIGGRAPH 1997](https://grail.cs.washington.edu/wp-content/uploads/2015/08/curtis-1997-cgw.pdf): related pigment transport and optical compositing work. Their shallow-water and Kubelkaâ€“Munk models are context, not implementations copied or claimed here.

### Check and preview

With the development server on port 5180, run `node tests/validate-color.mjs`. It checks weighted mixtures, ordering, optical conservation, complete drying, clearing, input validation and responsive layout. Set `TEST_URL` for another port. `node tests/capture-color-mixing.mjs` records the actual GPU output; `python tests/make-color-mixing-gif.py` assembles the frames.

![Transparent ink mixing](media/color-mixing-demo.gif)


## Milestone 2: paper thickness and seepage

The model uses a conservative finite-volume discretization of anisotropic moisture diffusion, with mobile color advected by that moisture flux. It is a reduced porous-medium model, not Navier-Stokes or a calibrated nonlinear Richards solver.

For adjacent cells `i,j`, the water amount transferred per substep is `Fij = r_ij * (w_i - w_j)`. In depth, `r_z = D_z * dt / dz^2`, where `dz = thickness / 8` and the illustrative coefficient `D_z = 0.0012 mm^2/s`. In-plane rates retain the fiber-modulated artistic diffusion control. Each interface uses the same coefficient in both directions. Pigment transfer is `Fij * mobilePigment_donor / water_donor`; optical mass uses the identical flux. First-order settling transfers `1-exp(-settling*dt)` of mobile pigment into the fixed channels. Drying is an effective volumetric loss, not a resolved humidity/heat or boundary evaporation model. Below a small dry threshold, remaining mobile pigment fixes locally.

We choose `substeps = ceil((0.96 + 2*r_z_nominal)/0.95)` and divide all flux rates and reaction timesteps by that count. The sum of outgoing water fractions is therefore below one, including at maximum roughness. This prevents negative donor amounts without changing the simulated elapsed time. The characteristic depth scale follows `sqrt(D_z*t)`, so crossing time scales with thickness squared. First-order trapping competes with transport: thin sheets show a larger rear deposit before pigment becomes fixed.

The eight layers are a coarse approximation. Amounts are in arbitrary units; no pore saturation, swelling, gravity, pigment-size filtering, rewetting, spectral scattering or optical show-through is modeled. The face shader reads the outermost layer only: visible rear ink is actual transported pigment, not the front image viewed through translucent paper. A 100 mm-wide reference sheet maps to two world units; rendered edge depth is enlarged tenfold, explicitly labeled in the interface. Changing thickness clears existing ink because remapping it to a different physical grid would otherwise invent a history.

### Scientific basis

- [Oliver, Agbezuge and Woodcock (1994), A diffusion approach for modelling penetration of aqueous liquids into paper](https://doi.org/10.1016/0927-7757(94)80120-7): motivates diffusion-based penetration. Predictive material behavior requires measured diffusion and evaporation data; our coefficient is illustrative.
- [Jiang, Amari and Watanabe (1989), The Porous Structure of Paper and Ink Penetration](https://doi.org/10.11413/nig1987.26.251): reports Lucas-Washburn square-root-of-time penetration and pore-dependent pigment filtering. Our diffusion approximation shares the time scaling, but does not resolve pores or implement their experiment.
- [Venditti, Murali and Darhuber (2021), Chromatographic Effects in Inkjet Printing](https://doi.org/10.1021/acs.langmuir.1c01624): context for moisture-driven color transport and competing retention/drying. Their coupled Richards/Darcy and sorption model is more complete than ours.

### Reproduce the thickness experiment

Run Vite on port 5181, then `node tests/capture-seepage.mjs` and `python tests/make-seepage-gif.py`. The capture uses identical colored waves and material controls at 0.06, 0.15 and 0.60 mm, advances each by four simulated seconds, then freezes time for a 360-degree inspection. Labels annotate the recording; all ink and paper are rendered by the app. The script checks pigment/optical conservation, nonnegative finite states, blank backs before transport, thickness ordering, rear-face deposition and clearing on thickness changes. Results are in `performance/seepage-results.json`. Earlier milestone benchmarks and GIFs remain historical baselines; they do not describe this larger simulation.

![Paper thickness experiments](media/paper-seepage-demo.gif)
