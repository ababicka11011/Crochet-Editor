import type { EdgeKind, StitchType } from '../model';

export interface StitchGeometry {
  type: StitchType;
  baseWidth: number;      // szerokość symbolu w jednostkach modelu
  baseHeight: number;     // wysokość symbolu w jednostkach modelu
  minRatio?: number;  // minimalne proporcje H/W symbolu
  maxRatio?: number;  // minimalne proporcje H/W symbolu
}

export const STITCH_GEOMETRY: Record<StitchType, StitchGeometry | undefined> = {
  ch: { type: 'ch', baseWidth: 1, baseHeight: 0 },
  sc: { type: 'sc', baseWidth: 1, baseHeight: 1, minRatio: 0.8, maxRatio: 1.2 },
  hdc: { type: 'hdc', baseWidth: 1, baseHeight: 1.5, minRatio: 1.2, maxRatio: 1.8 },
  dc: { type: 'dc', baseWidth: 1, baseHeight: 2, minRatio: 1.6, maxRatio: 2.4 },
  tr: { type: 'tr', baseWidth: 1, baseHeight: 3, minRatio: 2.5, maxRatio: 3.5 },
  mr: undefined,    // magiczne kółka nie mają określonej geometrii
  hole: undefined,  // otwory nie mają określonej geometrii
};


export interface StitchInfo {
  label: string;
  /** Czy to oczko może być wbite w inne punkty (ma krawędzie insertion). */
  canInsert: boolean;
}

export const CATALOG: Record<StitchType, StitchInfo> = {
  ch: { label: 'Łańcuszek', canInsert: false },
  sc: { label: 'Półsłupek', canInsert: true },
  hdc: { label: 'Słupek półpodwójny', canInsert: true },
  dc: { label: 'Słupek', canInsert: true },
  tr: { label: 'Słupek podwójny', canInsert: true },
  mr: { label: 'Magiczne kółko', canInsert: false },
  hole : { label: 'Otwór pod łańcuszkiem', canInsert: true }
};

export const PALETTE_TYPES: StitchType[] = ['ch', 'sc', 'hdc', 'dc', 'tr', 'mr', 'hole'];

export const LAYER_COLORS = ['#3b4fb8', '#c0392b', '#1f8a5b', '#b7791f', '#8e44ad', '#16808f'];
export const layerColor = (layer: number) =>
  LAYER_COLORS[(Math.max(1, layer) - 1) % LAYER_COLORS.length] ?? '#3b4fb8';

export const EDGE_LABEL: Partial<Record<EdgeKind, string>> = {
  previous: 'previous',
  insertion: 'insert',
  'slip-stitch': 'slip stitch',
};
