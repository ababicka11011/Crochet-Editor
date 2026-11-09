import type { Layout, LayoutEngine, LayoutResult, Pattern, StitchId, StitchPlacement } from '../contracts';
import { CATALOG } from '../model/stitchCatalog';

const GAP = 2;
const CHAIN_STEP = 12;
const FAN = 0.5; // rad między sąsiadami w wachlarzu

export function computeBounds(pl: Record<StitchId, StitchPlacement>): Layout['bounds'] {
  const xs = Object.values(pl);
  if (xs.length === 0) return { minX: -50, minY: -50, maxX: 50, maxY: 50 };
  const pad = 14;
  return {
    minX: Math.min(...xs.map((p) => p.x)) - pad,
    minY: Math.min(...xs.map((p) => p.y)) - pad,
    maxX: Math.max(...xs.map((p) => p.x)) + pad,
    maxY: Math.max(...xs.map((p) => p.y)) + pad,
  };
}

/**
 * Wstępne, synchroniczne położenie nowych oczek – nie rusza pozostałych symboli (Stage 2, pkt 3).
 * Oczko wbite: nad celem, w wachlarzu (0, +θ, -θ, +2θ ...). Oczko niewbite: obok poprzedniego.
 */
export function placeNewStitches(p: Pattern, prev: Layout, newIds: StitchId[]): Layout {
  const pl: Record<StitchId, StitchPlacement> = { ...prev.placements };
  for (const id of newIds) {
    const s = p.stitches[id];
    if (!s) continue;
    const info = CATALOG[s.type];
    const target = p.edges.find((e) => e.kind === 'insertion' && e.from === id)?.to;
    const before = p.edges.find((e) => e.kind === 'previous' && e.from === id)?.to;
    let place: StitchPlacement = { x: 0, y: 0, rotation: 0, sw: 1, sh: 1 };
    const parent = target ? pl[target] : undefined;
    const parentStitch = target ? p.stitches[target] : undefined;
    if (parent && parentStitch) {
      const k = p.edges.filter((e) => e.kind === 'insertion' && e.to === target && e.from !== id && pl[e.from]).length;
      const theta = (k === 0 ? 0 : (k % 2 === 1 ? 1 : -1) * Math.ceil(k / 2)) * FAN;
      const rot = parent.rotation + theta;
      const dist = CATALOG[parentStitch.type].baseHeight / 2 + info.baseHeight / 2 + GAP;
      place = { x: parent.x + Math.sin(rot) * dist, y: parent.y - Math.cos(rot) * dist, rotation: rot, sw: 1, sh: 1 };
    } else if (before && pl[before]) {
      const b = pl[before]!;
      place = { x: b.x + CHAIN_STEP, y: b.y, rotation: 0, sw: 1, sh: 1 };
    }
    pl[id] = place;
  }
  return { placements: pl, bounds: computeBounds(pl) };
}

export const emptyLayout = (): Layout => ({ placements: {}, bounds: computeBounds({}) });

/** Układ „od zera": kolejne oczka po kolei (deterministyczny). */
export function rebuildLayout(p: Pattern): Layout {
  const ids = Object.values(p.stitches).sort((a, b) => a.order - b.order).map((s) => s.id);
  return placeNewStitches(p, emptyLayout(), ids);
}

/**
 * ZASTĘPCZY silnik – tu podłącza się moduł algorytmiczny (d3-force / WebCola przez adapter).
 * Ten sam kontrakt (LayoutEngine), więc kontroler i UI nie wymagają zmian.
 */
export class StubLayoutEngine implements LayoutEngine {
  async computeLayout(p: Pattern): Promise<LayoutResult> {
    return { ok: true, layout: rebuildLayout(p), diagnostics: {} };
  }
}
