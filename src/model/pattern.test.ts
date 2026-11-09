import { describe, expect, it } from 'vitest';
import { addStitch, createNewPattern, removeLastStitch, startNewLayer } from './pattern';

describe('model wzoru', () => {
  const start = () => createNewPattern({ kind: 'chain', count: 3 });

  it('tworzy łańcuszek startowy z kursorem na ostatnim oczku', () => {
    const p = start();
    expect(Object.keys(p.stitches)).toHaveLength(3);
    expect(p.cursor).toBe('s2');
    expect(p.currentLayer).toBe(1);
  });

  it('dodaje słupek wbity w wybrane oczko', () => {
    const r = addStitch(start(), 'dc', 's0');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.cursor).toBe('s3');
      expect(r.value.edges.some((e) => e.kind === 'insertion' && e.from === 's3' && e.to === 's0')).toBe(true);
    }
  });

  it('odrzuca wbicie bez celu lub w nieistniejący element', () => {
    const p = start();
    expect(addStitch(p, 'dc').ok).toBe(false);
    expect(addStitch(p, 'dc', 'nope').ok).toBe(false);
  });

  it('usuwa ostatnie oczko i cofa kursor', () => {
    const r = removeLastStitch(start());
    expect(r.ok && r.value.cursor).toBe('s1');
  });

  it('zmienia warstwę', () => {
    const r = startNewLayer(start());
    expect(r.ok && r.value.currentLayer).toBe(2);
  });

  it('nie mutuje poprzedniej wersji wzoru', () => {
    const p = start();
    addStitch(p, 'sc', 's0');
    expect(Object.keys(p.stitches)).toHaveLength(3);
  });
});
