import type { EdgeKind, StitchType } from '../contracts';

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
};

export const PALETTE_TYPES: StitchType[] = ['ch', 'sc', 'hdc', 'dc', 'tr', 'mr'];

export const LAYER_COLORS = ['#3b4fb8', '#c0392b', '#1f8a5b', '#b7791f', '#8e44ad', '#16808f'];
export const layerColor = (layer: number) =>
  LAYER_COLORS[(Math.max(1, layer) - 1) % LAYER_COLORS.length] ?? '#3b4fb8';

export const EDGE_LABEL: Partial<Record<EdgeKind, string>> = {
  previous: 'previous',
  insertion: 'insert',
  'slip-stitch': 'slip stitch',
};
