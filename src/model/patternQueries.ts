import type { StitchId, Stitch, Pattern } from '../model';

export const previousOf = (pattern: Pattern, id: StitchId): StitchId | null =>
  pattern.edges.find(e => e.kind === 'previous' && e.from === id)?.to ?? null;

export const nextOf = (pattern: Pattern, id: StitchId): StitchId | null =>
  pattern.edges.find(e => e.kind === 'previous' && e.to === id)?.from ?? null;

export const parentsOf = (pattern: Pattern, id: StitchId): StitchId[] =>
  pattern.edges
    .filter(edge => edge.kind === 'insertion' && edge.from === id)
    .map(edge => edge.to);

export const siblingsOf = (pattern: Pattern, id: StitchId, parent?: StitchId): StitchId[] => {
    if (!parent) {
        const parents = parentsOf(pattern, id);
        if (parents.length === 0) return [];
        parent = parents[0]; // take the first parent if multiple exist
    }

    return pattern.edges
        .filter(edge => edge.kind === 'insertion' && edge.to === parent && edge.from !== id)
        .map(edge => edge.from);
};

export function firstStitch(pattern: Pattern): Stitch | null {
  let first: Stitch | null = null;
  for (const s of Object.values(pattern.stitches)) {
    if (!first || s.order < first.order) first = s;
  }
  return first;
}
