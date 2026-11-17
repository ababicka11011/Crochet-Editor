import { describe, expect, it } from 'vitest';
import type { Layout, StitchPlacement } from '../contracts/Layout';
import type { Edge, Pattern, Stitch, StitchType } from '../model';
import { overlapMetrics } from './metrics';

const place = (x: number, y: number, rotation = 0): StitchPlacement => ({ x, y, rotation, sw: 1, sh: 1 });

function make(
  items: { id: string; type: StitchType; pl: StitchPlacement }[],
  edges: Edge[] = [],
): { pattern: Pattern; layout: Layout } {
  const stitches: Record<string, Stitch> = {};
  const placements: Record<string, StitchPlacement> = {};
  items.forEach((it, order) => {
    stitches[it.id] = { id: it.id, type: it.type, layer: 1, order };
    placements[it.id] = it.pl;
  });
  return {
    pattern: { stitches, edges, cursor: null, currentLayer: 1, nextOrder: items.length },
    layout: { placements, bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 } },
  };
}

describe('overlapMetrics', () => {
  it('sąsiednie oczka w odstępie jednej szerokości nie kolidują', () => {
    const { pattern, layout } = make([
      { id: 'a', type: 'dc', pl: place(0, 0) },
      { id: 'b', type: 'dc', pl: place(1, 0) },
    ]);
    expect(overlapMetrics(pattern, layout).collisionCount).toBe(0);
  });

  it('niewielki obrót sąsiada nie powoduje kolizji', () => {
    const { pattern, layout } = make([
      { id: 'a', type: 'dc', pl: place(0, 0) },
      { id: 'b', type: 'dc', pl: place(1, 0, (10 * Math.PI) / 180) },
    ]);
    expect(overlapMetrics(pattern, layout).collisionCount).toBe(0);
  });

  it('symbole w tym samym miejscu kolidują', () => {
    const { pattern, layout } = make([
      { id: 'a', type: 'sc', pl: place(0, 0) },
      { id: 'b', type: 'sc', pl: place(0.1, 0) },
    ]);
    const m = overlapMetrics(pattern, layout);
    expect(m.collisionCount).toBe(1);
    expect(m.overlapRatio).toBe(1);
    expect(m.collidingIds.sort()).toEqual(['a', 'b']);
  });

  it('nachodzenie poniżej tolerancji nie jest kolizją', () => {
    // obrys sc ma szerokość 0.6; odstęp 0.59 daje nachodzenie ok. 1.7% szerokości
    const { pattern, layout } = make([
      { id: 'a', type: 'sc', pl: place(0, 0) },
      { id: 'b', type: 'sc', pl: place(0.59, 0) },
    ]);
    expect(overlapMetrics(pattern, layout).collisionCount).toBe(0);
  });

  it('pomija parę oczko - punkt wbicia', () => {
    const { pattern, layout } = make(
      [
        { id: 'a', type: 'dc', pl: place(0, 0) },
        { id: 'b', type: 'dc', pl: place(0, -0.5) },
      ],
      [{ kind: 'insertion', from: 'b', to: 'a', insertion: 'both-loops' }],
    );
    expect(overlapMetrics(pattern, layout).collisionCount).toBe(0);
  });

  it('pomija oczka bez geometrii (magiczne kółko)', () => {
    const { pattern, layout } = make([
      { id: 'm', type: 'mr', pl: place(0, 0) },
      { id: 'a', type: 'sc', pl: place(0, 0) },
    ]);
    expect(overlapMetrics(pattern, layout).collisionCount).toBe(0);
  });

  it('pusty wzór daje zera', () => {
    const { pattern, layout } = make([]);
    expect(overlapMetrics(pattern, layout)).toEqual({
      overlapRatio: 0, collisionCount: 0, meanOverlapDepth: 0, collidingIds: [],
    });
  });
});
