import type { Edge, Pattern, Result, Stitch, StitchId, StitchType } from '../contracts';
import { CATALOG } from './stitchCatalog';

function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}
function err<T>(error: string): Result<T> {
  return { ok: false, error };
}

export function emptyPattern(): Pattern {
  return { stitches: {}, edges: [], cursor: null, currentLayer: 1, nextOrder: 0 };
}

/**
 * Dodaje wierzchołek wraz z krawędzią `previous` do bieżącego wierzchołka;
 * nowy wierzchołek staje się bieżącym.
 */
export function addVertex(p: Pattern, type: StitchType): Result<Pattern> {
  if (!p.cursor && type !== 'ch' && type !== 'mr') {
    return err('Wzór zaczyna się od łańcuszka (ch) lub magicznego kółka (mr).');
  }
  const id = `s${p.nextOrder}`;
  const stitch: Stitch = { id, type, layer: p.currentLayer, order: p.nextOrder };
  const edges: Edge[] = [...p.edges];
  if (p.cursor) edges.push({ kind: 'previous', from: id, to: p.cursor });
  return ok({
    ...p,
    stitches: { ...p.stitches, [id]: stitch },
    edges,
    cursor: id,
    nextOrder: p.nextOrder + 1,
  });
}

/**
 * Dodaje krawędź insertion (nie zmienia bieżącego wierzchołka)
 * albo slip-stitch (bieżącym wierzchołkiem zostaje cel krawędzi).
 */
export function addEdge(
  p: Pattern,
  kind: 'insertion' | 'slip-stitch',
  from: StitchId,
  to: StitchId,
): Result<Pattern> {
  const a = p.stitches[from];
  const b = p.stitches[to];
  if (!a || !b) return err('Nie znaleziono wierzchołka.');
  if (from === to) return err('Krawędź musi łączyć dwa różne wierzchołki.');
  if (p.edges.some((e) => e.kind === kind && e.from === from && e.to === to)) {
    return err('Taka krawędź już istnieje.');
  }
  if (kind === 'insertion') {
    if (!CATALOG[a.type].canInsert) {
      return err(`${CATALOG[a.type].label} nie jest wbijany w inne punkty.`);
    }
    if (b.order > a.order) {
      return err('Można wbić tylko w punkt utworzony wcześniej (wzór musi dać się wyszydełkować).');
    }
    return ok({ ...p, edges: [...p.edges, { kind, from, to, insertion: 'both-loops' }] });
  }
  if (from !== p.cursor) {
    return err('Oczko ścisłe zaczyna się w bieżącym wierzchołku (zaznaczony pierścieniem).');
  }
  return ok({ ...p, edges: [...p.edges, { kind, from, to }], cursor: to });
}

/** Usuwa najnowszy wierzchołek razem z jego krawędziami. */
export function removeLastStitch(p: Pattern): Result<Pattern> {
  const all = Object.values(p.stitches);
  const last = all.reduce<Stitch | null>((a, s) => (!a || s.order > a.order ? s : a), null);
  if (!last) return err('Wzór jest pusty.');
  const prev = p.edges.find((e) => e.kind === 'previous' && e.from === last.id)?.to ?? null;
  const stitches = { ...p.stitches };
  delete stitches[last.id];
  const rest = Object.values(stitches);
  const newest = rest.reduce<Stitch | null>((a, s) => (!a || s.order > a.order ? s : a), null);
  let cursor = p.cursor === last.id ? prev : p.cursor;
  if (cursor && !(cursor in stitches)) cursor = null;
  if (!cursor) cursor = newest?.id ?? null;
  return ok({
    ...p,
    stitches,
    edges: p.edges.filter((e) => e.from !== last.id && e.to !== last.id),
    cursor,
    currentLayer: rest.length === 0 ? 1 : p.currentLayer,
  });
}

export function startNewLayer(p: Pattern): Result<Pattern> {
  if (!p.cursor) return err('Najpierw dodaj wierzchołek.');
  const inLayer = Object.values(p.stitches).some((s) => s.layer === p.currentLayer);
  if (!inLayer) return err('Bieżąca warstwa jest pusta.');
  return ok({ ...p, currentLayer: p.currentLayer + 1 });
}
