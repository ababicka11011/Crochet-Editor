import type { StitchId, Stitch } from "../model/Stitch";
import type { Edge } from "../model/Edge";

export interface Pattern {
  stitches: Record<StitchId, Stitch>
  edges: Edge[]
  cursor: StitchId | null;
  currentLayer: number;
  nextOrder: number;
}