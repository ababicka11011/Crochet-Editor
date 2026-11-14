export type StitchId = string;
export type StitchType = 'ch' | 'sc' | 'hdc' | 'dc' | 'tr' | 'mr' | 'hole'

export interface Stitch {
  id: StitchId
  type: StitchType
  layer: number
  surroundingNodes: StitchId[] | null
}