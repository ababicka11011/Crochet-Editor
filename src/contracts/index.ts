// Typy i interfejsy współdzielone przez moduły (bez logiki).
// Model wzoru wzorowany na: Seitz i in., "Digital Crochet" (Onward! 2022).

export type StitchId = string;
/** Węzły = punkty wbicia. Oczko ścisłe (slip stitch) nie jest węzłem, tylko krawędzią. */
export type StitchType = 'ch' | 'sc' | 'hdc' | 'dc' | 'tr' | 'mr';
export type EdgeKind = 'previous' | 'insertion' | 'slip-stitch' | 'surrounding';
export type Insertion = 'both-loops' | 'front-loop' | 'back-loop' | 'arch';

export interface Stitch {
  id: StitchId;
  type: StitchType;
  layer: number;
  order: number;
}

/** Krawędź skierowana od węzła nowszego do starszego (slip stitch: od bieżącego do celu). */
export interface Edge {
  kind: EdgeKind;
  from: StitchId;
  to: StitchId;
  insertion?: Insertion; // tylko dla kind = 'insertion'
}

export interface Pattern {
  stitches: Record<StitchId, Stitch>;
  edges: readonly Edge[];
  cursor: StitchId | null; // bieżący wierzchołek (skąd wychodzi nić)
  currentLayer: number;
  nextOrder: number;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

// --- Layout ---
export interface StitchPlacement {
  x: number;
  y: number; // oś Y w dół (jak w SVG)
  rotation: number; // radiany (w surowym edytorze zawsze 0)
  sw: number;
  sh: number;
}

export interface Layout {
  placements: Readonly<Record<StitchId, StitchPlacement>>;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

export interface LayoutOptions {
  seed?: number;
  /** Dotychczasowy układ - punkt startowy dla algorytmu (pozycje ustawione ręcznie). */
  previous?: Layout;
}
export type LayoutDiagnostics = Record<string, number>;

export type LayoutResult =
  | { ok: true; layout: Layout; diagnostics: LayoutDiagnostics }
  | { ok: false; error: string };

/** Kontrakt modułu algorytmicznego. */
export interface LayoutEngine {
  computeLayout(p: Pattern, options?: LayoutOptions): Promise<LayoutResult>;
}
