// Typy i interfejsy współdzielone przez moduły (bez logiki).
// Model wzoru wzorowany na: Seitz i in., "Digital Crochet" (Onward! 2022).

export type StitchId = string;
/** Węzły = punkty wbicia. Oczko ścisłe (slip stitch) nie jest węzłem, tylko krawędzią. */
export type StitchType = 'ch' | 'sc' | 'hdc' | 'dc' | 'tr' | 'mr' | 'hole'

export interface Stitch {
  id: StitchId
  type: StitchType
  layer: number
  order: number
  surroundingNodes?: StitchId[]
}

export type EdgeKind = 'previous' | 'insertion' | 'slip-stitch' | 'surrounding'
export type Insertion = 'both-loops' | 'front-loop' | 'back-loop' | 'front-post' | 'back-post' | 'space' | 'ring';

/** Krawędź skierowana od węzła nowszego do starszego (slip stitch: od bieżącego do celu). */
export interface Edge {
    kind: EdgeKind
    from: StitchId
    to: StitchId
    insertion?: Insertion  // tylko dla kind = 'insertion'
    layer?: number
}

export interface Pattern {
  stitches: Record<StitchId, Stitch>
  edges: Edge[]
  cursor: StitchId | null; // bieżący wierzchołek (skąd wychodzi nić)
  currentLayer: number;
  nextOrder: number;
}