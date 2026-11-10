import depositCode from './deposit.wgsl?raw';
import simulateCode from './simulate.wgsl?raw';

export interface InkParams {
  diffusion: number;  // water spread per step, max stable ~0.24
  absorption: number; // paper soaks up water (1/s)
  settling: number;   // mobile pigment fixes to the paper (1/s)
  waterLoad: number;  // water deposited per unit of brush contact
  radius: number;     // brush core radius in grid cells
  roughness: number;  // 0 = uniform paper, 1 = strongly fibrous
}
export const DEFAULT_PARAMS: InkParams = { diffusion: 0.18, absorption: 0.65, settling: 1.1, waterLoad: 5, radius: 8, roughness: 0 };

// define some fiber parameters
//length of fiber strands in long direction (length)
const FIBER_LONG = 10;
//length of fiber stands in short direction (width)
const FIBER_SHORT = 2.5;
const WEIGHT_GRAIN = 0.3;
const WEIGHT_STREAK = 0.35;
//contrast of fiber compared to the rest of the paper
const FIBER_CONTRAST = 2.2;

//stretch noise across an axis to create fiber "streaks"
function makeStreakLayer(n: number, sx: number, sy: number) {
  const cols = Math.ceil(n / sx) + 2, rows = Math.ceil(n / sy) + 2;
  const lattice = Float32Array.from({ length: cols * rows }, () => Math.random());
  return (px: number, py: number) => {
    const x = px / sx;
    const y = py / sy;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const u = fx * fx * (3 - 2 * fx);
    const v = fy * fy * (3 - 2 * fy);
    const a = lattice[y0 * cols + x0], b = lattice[y0 * cols + x0 + 1];
    const c = lattice[(y0 + 1) * cols + x0], d = lattice[(y0 + 1) * cols + x0 + 1];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

// create streaks in 2 directions to create a crosshatched fiber pattern, similar to real paper
function makeFiberMap(n: number): Float32Array<ArrayBuffer> {
  const horizontal = makeStreakLayer(n, FIBER_LONG, FIBER_SHORT);
  const vertical = makeStreakLayer(n, FIBER_SHORT, FIBER_LONG);
  const map = new Float32Array(new ArrayBuffer(n * n * 4));
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const f = WEIGHT_GRAIN * Math.random()
      + WEIGHT_STREAK * horizontal(x, y)
      + WEIGHT_STREAK * vertical(x, y);
    map[y * n + x] = Math.min(1, Math.max(0, (f - 0.5) * FIBER_CONTRAST + 0.5));
  }
  return map;
}

export class InkSimulation {
  readonly size = 1024;
  readonly buffers: GPUBuffer[];
  current = 0;
  params: InkParams = { ...DEFAULT_PARAMS };
  private deposit!: GPUComputePipeline;
  private simulate!: GPUComputePipeline;
  private groups: GPUBindGroup[] = [];
  private pending: number[][] = [];
  private uniforms: GPUBuffer[] = [];
  private paramBuffer: GPUBuffer;
  private fiberBuffer: GPUBuffer;
  constructor(readonly device: GPUDevice) {
    this.buffers = [0, 1].map(() => device.createBuffer({ size: 1024 * 1024 * 16,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST }));
    this.paramBuffer = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.fiberBuffer = device.createBuffer({ size: 1024 * 1024 * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(this.fiberBuffer, 0, makeFiberMap(1024));
    this.setParams({});
  }
  /** Updates any subset of the parameters; sim parameters take effect on the next step. */
  setParams(change: Partial<InkParams>) {
    this.params = { ...this.params, ...change };
    const p = this.params;
    this.device.queue.writeBuffer(this.paramBuffer, 0, new Float32Array([p.diffusion, p.absorption, p.settling, p.roughness]));
  }
  async init() {
    const pipelines = [];
    for (const [code, entryPoint] of [[depositCode, 'deposit'], [simulateCode, 'simulate']]) {
      const module = this.device.createShaderModule({ code });
      const info = await module.getCompilationInfo();
      const errors = info.messages.filter(m => m.type === 'error');
      if (errors.length) throw Error(errors.map(m => m.message).join('\n'));
      pipelines.push(await this.device.createComputePipelineAsync({ layout: 'auto', compute: { module, entryPoint } }));
    }
    [this.deposit, this.simulate] = pipelines;
    this.groups = [0, 1].map(i => this.device.createBindGroup({ layout: this.simulate.getBindGroupLayout(0), entries: [
      { binding: 0, resource: { buffer: this.buffers[i] } },
      { binding: 1, resource: { buffer: this.buffers[1-i] } },
      { binding: 2, resource: { buffer: this.paramBuffer } },
      { binding: 3, resource: { buffer: this.fiberBuffer } },
    ] }));
  }
  stroke(x: number, y: number, px = x, py = y, seconds = 1/60) {
    this.pending.push([px*1024, py*1024, x*1024, y*1024, Math.min(0.1, Math.max(0, seconds))*60, this.params.radius, this.params.waterLoad, 0]);
  }
  encode(encoder: GPUCommandEncoder, steps: number, querySet?: GPUQuerySet) {
    for (let i = 0; i < this.pending.length; i++) {
      const data = this.pending[i];
      const buffer = this.uniforms[i] ??= this.device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      this.device.queue.writeBuffer(buffer, 0, new Float32Array(data));
      const pass = encoder.beginComputePass();
      pass.setPipeline(this.deposit);
      pass.setBindGroup(0, this.device.createBindGroup({ layout: this.deposit.getBindGroupLayout(0), entries: [
        { binding: 0, resource: { buffer: this.buffers[this.current] } }, { binding: 1, resource: { buffer } },
      ] }));
      const span = 2 * (data[5] * 1.5 + 1) + 1; // matches the shader's margin around the segment
      pass.dispatchWorkgroups(Math.ceil((Math.abs(data[2]-data[0])+span)/8), Math.ceil((Math.abs(data[3]-data[1])+span)/8));
      pass.end();
    }
    this.pending = [];
    for (let i = 0; i < steps; i++) {
      const pass = encoder.beginComputePass(querySet ? { timestampWrites: { querySet, beginningOfPassWriteIndex: 0, endOfPassWriteIndex: 1 } } : {});
      pass.setPipeline(this.simulate); pass.setBindGroup(0, this.groups[this.current]);
      pass.dispatchWorkgroups(128, 128); pass.end(); this.current = 1-this.current;
    }
  }
  clear() {
    this.pending = [];
    const encoder = this.device.createCommandEncoder();
    for (const buffer of this.buffers) encoder.clearBuffer(buffer);
    this.device.queue.submit([encoder.finish()]);
  }
  async benchmark() {
    const timed = this.device.features.has('timestamp-query');
    const query = timed ? this.device.createQuerySet({ type: 'timestamp', count: 2 }) : undefined;
    const resolve = timed ? this.device.createBuffer({ size: 16, usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC }) : undefined;
    const read = timed ? this.device.createBuffer({ size: 16, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ }) : undefined;
    const gpu: number[] = [], wall: number[] = [];
    for (let i = 0; i < 150; i++) {
      const start = performance.now();
      const encoder = this.device.createCommandEncoder(); this.encode(encoder, 1, query);
      if (query && resolve && read) { encoder.resolveQuerySet(query, 0, 2, resolve, 0); encoder.copyBufferToBuffer(resolve, 0, read, 0, 16); }
      this.device.queue.submit([encoder.finish()]);
      await this.device.queue.onSubmittedWorkDone();
      const elapsed = performance.now()-start;
      if (read) {
        await read.mapAsync(GPUMapMode.READ);
        const stamps = new BigUint64Array(read.getMappedRange());
        if (i >= 30) gpu.push(Number(stamps[1]-stamps[0])/1e6);
        read.unmap();
      }
      if (i >= 30) wall.push(elapsed);
    }
    query?.destroy(); resolve?.destroy(); read?.destroy();
    return { gpu, wall };
  }
  async read() {
    const buffer = this.device.createBuffer({ size: 1024*1024*16, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    const encoder = this.device.createCommandEncoder();
    encoder.copyBufferToBuffer(this.buffers[this.current], 0, buffer, 0, buffer.size);
    this.device.queue.submit([encoder.finish()]);
    await buffer.mapAsync(GPUMapMode.READ);
    const data = new Float32Array(buffer.getMappedRange().slice(0)); buffer.unmap(); buffer.destroy();
    let water = 0, pigment = 0, mobile = 0, wet = 0, invalid = 0;
    for (let i = 0; i < data.length; i += 4) {
      water += data[i]; mobile += data[i+1]; pigment += data[i+1]+data[i+2];
      if (data[i] > 0.001) wet++;
      for (let j = 0; j < 3; j++) if (!Number.isFinite(data[i+j]) || data[i+j] < 0) invalid++;
    }
    return { water, pigment, mobile, wet, invalid };
  }
}
