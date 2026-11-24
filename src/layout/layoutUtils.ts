import type { Layout, LayoutResult, StitchPlacement } from '../contracts/Layout';
import type { StitchId, Stitch, Pattern } from '../model';
import { previousOf, parentsOf, siblingsOf } from '../model/patternQueries';
import { add, normalize, rotationFromDirection, rotationFromUp, scale, sub, upFromRotation, type Vec } from './geometry/Vec';
import { type StitchGeometry, STITCH_GEOMETRY } from '../model/stitchCatalog';
import { tangentFromRotation, dot, vecLength } from './geometry/Vec';
import { EDGE_LEN } from './geometry/edgeGeometry';
import { forceLayout } from './forceLayout';

function directionFromLastTwo(pattern: Pattern, layout: Layout): Vec | null {
  const lastId = pattern.cursor;
  if (!lastId) return null;
  const beforeLastId = previousOf(pattern, lastId);
  if (!beforeLastId) return null;

  const last = layout.placements[lastId];
  const beforeLast = layout.placements[beforeLastId];
  if (!last || !beforeLast) return null;

  return normalize(sub(last, beforeLast));
}

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

export function placeNewStitches(pattern: Pattern, layout: Layout, newIds: StitchId[]): LayoutResult {
  const newLayout: Layout = { ...layout };

  // Add new placements for the new stitches
  newIds.forEach((id) => {
    // add handling case where more than one parent
    const type = pattern.stitches[id]?.type;
    const stitchGeometry = STITCH_GEOMETRY[type];

    if (!stitchGeometry) {
      return { ok: false, error: `No geometry for stitch type: ${type}` };
    }

    switch (type) {
      case 'ch':
        var d: Vec | null = directionFromLastTwo(pattern, newLayout);
        if (!d) {
          // If we can't determine a direction, just place it next to the last stitch
          d = { x: 1, y: 0 }; // default direction to the right
        }
        const previousNodePlacement = layout.placements[previousOf(pattern, id)!];
        const prevPos: Vec = {x: previousNodePlacement.x ?? 0, y: previousNodePlacement.y ?? 0};

        const newPos_ch = add(prevPos, scale(d, stitchGeometry.baseWidth * EDGE_LEN));
        // Place the new chain stitch in the direction of the last two stitches
        newLayout.placements[id] = { x: newPos_ch.x, y: newPos_ch.y, rotation: rotationFromDirection(d), sh: 1, sw: 1 }; // Default placement for chain stitch
        break;
      case 'sc':
      case 'hdc':
      case 'dc':
      case 'tr':
        // For these stitch types, we can position them based on their parent stitch's placement and geometry
        const parents = parentsOf(pattern, id);

        var parentPos: Vec, parentRotation: number;

        if (parents.length <= 0) {
          // no parent node found, return an error
          return { ok: false, error: `No parent node found for stitch ${id}` };
        } else if (parents.length === 1) {
          // exactly one parent node found
          const parentPlacement = newLayout.placements[parents[0]];
          parentPos = { x: parentPlacement.x, y: parentPlacement.y };
          parentRotation = parentPlacement.rotation;
        } else {
          // more than one parent node found, get the median position and rotation of the parents
          const parentPlacements = parents
            .map(id => newLayout.placements[id])
            .filter((p): p is StitchPlacement => p !== undefined);

          parentPos = average(parentPlacements)

          const upSum = parentPlacements.reduce( (sum, p) => add(sum, upFromRotation(p.rotation)), { x: 0, y: 0 }, );
          const meanUp = normalize(upSum);
          parentRotation = meanUp ? rotationFromUp(meanUp) : parentPlacements[0].rotation;
        }

        var n: Vec = upFromRotation(parentRotation);

        // const stitchGeometry = stitchGeometryMap[type];
        const newPos = add(parentPos, scale(n, stitchGeometry.baseHeight));

        // if several stitches are sharing the same parent, adjust the position of the new stitch accordingly
        const siblings = siblingsOf(pattern, id, parents[0]);

        if (siblings.length > 0) {
          const siblingPlacements = siblings
            .map(id => newLayout.placements[id])
            .filter((p): p is StitchPlacement => p !== undefined);
                    
          const direction_sign = Math.sign(directionFromLastTwo(pattern, newLayout)?.x ?? 1);
          if (direction_sign > 0) {
            newPos.x = siblingPlacements.reduce((maxx, p) => { maxx = Math.max(maxx, p.x); return maxx; }, newPos.x) + 0.15 * EDGE_LEN;
          } else {
            newPos.x = siblingPlacements.reduce((minx, p) => { minx = Math.min(minx, p.x); return minx; }, newPos.x) - 0.15 * EDGE_LEN;
          }
        }
        newLayout.placements[id] = { x: newPos.x, y: newPos.y, rotation: parentRotation, sh: 1, sw: 1 };
        break;
      default:
        return { ok: false, error: `No geometry for stitch type: ${type}` };
    }
  });

  return { ok: true, layout: newLayout };
}

