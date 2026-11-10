import './style.css';
import { InkSimulation, DEFAULT_PARAMS, type InkParams } from './ink-simulation';
import { paperPoint, type Point } from './paper-view';
import shaderCode from './paper.wgsl?raw';

const canvas = document.querySelector<HTMLCanvasElement>('#canvas')!;
const status = document.querySelector<HTMLElement>('#status')!;
const resetButton = document.querySelector<HTMLButtonElement>('#reset')!;

// Tracks whether rendering has been stopped because of a GPU error.
// The device-lost and uncaptured-error handlers in getGPU() set this to true.
// When true, render() skips GPU work and initialization preserves the error
// message instead of replacing it with "WebGPU ready". Reloading resets it.
let stoppedRendering = false;

function showError(error: unknown): void {
  status.dataset.error = 'true';
  status.textContent = error instanceof Error ? error.message : String(error);
}

async function getGPU(): Promise<{ adapter: GPUAdapter; device: GPUDevice }> {
  // First, see if this browser has support for WebGPU. 
  // If it does not, immediately error
  if (!navigator.gpu) {
    throw new Error('WebGPU is unavailable. Open this page in a WebGPU-capable browser on localhost or HTTPS.');
  }
  
  // Otherwise, attempt to get the WebGPU adapter
  // throw an error if we cannot get it for some reason
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    throw new Error('No WebGPU adapter is available in this browser.');
  }
  
  // Finally, get the device from the adapter 
  const device = await adapter.requestDevice({ requiredFeatures: adapter.features.has('timestamp-query') ? ['timestamp-query'] : [] });

  // Register a callback for when this device is lost and can no longer be used.
  // Using .then registers the callback without waiting for device loss here.
  device.lost.then((info) => {
    stoppedRendering = true;
    showError(`GPU device lost: ${info.message || info.reason}. Reload to reconnect.`);
  });

  // Register a callback for GPU errors that were not captured by an error scope.
  // These can be reported asynchronously, such as using a buffer incorrectly.
  device.addEventListener('uncapturederror', (event) => {
    stoppedRendering = true;
    showError(event.error.message);
  });
  
  // Return both objects. An async function wraps this result in a Promise.
  return { adapter, device };
} 

