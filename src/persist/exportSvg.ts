import type { Layout, Pattern } from '../contracts';
import { edgeOffsets, edgePath, NODE_RADIUS } from '../layout/edgeGeometry';
import { computeBounds } from '../layout/forceLayout';
import { layerColor } from '../model/stitchCatalog';

const EDGE_COLOR = { previous: '#5d6879', insertion: '#3b4fb8', 'slip-stitch': '#d4701a', surrounding: '#888888' };

/** Eksport całego grafu, niezależny od widoku; bez elementów UI (US-10). */
export function exportSvg(p: Pattern, layout: Layout): string {
  const { minX, minY, maxX, maxY } = computeBounds(layout.placements);
  const markers = Object.entries(EDGE_COLOR)
    .map(([k, c]) => `<marker id="a-${k}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="${c}"/></marker>`)
    .join('');
  const offsets = edgeOffsets(p.edges);
  const edges = p.edges
    .map((e, i) => {
      const a = layout.placements[e.from];
      const b = layout.placements[e.to];
      if (!a || !b) return '';
      const g = edgePath(a, b, offsets[i] ?? 0);
      if (!g) return '';
      const dash = e.kind === 'slip-stitch' ? ' stroke-dasharray="5 3"' : '';
      const label = e.kind === 'slip-stitch'
        ? `<text x="${g.lx.toFixed(1)}" y="${(g.ly - 3).toFixed(1)}" font-size="8" text-anchor="middle" fill="${EDGE_COLOR[e.kind]}">sl st</text>`
        : '';
      return `<path d="${g.d}" fill="none" stroke="${EDGE_COLOR[e.kind]}" stroke-width="1.5"${dash} marker-end="url(#a-${e.kind})"/>${label}`;
    })
    .join('\n');
  const nodes = Object.values(p.stitches)
    .map((s) => {
      const pl = layout.placements[s.id];
      if (!pl) return '';
      return `<circle cx="${pl.x.toFixed(1)}" cy="${pl.y.toFixed(1)}" r="${NODE_RADIUS}" fill="#ffffff" stroke="${layerColor(s.layer)}" stroke-width="2"/><text x="${pl.x.toFixed(1)}" y="${pl.y.toFixed(1)}" font-size="10" font-weight="600" text-anchor="middle" dominant-baseline="central" fill="#1b2330">${s.type}</text>`;
    })
    .join('\n');
  const w = maxX - minX;
  const h = maxY - minY;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${w} ${h}" width="${w * 2}" height="${h * 2}" font-family="system-ui, sans-serif">
<defs>${markers}</defs>
${edges}
${nodes}
</svg>`;
}
