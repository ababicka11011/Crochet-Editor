export type Vec = { x: number; y: number };

export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec, k: number): Vec => ({ x: a.x * k, y: a.y * k });
export const dot = (a: Vec, b: Vec): number => a.x * b.x + a.y * b.y;

export const upFromRotation = (θ: number): Vec => ({ x: Math.sin(θ), y: -Math.cos(θ) });
export const tangentFromRotation = (θ: number): Vec => ({ x: Math.cos(θ), y: Math.sin(θ) });
export const rotationFromUp = (v: Vec): number => Math.atan2(v.x, -v.y);
export const rotationFromDirection = (v: Vec): number => Math.atan2(v.y, v.x);

const length = (v: Vec): number => Math.hypot(v.x, v.y);

export const normalize = (v: Vec): Vec | null => {
  const len = length(v);
  return len < 1e-9 ? null : { x: v.x / len, y: v.y / len };
};