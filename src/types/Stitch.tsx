export type StitchId = string;
export type StitchType = 'ch' | 'sc' | 'hdc' | 'dc' | 'tr' | 'mr' | 'hole'

export interface Stitch {
  id: StitchId
  type: StitchType
  layer: number
  previous: StitchId | null
  surroundingNodes: StitchId[] | null
  x: number
  y: number
}

export type EdgeKind = 'previous' | 'insertion' | 'slip-stitch'
export type Insertion = 'both-loops' | 'front-loop' | 'back-loop' | 'space' | 'ring';

export interface Edge {
    kind: EdgeKind
    from: StitchId
    to: StitchId
    insertion?: Insertion
}

export interface Pattern {
  stitches: Record<StitchId, Stitch>
  edges: Edge[]
  cursor: StitchId | null;
  currentRound: number;
}