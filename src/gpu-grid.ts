export const GRID_SIZE = 512;
export const DEPTH_LAYERS = 8;
export const shaderSource = (code: string) => `const N: u32 = ${GRID_SIZE}u;\nconst LAYERS: u32 = ${DEPTH_LAYERS}u;\n${code}`;
