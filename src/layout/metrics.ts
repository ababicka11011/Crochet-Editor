/**
 * Metryki jakości układu symboli.
 *
 * Każda metryka jest czystą funkcją (wzór, układ) -> wynik: nie zmienia danych wejściowych
 * i nie zależy od silnika układu, dzięki czemu można nią porównywać różne silniki
 * oraz wykrywać regresje w testach. Wszystkie wartości są liczone w jednostkach modelu
 * (szerokość bazowa oczka = 1), więc nie zależą od przybliżenia widoku.
 *
 * Konwencja pozycji: (x, y) w StitchPlacement to środek GÓRNEJ krawędzi symbolu,
 * czyli punkt, w który wbija się kolejne oczko (zob. contracts/Layout).
 */
import type { Layout, StitchPlacement } from '../contracts/Layout';
import type { Edge, Pattern, StitchId } from '../model';
import { firstStitch, parentsOf } from '../model/patternQueries';
import { STITCH_GEOMETRY } from '../model/stitchCatalog';
import type { Vec } from './geometry/Vec';
import { add, angleBetween, dot, normalize, scale, sub, upFromRotation, vecLength } from './geometry/Vec';

/**
 * Obrys symbolu jako część komórki oczka. Komórka (pełna szerokość/wysokość z katalogu)
 * opisuje miejsce zajmowane w robótce, a sąsiednie oczka stykają się bokami - dlatego
 * kolizje liczymy na mniejszym obrysie, który faktycznie widać na schemacie.
 * Wartości dobrać do symboli SVG (te same współczynniki powinien stosować renderer).
 */
export const SYMBOL_SCALE_W = 0.6;
export const SYMBOL_SCALE_H = 0.9;
/** Grubość obrysu łańcuszka (w katalogu ma wysokość 0), w jednostkach modelu. */
export const CHAIN_THICKNESS = 0.5;
/** Nachodzenie mniejsze niż ten ułamek szerokości mniejszego symbolu nie jest kolizją. */
export const OVERLAP_TOLERANCE = 0.05;

// ---------------------------------------------------------------------------
// Typy wyników
// ---------------------------------------------------------------------------

/** Obrócony prostokąt: środek, półwymiary wzdłuż osi lokalnych, osie lokalne (jednostkowe). */
interface Box {
  c: Vec;
  hw: number;   // połówka szerokości
  hh: number;   // połówka wysokości
  ux: Vec;      // oś szerokości
  uy: Vec;      // oś wysokości
}

/** Wynik metryki nakładania symboli (overlapMetrics). */
export interface OverlapMetrics {
  /** Udział oczek biorących udział w co najmniej jednej kolizji (0..1). */
  overlapRatio: number;
  /** Liczba par symboli nachodzących na siebie powyżej tolerancji. */
  collisionCount: number;
  /** Średnia głębokość nachodzenia kolidujących par, względem szerokości mniejszego symbolu. */
  meanOverlapDepth: number;
  /** Oczka biorące udział w kolizjach (np. do podświetlenia w UI). */
  collidingIds: StitchId[];
}

/** Wynik metryki proporcji symboli (aspectViolations). */
export interface AspectViolationMetrics {
  /** Oczka, których proporcje H/W wykraczają poza zakres [minRatio, maxRatio] z katalogu. */
  violatingStitches: StitchId[],
  /** Średni koszt kształtu: średnia z (H/W - H/W preferowane)^2; 0 = wszystkie oczka w proporcjach bazowych. */
  meanShapeCost: number,
  /** Liczba oczek, dla których sprawdzano proporcje (oczka z określoną geometrią). */
  stitchesWithGeometryCount: number
}

/** Wynik metryki długości krawędzi (edgeLengthError). Błędy są względne: |d - d*| / d*. */
export interface EdgeLengthMetrics {
  /** Średni błąd względny krawędzi previous (odstęp od poprzedniego oczka). */
  meanPreviousEdgeLengthError: number,
  /** Liczba ocenionych krawędzi previous. */
  previousEdgeCount: number,
  /** Średni błąd względny krawędzi insertion (odległość od punktu wbicia). */
  meanInsertionEdgeLengthError: number,
  /** Liczba ocenionych krawędzi insertion. */
  insertionEdgeCount: number
}

