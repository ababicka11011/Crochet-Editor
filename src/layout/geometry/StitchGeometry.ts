import type { StitchType } from "../../model/Stitch";

export interface StitchGeometry {
  type: StitchType;
  width: number;    // szerokość symbolu w jednostkach modelu
  height: number;   // wysokość symbolu w jednostkach modelu
}

export const stitchGeometryMap: Record<StitchType, StitchGeometry | undefined> = {
  ch: { type: 'ch', width: 1, height: 0 },
  sc: { type: 'sc', width: 1, height: 1 },
  hdc: { type: 'hdc', width: 1, height: 1.5 },
  dc: { type: 'dc', width: 1, height: 2 },
  tr: { type: 'tr', width: 1, height: 3 },
  mr: undefined, // mr stitches don't have a specific geometry
  hole: undefined, // hole stitches don't have a specific geometry
};
