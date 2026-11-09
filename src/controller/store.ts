import { atom } from 'jotai';
import type { Layout, Pattern, Result, StartElement, StitchType } from '../contracts';
import { StubLayoutEngine, placeNewStitches, rebuildLayout } from '../layout/initialPlacement';
import { addStitch, createNewPattern, removeLastStitch, startNewLayer } from '../model/pattern';
import { parseProject } from '../persist/projectFile';

interface Snapshot { pattern: Pattern; layout: Layout }
interface History { past: Snapshot[]; present: Snapshot; future: Snapshot[] }

// Podmiana na implementację z modułu algorytmicznego (docelowo w Web Workerze).
const engine = new StubLayoutEngine();

const initialPattern = createNewPattern({ kind: 'chain', count: 5 });
const initial: Snapshot = { pattern: initialPattern, layout: rebuildLayout(initialPattern) };

export const historyAtom = atom<History>({ past: [], present: initial, future: [] });
export const patternAtom = atom((get) => get(historyAtom).present.pattern);
export const layoutAtom = atom((get) => get(historyAtom).present.layout);
export const canUndoAtom = atom((get) => get(historyAtom).past.length > 0);
export const canRedoAtom = atom((get) => get(historyAtom).future.length > 0);

export const selectedTypeAtom = atom<StitchType>('dc');
export const statusAtom = atom<{ kind: 'ok' | 'busy' | 'error'; text: string }>({ kind: 'ok', text: 'Gotowy' });
export const layoutStaleAtom = atom(false);
export const dirtyAtom = atom(false);

const push = (h: History, next: Snapshot): History => ({
  past: [...h.past, h.present], present: next, future: [],
});

export const addStitchAtom = atom(null, (get, set, targetId?: string) => {
  const h = get(historyAtom);
  const r = addStitch(h.present.pattern, get(selectedTypeAtom), targetId);
  if (!r.ok) return void set(statusAtom, { kind: 'error', text: r.error });
  const layout = placeNewStitches(r.value, h.present.layout, [r.value.cursor!]);
  set(historyAtom, push(h, { pattern: r.value, layout }));
  set(layoutStaleAtom, true);
  set(dirtyAtom, true);
  set(statusAtom, { kind: 'ok', text: 'Dodano oczko' });
});

const mutate = (fn: (p: Pattern) => Result<Pattern>) =>
  atom(null, (get, set) => {
    const h = get(historyAtom);
    const r = fn(h.present.pattern);
    if (!r.ok) return void set(statusAtom, { kind: 'error', text: r.error });
    set(historyAtom, push(h, { pattern: r.value, layout: rebuildLayout(r.value) }));
    set(layoutStaleAtom, true);
    set(dirtyAtom, true);
    set(statusAtom, { kind: 'ok', text: 'Gotowy' });
  });

export const removeLastAtom = mutate(removeLastStitch);
export const newLayerAtom = mutate(startNewLayer);

export const startPatternAtom = atom(null, (get, set, start: StartElement) => {
  const pattern = createNewPattern(start);
  set(historyAtom, push(get(historyAtom), { pattern, layout: rebuildLayout(pattern) }));
  set(layoutStaleAtom, false);
  set(dirtyAtom, false);
  set(statusAtom, { kind: 'ok', text: 'Nowy wzór' });
});

export const loadProjectAtom = atom(null, (get, set, text: string) => {
  const r = parseProject(text);
  if (!r.ok) return void set(statusAtom, { kind: 'error', text: r.error });
  set(historyAtom, push(get(historyAtom), { pattern: r.value, layout: rebuildLayout(r.value) }));
  set(dirtyAtom, false);
  set(statusAtom, { kind: 'ok', text: 'Wczytano projekt' });
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

/** Pełne przeliczenie na żądanie (docelowo: Web Worker + identyfikatory żądań). */
export const recomputeLayoutAtom = atom(null, async (get, set) => {
  const h = get(historyAtom);
  set(statusAtom, { kind: 'busy', text: 'Przeliczanie…' });
  const res = await engine.computeLayout(h.present.pattern);
  if (get(historyAtom).present !== h.present) return; // wzór zmieniony w trakcie – wynik nieaktualny
  if (!res.ok) return void set(statusAtom, { kind: 'error', text: res.error });
  set(historyAtom, push(h, { pattern: h.present.pattern, layout: res.layout }));
  set(layoutStaleAtom, false);
  set(statusAtom, { kind: 'ok', text: 'Układ przeliczony' });
});
