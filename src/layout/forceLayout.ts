import type { Pattern, StitchId } from '../model';
import type { StitchPlacement, Layout, LayoutEngine, LayoutOptions, LayoutResult } from '../contracts/Layout.ts'
import { computeBounds } from './layoutUtils.ts';
import { EDGE_LEN, targetDistance } from './geometry/edgeGeometry.ts';


/**
 * Stress majorization (SMACOF, wersja Gaussa-Seidela): docelowa odległość między wierzchołkami
 * = EDGE_LEN * długość najkrótszej ścieżki w grafie (krawędzie nieskierowane).
 * Iteruje do zbieżności, więc wynik jest układem docelowym; start od `prev` (ręczne pozycje).
 */
export function forceLayout(p: Pattern, prev?: Layout, maxIter = 300): Layout {
  const ordered = Object.values(p.stitches).sort((a, b) => a.order - b.order);
  const n = ordered.length;

  const index = new Map(ordered.map((s, i) => [s.id, i]));
  const adj: { to: number; w: number }[][] = ordered.map(() => []);
  for (const e of p.edges) {
    const a = index.get(e.from);
    const b = index.get(e.to);
    if (a === undefined || b === undefined) continue;
    const w = targetDistance(e, p);          // jednostki modelu, > 0
    adj[a]!.push({ to: b, w });
    adj[b]!.push({ to: a, w });
  }

  // Odległości grafowe (BFS z każdego wierzchołka).
  const D = new Float64Array(n * n);
let maxD = 1;
for (let s = 0; s < n; s++) {
  const dist = new Float64Array(n).fill(Infinity);
  const done = new Uint8Array(n);
  dist[s] = 0;
  for (let k = 0; k < n; k++) {
    let u = -1;
    for (let v = 0; v < n; v++) {
      if (!done[v] && (u < 0 || dist[v]! < dist[u]!)) u = v;
    }
    if (dist[u]! === Infinity) break;     // reszta nieosiągalna
    done[u] = 1;
    for (const { to, w } of adj[u]!) {
      if (dist[u]! + w < dist[to]!) dist[to] = dist[u]! + w;
    }
  }
  for (let t = 0; t < n; t++) {
    D[s * n + t] = dist[t]!;
    if (dist[t]! !== Infinity && dist[t]! > maxD) maxD = dist[t]!;
  }
}
for (let k = 0; k < D.length; k++) if (D[k]! === Infinity) D[k] = maxD + 1; // niespójne części

  const x: number[] = [];
  const y: number[] = [];
  ordered.forEach((s, i) => {
    const q = prev?.placements[s.id];
    const r = 30 * Math.sqrt(i + 1);
    x.push(q ? q.x : Math.cos(i * 2.4) * r);
    y.push(q ? q.y : Math.sin(i * 2.4) * r);
  });

  for (let it = 0; it < maxIter; it++) {
    let maxMove = 0;
    for (let i = 0; i < n; i++) {
      let sx = 0;
      let sy = 0;
      let sw = 0;
      const xi = x[i]!;
      const yi = y[i]!;
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        const d = D[i * n + j]! * EDGE_LEN;
        const w = 1 / (d * d);
        let dx = xi - x[j]!;
        let dy = yi - y[j]!;
        let dist = Math.hypot(dx, dy);
        if (dist < 1e-6) { dx = i < j ? -1 : 1; dy = 0; dist = 1; }
        const k = d / dist;
        sx += w * (x[j]! + dx * k);
        sy += w * (y[j]! + dy * k);
        sw += w;
      }
      if (sw === 0) continue;
      const nx = sx / sw;
      const ny = sy / sw;
      maxMove = Math.max(maxMove, Math.hypot(nx - xi, ny - yi));
      x[i] = nx;
      y[i] = ny;
    }
    if (maxMove < 0.05) break;
  }

  // Bez poprzedniego układu - wyśrodkuj; z poprzednim zostaw, żeby widok się nie przesuwał.
  const cx = prev ? 0 : x.reduce((s, v) => s + v, 0) / n;
  const cy = prev ? 0 : y.reduce((s, v) => s + v, 0) / n;
  const placements: Record<StitchId, StitchPlacement> = {};
  ordered.forEach((s, i) => {
    placements[s.id] = { x: x[i]! - cx, y: y[i]! - cy, rotation: 0, sw: 1, sh: 1 };
  });
  return { placements, bounds: computeBounds(placements) };
}

/** Wbudowany silnik układu. Moduł algorytmiczny podmienia go własną implementacją LayoutEngine. */
export class ForceLayoutEngine implements LayoutEngine {
  id = "smacof";
  name = 'Force Layout Engine';

  async computeLayout(p: Pattern, options?: LayoutOptions): Promise<LayoutResult> {
    return { ok: true, layout: forceLayout(p, options?.previous), diagnostics: {} };
  }
}