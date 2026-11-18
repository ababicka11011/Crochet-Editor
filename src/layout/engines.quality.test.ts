import { describe, it, expect } from "vitest";
import { ForceLayoutEngine } from "./forceLayout";
import { emptyPattern } from "../model/pattern";
import { computeMetrics, layerRegularity } from "./metrics";
import type { Pattern } from '../model';
import type { LayerKind } from './metrics';

interface Fixture { name: string; pattern: Pattern; layerKind: LayerKind }

// dodać inne silniki jak powstaną i zestaw wzorów testowych
const engines = [new ForceLayoutEngine()];
const fixtures: Fixture[] = [
  { name: 'pusty wzór', pattern: emptyPattern(), layerKind: 'row' },
];

describe.each(engines)('$name', (engine) => {
    /** Dla wzoru pustego wartości wszystkich metryk numerycznych powinny być równe 0, a wszystkie
     * zbiory powinny mieć długość 0.
     */
    it('Wzór pusty', async () => {
        const pattern = emptyPattern();
        const res = await engine.computeLayout(pattern);
        expect(res.ok).toBe(true);
        if (!res.ok) return;
        const metrics = computeMetrics(pattern, res.layout)
        expect(metrics.overlapMetrics.overlapRatio).toBe(0);
        expect(metrics.overlapMetrics.meanOverlapDepth).toBe(0);
        expect(metrics.overlapMetrics.collisionCount).toBe(0);
        expect(metrics.overlapMetrics.collidingIds.length).toBe(0);

        expect(metrics.aspectViolationMetrics.violatingStitches.length).toBe(0);
        expect(metrics.aspectViolationMetrics.meanShapeCost).toBe(0);
        expect(metrics.aspectViolationMetrics.stitchesWithGeometryCount).toBe(0);

        expect(metrics.orientationMetrics.medianDegree).toBe(0);
        expect(metrics.orientationMetrics.maxDegree).toBe(0);
        expect(metrics.orientationMetrics.measuredStitches).toBe(0);
        expect(metrics.orientationMetrics.skippedStitches).toBe(0);
        
        expect(metrics.edgeLengthMetrics.meanPreviousEdgeLengthError).toBe(0);
        expect(metrics.edgeLengthMetrics.meanInsertionEdgeLengthError).toBe(0);
        expect(metrics.edgeLengthMetrics.insertionEdgeCount).toBe(0);
        expect(metrics.edgeLengthMetrics.previousEdgeCount).toBe(0);

        const metricsRow = layerRegularity(pattern, res.layout, 'row');
        expect(metricsRow.shapeDeviation).toBe(0);
        expect(metricsRow.spacingCV).toBe(0);
        expect(metricsRow.measuredLayers).toBe(0);
        expect(metricsRow.skippedLayers).toBe(0);

        const metricsRound = layerRegularity(pattern, res.layout, 'round');
        expect(metricsRound.shapeDeviation).toBe(0);
        expect(metricsRound.spacingCV).toBe(0);
        expect(metricsRound.measuredLayers).toBe(0);
        expect(metricsRound.skippedLayers).toBe(0);
    });

    it.each(fixtures)('Wzór $name', async ({pattern, layerKind}) => {
        const res = await engine.computeLayout(pattern);
        expect(res.ok).toBe(true);
        if (!res.ok) return;
        const metrics = computeMetrics(pattern, res.layout, layerKind)
        expect(metrics.overlapMetrics.overlapRatio).lessThanOrEqual(0.05);
        expect(metrics.aspectViolationMetrics.violatingStitches.length).toBe(0);
        expect(metrics.orientationMetrics.medianDegree).lessThanOrEqual(15);
        expect(metrics.edgeLengthMetrics.meanPreviousEdgeLengthError).lessThanOrEqual(0.3);
        expect(metrics.edgeLengthMetrics.meanInsertionEdgeLengthError).lessThanOrEqual(0.3);
        if (metrics.layerRegularityMetrics) {
            expect(metrics.layerRegularityMetrics.shapeDeviation).lessThanOrEqual(0.15);
            expect(metrics.layerRegularityMetrics.spacingCV).lessThanOrEqual(0.3);
        }
    });
})

