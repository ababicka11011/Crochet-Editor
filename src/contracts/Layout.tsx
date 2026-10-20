import type { StitchId } from "../model/Stitch";

export interface StitchPlacement {
  x: number;        // środek symbolu, jednostki modelu
  y: number;
  rotation: number; // radiany; 0 = symbol pionowo, podstawa na dole
  sw: number;       // skala szerokości: W = W0 * sw
  sh: number;       // skala wysokości:  H = H0 * sh
}

export interface Layout {
//   patternId: string;
  placements: Record<StitchId, StitchPlacement>;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

export interface LayoutOptions {
    // for options to configure layout algorithm, e.g. seed, maxIterations, timeBudgetMs,
    // pinned list, abort signal to allow stopping computations
}

export type LayoutResult =
  | { ok: true; layout: Layout; diagnostics: LayoutDiagnostics }
  | { ok: false; error: string };

//   type LayoutResult =
//   | { ok: true; layout: Layout; diagnostics: LayoutDiagnostics }
//   | { ok: false; error: { code: LayoutErrorCode; message: string } };

export interface LayoutDiagnostics {
    // for results of various metrics regarding layout quality, e.g. percent of collisions, 
    // number of deformed stitches
}