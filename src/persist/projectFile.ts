import type { Edge, Layout, Pattern, Result, Stitch } from '../contracts';

const VERSION = '1.1';
const TYPES = ['ch', 'sc', 'hdc', 'dc', 'tr', 'mr'];
const KINDS = ['previous', 'insertion', 'slip-stitch', 'surrounding'];

export type Positions = Record<string, { x: number; y: number }>;
export interface LoadedProject {
  pattern: Pattern;
  positions: Positions | null;
}

export function serializeProject(p: Pattern, layout: Layout, title = 'Bez tytułu'): string {
  const positions: Positions = {};
  for (const id of Object.keys(p.stitches)) {
    const pl = layout.placements[id];
    if (pl) positions[id] = { x: pl.x, y: pl.y };
  }
  return JSON.stringify(
    {
      version: VERSION,
      meta: { title, created: new Date().toISOString() },
      pattern: {
        stitches: Object.values(p.stitches),
        edges: p.edges,
        cursor: p.cursor,
        currentLayer: p.currentLayer,
        nextOrder: p.nextOrder,
      },
      layout: positions,
    },
    null,
    2,
  );
}

/** Nigdy nie rzuca - niepoprawny plik daje komunikat błędu (NFR-R2). */
export function parseProject(text: string): Result<LoadedProject> {
  try {
    const d = JSON.parse(text);
    if (d?.version !== VERSION) return { ok: false, error: 'Nieobsługiwana wersja pliku projektu.' };
    const raw = d.pattern;
    if (!raw || !Array.isArray(raw.stitches) || !Array.isArray(raw.edges)) {
      return { ok: false, error: 'Plik nie zawiera poprawnego wzoru.' };
    }
    const stitches: Record<string, Stitch> = {};
    for (const s of raw.stitches) {
      if (typeof s?.id !== 'string' || !TYPES.includes(s.type) ||
          !Number.isInteger(s.layer) || !Number.isInteger(s.order)) {
        return { ok: false, error: 'Plik zawiera niepoprawny wierzchołek.' };
      }
      stitches[s.id] = { id: s.id, type: s.type, layer: s.layer, order: s.order };
    }
    for (const e of raw.edges as Edge[]) {
      if (!KINDS.includes(e?.kind) || !(e.from in stitches) || !(e.to in stitches)) {
        return { ok: false, error: 'Plik zawiera niepoprawną krawędź.' };
      }
    }
    if (raw.cursor !== null && !(raw.cursor in stitches)) {
      return { ok: false, error: 'Niepoprawny bieżący wierzchołek.' };
    }
    if (!Number.isInteger(raw.currentLayer) || !Number.isInteger(raw.nextOrder)) {
      return { ok: false, error: 'Niepoprawny numer warstwy.' };
    }
    let positions: Positions | null = null;
    if (d.layout && typeof d.layout === 'object') {
      positions = {};
      for (const [id, q] of Object.entries(d.layout as Record<string, { x: unknown; y: unknown }>)) {
        if (typeof q?.x === 'number' && typeof q?.y === 'number' && Number.isFinite(q.x) && Number.isFinite(q.y)) {
          positions[id] = { x: q.x, y: q.y };
        }
      }
    }
    return {
      ok: true,
      value: {
        pattern: { stitches, edges: raw.edges, cursor: raw.cursor, currentLayer: raw.currentLayer, nextOrder: raw.nextOrder },
        positions,
      },
    };
  } catch {
    return { ok: false, error: 'Plik nie jest poprawnym JSON-em.' };
  }
}

export function download(name: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