/** Wynik metryki orientacji symboli (orientationError). */
export interface OrientationMetrics {
  /** Mediana błędu orientacji w stopniach (odporna na pojedyncze odstające oczka). */
  medianDegree: number,
  /** Największy błąd orientacji w stopniach (najgorzej skierowany symbol). */
  maxDegree: number,
  /** Liczba ocenionych oczek. */
  measuredStitches: number,
  /** Oczka z rodzicem, których nie dało się ocenić (brak pozycji, oczko za blisko rodzica). */
  skippedStitches: number,
}

/** Sposób wykonania warstwy: okrążenie albo rząd. */
export type LayerKind = 'round' | 'row';

/** Wynik metryki regularności warstw (layerRegularity). */
export interface LayerRegularityMetrics {
  /** Rodzaj warstw, dla którego policzono metrykę (wartości obu rodzajów nie są porównywalne). */
  kind: LayerKind;
  /** Odchylenie od kształtu warstwy: CV promieni (okrążenia) lub odchylenie od prostej w szerokościach oczka (rzędy). */
  shapeDeviation: number;
  /** Nierównomierność rozstawu: CV odstępów kątowych (okrążenia) lub odległości między oczkami (rzędy). */
  spacingCV: number;
  /** Liczba ocenionych warstw. */
  measuredLayers: number;
  /** Warstwy pominięte, bo miały mniej niż 3 oczka. */
  skippedLayers: number;
}

/* Zebrane łącznie wszystkie metryki dla layoutu */
export interface LayoutMetrics {
  overlapMetrics: OverlapMetrics,
  aspectViolationMetrics: AspectViolationMetrics,
  edgeLengthMetrics: EdgeLengthMetrics,
  orientationMetrics: OrientationMetrics,
  layerRegularityMetrics: LayerRegularityMetrics | null
}

// ---------------------------------------------------------------------------
// Funkcje pomocnicze: geometria
// ---------------------------------------------------------------------------

/**
 * Prostokąt kolizji symbolu: obrys widocznego symbolu (nie pełna komórka oczka),
 * obrócony zgodnie z pozycją. Zwraca null dla oczek bez geometrii.
 */
function symbolBox(type: keyof typeof STITCH_GEOMETRY, pl: StitchPlacement): Box | null {
  const g = STITCH_GEOMETRY[type];
  if (!g) return null; // magiczne kółko, otwór - brak symbolu do sprawdzania
  const w = g.baseWidth * pl.sw * SYMBOL_SCALE_W;
  // łańcuszek ma w katalogu wysokość 0 - dostaje stałą grubość obrysu
  const h = g.baseHeight > 0 ? g.baseHeight * pl.sh * SYMBOL_SCALE_H : CHAIN_THICKNESS;
  // osie lokalne prostokąta: ux - wzdłuż szerokości, uy - wzdłuż wysokości
  const cos = Math.cos(pl.rotation);
  const sin = Math.sin(pl.rotation);
  // pozycja to górna krawędź symbolu, więc środek prostokąta leży pół wysokości
  // niżej, w kierunku przeciwnym do "góry" symbolu: c = pozycja − n * (h / 2)
  const c = sub({ x: pl.x, y: pl.y }, scale(upFromRotation(pl.rotation), h / 2))
  return {
    c: c,
    hw: w / 2,
    hh: h / 2,
    ux: { x: cos, y: sin },
    uy: { x: -sin, y: cos },
  };
}

/** Promień rzutu prostokąta na oś `axis` (jednostkową). */
const projectedRadius = (b: Box, axis: Vec) =>
  b.hw * Math.abs(dot(b.ux, axis)) + b.hh * Math.abs(dot(b.uy, axis));

/** Rzeczywista długość krawędzi w układzie; null, gdy któryś koniec nie ma pozycji. */
function edgeLength(edge: Edge, layout: Layout): number | null {
  const plFrom = layout.placements[edge.from];
  const plTo = layout.placements[edge.to];
  if (!plFrom || !plTo) return null;

  return Math.hypot(plTo.x - plFrom.x, plTo.y - plFrom.y)
}

