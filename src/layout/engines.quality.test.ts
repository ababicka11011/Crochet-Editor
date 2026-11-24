import { describe, it, expect } from "vitest";
import { ForceLayoutEngine } from "./forceLayout";
import { emptyPattern } from "../model/pattern";
import { computeMetrics, layerRegularity } from "./metrics";
import type { Pattern } from '../model';
import type { LayerKind } from './metrics';
import { D3LayoutEngine } from "./d3Layout";
import { ColaLayoutEngine } from "./colaLayout";

interface Fixture { name: string; pattern: Pattern; layerKind: LayerKind }

// dodać inne silniki jak powstaną i zestaw wzorów testowych
const engines = [new ForceLayoutEngine(), new D3LayoutEngine(), new ColaLayoutEngine()];
const fixtures: Fixture[] = [
  { name: 'Empty pattern', pattern: emptyPattern(), layerKind: 'row' },
];

describe.each(engines)('$name', (engine) => {
    /** Dla wzoru pustego wartości wszystkich metryk numerycznych powinny być równe 0, a wszystkie
     * zbiory powinny mieć długość 0.
     */
    it('Empty pattern', async () => {
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

/**
 * Dla silnika szybkiego progi mogą być łagodniejsze niż dla dokładnego. Najprościej trzymać je w obiekcie przy definicji silnika.

2. Porównania względne między silnikami
silnik dokładny ma nie więcej kolizji niż szybki na każdym wzorze,
silnik dokładny ma mniejszy lub równy shapeDeviation niż szybki,
każdy silnik jest lepszy od układu startowego (np. placeNewStitches dla wszystkich oczek): przeliczenie nie może pogorszyć overlapRatio ani edgeLengthError.

Ostatni test jest szczególnie przydatny: wychwytuje sytuację, w której zmiana w silniku sprawia, że „optymalizacja” psuje dobry układ.

3. Własności, które muszą zawsze zachodzić
determinizm: ten sam wzór i ten sam seed → identyczny układ (porównanie pozycji co do 1e-9),
kompletność: każde oczko z wzoru ma pozycję w wyniku, brak NaN i Infinity,
stabilność przy previous: przeliczenie układu, który już jest wynikiem silnika, przesuwa oczka średnio o mniej niż np. 0,1 szerokości oczka. Układ będący już minimum nie powinien „odpływać”,
lokalność zmian: dodanie jednego oczka i przeliczenie z previous przesuwa pozostałe oczka średnio o mniej niż np. 0,5 szerokości oczka. To sprawdza wymaganie „symbole nie latają po ekranie”.
4. Przypadki brzegowe
pusty wzór → wynik ok: false albo pusty układ, bez wyjątku,
jedno oczko, sam łańcuszek, samo magiczne kółko → poprawny wynik, metryki bez NaN,
wzór z otworem i z łączeniem oczek (kilku rodziców) → przechodzi progi z punktu 1,
dwie niepołączone części wzoru → nie nakładają się na siebie (overlapRatio = 0 między częściami).
5. Czas (luźny próg)
wzór ~500 oczek liczy się w mniej niż np. 2 s (NFR-P2).

Wzory testowe (fixtures)

Żeby powyższe miało sens, potrzebujecie kilku wzorów pokrywających różne techniki:

łańcuszek + 2 rzędy półsłupków (rzędy),
magiczne kółko + 3 okrążenia z dodawaniem (okrążenia),
okrążenia z łukami z łańcuszków i wbiciem w otwór (serwetka),
rząd z łączeniem oczek (zwężanie),
warstwa mieszana: półsłupki i słupki podwójne w jednym okrążeniu,
większy wzór ~300–500 oczek (do testu czasu i lokalności).
*/