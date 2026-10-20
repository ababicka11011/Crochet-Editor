import type { StitchId, Stitch } from "../model/Stitch";
import type { Edge } from "../model/Edge";
import type { Layout } from "./Layout";

export interface Pattern {
  stitches: Record<StitchId, Stitch>
  edges: Edge[]
  cursor: StitchId | null;
  currentRound: number;
  layout: Layout;
}