/**
 * Docelowa długość krawędzi wynikająca z geometrii oczek:
 * - insertion: połowa wysokości oczka + połowa wysokości punktu wbicia,
 * - previous: połowa szerokości obu oczek (sąsiednie oczka stykają się bokami).
 * Zwraca null dla krawędzi, których nie oceniamy (oczka bez geometrii, slip stitch, surrounding).
 */
function edgeLengthBase(edge: Edge, pattern: Pattern): number | null {
  const from = STITCH_GEOMETRY[pattern.stitches[edge.from]?.type ?? 'mr'];
  const to = STITCH_GEOMETRY[pattern.stitches[edge.to]?.type ?? 'mr'];
  if (edge.kind === "insertion") {
    if (!from) return null;
    // punkt wbicia bez geometrii (magiczne kółko, otwór) liczony jako punkt o wysokości 0
    return from.baseHeight / 2 + (to?.baseHeight ?? 0) / 2;
  } else if (edge.kind === "previous") {
    if (!from || !to) return null;
    return from.baseWidth / 2 + to.baseWidth / 2;
  }

  return null;
}

/** Średnia pozycja punktów (środek ciężkości). Wymaga niepustej tablicy. */
function avgPosition(points: Vec[]): Vec {
  let sum = {x: 0, y: 0};
  for (const point of points) {
    sum = add(sum, point);
  }
  return scale(sum, 1/points.length);
}

// ---------------------------------------------------------------------------
// Funkcje pomocnicze: statystyka
// ---------------------------------------------------------------------------

/** Mediana; dla pustej tablicy 0. Sortuje kopię, nie zmienia wejścia. */
const median = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
};

/** Średnia arytmetyczna; dla pustej tablicy NaN. */
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

/** Odchylenie standardowe (populacyjne). */
const std = (xs: number[]) => {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};

/** Współczynnik zmienności: bezwymiarowy, 0 = wszystkie wartości równe. */
const cv = (xs: number[]) => {
  const m = mean(xs);
  return m === 0 ? 0 : std(xs) / m;
};

/**
 * Regularność jednego okrążenia względem środka wzoru `c`:
 * - radial: CV odległości oczek od środka (0 = idealny okrąg),
 * - angular: CV odstępów kątowych między kolejnymi oczkami (0 = równy rozkład).
 * Zakłada pełne okrążenie: przy warstwie obejmującej część obwodu `angular` będzie zawyżone.
 */
function roundRegularity(points: Vec[], c: Vec) {
  const radii = points.map((p) => Math.hypot(p.x - c.x, p.y - c.y));
  const angles = points
    .map((p) => Math.atan2(p.y - c.y, p.x - c.x))
    .sort((a, b) => a - b);
  const gaps = angles.slice(1).map((a, i) => a - angles[i]!);
  // domknięcie okręgu: odstęp między ostatnim a pierwszym oczkiem
  gaps.push(2 * Math.PI - (angles[angles.length - 1]! - angles[0]!));
  return { radial: cv(radii), angular: cv(gaps) };
}

/**
 * Regularność jednego rzędu:
 * - straightness: odchylenie standardowe odległości od dopasowanej prostej, w jednostkach `unit`,
 * - spacing: CV odstępów między kolejnymi oczkami wzdłuż prostej.
 * Prosta to główna oś zbioru punktów (najmniejsze odległości prostopadłe),
 * więc wynik nie zależy od obrotu rzędu - działa też dla rzędów pionowych.
 */
function rowRegularity(points: Vec[], unit: number) {
  const c = { x: mean(points.map((p) => p.x)), y: mean(points.map((p) => p.y)) };
  // macierz kowariancji 2x2
  let sxx = 0, sxy = 0, syy = 0;
  for (const p of points) {
    const dx = p.x - c.x, dy = p.y - c.y;
    sxx += dx * dx; sxy += dx * dy; syy += dy * dy;
  }
  // kierunek głównej osi (wektor własny macierzy kowariancji dla większej wartości własnej)
  const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy);     // kierunek prostej
  const dir = { x: Math.cos(angle), y: Math.sin(angle) };
  const normal = { x: -dir.y, y: dir.x };

  // współrzędne punktów wzdłuż prostej (posortowane) i w poprzek prostej
  const along = points.map((p) => dot(sub(p, c), dir)).sort((a, b) => a - b);
  const across = points.map((p) => dot(sub(p, c), normal));

  const gaps = along.slice(1).map((a, i) => a - along[i]!);
  return {
    straightness: std(across) / unit, // odchylenie od prostej w szerokościach oczka
    spacing: cv(gaps),
  };
}

