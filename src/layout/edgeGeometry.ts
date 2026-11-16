import type { Edge } from '../contracts';

export const NODE_RADIUS = 14;

interface Pt {
  x: number;
  y: number;
}

function shift(from: Pt, toward: Pt, dist: number): Pt {
  const dx = toward.x - from.x;
  const dy = toward.y - from.y;
  const l = Math.hypot(dx, dy) || 1;
  return { x: from.x + (dx / l) * dist, y: from.y + (dy / l) * dist };
}

/** Przesunięcia (px) rozsuwające kilka krawędzi między tą samą parą wierzchołków. */
export function edgeOffsets(edges: readonly Edge[]): number[] {
  const key = (e: Edge) => (e.from < e.to ? `${e.from}|${e.to}` : `${e.to}|${e.from}`);
  const counts = new Map<string, number>();
  for (const e of edges) counts.set(key(e), (counts.get(key(e)) ?? 0) + 1);
  const seen = new Map<string, number>();
  return edges.map((e) => {
    const k = key(e);
    const i = seen.get(k) ?? 0;
    seen.set(k, i + 1);
    const o = (i - ((counts.get(k) ?? 1) - 1) / 2) * 16;
    return e.from < e.to ? o : -o;
  });
}

/** Ścieżka krawędzi skrócona o promienie kółek (+ miejsce na grot) i pozycja etykiety. */
export function edgePath(
  a: Pt,
  b: Pt,
  offset: number,
): { d: string; lx: number; ly: number } | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len <= 2 * NODE_RADIUS + 3) return null; // kółka się stykają
  const c = { x: (a.x + b.x) / 2 - (dy / len) * offset * 2, y: (a.y + b.y) / 2 + (dx / len) * offset * 2 };
  const s = shift(a, c, NODE_RADIUS);
  const e = shift(b, c, NODE_RADIUS + 2);
  return {
    d: `M${s.x.toFixed(1)} ${s.y.toFixed(1)} Q${c.x.toFixed(1)} ${c.y.toFixed(1)} ${e.x.toFixed(1)} ${e.y.toFixed(1)}`,
    lx: 0.25 * s.x + 0.5 * c.x + 0.25 * e.x,
    ly: 0.25 * s.y + 0.5 * c.y + 0.25 * e.y,
  };
}