async function main(): Promise<void> {
  // 1. Wait for GPU initialization, then extract the device from the result.
  const { adapter, device } = await getGPU();

  // 2. Connect the HTML canvas to this device's rendered output.
  const context = canvas.getContext('webgpu');
  if (!context) throw new Error('Could not create a WebGPU canvas context.');
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: 'opaque' });

  // 3. Compile the shader and define how the GPU draws our two triangles.
  const shader = device.createShaderModule({ label: 'Paper shaders', code: shaderCode });
  const compilation = await shader.getCompilationInfo();
  const errors = compilation.messages.filter((message) => message.type === 'error');
  if (errors.length) throw new Error(errors.map((error) => `WGSL line ${error.lineNum}: ${error.message}`).join('\n'));
  const pipeline = await device.createRenderPipelineAsync({
    label: 'Smooth paper pipeline',
    layout: 'auto',
    vertex: { module: shader, entryPoint: 'vertexMain' },
    fragment: { module: shader, entryPoint: 'fragmentMain', targets: [{ format }] },
    // Both sides stay visible when the paper rotates away from the camera.
    primitive: { topology: 'triangle-list', cullMode: 'none' },
  });

  // 4. A uniform buffer carries the aspect ratio and angles into the shader.
  const viewBuffer = device.createBuffer({
    label: 'View parameters',
    size: 16, // Four float32 values; matches the WGSL View struct exactly.
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const simulation = new InkSimulation(device);
  await simulation.init();
  const bindGroups = simulation.buffers.map(buffer => device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0), entries: [
      { binding: 0, resource: { buffer: viewBuffer } },
      { binding: 1, resource: { buffer } },
    ],
  }));
  function clearPaper() { simulation.clear(); }
  let paused = false;
  let accumulator = 0;
  let lastTime = performance.now();
  const frameTimes: number[] = [];
  let yaw = 0;
  let pitch = 0;
  let distance = 4;

  // 5. Input renders immediately; animation advances a fixed 60 Hz simulation.
  // Pipelines and buffers persist; the canvas texture is acquired each draw.
  function render(steps = 0): void {
    if (stoppedRendering || !context) return;
    device.queue.writeBuffer(viewBuffer, 0, new Float32Array([
      canvas.width / canvas.height, yaw, pitch, distance,
    ]));
    const encoder = device.createCommandEncoder({ label: 'Paper frame' });
    simulation.encode(encoder, steps);
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        clearValue: { r: 0.035, g: 0.045, b: 0.065, a: 1 },
        loadOp: 'clear', // Clear the background before drawing the white plane.
        storeOp: 'store', // Preserve the finished image for presentation.
      }],
    });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroups[simulation.current]);
    pass.draw(6); // Six vertex shader invocations produce two triangles.
    pass.end();
    device.queue.submit([encoder.finish()]);
  }

  // Display resolution is independent of the 1024-square simulation grid.
  const resizeObserver = new ResizeObserver(() => {
    const ratio = window.devicePixelRatio || 1;
    const limit = device.limits.maxTextureDimension2D;
    canvas.width = Math.max(1, Math.min(limit, Math.round(canvas.clientWidth * ratio)));
    canvas.height = Math.max(1, Math.min(limit, Math.round(canvas.clientHeight * ratio)));
    render();
  });
  resizeObserver.observe(canvas);

  // 6. Drawing and navigation are separate gestures. Ray picking uses exactly
  // the same camera and rotation as the vertex shader, including the back face.
  let drag: { id: number; x: number; y: number; rotate: boolean; previous?: Point } | undefined;
  function hit(event: PointerEvent): Point | undefined {
    const rect = canvas.getBoundingClientRect();
    return paperPoint(
      2 * (event.clientX - rect.left - canvas.clientLeft) / canvas.clientWidth - 1,
      1 - 2 * (event.clientY - rect.top - canvas.clientTop) / canvas.clientHeight,
      canvas.width / canvas.height, yaw, pitch, distance,
    );
  }
  let sampleTime = 0;
  function drawPoint(point: Point, previous?: Point, time = performance.now()): void {
    simulation.stroke(point.x, point.y, previous?.x, previous?.y, previous ? (time-sampleTime)/1000 : 1/60);
    sampleTime = time;
  }
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  canvas.addEventListener('pointerdown', (event) => {
    if ((event.button !== 0 && event.button !== 2) || drag) return;
    event.preventDefault();
    canvas.focus();
    canvas.setPointerCapture(event.pointerId);
    const rotate = event.button === 2 || event.shiftKey;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, rotate };
    canvas.style.cursor = rotate ? 'grabbing' : 'crosshair';
    if (!rotate) {
      drag.previous = hit(event);
      if (drag.previous) {
        drawPoint(drag.previous, undefined, event.timeStamp);

      }
      render();
    }
  });
  function movePointer(event: PointerEvent): void {
    if (!drag || drag.id !== event.pointerId) return;
    if (drag.rotate) {
      yaw += (event.clientX - drag.x) * 0.008;
      pitch += (event.clientY - drag.y) * 0.008;
    } else {
      // Browsers may combine several hardware samples into one pointer event.
      // Preserve sample timing and curved stroke segments for GPU deposition.
      const samples = event.getCoalescedEvents?.() ?? [];

      for (const sample of samples.length ? samples : [event]) {
        const point = hit(sample);
        if (point) {
          drawPoint(point, drag.previous, sample.timeStamp);

        }
        // Leaving the sheet breaks the stroke, avoiding a bridge on reentry.
        drag.previous = point;
      }

    }
    drag.x = event.clientX;
    drag.y = event.clientY;
    render();
  }
  canvas.addEventListener('pointermove', movePointer);
  canvas.addEventListener('pointerup', (event) => {
    movePointer(event);
    if (drag?.id === event.pointerId) {
      drag = undefined;
      canvas.style.cursor = 'crosshair';
      canvas.releasePointerCapture(event.pointerId);
    }
  });
  for (const name of ['pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(name, () => { drag = undefined; canvas.style.cursor = 'crosshair'; });
  }
  function zoom(factor: number): void {
    if (drag) return;
    // Keep the camera outside the entire rotated square (radius sqrt(2)).
    distance = Math.max(1.8, Math.min(10, distance * factor));
    render();
  }
  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1);
    zoom(Math.exp(Math.max(-1, Math.min(1, pixels * 0.001))));
  }, { passive: false });
  document.querySelector('#zoom-in')!.addEventListener('click', () => zoom(1 / 1.15));
  document.querySelector('#zoom-out')!.addEventListener('click', () => zoom(1.15));
  document.querySelector('#clear')!.addEventListener('click', () => { clearPaper(); render(); });
  function resetView(): void {
    if (drag) return;
    yaw = pitch = 0;
    distance = 4;
    render();
  }
  resetButton.addEventListener('click', resetView);
  canvas.addEventListener('keydown', (event) => {
    if (drag) return;
    switch (event.key) {
      case 'ArrowLeft': yaw -= 0.1; break;
      case 'ArrowRight': yaw += 0.1; break;
      case 'ArrowUp': pitch -= 0.1; break;
      case 'ArrowDown': pitch += 0.1; break;
      case '+': case '=': zoom(1 / 1.15); return;
      case '-': zoom(1.15); return;
      case 'r': case 'R': resetView(); return;
      default: return;
    }
    event.preventDefault();
    render();
  });
  //create slider inputs to modify params at runtime
  const sliderInputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[data-param]'));
  function syncSliders(): void {
    for (const input of sliderInputs) {
      const key = input.dataset.param as keyof InkParams;
      input.value = String(simulation.params[key]);
      input.nextElementSibling!.textContent = Number(input.value).toString();
    }
  }
  for (const input of sliderInputs) {
    input.addEventListener('input', () => {
      simulation.setParams({ [input.dataset.param as keyof InkParams]: Number(input.value) });
      input.nextElementSibling!.textContent = Number(input.value).toString();
    });
  }
  document.querySelector('#reset-sliders')!.addEventListener('click', () => {
    simulation.setParams(DEFAULT_PARAMS);
    syncSliders();
  });
  syncSliders();
  if (!stoppedRendering) {
    status.textContent = 'Smooth paper | Round brush | Live ink · 1024 × 1024';
  }
  function animate(now: number) {
    const elapsed = now-lastTime; lastTime = now;
    if (!paused && !document.hidden) {
      frameTimes.push(elapsed); if (frameTimes.length > 3600) frameTimes.shift();
      accumulator += Math.min(elapsed/1000, 0.1);
      const steps = Math.min(6, Math.floor(accumulator*60));
      accumulator -= steps/60;
      render(steps);
    }
    if (!stoppedRendering) requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
  // Explicit test mode: deterministic stepping and readback for validation/captures.
  if (new URLSearchParams(location.search).has('test')) {
    (window as any).inkTest = {
      benchmark: () => simulation.benchmark(),
      hardware: adapter.info, pause: () => { paused = true; },
      clear: () => { clearPaper(); render(); },
      stroke: (...args: Parameters<InkSimulation['stroke']>) => simulation.stroke(...args),
      step: async (n: number) => { for(let i=0;i<n;i++) render(1); await device.queue.onSubmittedWorkDone(); },
      render: () => render(), read: () => simulation.read(),
      frames: () => frameTimes.slice(),
      resume: () => { paused = false; accumulator = 0; lastTime = performance.now(); },
    };
  }

}

main().catch(showError);
