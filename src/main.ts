import './style.css';
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
  const device = await adapter.requestDevice();

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
  const { device } = await getGPU();

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
  // Static brush marks live in a paper-space image, not a fluid simulation.
  const resolution = 1024;
  const marks = document.createElement('canvas');
  marks.width = marks.height = resolution;
  const ink = marks.getContext('2d')!;
  const paperTexture = device.createTexture({
    label: 'Smooth paper and static brush marks',
    size: [resolution, resolution], format: 'rgba8unorm',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
  });
  function uploadPaper(): void {
    device.queue.copyExternalImageToTexture({ source: marks }, { texture: paperTexture }, [resolution, resolution]);
  }
  function clearPaper(): void {
    ink.fillStyle = '#f6f2e7';
    ink.fillRect(0, 0, resolution, resolution);
    uploadPaper();
  }
  clearPaper();
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: viewBuffer } },
      { binding: 1, resource: paperTexture.createView() },
      { binding: 2, resource: device.createSampler({ magFilter: 'linear', minFilter: 'linear' }) },
    ],
  });
  let yaw = 0;
  let pitch = 0;
  let distance = 4;

  // 5. Draw on demand: input and resizing trigger a new frame.
  // Pipelines and buffers persist; the canvas texture is acquired each draw.
  function render(): void {
    if (stoppedRendering || !context) return;
    device.queue.writeBuffer(viewBuffer, 0, new Float32Array([
      canvas.width / canvas.height, yaw, pitch, distance,
    ]));
    const encoder = device.createCommandEncoder({ label: 'Paper frame' });
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        clearValue: { r: 0.035, g: 0.045, b: 0.065, a: 1 },
        loadOp: 'clear', // Clear the background before drawing the white plane.
        storeOp: 'store', // Preserve the finished image for presentation.
      }],
    });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.draw(6); // Six vertex shader invocations produce two triangles.
    pass.end();
    device.queue.submit([encoder.finish()]);
  }

  // Match display pixels, including high-DPI screens. No simulation grid yet.
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
  function drawPoint(point: Point, previous?: Point): void {
    ink.strokeStyle = ink.fillStyle = '#202126';
    ink.lineWidth = 12;
    ink.lineCap = ink.lineJoin = 'round';
    ink.beginPath();
    if (previous) {
      ink.moveTo(previous.x * resolution, previous.y * resolution);
      ink.lineTo(point.x * resolution, point.y * resolution);
      ink.stroke();
    } else {
      ink.arc(point.x * resolution, point.y * resolution, 6, 0, Math.PI * 2);
      ink.fill();
    }
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
        drawPoint(drag.previous);
        uploadPaper();
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
      // Preserve those samples for curved strokes, then upload only once.
      const samples = event.getCoalescedEvents?.() ?? [];
      let changed = false;
      for (const sample of samples.length ? samples : [event]) {
        const point = hit(sample);
        if (point) {
          drawPoint(point, drag.previous);
          changed = true;
        }
        // Leaving the sheet breaks the stroke, avoiding a bridge on reentry.
        drag.previous = point;
      }
      if (changed) uploadPaper();
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
  if (!stoppedRendering) {
    status.textContent = 'Smooth paper | Round brush | Static ink';
  }
}

main().catch(showError);
