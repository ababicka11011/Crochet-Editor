import { describe, expect, it } from 'vitest';
import type { Pattern } from '../contracts';
import { addEdge, addVertex, emptyPattern, removeLastStitch, startNewLayer } from './pattern';

function build(...types: Parameters<typeof addVertex>[1][]): Pattern {
  let p = emptyPattern();
  for (const t of types) {
    const r = addVertex(p, t);
    if (!r.ok) throw new Error(r.error);
    p = r.value;
  }
  return p;
}

describe('model wzoru', () => {
  it('pierwszy wierzchołek musi być ch lub mr', () => {
    expect(addVertex(emptyPattern(), 'dc').ok).toBe(false);
    expect(addVertex(emptyPattern(), 'mr').ok).toBe(true);
  });

  it('nowy wierzchołek dostaje krawędź previous do bieżącego i staje się bieżącym', () => {
    const p = build('ch', 'ch', 'sc');
    expect(p.cursor).toBe('s2');
    expect(p.edges).toEqual([
      { kind: 'previous', from: 's1', to: 's0' },
      { kind: 'previous', from: 's2', to: 's1' },
    ]);
  });

  it('insert nie zmienia bieżącego wierzchołka', () => {
    const r = addEdge(build('ch', 'ch', 'sc'), 'insertion', 's2', 's0');
    expect(r.ok && r.value.cursor).toBe('s2');
    expect(r.ok && r.value.edges.some((e) => e.kind === 'insertion')).toBe(true);
  });

  it('insert: odrzuca ch jako źródło, przyszły cel i duplikat', () => {
    const p = build('ch', 'ch', 'sc');
    expect(addEdge(p, 'insertion', 's1', 's0').ok).toBe(false); // ch
    expect(addEdge(p, 'insertion', 's0', 's2').ok).toBe(false);
    const once = addEdge(p, 'insertion', 's2', 's0');
    if (!once.ok) throw new Error('unexpected');
    expect(addEdge(once.value, 'insertion', 's2', 's0').ok).toBe(false);
  });

  it('slip stitch przenosi bieżący wierzchołek na cel, tylko z bieżącego', () => {
    const p = build('ch', 'ch', 'ch');
    expect(addEdge(p, 'slip-stitch', 's1', 's0').ok).toBe(false);
    const r = addEdge(p, 'slip-stitch', 's2', 's0');
    expect(r.ok && r.value.cursor).toBe('s0');
  });

  it('usuwa najnowszy wierzchołek z krawędziami', () => {
    const r = removeLastStitch(build('ch', 'ch', 'sc'));
    expect(r.ok && r.value.cursor).toBe('s1');
    expect(r.ok && r.value.edges).toHaveLength(1);
  });

  it('zmienia warstwę i nie mutuje poprzedniego wzoru', () => {
    const p = build('ch');
    const r = startNewLayer(p);
    expect(r.ok && r.value.currentLayer).toBe(2);
    expect(p.currentLayer).toBe(1);
  });
});
