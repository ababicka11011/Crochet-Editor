import type { StitchId } from "./Stitch";

export type EdgeKind = 'previous' | 'insertion' | 'slip-stitch'
export type Insertion = 'both-loops' | 'front-loop' | 'back-loop' | 'space' | 'ring';

export interface Edge {
    kind: EdgeKind
    from: StitchId
    to: StitchId
    insertion?: Insertion
}