import { atom } from 'jotai';
import type { Layout, Pattern, Result, StitchType } from '../contracts';
import {
  ForceLayoutEngine, emptyLayout, layoutFromPositions, withPlacement,
} from '../layout/forceLayout';
import { addEdge, addVertex, emptyPattern, removeLastStitch, startNewLayer } from '../model/pattern';
import { parseProject } from '../persist/projectFile';

export type Tool = 'vertex' | 'insertion' | 'slip-stitch';

interface Snapshot { pattern: Pattern; layout: Layout }
interface History { past: Snapshot[]; present: Snapshot; future: Snapshot[] }

// Podmiana na implementację z modułu algorytmicznego (docelowo w Web Workerze).
const engine = new ForceLayoutEngine();

export const historyAtom = atom<History>({
  past: [],
  present: { pattern: emptyPattern(), layout: emptyLayout() },
  future: [],
});
export const patternAtom = atom((get) => get(historyAtom).present.pattern);
export const layoutAtom = atom((get) => get(historyAtom).present.layout);
export const canUndoAtom = atom((get) => get(historyAtom).past.length > 0);
export const canRedoAtom = atom((get) => get(historyAtom).future.length > 0);

export const toolAtom = atom<Tool>('vertex');
export const selectedTypeAtom = atom<StitchType>('ch');
export const statusAtom = atom<{ kind: 'ok' | 'busy' | 'error'; text: string }>({
  kind: 'ok',
  text: 'Kliknij w puste miejsce, aby dodać pierwszy wierzchołek.',
});
export const dirtyAtom = atom(false);

const push = (h: History, next: Snapshot): History => ({
  past: [...h.past, h.present], present: next, future: [],
});

export const addVertexAtom = atom(null, (get, set, pos: { x: number; y: number }) => {
  const h = get(historyAtom);
  const r = addVertex(h.present.pattern, get(selectedTypeAtom));
  if (!r.ok) return void set(statusAtom, { kind: 'error', text: r.error });
  const id = r.value.cursor;
  if (!id) return;
  const layout = withPlacement(h.present.layout, id, pos);
  set(historyAtom, push(h, { pattern: r.value, layout }));
  set(dirtyAtom, true);
  set(statusAtom, { kind: 'ok', text: 'Dodano wierzchołek i krawędź previous.' });
});

export const addEdgeAtom = atom(null, (get, set, a: { from: string; to: string }) => {
  const tool = get(toolAtom);
  if (tool === 'vertex') return;
  const h = get(historyAtom);
  const r = addEdge(h.present.pattern, tool, a.from, a.to);
  if (!r.ok) return void set(statusAtom, { kind: 'error', text: r.error });
  set(historyAtom, push(h, { pattern: r.value, layout: h.present.layout }));
  set(dirtyAtom, true);
  set(statusAtom, {
    kind: 'ok',
    text: tool === 'slip-stitch' ? 'Slip stitch – bieżący wierzchołek zmieniony.' : 'Dodano krawędź insert.',
  });
});

// Przeciąganie wierzchołka: jedna pozycja w historii na cały gest.
let dragBase: Snapshot | null = null;

export const moveNodeAtom = atom(null, (get, set, a: { id: string; x: number; y: number }) => {
  const h = get(historyAtom);
  if (!dragBase) dragBase = h.present;
  set(historyAtom, {
    ...h,
    present: { ...h.present, layout: withPlacement(h.present.layout, a.id, a) },
  });
});

export const endMoveAtom = atom(null, (get, set) => {
  if (!dragBase) return;
  const base = dragBase;
  dragBase = null;
  const h = get(historyAtom);
  set(historyAtom, { past: [...h.past, base], present: h.present, future: [] });
  set(dirtyAtom, true);
});

const mutate = (fn: (p: Pattern) => Result<Pattern>) =>
  atom(null, (get, set) => {
    const h = get(historyAtom);
    const r = fn(h.present.pattern);
    if (!r.ok) return void set(statusAtom, { kind: 'error', text: r.error });
    set(historyAtom, push(h, { pattern: r.value, layout: h.present.layout }));
    set(dirtyAtom, true);
    set(statusAtom, { kind: 'ok', text: 'Gotowe.' });
  });

export const removeLastAtom = mutate(removeLastStitch);
export const newLayerAtom = mutate(startNewLayer);

export const newPatternAtom = atom(null, (get, set) => {
  set(historyAtom, push(get(historyAtom), { pattern: emptyPattern(), layout: emptyLayout() }));
  set(dirtyAtom, false);
  set(statusAtom, { kind: 'ok', text: 'Nowy wzór.' });
});

export const loadProjectAtom = atom(null, (get, set, text: string) => {
  const r = parseProject(text);
  if (!r.ok) return void set(statusAtom, { kind: 'error', text: r.error });
  const { pattern, positions } = r.value;
  set(historyAtom, push(get(historyAtom), { pattern, layout: layoutFromPositions(pattern, positions) }));
  set(dirtyAtom, false);
  set(statusAtom, { kind: 'ok', text: 'Wczytano projekt.' });
});

export const undoAtom = atom(null, (get, set) => {
  const h = get(historyAtom);
  const prev = h.past[h.past.length - 1];
  if (!prev) return;
  set(historyAtom, { past: h.past.slice(0, -1), present: prev, future: [h.present, ...h.future] });
  set(dirtyAtom, true);
});

export const redoAtom = atom(null, (get, set) => {
  const h = get(historyAtom);
  const next = h.future[0];
  if (!next) return;
  set(historyAtom, { past: [...h.past, h.present], present: next, future: h.future.slice(1) });
  set(dirtyAtom, true);
});

/** Automatyczne rozmieszczenie na żądanie (docelowo: Web Worker + identyfikatory żądań). */
export const recomputeLayoutAtom = atom(null, async (get, set) => {
  const h = get(historyAtom);
  set(statusAtom, { kind: 'busy', text: 'Rozmieszczanie…' });
  const res = await engine.computeLayout(h.present.pattern, { previous: h.present.layout });
  if (get(historyAtom).present !== h.present) {
    return void set(statusAtom, { kind: 'ok', text: 'Wzór zmieniono w trakcie – wynik odrzucono.' });
  }
  if (!res.ok) return void set(statusAtom, { kind: 'error', text: res.error });
  set(historyAtom, push(h, { pattern: h.present.pattern, layout: res.layout }));
  set(dirtyAtom, true);
  set(statusAtom, { kind: 'ok', text: 'Układ przeliczony.' });
});
