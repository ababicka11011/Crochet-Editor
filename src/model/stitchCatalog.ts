import type { StitchType } from '../contracts';

export interface StitchInfo {
  label: string;
  baseWidth: number;
  baseHeight: number;
  /** Czy oczko wymaga wbicia w istniejący element. */
  needsInsertion: boolean;
  /** Ścieżka SVG symbolu we współrzędnych lokalnych (środek w 0,0). */
  path: string;
  filled?: boolean;
}

export const CATALOG: Record<StitchType, StitchInfo> = {
  ch:   { label: 'Łańcuszek', baseWidth: 10, baseHeight: 5, needsInsertion: false,
          path: 'M-5 0 a5 2.5 0 1 0 10 0 a5 2.5 0 1 0 -10 0' },
  slst: { label: 'Oczko ścisłe', baseWidth: 5, baseHeight: 5, needsInsertion: true, filled: true,
          path: 'M-2.5 0 a2.5 2.5 0 1 0 5 0 a2.5 2.5 0 1 0 -5 0' },
  sc:   { label: 'Półsłupek', baseWidth: 8, baseHeight: 8, needsInsertion: true,
          path: 'M0 -4 V4 M-4 0 H4' },
  hdc:  { label: 'Słupek półpodwójny', baseWidth: 8, baseHeight: 14, needsInsertion: true,
          path: 'M0 7 V-7 M-4 -7 H4' },
  dc:   { label: 'Słupek', baseWidth: 8, baseHeight: 18, needsInsertion: true,
          path: 'M0 9 V-9 M-4 -9 H4 M-3 1 L3 -3' },
  tr:   { label: 'Słupek podwójny', baseWidth: 8, baseHeight: 22, needsInsertion: true,
          path: 'M0 11 V-11 M-4 -11 H4 M-3 -1 L3 -5 M-3 3 L3 -1' },
  mr:   { label: 'Magiczne kółko', baseWidth: 10, baseHeight: 10, needsInsertion: false,
          path: 'M-4 0 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0' },
};

export const PALETTE_TYPES: StitchType[] = ['ch', 'slst', 'sc', 'hdc', 'dc', 'tr'];