export function pruneLayout(pattern: Pattern, layout: Layout): LayoutResult {
  const newLayout: Layout = { ...layout };

  // Remove placements for stitches that no longer exist in the pattern
  for (const id in newLayout.placements) {
    if (!pattern.stitches[id]) {
      delete newLayout.placements[id];
    }
  }
  return { ok: true, layout: newLayout };
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

/** Indeksy grafu budowane raz dla całego wzoru. */
function buildIndex(pattern: Pattern) {
  const parents = new Map<StitchId, StitchId[]>();
  const children = new Map<StitchId, StitchId[]>();
  const prev = new Map<StitchId, StitchId>();
  const next = new Map<StitchId, StitchId>();
  const push = (m: Map<StitchId, StitchId[]>, k: StitchId, v: StitchId) => {
    const list = m.get(k);
    if (list) list.push(v); else m.set(k, [v]);
  };
  for (const e of pattern.edges) {
    if (e.kind === 'insertion') {
      push(parents, e.from, e.to);
      push(children, e.to, e.from);
    } else if (e.kind === 'previous') {
      prev.set(e.from, e.to);   // krawędź od nowszego do starszego
      next.set(e.to, e.from);
    }
  }
  return { parents, children, prev, next };
}

const mean = (a: number[]) =>
  a.length === 0 ? 0 : a.reduce((sum, e) => sum + e, 0) / a.length;

function average(points: Vec[]): Vec {
  const sum = points.reduce((s, p) => ({ x: s.x + p.x, y: s.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
}

export interface FinalizeContext {
  pattern: Pattern;
  idx: ReturnType<typeof buildIndex>;
  placements: Record<StitchId, StitchPlacement>;
}

export function createContext(pattern: Pattern, layout: Layout): FinalizeContext {
  return { pattern, idx: buildIndex(pattern), placements: layout.placements };
}

function positionsOf(ids: StitchId[] | undefined, ctx: FinalizeContext): Vec[] {
  return (ids ?? [])
    .map((id) => ctx.placements[id])
    .filter((p): p is StitchPlacement => p !== undefined);
}

export function computeRotation(
  s: Stitch, ctx: FinalizeContext, rotations: ReadonlyMap<StitchId, number>,
): number {
  const pl = ctx.placements[s.id];
  if (s.type === 'mr' || s.type === 'hole') return 0;

  const parents = positionsOf(ctx.idx.parents.get(s.id), ctx);
  if (parents.length > 0) return rotationFromParents(pl, parents) ?? pl.rotation;
  if (s.type === 'ch') return chainRotation(s, ctx, rotations);
  return pl.rotation;
}

function rotationFromParents(pos: Vec, parents: Vec[]): number | null {
  const v = normalize(sub(pos, average(parents)));
  return v ? rotationFromUp(v) : null;
}

function chainRotation(s: Stitch, ctx: FinalizeContext, rotations: ReadonlyMap<StitchId, number>,): number {
  const pl = ctx.placements[s.id];
  const prevId = ctx.idx.prev.get(s.id);
  const a = (prevId && ctx.placements[prevId]) || pl;
  const nextId = ctx.idx.next.get(s.id);
  const b = (nextId && ctx.placements[nextId]) || pl;
  const d = normalize(sub(b, a));
  const rot = d ? rotationFromDirection(d) : pl.rotation;

  // wybór zwrotu: do oczek wbitych albo zgodnie z poprzednim łańcuszkiem
  const children = positionsOf(ctx.idx.children.get(s.id), ctx);
  const reference = children.length > 0
    ? sub(average(children), pl)
    : prevId !== undefined && rotations.has(prevId)
      ? upFromRotation(rotations.get(prevId)!)
      : null;
  return reference && dot(upFromRotation(rot), reference) < 0 ? rot + Math.PI : rot;
}

export function computeScale(
  s: Stitch, rotation: number, ctx: FinalizeContext,
): { sw: number; sh: number } {
  const g = STITCH_GEOMETRY[s.type];
  if (!g) return { sw: 1, sh: 1 };
  const sh = heightScale(s, g, ctx);
  const sw = widthScale(s, g, rotation, ctx);
  return { sw, sh };
}

function widthScale(s: Stitch, g: StitchGeometry, rotation: number, ctx: FinalizeContext): number {
  if (g.baseWidth <= 0) return 1;
  const pl = ctx.placements[s.id];
  const t = tangentFromRotation(rotation);
  const sameLayer = [ctx.idx.prev.get(s.id), ctx.idx.next.get(s.id)]
    .filter((id): id is StitchId =>
      id !== undefined && ctx.pattern.stitches[id]?.layer === s.layer);
  const gaps = positionsOf(sameLayer, ctx).map((p) => Math.abs(dot(sub(p, pl), t)));
  return gaps.length > 0 ? mean(gaps) / (g.baseWidth * EDGE_LEN) : 1;
}

function heightScale(s: Stitch, g: StitchGeometry, ctx: FinalizeContext): number {
  if (g.baseHeight <= 0) return 1;
  const parents = positionsOf(ctx.idx.parents.get(s.id), ctx);
  if (parents.length === 0) return 1;
  const dist = vecLength(sub(ctx.placements[s.id], average(parents)));
  return dist / (g.baseHeight * EDGE_LEN);
}

export function finalizeLayout(pattern: Pattern, layout: Layout): Layout {
  const ctx = createContext(pattern, layout);
  const ordered = Object.values(pattern.stitches)
    .filter((s) => layout.placements[s.id] !== undefined)
    .sort((a, b) => a.order - b.order);

  const rotations = new Map<StitchId, number>();
  for (const s of ordered) rotations.set(s.id, computeRotation(s, ctx, rotations));

  const placements: Record<StitchId, StitchPlacement> = {};
  for (const s of ordered) {
    const pl = layout.placements[s.id];
    const rotation = rotations.get(s.id)!;
    placements[s.id] = { x: pl.x, y: pl.y, rotation, ...computeScale(s, rotation, ctx) };
  }
  return { placements, bounds: layout.bounds };
}