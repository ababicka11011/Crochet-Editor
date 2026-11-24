import type { Pattern, StitchId } from '../model';
import type { StitchPlacement, LayoutEngine, LayoutOptions, LayoutResult } from '../contracts/Layout.ts'
import { emptyLayout, computeBounds, placeNewStitches, finalizeLayout } from './layoutUtils.ts';
import { EDGE_LEN, targetDistance } from './geometry/edgeGeometry.ts';
import { STITCH_GEOMETRY } from '../model/stitchCatalog.ts';
import { Layout as ColaLayout } from 'webcola';

interface ColaNode {
    id: StitchId
    x: number,
    y: number,
    width: number,
    height: number,
    fixed?: number
}

interface ColaLink {
    source: number,
    target: number,
    length: number;          // docelowa długość z geometrii oczek
}

/** (x, y) w WebCoLa to środek węzła, a width i height opisują prostokąt wokół niego. W modelu pozycja to górna krawędź symbolu, 
 * więc w adapterze trzeba przeliczyć na środek przed obliczeniami i z powrotem po. Tak samo długości krawędzi muszą być liczone 
 * między środkami (insertion: hRodzica/2 + hDziecka/2).
 */
function colaLayout(pattern: Pattern, options?: LayoutOptions): LayoutResult {
    const start = options?.previous ?? emptyLayout();
    const missing = Object.keys(pattern.stitches).filter((id) => !start.placements[id]);
    // próba uzupełnienia brakujących pozycji oczek dla lepszego ułożenia początkowego,
    // w razie niepowodzenia fallback do oryginalnego layoutu
    const initialResult = placeNewStitches(pattern, start, missing);
    const initial = initialResult.ok ? initialResult.layout : start
    const ids = Object.keys(pattern.stitches);
    if (ids.length === 0) return { ok: false, error: 'Wzór jest pusty.' };
    const index = new Map(ids.map((id, i) => [id, i]));

    // węzły: pozycja "góra symbolu" -> środek prostokąta
    const nodes: ColaNode[] = ids.map((id) => {
      const s = pattern.stitches[id]!;
      const g = STITCH_GEOMETRY[s.type];
      const pl = initial.placements[id]!;
      return { id, x: pl.x, y: pl.y, width: (g?.baseWidth ?? 1) * 0.6 * EDGE_LEN, height: (g?.baseHeight?? 1) * 0.6 * EDGE_LEN, 
        ...(s.type === 'mr' ? { fixed: 1 } : {}) };
    }); 

    // krawędzie: tylko previous i insertion, długość między środkami
    const links: ColaLink[] = pattern.edges
      .filter((e) => index.has(e.from) && index.has(e.to))
      .map((e) => ({
        source: index.get(e.from)!,
        target: index.get(e.to)!,
        length: targetDistance(e, pattern) * EDGE_LEN,   // wspólna funkcja z layout/geometry
      }));  

    // obliczenia (synchronicznie)
    new ColaLayout()
      .nodes(nodes)
      .links(links)
      .linkDistance((l) => (l as ColaLink).length)
      .avoidOverlaps(true)
      .handleDisconnected(false)
      .convergenceThreshold(1e-3)
      .start(30, 0, 30, 0, false, false);   // bez ograniczeń, z ograniczeniami, z nakładaniem; bez centrowania


    // wyliczenie współrzędnych góry symbolu, nowy Layout
    const placements: Record<StitchId, StitchPlacement> = {};
    for (const n of nodes) {
      const old = start.placements[n.id]!;
      placements[n.id] = { ...old, x: n.x, y: n.y };
    }

    // wyliczenie obrotów i skali sw i sh
    return { ok: true, layout: finalizeLayout(pattern, { placements: placements, bounds: computeBounds(placements) }) };
}

export class ColaLayoutEngine implements LayoutEngine {
  id = 'cola';
  name = 'Layout Engine using WebCoLa library';

  async computeLayout(p: Pattern, options?: LayoutOptions): Promise<LayoutResult> {
    if (Object.keys(p.stitches).length === 0) {
        return { ok: false, error: 'Wzór jest pusty. Dodaj przynajmniej jedno oczko, aby rozmieścić.' };
    }

    return colaLayout(p, options);
  }
}