/**
 * Głębokość nachodzenia dwóch obróconych prostokątów (test osi rozdzielających, SAT):
 * najmniejsze nachodzenie rzutów na 4 osiach lokalnych obu prostokątów.
 * Wartość <= 0 oznacza brak przecięcia.
 */
export function overlapDepth(a: Box, b: Box): number {
  const d = { x: b.c.x - a.c.x, y: b.c.y - a.c.y };
  let min = Infinity;
  for (const axis of [a.ux, a.uy, b.ux, b.uy]) {
    const overlap = projectedRadius(a, axis) + projectedRadius(b, axis) - Math.abs(dot(d, axis));
    if (overlap <= 0) return overlap; // znaleziona oś rozdzielająca
    if (overlap < min) min = overlap;
  }
  return min;
}

// ---------------------------------------------------------------------------
// Metryki
// ---------------------------------------------------------------------------

/** Klucz pary niezależny od kolejności. */
const pairKey = (a: StitchId, b: StitchId) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/**
 * Metryka nakładania symboli. Pomija pary połączone krawędzią insertion
 * (oczko i punkt wbicia stykają się z definicji: podstawa leży na górze rodzica).
 */
export function overlapMetrics(pattern: Pattern, layout: Layout): OverlapMetrics {
  const items: { id: StitchId; box: Box }[] = [];
  for (const s of Object.values(pattern.stitches)) {
    const pl = layout.placements[s.id];
    if (!pl) continue;
    const box = symbolBox(s.type, pl);
    if (box && box.hw > 0 && box.hh > 0) items.push({ id: s.id, box });
  }

  // pary oczko - punkt wbicia: ich styk nie jest kolizją
  const touching = new Set<string>();
  for (const e of pattern.edges) {
    if (e.kind === 'insertion') touching.add(pairKey(e.from, e.to));
  }

  let collisionCount = 0;
  let depthSum = 0;
  const colliding = new Set<StitchId>();

  // wszystkie pary symboli: O(n^2), wystarczające dla kilkuset oczek
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i]!;
      const b = items[j]!;
      if (touching.has(pairKey(a.id, b.id))) continue;
      const depth = overlapDepth(a.box, b.box);
      const ref = 2 * Math.min(a.box.hw, b.box.hw); // szerokość mniejszego symbolu
      // głębokość względna, żeby próg tolerancji nie zależał od rozmiaru symboli
      const relative = depth / ref;
      if (relative > OVERLAP_TOLERANCE) {
        collisionCount++;
        depthSum += relative;
        colliding.add(a.id);
        colliding.add(b.id);
      }
    }
  }

  return {
    overlapRatio: items.length === 0 ? 0 : colliding.size / items.length,
    collisionCount,
    meanOverlapDepth: collisionCount === 0 ? 0 : depthSum / collisionCount,
    collidingIds: [...colliding],
  };
}

/**
 * Metryka proporcji symboli: czy algorytm nie zdeformował oczek ponad dopuszczalny zakres.
 * Proporcje H/W liczone ze skal sw/sh względem wymiarów bazowych z katalogu.
 * Pomija oczka bez geometrii oraz łańcuszki (wysokość bazowa 0).
 */
