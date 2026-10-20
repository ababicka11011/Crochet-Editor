import type { Pattern } from "./Pattern";
import type { LayoutOptions, LayoutResult } from "./Layout";

export interface LayoutEngine {
  computeLayout(pattern: Pattern, options?: LayoutOptions): Promise<LayoutResult>;
}