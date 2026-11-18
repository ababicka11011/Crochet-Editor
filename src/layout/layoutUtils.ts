import type { Layout, LayoutResult, StitchPlacement } from '../contracts/Layout';
import type { Pattern } from '../model';
import type { StitchId } from '../model';
import { previousOf, parentsOf, siblingsOf } from '../model/patternQueries';
import { add, normalize, rotationFromDirection, rotationFromUp, scale, sub, upFromRotation, type Vec } from './geometry/Vec';
import { STITCH_GEOMETRY } from '../model/stitchCatalog';

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

                const newPos_ch = add(prevPos, scale(d, stitchGeometry.baseHeight));
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

                    const count = parentPlacements.length;
                    parentPos = {
                        x: parentPlacements.reduce((sum, p) => sum + p.x, 0) / count,
                        y: parentPlacements.reduce((sum, p) => sum + p.y, 0) / count,
                    };

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
                        newPos.x = siblingPlacements.reduce((maxx, p) => { maxx = Math.max(maxx, p.x); return maxx; }, newPos.x) + 0.1;
                    } else {
                        newPos.x = siblingPlacements.reduce((minx, p) => { minx = Math.min(minx, p.x); return minx; }, newPos.x) - 0.1;
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