export function aspectViolations(pattern: Pattern, layout: Layout): AspectViolationMetrics {
  const violatingStitches: StitchId[] = [];
  let shapeCostSum = 0;
  let shapeCostCount = 0; 

  for (const stitch of Object.values(pattern.stitches)){
    const g = STITCH_GEOMETRY[stitch.type];
    const pl = layout.placements[stitch.id];
    if (!g || !pl) continue;
    // pomijamy oczka bez obu wymiarów (łańcuszek ma wysokość 0, więc proporcje nie mają sensu)
    if (!(g.baseHeight) || !(g.baseWidth)) continue;
    const r = (g.baseHeight * pl.sh) / (g.baseWidth * pl.sw); // ratio H/W dla konkretnego oczka
    if ((g.minRatio !== undefined && r < g.minRatio) || (g.maxRatio !== undefined && r > g.maxRatio!)){
      violatingStitches.push(stitch.id);
    }
    shapeCostCount += 1;
    // koszt kształtu: kwadrat odchylenia od proporcji bazowych
    const preferred = g.baseHeight / g.baseWidth;
    shapeCostSum += (r - preferred) ** 2;
  }

  return {
    violatingStitches: violatingStitches,
    meanShapeCost: shapeCostCount > 0 ? shapeCostSum / shapeCostCount : 0,
    stitchesWithGeometryCount: shapeCostCount
  }
}

/**
 * Metryka długości krawędzi: czy oczka stoją w realistycznej odległości od sąsiadów.
 * Osobno dla krawędzi previous i insertion. Uwaga: jeśli silnik optymalizuje dokładnie
 * te długości, metryka będzie dla niego zawsze dobra - oceniać razem z pozostałymi.
 */
export function edgeLengthError(pattern: Pattern, layout: Layout): EdgeLengthMetrics {
  let sumPreviousEdgeLengthError = 0;
  let sumInsertionEdgeLengthError = 0;
  let previousEdgeCount = 0;
  let insertionEdgeCount = 0;
  
  for (let i = 0; i < pattern.edges.length; i++) {
    const edge = pattern.edges[i];
    const d = edgeLength(edge, layout);
    const dBase = edgeLengthBase(edge, pattern);

    // pomijamy krawędzie bez pozycji lub bez długości docelowej
    if (d === null || dBase === null || dBase <= 0) continue;
    const relativeError = Math.abs(d - dBase) / dBase;

    if (edge.kind === "previous") {
      sumPreviousEdgeLengthError += relativeError;
      previousEdgeCount += 1;
    }
    else if (edge.kind === "insertion") {
      sumInsertionEdgeLengthError += relativeError;
      insertionEdgeCount += 1;
    }
  }
  
  return {
    meanPreviousEdgeLengthError: previousEdgeCount > 0 ? sumPreviousEdgeLengthError / previousEdgeCount : 0,
    previousEdgeCount: previousEdgeCount,
    meanInsertionEdgeLengthError: insertionEdgeCount > 0 ? sumInsertionEdgeLengthError / insertionEdgeCount : 0,
    insertionEdgeCount: insertionEdgeCount
  };
}

/**
 * Metryka orientacji: czy symbol jest skierowany od punktu wbicia "na zewnątrz", zgodnie
 * z konwencją schematów. Błąd to kąt między kierunkiem "w górę" symbolu (z obrotu)
 * a kierunkiem od średniej pozycji rodziców do oczka. Porównanie z kierunkiem do rodzica,
 * a nie z obrotem rodzica, sprawia, że wachlarz kilku oczek w jednym miejscu nie jest błędem.
 * Ocenia tylko oczka z krawędzią insertion (łańcuszki i magiczne kółko nie mają rodzica).
 */
export function orientationError(pattern: Pattern, layout: Layout): OrientationMetrics {
  const orErrorArray: number[] = [];
  let maxOrError = 0;
  let measured = 0;
  let candidates = 0;

  for (const stitch of Object.values(pattern.stitches)) {
    const parents = parentsOf(pattern, stitch.id);
    let parentPos = { x: 0, y: 0 };

    if (parents.length === 0) continue;
    candidates += 1;
    // średnia pozycja rodziców (przy łączeniu oczek - środek między nimi)
    let validParents = parents.length;
    for (const parentId of parents){
      const ppl = layout.placements[parentId];
      if (!ppl) {
        validParents -= 1;
        continue;
      }
      parentPos = add(parentPos, { x: ppl.x, y: ppl.y});
    }
    if (validParents === 0) continue;
    parentPos = scale(parentPos, 1/validParents);
    
    const pl = layout.placements[stitch.id];
    if (!pl) continue;
    const distanceFromParent = sub({x: pl.x, y: pl.y}, parentPos);
    // jeśli oczko jest za blisko rodzica, kierunek jest przypadkowy - pomiń
    if (vecLength(distanceFromParent) < 0.1) continue;
    const v = normalize(distanceFromParent);
    if (!v) continue;
    const n = upFromRotation(pl.rotation);

    const orError = angleBetween(v, n) * 180 / Math.PI;
    if (orError > maxOrError) maxOrError = orError;
    orErrorArray.push(orError);
    measured += 1;
  }

  return {
    medianDegree: median(orErrorArray),
    maxDegree: maxOrError,
    measuredStitches: measured,
    skippedStitches: candidates - measured
  }
}

