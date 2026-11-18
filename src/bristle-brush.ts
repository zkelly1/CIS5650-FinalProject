// Bristle-based brush tip
import commonCode from './bristle-common.wgsl?raw';
import updateCode from './bristle-update.wgsl?raw';
import depositCode from './bristle-deposit.wgsl?raw';
import resolveCode from './bristle-resolve.wgsl?raw';
import type { InkSimulation } from './ink-simulation';
import { DEPTH_LAYERS, GRID_SIZE, shaderSource } from './gpu-grid';

export interface BristleParams {
  bristleCount: number;  //number of bristles
  bristleRadius: number; // radius of a single bristle
  deformation: number;   // measure of how much the bristles drage behind current position (0 to 1)
  pressure: number;      // measure of pressure applied to brush - more pressure, bristles splayed out more (0 to 1)
  depletion: number;     // how quickly the bristles run dry (0 to 1)
  wetness: number;       // how wet the brush is (0 to 1)
}
export const MAX_BRISTLES = 1024;
export const DEFAULT_BRISTLE_PARAMS: BristleParams = { bristleCount: 192, bristleRadius: 0.6, deformation: 0, pressure: 0, depletion: 0.5, wetness: 0.1 };
export const PRESSURE_SPREAD = 1.5;
export const BRISTLE_SLIDERS: { key: keyof BristleParams; label: string; min: number; max: number; step: number; title: string }[] = [
  { key: 'bristleCount', label: 'Bristles', min: 4, max: MAX_BRISTLES, step: 1, title: 'Number of bristles in the brush tip.' },
  { key: 'bristleRadius', label: 'Bristle radius', min: 0.3, max: 4, step: 0.1, title: 'Ink footprint of a single bristle, in paper cells.' },
  { key: 'deformation', label: 'Deformation', min: 0, max: 1, step: 0.05, title: 'How far bristles bend and drag behind the brush. 0 = rigid round tip.' },
  { key: 'pressure', label: 'Pressure', min: 0, max: 1, step: 0.05, title: 'How hard the brush is pressed into the page. More pressure splays the bristles into a wider stroke.' },
  { key: 'depletion', label: 'Ink depletion', min: 0, max: 1, step: 0.05, title: 'How fast bristles run out of ink. Higher = strokes break up into dry-brush hairs sooner. Refills on each new stroke.' },
  { key: 'wetness', label: 'Bristle wetness', min: 0, max: 1, step: 0.05, title: 'Water carried by the bristles, as a fraction of the water load. Low = dry brush with crisp hair lines; high = hairs bleed together.' },
];

const SUBSTEP = 3;
const MAX_SUBSTEPS = 64;
const FALLOFF = 1.25;

// `ink` = [water per unit ink, depth layer, absorption r, g, b, dryness], captured when the stroke is
// drawn (like the round brush), so changing sliders or colour later doesn't recolour pending ink.
interface Op { data: Float32Array<ArrayBuffer>; box: [number, number, number, number]; draw: boolean; ink: number[] }

export class BristleBrush {
  params: BristleParams = { ...DEFAULT_BRISTLE_PARAMS };
  private uniforms: GPUBuffer[] = [];
  private updateGroups: GPUBindGroup[] = [];
  private depositGroups: GPUBindGroup[] = [];
  private resolveGroups = new Map<string, GPUBindGroup>();
  private pending: Op[] = [];
  private last?: [number, number];
  private dir: [number, number] = [1, 0];
  private reach = 0;
  private needsReset = true;
  private layer = 0;

  
  private update!: GPUComputePipeline;
  private deposit!: GPUComputePipeline;
  private resolve!: GPUComputePipeline;
  private readonly bristles: GPUBuffer;
  private readonly accum: GPUBuffer;
  // One uniform per resolve in a frame: queue writes all land before the submit.
  private resolveUniforms: GPUBuffer[] = [];

  constructor(readonly device: GPUDevice, private readonly sim: InkSimulation) {
    this.bristles = device.createBuffer({ label: 'Bristles', size: MAX_BRISTLES * 32, usage: GPUBufferUsage.STORAGE });
    this.accum = device.createBuffer({ label: 'Bristle ink accumulator', size: GRID_SIZE * GRID_SIZE * 4, usage: GPUBufferUsage.STORAGE });
  }

