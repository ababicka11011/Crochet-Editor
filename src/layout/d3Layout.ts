import type { Pattern, StitchId, EdgeKind } from '../model';
import type { StitchPlacement, LayoutEngine, LayoutOptions, LayoutResult } from '../contracts/Layout.ts'
import { emptyLayout, computeBounds, placeNewStitches, finalizeLayout } from './layoutUtils.ts';
import { EDGE_LEN, targetDistance } from './geometry/edgeGeometry.ts';
import { type SimulationNodeDatum, type SimulationLinkDatum, forceSimulation, forceLink, forceManyBody } from 'd3';
import { firstStitch } from '../model/patternQueries.ts';
import { average, sub } from './geometry/vec.ts';

interface Node extends SimulationNodeDatum {
    id: StitchId
}

interface Link extends SimulationLinkDatum<Node> {
    kind: EdgeKind;
    distance: number;          // docelowa długość z geometrii oczek
}

/** Przesuwa i obraca `next` tak, żeby jak najlepiej pokrywał się z `prev` (na wspólnych oczkach). */
function alignToPrevious(
  next: Record<StitchId, StitchPlacement>,
  prev: Record<StitchId, StitchPlacement>,
): Record<StitchId, StitchPlacement> {
  const ids = Object.keys(next).filter((id) => prev[id]);
  if (ids.length < 2) return next;

  const cp = average(ids.map((id) => prev[id]!));
  const cn = average(ids.map((id) => next[id]!));

  let sin = 0, cos = 0;
  for (const id of ids) {
    const a = sub(prev[id]!, cp);
    const b = sub(next[id]!, cn);
    cos += a.x * b.x + a.y * b.y;
    sin += b.x * a.y - b.y * a.x;
  }
  const theta = Math.atan2(sin, cos);
  const c = Math.cos(theta), s = Math.sin(theta);

  const out: Record<StitchId, StitchPlacement> = {};
  for (const [id, p] of Object.entries(next)) {
    const d = sub(p, cn);
    out[id] = {
      ...p,
      x: cp.x + c * d.x - s * d.y,
      y: cp.y + s * d.x + c * d.y,
      rotation: p.rotation + theta,
    };
  }
  return out;
}

function d3Layout(pattern: Pattern, options?: LayoutOptions): LayoutResult {
    const start = options?.previous ?? emptyLayout();
    const missing = Object.keys(pattern.stitches).filter((id) => !start.placements[id]);
    // próba uzupełnienia brakujących pozycji oczek dla lepszego ułożenia początkowego,
    // w razie niepowodzenia fallback do oryginalnego layoutu
    const initialResult = placeNewStitches(pattern, start, missing);
    const initial = initialResult.ok ? initialResult.layout : start
    const firstId = firstStitch(pattern)?.id;

    let nodes: Node[] = Object.values(pattern.stitches).map((s) => {
        const start = initial.placements[s.id];
        const x = start?.x ?? 0;
        const y = start?.y ?? 0;
        const pinned = s.type === 'mr' || s.id === firstId;
        return pinned
            ? { id: s.id, x, y, fx: x, fy: y }
            : { id: s.id, x, y };
    });

    let links: Link[] = pattern.edges.map((e) => ({
        source: e.from,
        target: e.to,
        kind: e.kind,
        distance: targetDistance(e, pattern) * EDGE_LEN,
    }));

    for (const stitch of Object.values(pattern.stitches)) {
        const pl = initial.placements[stitch.id];
            if (pl) {
                nodes.push({x: pl.x, y: pl.y, id: stitch.id});
                continue;
            }
        nodes.push({x: 0, y: 0, id: stitch.id});
    }

    const simulation = forceSimulation<Node>(nodes)
        .force('link', forceLink<Node, Link>(links)
            .id((d) => d.id)
            .strength((l) => (l.kind === 'insertion' ? 1 : 0.5))
            .distance((l) => l.distance))
        .force('charge', forceManyBody<Node>())
        .stop();                          // bez automatycznego uruchamiania

    // const ticks = Math.ceil(
    //     Math.log(simulation.alphaMin()) / Math.log(1 - simulation.alphaDecay()),
    // );                                  // liczba kroków do wygaszenia (domyślnie ok. 300)
    simulation.tick(options?.maxIter ?? 1000);

    const placements: Record<StitchId, StitchPlacement> = {};
    for (const n of nodes) {
        const old = initial?.placements[n.id];

        placements[n.id] = {
            x: n.x ?? 0,
            y: n.y ?? 0,
            rotation: old?.rotation ?? 0,
            sw: old?.sw ?? 1,
            sh: old?.sh ?? 1,
        };
    }

    const aligned = alignToPrevious(placements, initial.placements);
    // wylicz rotation, sw i sh
    return { ok: true, layout: finalizeLayout(pattern, { placements: aligned, bounds: computeBounds(placements) }) };
}

export class D3LayoutEngine implements LayoutEngine {
  id = 'd3';
  name = 'Layout Engine using D3.js library';

  async computeLayout(p: Pattern, options?: LayoutOptions): Promise<LayoutResult> {

    return d3Layout(p, options);
  }
}