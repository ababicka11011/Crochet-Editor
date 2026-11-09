import type { Edge, Pattern, Result, Stitch } from '../contracts';

const VERSION = '1.0';
const TYPES = ['ch', 'slst', 'sc', 'hdc', 'dc', 'tr', 'mr'];
const KINDS = ['previous', 'insertion', 'slip-stitch', 'surrounding'];

export function serializeProject(p: Pattern, title = 'Bez tytułu'): string {
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
    },
    null,
    2,
  );
}

/** Nigdy nie rzuca – niepoprawny plik daje komunikat błędu (NFR-R2). */
export function parseProject(text: string): Result<Pattern> {
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
        return { ok: false, error: 'Plik zawiera niepoprawne oczko.' };
      }
      stitches[s.id] = { id: s.id, type: s.type, layer: s.layer, order: s.order };
    }
    for (const e of raw.edges as Edge[]) {
      if (!KINDS.includes(e?.kind) || !(e.from in stitches) || !(e.to in stitches)) {
        return { ok: false, error: 'Plik zawiera niepoprawne połączenie.' };
      }
    }
    if (raw.cursor !== null && !(raw.cursor in stitches)) {
      return { ok: false, error: 'Niepoprawna pozycja nici.' };
    }
    if (!Number.isInteger(raw.currentLayer) || !Number.isInteger(raw.nextOrder)) {
      return { ok: false, error: 'Niepoprawny numer warstwy.' };
    }
    return {
      ok: true,
      value: { stitches, edges: raw.edges, cursor: raw.cursor, currentLayer: raw.currentLayer, nextOrder: raw.nextOrder },
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
