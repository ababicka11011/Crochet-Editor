import type {
  Edge, Insertion, Pattern, Result, StartElement, Stitch, StitchId, StitchType,
} from '../contracts';
import { CATALOG } from './stitchCatalog';

const ok = <T,>(value: T): Result<T> => ({ ok: true, value });
const err = <T,>(error: string): Result<T> => ({ ok: false, error });

export function emptyPattern(): Pattern {
  return { stitches: {}, edges: [], cursor: null, currentLayer: 1, nextOrder: 0 };
}

function append(p: Pattern, type: StitchType, targets: StitchId[], insertion: Insertion): Pattern {
  const id = `s${p.nextOrder}`;
  const stitch: Stitch = { id, type, layer: p.currentLayer, order: p.nextOrder };
  const edges: Edge[] = [...p.edges];
  if (p.cursor) edges.push({ kind: 'previous', from: id, to: p.cursor });
  for (const to of targets) edges.push({ kind: 'insertion', from: id, to, insertion });
  return {
    ...p,
    stitches: { ...p.stitches, [id]: stitch },
    edges,
    cursor: id,
    nextOrder: p.nextOrder + 1,
  };
}

export function createNewPattern(start: StartElement): Pattern {
  let p = emptyPattern();
  if (start.kind === 'magic-ring') return append(p, 'mr', [], 'both-loops');
  const n = Math.max(1, Math.floor(start.count));
  for (let i = 0; i < n; i++) p = append(p, 'ch', [], 'both-loops');
  return p;
}

export function validateInsertion(p: Pattern, type: StitchType, target: StitchId): boolean {
  return CATALOG[type].needsInsertion && target in p.stitches;
}

export function addStitch(
  p: Pattern,
  type: StitchType,
  insertInto?: StitchId | StitchId[],
  insertion: Insertion = 'both-loops',
): Result<Pattern> {
  const targets = insertInto === undefined ? [] : Array.isArray(insertInto) ? insertInto : [insertInto];
  if (!CATALOG[type].needsInsertion) return ok(append(p, type, [], insertion));
  if (targets.length === 0) {
    return err(`${CATALOG[type].label}: kliknij element, w który chcesz wbić oczko.`);
  }
  for (const t of targets) {
    if (!validateInsertion(p, type, t)) {
      return err(`Nie można wbić oczka „${CATALOG[type].label}” w wybrany element.`);
    }
  }
  return ok(append(p, type, targets, insertion));
}

export function removeLastStitch(p: Pattern): Result<Pattern> {
  const last = p.cursor;
  if (!last) return err('Wzór jest pusty.');
  const prev = p.edges.find((e) => e.kind === 'previous' && e.from === last)?.to ?? null;
  const { [last]: _removed, ...stitches } = p.stitches;
  return ok({
    ...p,
    stitches,
    edges: p.edges.filter((e) => e.from !== last && e.to !== last),
    cursor: prev,
    currentLayer: prev ? (stitches[prev]?.layer ?? p.currentLayer) : 1,
  });
}

export function changeStitchType(p: Pattern, id: StitchId, type: StitchType): Result<Pattern> {
  const s = p.stitches[id];
  if (!s) return err('Nie znaleziono oczka.');
  const hasInsertion = p.edges.some((e) => e.kind === 'insertion' && e.from === id);
  if (CATALOG[type].needsInsertion && !hasInsertion) {
    return err('To oczko nie jest nigdzie wbite, więc nie może zmienić typu na wbijany.');
  }
  return ok({ ...p, stitches: { ...p.stitches, [id]: { ...s, type } } });
}

export function startNewLayer(p: Pattern): Result<Pattern> {
  if (!p.cursor) return err('Najpierw dodaj oczko.');
  const inLayer = Object.values(p.stitches).some((s) => s.layer === p.currentLayer);
  if (!inLayer) return err('Bieżąca warstwa jest pusta.');
  return ok({ ...p, currentLayer: p.currentLayer + 1 });
}
