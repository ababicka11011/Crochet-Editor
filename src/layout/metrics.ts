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

/** Obrócony prostokąt: środek, półwymiary wzdłuż osi lokalnych, osie lokalne (jednostkowe). */
interface Box {
  c: Vec;
  hw: number;   // połówka szerokości
  hh: number;   // połówka wysokości
  ux: Vec;      // oś szerokości
  uy: Vec;      // oś wysokości
}

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

export interface AspectViolationMetrics {
  /** Lista oczek przekraczających dopuszczalny stosunek H/W **/
  violatingStitches: StitchId[],
  /** Średni koszt kształtu (odchylenia od standardowego stosunku H/W**/
  meanShapeCost: number,
  /** Liczba wszystkich oczek, dla których sprawdzana była zgodność stosunku H/W **/
  stitchesWithGeometryCount: number
}

export interface EdgeLengthMetrics {
  meanPreviousEdgeLengthError: number,
  previousEdgeCount: number,
  meanInsertionEdgeLengthError: number,
  insertionEdgeCount: number
}

export interface OrientationMetrics {
  medianDegree: number,
  maxDegree: number,
  measuredStitches: number,
  skippedStitches: number,
}

export type LayerKind = 'round' | 'row';

export interface LayerRegularityMetrics {
  kind: LayerKind;
  /** Odchylenie od kształtu warstwy: CV promieni (okrążenia) lub odchylenie od prostej w szerokościach oczka (rzędy). */
  shapeDeviation: number;
  /** Nierównomierność rozstawu: CV odstępów kątowych (okrążenia) lub odległości między oczkami (rzędy). */
  spacingCV: number;
  measuredLayers: number;
  skippedLayers: number;
}

function symbolBox(type: keyof typeof STITCH_GEOMETRY, pl: StitchPlacement): Box | null {
  const g = STITCH_GEOMETRY[type];
  if (!g) return null; // magiczne kółko, otwór - brak symbolu do sprawdzania
  const w = g.baseWidth * pl.sw * SYMBOL_SCALE_W;
  const h = g.baseHeight > 0 ? g.baseHeight * pl.sh * SYMBOL_SCALE_H : CHAIN_THICKNESS;
  const cos = Math.cos(pl.rotation);
  const sin = Math.sin(pl.rotation);
  // c = pozycja − n * (h / 2)
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

function edgeLength(edge: Edge, layout: Layout): number | null {
  const plFrom = layout.placements[edge.from];
  const plTo = layout.placements[edge.to];
  if (!plFrom || !plTo) return null;

  return Math.hypot(plTo.x - plFrom.x, plTo.y - plFrom.y)
}

function edgeLengthBase(edge: Edge, pattern: Pattern): number | null {
  const from = STITCH_GEOMETRY[pattern.stitches[edge.from]?.type ?? 'mr'];
  const to = STITCH_GEOMETRY[pattern.stitches[edge.to]?.type ?? 'mr'];
  if (edge.kind === "insertion") {
    if (!from) return null;
    return from.baseHeight / 2 + (to?.baseHeight ?? 0) / 2;
  } else if (edge.kind === "previous") {
    if (!from || !to) return null;
    return from.baseWidth / 2 + to.baseWidth / 2;
  }

  return null;
}

function avgPosition(points: Vec[]): Vec {
  let sum = {x: 0, y: 0};
  for (const point of points) {
    sum = add(sum, point);
  }
  return scale(sum, 1/points.length);
}

const median = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
};

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

const std = (xs: number[]) => {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};

/** Współczynnik zmienności: bezwymiarowy, 0 = wszystkie wartości równe. */
const cv = (xs: number[]) => {
  const m = mean(xs);
  return m === 0 ? 0 : std(xs) / m;
};

function roundRegularity(points: Vec[], c: Vec) {
  const radii = points.map((p) => Math.hypot(p.x - c.x, p.y - c.y));
  const angles = points
    .map((p) => Math.atan2(p.y - c.y, p.x - c.x))
    .sort((a, b) => a - b);
  const gaps = angles.slice(1).map((a, i) => a - angles[i]!);
  gaps.push(2 * Math.PI - (angles[angles.length - 1]! - angles[0]!));
  return { radial: cv(radii), angular: cv(gaps) };
}

function rowRegularity(points: Vec[], unit: number) {
  const c = { x: mean(points.map((p) => p.x)), y: mean(points.map((p) => p.y)) };
  // macierz kowariancji 2x2
  let sxx = 0, sxy = 0, syy = 0;
  for (const p of points) {
    const dx = p.x - c.x, dy = p.y - c.y;
    sxx += dx * dx; sxy += dx * dy; syy += dy * dy;
  }
  const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy);     // kierunek prostej
  const dir = { x: Math.cos(angle), y: Math.sin(angle) };
  const normal = { x: -dir.y, y: dir.x };

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

  const touching = new Set<string>();
  for (const e of pattern.edges) {
    if (e.kind === 'insertion') touching.add(pairKey(e.from, e.to));
  }

  let collisionCount = 0;
  let depthSum = 0;
  const colliding = new Set<StitchId>();

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i]!;
      const b = items[j]!;
      if (touching.has(pairKey(a.id, b.id))) continue;
      const depth = overlapDepth(a.box, b.box);
      const ref = 2 * Math.min(a.box.hw, b.box.hw); // szerokość mniejszego symbolu
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

export function aspectViolations(pattern: Pattern, layout: Layout): AspectViolationMetrics {
  const violatingStitches: StitchId[] = [];
  let shapeCostSum = 0;
  let shapeCostCount = 0; 

  for (const stitch of Object.values(pattern.stitches)){
    const g = STITCH_GEOMETRY[stitch.type];
    const pl = layout.placements[stitch.id];
    if (!g || !pl) continue;
    // jeśli oczko nie ma zdefiniowanej geometrii, pomiń je
    if (!(g.baseHeight) || !(g.baseWidth)) continue;
    const r = (g.baseHeight * pl.sh) / (g.baseWidth * pl.sw); // ratio H/W dla konkretnego oczka
    if ((g.minRatio !== undefined && r < g.minRatio) || (g.maxRatio !== undefined && r > g.maxRatio!)){
      violatingStitches.push(stitch.id);
    }
    shapeCostCount += 1;
    const preferred = g.baseHeight / g.baseWidth;
    shapeCostSum += (r - preferred) ** 2;
  }

  return {
    violatingStitches: violatingStitches,
    meanShapeCost: shapeCostCount > 0 ? shapeCostSum / shapeCostCount : 0,
    stitchesWithGeometryCount: shapeCostCount
  }
}

export function edgeLengthError(pattern: Pattern, layout: Layout): EdgeLengthMetrics {
  let sumPreviousEdgeLengthError = 0;
  let sumInsertionEdgeLengthError = 0;
  let previousEdgeCount = 0;
  let insertionEdgeCount = 0;
  
  for (let i = 0; i < pattern.edges.length; i++) {
    const edge = pattern.edges[i];
    const d = edgeLength(edge, layout);
    const dBase = edgeLengthBase(edge, pattern);

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
    // jeśli oczko jest za blisko rodzica, pomiń
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
    shapeDeviation: shapes.length ? mean(shapes) : NaN,
    spacingCV: spacings.length ? mean(spacings) : NaN,
    measuredLayers: shapes.length,
    skippedLayers,
  }
}
