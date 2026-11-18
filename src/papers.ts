// Paper presets. supports the following file names (not case sensitive)
//   *NORM* light normals
//   *DISP* height map, translated to paper fiber map
//   *DIFF* paper color
import { GRID_SIZE } from './gpu-grid';

const files = import.meta.glob<string>('../paper/*/*.{png,jpg,jpeg,webp}', {
  query: '?url', import: 'default', eager: true,
});

type Role = 'albedo' | 'height' | 'normal';
const ROLES: [Role, RegExp][] = [
  ['normal', /norm/i],
  ['height', /disp/i],
  ['albedo', /diff/i],
];

const sources = new Map<string, Partial<Record<Role, string>>>();
for (const [path, url] of Object.entries(files)) {
  const match = path.match(/paper\/([^/]+)\/([^/]+)$/);
  const role = match && ROLES.find(([, pattern]) => pattern.test(match[2]))?.[0];
  if (!match || !role) continue;
  if (!sources.has(match[1])) sources.set(match[1], {});
  sources.get(match[1])![role] = url;
}

export const DEFAULT_PAPER = 'default-paper';
export const PAPER_NAMES = [DEFAULT_PAPER, ...[...sources.keys()].sort()];

// Display textures stay 1024² for sharpness; the fibre map matches the simulation grid.
const SIZE = 1024;
const DEFAULT_ALBEDO = [246, 242, 231, 255];
const FLAT_NORMAL = [128, 128, 255, 255];
const TEXTURED_RELIEF = 1.0;

export interface Paper {
  name: string;
  albedo: GPUTexture;
  normal: GPUTexture;
  fiber?: Float32Array<ArrayBuffer>;
  relief: number;
}

function solidTexture(device: GPUDevice, rgba: number[], label: string): GPUTexture {
  const texture = device.createTexture({
    label, size: [1, 1], format: 'rgba8unorm',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });
  device.queue.writeTexture({ texture }, new Uint8Array(rgba), {}, [1, 1]);
  return texture;
}

async function loadBitmap(url: string): Promise<ImageBitmap> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load ${url} (${response.status})`);
  return createImageBitmap(await response.blob(), {
    colorSpaceConversion: 'none', premultiplyAlpha: 'none',
    resizeWidth: SIZE, resizeHeight: SIZE, resizeQuality: 'high',
  });
}

function bitmapTexture(device: GPUDevice, bitmap: ImageBitmap, label: string): GPUTexture {
  const texture = device.createTexture({
    label, size: [bitmap.width, bitmap.height], format: 'rgba8unorm',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
  });
  device.queue.copyExternalImageToTexture({ source: bitmap }, { texture }, [bitmap.width, bitmap.height]);
  return texture;
}

// more height, higher fiber density
function heightToFiber(bitmap: ImageBitmap): Float32Array<ArrayBuffer> {
  const context = new OffscreenCanvas(GRID_SIZE, GRID_SIZE).getContext('2d', { willReadFrequently: true })!;
  context.drawImage(bitmap, 0, 0, GRID_SIZE, GRID_SIZE);
  const pixels = context.getImageData(0, 0, GRID_SIZE, GRID_SIZE).data;
  const count = GRID_SIZE * GRID_SIZE;
  const histogram = new Uint32Array(256);
  for (let i = 0; i < count; i++) histogram[pixels[i * 4]]++;
  const percentile = (q: number) => {
    let total = 0;
    for (let v = 0; v < 256; v++) if ((total += histogram[v]) >= q * count) return v;
    return 255;
  };
  const low = percentile(0.02);
  const high = Math.max(low + 1, percentile(0.98));
  const map = new Float32Array(new ArrayBuffer(count * 4));
  for (let i = 0; i < count; i++) {
    map[i] = Math.min(1, Math.max(0, (pixels[i * 4] - low) / (high - low)));
  }
  return map;
}

const cache = new Map<string, Promise<Paper>>();

async function build(device: GPUDevice, name: string): Promise<Paper> {
  if (name === DEFAULT_PAPER) {
    return {
      name, relief: 0,
      albedo: solidTexture(device, DEFAULT_ALBEDO, 'default-paper albedo'),
      normal: solidTexture(device, FLAT_NORMAL, 'default-paper normal'),
    };
  }
  const source = sources.get(name);
  if (!source) throw new Error(`Unknown paper "${name}"`);
  const [albedo, height, normal] = await Promise.all(
    (['albedo', 'height', 'normal'] as const).map(role => source[role] ? loadBitmap(source[role]) : undefined));
  const paper: Paper = {
    name,
    albedo: albedo ? bitmapTexture(device, albedo, `${name} albedo`) : solidTexture(device, DEFAULT_ALBEDO, `${name} albedo`),
    normal: normal ? bitmapTexture(device, normal, `${name} normal`) : solidTexture(device, FLAT_NORMAL, `${name} normal`),
    fiber: height ? heightToFiber(height) : undefined,
    relief: normal ? TEXTURED_RELIEF : 0,
  };
  for (const bitmap of [albedo, height, normal]) bitmap?.close();
  return paper;
}

export function loadPaper(device: GPUDevice, name: string): Promise<Paper> {
  let paper = cache.get(name);
  if (!paper) {
    paper = build(device, name);
    cache.set(name, paper);
    paper.catch(() => cache.delete(name));
  }
  return paper;
}
