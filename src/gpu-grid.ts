// Explicit test mode can match the Milestone 1 resolution for benchmarks.
const testParams = new URLSearchParams(globalThis.location?.search ?? '');
export const GRID_SIZE = testParams.has('test') && testParams.get('grid') === '1024' ? 1024 : 512;
export const DEPTH_LAYERS = 8;
export const STATE_BUFFER_BYTES = GRID_SIZE * GRID_SIZE * DEPTH_LAYERS * 48;
export const shaderSource = (code: string) => `const N: u32 = ${GRID_SIZE}u;\nconst LAYERS: u32 = ${DEPTH_LAYERS}u;\n${code}`;
