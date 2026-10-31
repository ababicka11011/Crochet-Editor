import type { StitchId } from "../model/Stitch";
import type { Pattern } from "./Pattern";
import type { LayoutOptions, LayoutResult, Layout } from "./Layout";

// function placeNewStitches(pattern: Pattern, layout: Layout, newIds: StitchId[]): Layout {
//   return new Layout
// }
  

export interface LayoutEngine {
  computeLayout(pattern: Pattern, options?: LayoutOptions): Promise<LayoutResult>;
}