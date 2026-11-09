import type { Layout, Pattern } from '../contracts';
import { CATALOG } from '../model/stitchCatalog';

/** Eksport całego schematu, niezależny od widoku; bez elementów UI (US-10). */
export function exportSvg(p: Pattern, layout: Layout): string {
  const { minX, minY, maxX, maxY } = layout.bounds;
  const body = Object.values(p.stitches)
    .map((s) => {
      const pl = layout.placements[s.id];
      if (!pl) return '';
      const info = CATALOG[s.type];
      const deg = (pl.rotation * 180) / Math.PI;
      return `<path d="${info.path}" transform="translate(${pl.x.toFixed(2)} ${pl.y.toFixed(2)}) rotate(${deg.toFixed(2)}) scale(${pl.sw} ${pl.sh})" fill="${info.filled ? '#1b2330' : 'none'}"/>`;
    })
    .join('\n  ');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${maxX - minX} ${maxY - minY}" width="${(maxX - minX) * 4}" height="${(maxY - minY) * 4}">
<g stroke="#1b2330" stroke-width="1" stroke-linecap="round" fill="none">
  ${body}
</g>
</svg>`;
}