  async init() {
    const pipelines = [];
    for (const [code, entryPoint] of [[updateCode, 'update'], [depositCode, 'deposit'], [resolveCode, 'resolve']]) {
      const module = this.device.createShaderModule({ label: `Bristle ${entryPoint}`, code: shaderSource(commonCode + code) });
      const errors = (await module.getCompilationInfo()).messages.filter(m => m.type === 'error');
      if (errors.length) throw Error(errors.map(m => `bristle ${entryPoint} line ${m.lineNum}: ${m.message}`).join('\n'));
      pipelines.push(await this.device.createComputePipelineAsync({ layout: 'auto', compute: { module, entryPoint } }));
    }
    [this.update, this.deposit, this.resolve] = pipelines;
  }

  setParams(change: Partial<BristleParams>) {
    const p = { ...this.params, ...change };
    p.bristleCount = Math.round(Math.min(MAX_BRISTLES, Math.max(1, p.bristleCount)));
    if (p.bristleCount !== this.params.bristleCount) this.needsReset = true;
    this.params = p;
  }

  setDeformation(deformation: number) { this.setParams({ deformation: Math.min(1, Math.max(0, deformation)) }); }

  /** set pressure as a scalar value - TODO replace by pressure applied by stylus */
  setPressure(pressure: number) { this.setParams({ pressure: Math.min(1, Math.max(0, pressure)) }); }

  /** spread the brush bristles */
  private spreadRadius() { return this.sim.params.radius * (1 + PRESSURE_SPREAD * this.params.pressure); }

// starts the stroke, reseting ink and returning bristles to central position
  beginStroke(_x?: number, _y?: number) { this.needsReset = true; }

