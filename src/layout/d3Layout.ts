import type { Pattern, StitchId, Edge, EdgeKind } from '../model';
import type { StitchPlacement, Layout, LayoutEngine, LayoutOptions, LayoutResult } from '../contracts/Layout.ts'
import { emptyLayout, computeBounds, placeNewStitches } from './layoutUtils.ts';
import { STITCH_GEOMETRY } from '../model/stitchCatalog.ts';
import * as d3 from 'd3';

const EDGE_LEN = 50;

interface Node extends d3.SimulationNodeDatum {
    id: StitchId
}

interface Link extends d3.SimulationLinkDatum<Node> {
    kind: EdgeKind;
    distance: number;          // docelowa długość z geometrii oczek
}

function targetDistance(edge: Edge, pattern: Pattern): number {
    switch (edge.kind) {
        case 'previous':
        case 'slip-stitch':
        case 'surrounding':
            return 1;
        case 'insertion':
            const type = pattern.stitches[edge.from].type;
            if (STITCH_GEOMETRY[type] && STITCH_GEOMETRY[type].baseHeight)
                return STITCH_GEOMETRY[type].baseHeight;
            else return 1;
    }
}

function d3Layout(pattern: Pattern, prev?: Layout, maxIter = 300): Layout {
    const start = prev ?? emptyLayout();
    const missing = Object.keys(pattern.stitches).filter((id) => !start.placements[id]);
    // próba uzupełnienia brakujących pozycji oczek dla lepszego ułożenia początkowego,
    // w razie niepowodzenia fallback do oryginalnego layoutu
    const initialResult = placeNewStitches(pattern, start, missing);
    const initial = initialResult.ok ? initialResult.layout : start

    let nodes: Node[] = Object.values(pattern.stitches).map((s) => {
        const start = initial.placements[s.id];
        const x = start?.x ?? 0;
        const y = start?.y ?? 0;
        return s.type === 'mr'
            ? { id: s.id, x, y, fx: x, fy: y }   // przypięty
            : { id: s.id, x, y };
    });

    let links: Link[] = pattern.edges.map((e) => ({
        source: e.from,
        target: e.to,
        kind: e.kind,
        distance: targetDistance(e, pattern) * EDGE_LEN,
    }));

    for (const stitch of Object.values(pattern.stitches)) {
        if(prev) {
            const pl = prev.placements[stitch.id];
            if (pl) {
                nodes.push({x: pl.x, y: pl.y, id: stitch.id});
                continue;
            }
        }
        nodes.push({x: 0, y: 0, id: stitch.id});
    }

    const simulation = d3.forceSimulation<Node>(nodes)
        .force('link', d3.forceLink<Node, Link>(links)
            .id((d) => d.id)
            .strength((l) => (l.kind === 'insertion' ? 1 : 0.5))
            .distance((l) => l.distance))
        .force('charge', d3.forceManyBody<Node>())
        .stop();                          // bez automatycznego uruchamiania

    // const ticks = Math.ceil(
    //     Math.log(simulation.alphaMin()) / Math.log(1 - simulation.alphaDecay()),
    // );                                  // liczba kroków do wygaszenia (domyślnie ok. 300)
    simulation.tick(maxIter);

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

    // wylicz rotation, sw i sh
    return { placements, bounds: computeBounds(placements) };
}

export class D3LayoutEngine implements LayoutEngine {
  id = 'd3';
  name = 'Layout Engine using D3.js library';

  async computeLayout(p: Pattern, options?: LayoutOptions): Promise<LayoutResult> {
    return { ok: true, layout: d3Layout(p, options?.previous), diagnostics: {} };
  }
}