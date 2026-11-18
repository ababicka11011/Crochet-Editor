import type { StitchId, Pattern } from "../model";
import { ForceLayoutEngine } from '../layout/forceLayout';
import { D3LayoutEngine } from '../layout/d3Layout.ts';

export interface StitchPlacement {
  x: number;        // środek symbolu, jednostki modelu
  y: number;        // górna krawędź symbolu (punkt wbicia kolejnego oczka); oś Y w dół (jak w SVG)
  rotation: number; // radiany; 0 = symbol pionowo, podstawa na dole (w surowym edytorze zawsze 0)
  sw: number;       // skala szerokości: W = W0 * sw
  sh: number;       // skala wysokości:  H = H0 * sh
}

export interface Layout {
  placements: Record<StitchId, StitchPlacement>;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

export interface LayoutOptions {
    // opcje algorytmu layoutu, np. seed, maxIterations, timeBudgetMs,
    // lista oczek o stałej pozycji, sygnał przerwania obliczeń
    seed?: number,
    /** Dotychczasowy układ - punkt startowy dla algorytmu (pozycje ustawione ręcznie). */
    previous?: Layout; 
    timeBudgetMs?: number
}
//   type LayoutResult =
//   | { ok: true; layout: Layout; diagnostics: LayoutDiagnostics }
//   | { ok: false; error: { code: LayoutErrorCode; message: string } };

// pozwala na zapisanie wartości różnych metryk związanych z jakością layoutu, np. procent kolizji,
// liczba zdeformowanych oczek, itp.
export type LayoutDiagnostics = Record<string, number>;

export type LayoutResult =
  | { ok: true; layout: Layout; diagnostics?: LayoutDiagnostics }
  | { ok: false; error: string };

/** Kontrakt modułu algorytmicznego. */
export interface LayoutEngine {
  id: string;
  name: string;
  computeLayout(pattern: Pattern, options?: LayoutOptions): Promise<LayoutResult>;
}

export const ENGINES: LayoutEngine[] = [
  new ForceLayoutEngine(),
  new D3LayoutEngine(),
];

export const DEFAULT_ENGINE_ID = 'smacof';
