import type { Pattern } from "../contracts/Pattern";
import type { Layout, LayoutOptions, LayoutResult } from "../contracts/Layout";
import type { LayoutEngine } from "../contracts/LayoutEngine";
import type { StitchId } from "../model/Stitch";

class BaseLayout implements LayoutEngine{
    placeNewStitches(pattern: Pattern, layout: Layout, newIds: StitchId[]): Layout {
       
    }

    computeLayout(pattern: Pattern, options?: LayoutOptions): Promise<LayoutResult> {
        throw new Error("Method not implemented.");
    }   
}