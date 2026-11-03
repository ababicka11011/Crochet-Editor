import { describe, expect, it } from 'vitest';
import type { Pattern } from '../../contracts/Pattern';
import type { Result } from '../Result';
import {
  addSlipStitch,
  addStitch,
  removeLastStitch,
  startNewPattern,
} from './pattern-operations';

/** Unwraps a Result, failing the test with the error message if it is not ok. */
function unwrap<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(`Expected ok result, got error: ${result.error}`);
  return result.value;
}

/** Builds a pattern of `count` chain stitches (stitch-0 .. stitch-(count-1)). */
function chainOf(count: number): Pattern {
  let pattern = startNewPattern('ch');
  for (let i = 1; i < count; i++) {
    pattern = unwrap(addStitch(pattern, 'ch'));
  }
  return pattern;
}

describe('addStitch', () => {
  it('links each new stitch to the previous one with a previous edge pointing old -> new', () => {
    const pattern = chainOf(3);

    expect(pattern.cursor).toBe('stitch-2');
    expect(pattern.stitches['stitch-2'].previous).toBe('stitch-1');
    expect(pattern.edges).toEqual([
      { kind: 'previous', from: 'stitch-1', to: 'stitch-0' },
      { kind: 'previous', from: 'stitch-2', to: 'stitch-1' },
    ]);
  });

  it('creates an insertion edge for every stitch worked into', () => {
    const base = chainOf(3);
    const pattern = unwrap(addStitch(base, 'dc', ['stitch-0', 'stitch-1'], 'both-loops'));

    const insertionEdges = pattern.edges.filter((e) => e.kind === 'insertion');
    expect(insertionEdges).toEqual([
      { kind: 'insertion', from: 'stitch-3', to: 'stitch-0', insertion: 'both-loops' },
      { kind: 'insertion', from: 'stitch-3', to: 'stitch-1', insertion: 'both-loops' },
    ]);
  });

  it('adds multiple stitches to one target stitch', () => {
    const base = chainOf(3);
    const pattern1 = unwrap(addStitch(base, 'sc', 'stitch-1', 'both-loops'));
    const pattern2 = unwrap(addStitch(pattern1, 'sc', 'stitch-1', 'both-loops'));

    expect(pattern2.edges.filter((e) => e.kind === 'insertion').length).toBe(2);
    expect(Object.keys(pattern2.stitches).length).toBe(5);
  });

  it('does not mutate the pattern it was given', () => {
    const base = chainOf(2);
    const edgesBefore = [...base.edges];
    const stitchIdsBefore = Object.keys(base.stitches);

    unwrap(addStitch(base, 'sc', 'stitch-0'));

    expect(base.edges).toEqual(edgesBefore);
    expect(Object.keys(base.stitches)).toEqual(stitchIdsBefore);
  });

  it('rejects inserting into a stitch that does not exist', () => {
    const result = addStitch(chainOf(2), 'sc', 'does-not-exist');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('does-not-exist');
  });

  it('rejects the whole call if any one of several insertion targets does not exist', () => {
    const result = addStitch(chainOf(2), 'sc', ['stitch-0', 'nope']);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('nope');
  });

  it('rejects inserting a chain stitch into another stitch', () => {
    const result = addStitch(chainOf(2), 'ch', 'stitch-0');

    expect(result.ok).toBe(false);
  });
});

describe('removeLastStitch', () => {
  it('removes the most recently added stitch and moves the cursor back', () => {
    const pattern = unwrap(removeLastStitch(chainOf(3)));

    expect(Object.keys(pattern.stitches)).toEqual(['stitch-0', 'stitch-1']);
    expect(pattern.cursor).toBe('stitch-1');
  });

  it('removes the edges that belonged to the removed stitch, and only those', () => {
    const pattern = unwrap(removeLastStitch(chainOf(3)));

    expect(pattern.edges).toEqual([{ kind: 'previous', from: 'stitch-1', to: 'stitch-0' }]);
  });

  it('removes insertion edges of the removed stitch', () => {
    const base = unwrap(addStitch(chainOf(3), 'sc', 'stitch-0', 'both-loops'));
    const pattern = unwrap(removeLastStitch(base));

    expect(pattern.edges.some((e) => e.kind === 'insertion')).toBe(false);
  });

  it('can remove the only stitch, leaving an empty pattern', () => {
    const pattern = unwrap(removeLastStitch(startNewPattern('mr')));

    expect(pattern.stitches).toEqual({});
    expect(pattern.edges).toEqual([]);
    expect(pattern.cursor).toBeNull();
  });

  it('returns an error when there is nothing left to remove', () => {
    const empty = unwrap(removeLastStitch(startNewPattern('ch')));

    expect(removeLastStitch(empty).ok).toBe(false);
  });

  it('does not mutate the pattern it was given', () => {
    const base = chainOf(3);
    const snapshot = JSON.stringify(base);

    unwrap(removeLastStitch(base));

    expect(JSON.stringify(base)).toBe(snapshot);
  });

  // test for removing a slip stitch and its effect on the cursor and edges
  it('removes a slip stitch and moves the cursor back to the stitch it was slipped into', () => {
    const base = chainOf(5);
    const withSlip = unwrap(addSlipStitch(base, 'stitch-1'));
    const pattern = unwrap(removeLastStitch(withSlip));

    expect(pattern.cursor).toBe('stitch-4');
    expect(pattern.edges.some((e) => e.kind === 'slip-stitch')).toBe(false);
  });
});
