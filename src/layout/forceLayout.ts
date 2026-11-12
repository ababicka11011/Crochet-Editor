import type {
  Layout, LayoutEngine, LayoutOptions, LayoutResult, Pattern, StitchId, StitchPlacement,
} from '../contracts';

export function computeBounds(pl: Readonly<Record<StitchId, StitchPlacement>>): Layout['bounds'] {
  const all = Object.values(pl);
  if (all.length === 0) return { minX: -50, minY: -50, maxX: 50, maxY: 50 };
  const pad = 30;
  return {
    minX: Math.min(...all.map((p) => p.x)) - pad,
    minY: Math.min(...all.map((p) => p.y)) - pad,
    maxX: Math.max(...all.map((p) => p.x)) + pad,
    maxY: Math.max(...all.map((p) => p.y)) + pad,
  };
}

export const emptyLayout = (): Layout => ({ placements: {}, bounds: computeBounds({}) });

export function withPlacement(layout: Layout, id: StitchId, pos: { x: number; y: number }): Layout {
  const old = layout.placements[id];
  const placements = {
    ...layout.placements,
    [id]: {
      x: pos.x,
      y: pos.y,
      rotation: old?.rotation ?? 0,
      sw: old?.sw ?? 1,
      sh: old?.sh ?? 1,
    },
  };
  return { placements, bounds: computeBounds(placements) };
}

export function layoutFromPositions(
  p: Pattern,
  positions: Record<string, { x: number; y: number }> | null,
): Layout {
  const placements: Record<StitchId, StitchPlacement> = {};
  let missing = false;
  for (const id of Object.keys(p.stitches)) {
    const q = positions?.[id];
    if (q) placements[id] = { x: q.x, y: q.y, rotation: 0, sw: 1, sh: 1 };
    else missing = true;
  }
  const layout = { placements, bounds: computeBounds(placements) };
  return missing ? forceLayout(p, layout) : layout;
}

/** Prosty, deterministyczny układ siłowy: sprężyny na krawędziach + odpychanie wierzchołków. */
export function forceLayout(p: Pattern, prev?: Layout, iterations = 300): Layout {
  const L = 50;
  const REPULSION = 2800;
  const SPRING = 0.08;
  const ordered = Object.values(p.stitches).sort((a, b) => a.order - b.order);
  const nodes = ordered.map((s, i) => {
    const q = prev?.placements[s.id];
    const r = 30 * Math.sqrt(i + 1);
    return {
      id: s.id,
      x: q ? q.x : Math.cos(i * 2.4) * r,
      y: q ? q.y : Math.sin(i * 2.4) * r,
      fx: 0,
      fy: 0,
    };
  });
  const byId = new Map(nodes.map((n) => [n.id, n]));

  for (let it = 0; it < iterations; it++) {
    const t = 1 - it / iterations;
    for (const n of nodes) { n.fx = 0; n.fy = 0; }
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]!;
        const b = nodes[j]!;
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 1) { dx = 1; dy = 0; d2 = 1; }
        const d = Math.sqrt(d2);
        const f = REPULSION / d2;
        a.fx += (dx / d) * f; a.fy += (dy / d) * f;
        b.fx -= (dx / d) * f; b.fy -= (dy / d) * f;
      }
    }
    for (const e of p.edges) {
      const a = byId.get(e.from);
      const b = byId.get(e.to);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 1;
      const f = SPRING * (d - L);
      a.fx += (dx / d) * f; a.fy += (dy / d) * f;
      b.fx -= (dx / d) * f; b.fy -= (dy / d) * f;
    }
    const maxStep = 8 * t + 0.2;
    for (const n of nodes) {
      const m = Math.hypot(n.fx, n.fy) || 1;
      const s = Math.min(m, maxStep) / m;
      n.x += n.fx * s;
      n.y += n.fy * s;
    }
  }

  const cx = nodes.reduce((s, n) => s + n.x, 0) / (nodes.length || 1);
  const cy = nodes.reduce((s, n) => s + n.y, 0) / (nodes.length || 1);
  const placements: Record<StitchId, StitchPlacement> = {};
  for (const n of nodes) placements[n.id] = { x: n.x - cx, y: n.y - cy, rotation: 0, sw: 1, sh: 1 };
  return { placements, bounds: computeBounds(placements) };
}

/** Wbudowany silnik układu. Moduł algorytmiczny podmienia go własną implementacją LayoutEngine. */
export class ForceLayoutEngine implements LayoutEngine {
  async computeLayout(p: Pattern, options?: LayoutOptions): Promise<LayoutResult> {
    return { ok: true, layout: forceLayout(p, options?.previous), diagnostics: {} };
  }
}
