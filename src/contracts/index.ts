// Typy i interfejsy współdzielone przez moduły (bez logiki). Por. Stage 2, pkt 2.1.

export type StitchId = string;
export type StitchType = 'ch' | 'slst' | 'sc' | 'hdc' | 'dc' | 'tr' | 'mr';
export type EdgeKind = 'previous' | 'insertion' | 'slip-stitch' | 'surrounding';
export type Insertion = 'both-loops' | 'front-loop' | 'back-loop' | 'arch';

export interface Stitch {
  id: StitchId;
  type: StitchType;
  layer: number;
  order: number;
}

/** Krawędź skierowana od węzła nowszego do starszego. */
export interface Edge {
  kind: EdgeKind;
  from: StitchId;
  to: StitchId;
  insertion?: Insertion; // tylko dla kind = 'insertion'
}

export interface Pattern {
  stitches: Record<StitchId, Stitch>;
  edges: readonly Edge[];
  cursor: StitchId | null;
  currentLayer: number;
  nextOrder: number;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export type StartElement = { kind: 'chain'; count: number } | { kind: 'magic-ring' };

// ---- Layout ----
export interface StitchPlacement {
  x: number; // środek symbolu, jednostki modelu
  y: number; // oś Y w dół (jak w SVG)
  rotation: number; // radiany; 0 = podstawa symbolu na dole
  sw: number; // skala szerokości
  sh: number; // skala wysokości
}

export interface Layout {
  placements: Readonly<Record<StitchId, StitchPlacement>>;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

export interface LayoutOptions {
  seed?: number;
}
export type LayoutDiagnostics = Record<string, number>;

export type LayoutResult =
  | { ok: true; layout: Layout; diagnostics: LayoutDiagnostics }
  | { ok: false; error: string };

/** Kontrakt modułu algorytmicznego – implementuje go współautor (force-directed). */
export interface LayoutEngine {
  computeLayout(p: Pattern, options?: LayoutOptions): Promise<LayoutResult>;
}