/**
 * Metryka regularności warstw: czy okrążenia przypominają okręgi, a rzędy proste,
 * i czy oczka są w nich równo rozłożone. Wynik to średnia po warstwach.
 * Typ warstw (`layerKind`) jest podawany z zewnątrz, np. z pliku wzoru testowego,
 * i obowiązuje dla całego wzoru. Warstwy z mniej niż 3 oczkami są pomijane.
 */
export function layerRegularity(pattern: Pattern, layout: Layout, layerKind: LayerKind): LayerRegularityMetrics {
  // grupowanie punktów po warstwach (bez magicznego kółka i otworów)
  const byLayer = new Map<number, Vec[]>();
  for (const s of Object.values(pattern.stitches)) {
    if (s.type === 'mr' || s.type === 'hole') continue;
    const pl = layout.placements[s.id];
    if (!pl) continue;
    const list = byLayer.get(s.layer) ?? [];
    list.push({ x: pl.x, y: pl.y });
    byLayer.set(s.layer, list);
  }

  // numery warstw rosnąco - niezależnie od kolejności kluczy w pattern.stitches
  const layers = [...byLayer.keys()].sort((a, b) => a - b);

  // środek wzoru: magiczne kółko albo środek pierwszej warstwy
  let center: Vec | null = null;
  if (layerKind === 'round') {
    const first = firstStitch(pattern);
    const mrPl = first?.type === 'mr' ? layout.placements[first.id] : undefined;
    if (mrPl) center = { x: mrPl.x, y: mrPl.y };
    else if (layers.length > 0) center = avgPosition(byLayer.get(layers[0]!)!);
  }

  const shapes: number[] = [];
  const spacings: number[] = [];
  let skippedLayers = 0;

  for (const layer of layers) {
    const points = byLayer.get(layer)!;
    if (points.length < 3) {
      skippedLayers += 1;
      continue;
    }
    if (layerKind === 'round') {
      // center jest ustawiony: przy 'round' i co najmniej jednej warstwie
      const m = roundRegularity(points, center!);
      shapes.push(m.radial);
      spacings.push(m.angular);
    } else {
      const m = rowRegularity(points, 1);
      shapes.push(m.straightness);
      spacings.push(m.spacing);
    }
  }
  
  return {
    kind: layerKind,
    shapeDeviation: shapes.length ? mean(shapes) : 0,
    spacingCV: spacings.length ? mean(spacings) : 0,
    measuredLayers: shapes.length,
    skippedLayers,
  }
}

/**
 * Funkcja zbiorcza, która wylicza po kolei wszystkie metryki i zwraca ich wyniki. layerRegularity jest wyliczane
 * tylko w przypadku, gdy typ warstw jest znany i przekazany do funkcji, w przeciwnym wypadku otrzymujemy null
 */
export function computeMetrics(pattern: Pattern, layout: Layout, layerKind?: LayerKind): LayoutMetrics {
  return {
    overlapMetrics: overlapMetrics(pattern, layout),
    aspectViolationMetrics: aspectViolations(pattern, layout),
    edgeLengthMetrics: edgeLengthError(pattern, layout),
    orientationMetrics: orientationError(pattern, layout),
    // pomijamy layerRegularityMetrics, jeśli nie znamy/nie mamy podanego typu warstw (layerKind)
    layerRegularityMetrics: layerKind ? layerRegularity(pattern, layout, layerKind) : null
  }
}