  stroke(x: number, y: number, px = x, py = y, seconds = 1/60, layer = 0) {
    layer = Math.max(0, Math.min(DEPTH_LAYERS - 1, Math.round(layer)));
    const R = this.spreadRadius();
    const { bristleCount: n, bristleRadius: r, deformation: def } = this.params;
    const ax = px * GRID_SIZE, ay = py * GRID_SIZE, bx = x * GRID_SIZE, by = y * GRID_SIZE;
    // max tip reach increases based on pressure applid
    const max_tip_reach = Math.max(R, this.sim.params.radius * (1 + PRESSURE_SPREAD)) * (1 + 2 * def) + 1;
    // Pressure changes do not reset, bristles can "close" mid stroke; moving to the other face does.
    const reset = this.needsReset || layer !== this.layer || !this.last || Math.hypot(this.last[0] - ax, this.last[1] - ay) > 0.5 || max_tip_reach !== this.reach;
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy);
    const seg: [number, number] | undefined = L > 1e-6 ? [dx / L, dy / L] : undefined;
    if (reset && seg) this.dir = seg;
    this.layer = layer;
    const Rp = FALLOFF * R, rp = FALLOFF * r;
    const time = Math.min(0.1, Math.max(0, seconds)) * 60;
    const mass = time * (Math.PI * Rp * Rp + 2 * Rp * L) / (1 + L / 16);
    const k = seg ? Math.min(MAX_SUBSTEPS, Math.ceil(L / SUBSTEP)) : 0;
    const dab = mass / (n * Math.PI * rp * rp);
    if (reset || !k) this.push(ax, ay, ax, ay, reset, k ? 0 : dab, max_tip_reach);
    for (let j = 1; j <= k; j++) {
      const t = j / k, s = (j - 1) / k, l = L / k;
      const d = [this.dir[0] * 0.7 + seg![0] * 0.3, this.dir[1] * 0.7 + seg![1] * 0.3];
      const dl = Math.hypot(d[0], d[1]) || 1;
      this.dir = [d[0] / dl, d[1] / dl];
      this.push(ax + dx * t, ay + dy * t, ax + dx * s, ay + dy * s, false, mass / k / (n * (Math.PI * rp * rp + 2 * rp * l)), max_tip_reach);
    }
    this.last = [bx, by];
    this.reach = max_tip_reach;
    this.needsReset = false;
  }

  private push(cx: number, cy: number, pcx: number, pcy: number, reset: boolean, amount: number, reach: number) {
    const { bristleCount: n, bristleRadius: r, deformation: def, depletion } = this.params;
    const margin = reach + 1.5 * r + 2;
    this.pending.push({
      data: new Float32Array([cx, cy, pcx, pcy, ...this.dir, this.spreadRadius(), r, def, amount, depletion, reset ? 1 : 0, n, reach, 0, 0]),
      box: [Math.min(cx, pcx) - margin, Math.min(cy, pcy) - margin, Math.max(cx, pcx) + margin, Math.max(cy, pcy) + margin],
      draw: amount > 0,
      ink: [this.sim.params.waterLoad * this.params.wetness, this.layer, ...this.sim.absorption, this.sim.params.dryness],
    });
  }

  /** Records all pending bristle work, then resolves the ink into `cells` (one compute pass). */
  encode(encoder: GPUCommandEncoder, cells: GPUBuffer = this.sim.buffers[this.sim.current]) {
    if (!this.pending.length) return;
    const groups = Math.ceil(this.params.bristleCount / 64);
    let box = [Infinity, Infinity, -Infinity, -Infinity];
    let ink = this.pending[0].ink, resolves = 0;
    const pass = encoder.beginComputePass({ label: 'Bristle brush' });
    // Moves the ink accumulated so far into `cells` with the settings in `ink`, then starts a new box.
    const flush = () => {
      const ox = Math.floor(Math.max(0, box[0])), oy = Math.floor(Math.max(0, box[1]));
      const ex = Math.ceil(Math.min(GRID_SIZE, box[2])), ey = Math.ceil(Math.min(GRID_SIZE, box[3]));
      box = [Infinity, Infinity, -Infinity, -Infinity];
      if (ex <= ox || ey <= oy) return;
      const index = resolves++;
      const uniform = this.resolveUniforms[index] ??= this.device.createBuffer({ label: 'Bristle resolve', size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      this.device.queue.writeBuffer(uniform, 0, new Float32Array([ox, oy, ...ink]));
      const key = `${this.sim.buffers.indexOf(cells)}:${index}`;
      let group = this.resolveGroups.get(key);
      if (!group) this.resolveGroups.set(key, group = this.device.createBindGroup({ layout: this.resolve.getBindGroupLayout(0), entries: [
        { binding: 0, resource: { buffer: cells } }, { binding: 1, resource: { buffer: this.accum } }, { binding: 2, resource: { buffer: uniform } },
        { binding: 3, resource: { buffer: this.sim.fiberBuffer } },
      ] }));
      pass.setPipeline(this.resolve);
      pass.setBindGroup(0, group);
      pass.dispatchWorkgroups(Math.ceil((ex - ox) / 8), Math.ceil((ey - oy) / 8));
    };
    this.pending.forEach((op, i) => {
      if (op.ink.some((v, k) => v !== ink[k])) { flush(); ink = op.ink; }
      const uniform = this.uniforms[i] ??= this.device.createBuffer({ label: 'Bristle segment', size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      this.device.queue.writeBuffer(uniform, 0, op.data);
      pass.setPipeline(this.update);
      pass.setBindGroup(0, this.updateGroups[i] ??= this.device.createBindGroup({ layout: this.update.getBindGroupLayout(0), entries: [
        { binding: 0, resource: { buffer: this.bristles } }, { binding: 1, resource: { buffer: uniform } },
      ] }));
      pass.dispatchWorkgroups(Math.ceil(op.data[12] / 64));
      if (!op.draw) return;
      pass.setPipeline(this.deposit);
      pass.setBindGroup(0, this.depositGroups[i] ??= this.device.createBindGroup({ layout: this.deposit.getBindGroupLayout(0), entries: [
        { binding: 0, resource: { buffer: this.bristles } }, { binding: 1, resource: { buffer: this.accum } }, { binding: 2, resource: { buffer: uniform } },
      ] }));
      pass.dispatchWorkgroups(groups);
      box[0] = Math.min(box[0], op.box[0]); box[1] = Math.min(box[1], op.box[1]);
      box[2] = Math.max(box[2], op.box[2]); box[3] = Math.max(box[3], op.box[3]);
    });
    flush();
    pass.end();
    this.pending = [];
  }

  clear() { this.pending = []; this.needsReset = true; }

  destroy() {
    for (const buffer of [this.bristles, this.accum, ...this.resolveUniforms, ...this.uniforms]) buffer.destroy();
    this.uniforms = []; this.resolveUniforms = []; this.updateGroups = []; this.depositGroups = []; this.resolveGroups.clear();
  }
}
