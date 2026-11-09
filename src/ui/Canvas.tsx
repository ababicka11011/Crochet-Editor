import { useRef, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { addStitchAtom, layoutAtom, patternAtom, selectedTypeAtom } from '../controller/store';
import { CATALOG } from '../model/stitchCatalog';

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export function Canvas() {
  const pattern = useAtomValue(patternAtom);
  const layout = useAtomValue(layoutAtom);
  const type = useAtomValue(selectedTypeAtom);
  const add = useSetAtom(addStitchAtom);
  const svgRef = useRef<SVGSVGElement>(null);
  const [view, setView] = useState({ x: 400, y: 300, zoom: 4 });
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  const zoomAt = (f: number, px: number, py: number) =>
    setView((v) => {
      const z = clamp(v.zoom * f, 0.5, 40);
      const k = z / v.zoom;
      return { zoom: z, x: px - (px - v.x) * k, y: py - (py - v.y) * k };
    });

  const centre = () => {
    const r = svgRef.current!.getBoundingClientRect();
    return [r.width / 2, r.height / 2] as const;
  };

  return (
    <div className="canvas-wrap">
      <svg
        ref={svgRef}
        className="canvas"
        onWheel={(e) => {
          const r = svgRef.current!.getBoundingClientRect();
          zoomAt(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX - r.left, e.clientY - r.top);
        }}
        onPointerDown={(e) => { drag.current = { x: e.clientX, y: e.clientY, moved: false }; }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d || e.buttons === 0) return;
          const dx = e.clientX - d.x, dy = e.clientY - d.y;
          if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
          if (!d.moved) return;
          d.x = e.clientX; d.y = e.clientY;
          setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
        }}
        onPointerUp={() => { setTimeout(() => (drag.current = null), 0); }}
      >
        <rect
          width="100%" height="100%" fill="transparent"
          onClick={() => { if (!drag.current?.moved && !CATALOG[type].needsInsertion) add(undefined); }}
        />
        <g transform={`translate(${view.x} ${view.y}) scale(${view.zoom})`}>
          {Object.values(pattern.stitches).map((s) => {
            const pl = layout.placements[s.id];
            if (!pl) return null;
            const info = CATALOG[s.type];
            const deg = (pl.rotation * 180) / Math.PI;
            return (
              <g
                key={s.id}
                className={`stitch${pattern.cursor === s.id ? ' cursor' : ''}`}
                transform={`translate(${pl.x} ${pl.y}) rotate(${deg}) scale(${pl.sw} ${pl.sh})`}
                onClick={(e) => { e.stopPropagation(); if (!drag.current?.moved) add(s.id); }}
              >
                <rect className="hit" x={-info.baseWidth / 2 - 2} y={-info.baseHeight / 2 - 2}
                  width={info.baseWidth + 4} height={info.baseHeight + 4} />
                <path d={info.path} fill={info.filled ? 'currentColor' : 'none'} />
              </g>
            );
          })}
        </g>
      </svg>
      <div className="zoom">
        <button aria-label="Oddal" onClick={() => zoomAt(1 / 1.25, ...centre())}>−</button>
        <span>{Math.round(view.zoom * 25)}%</span>
        <button aria-label="Przybliż" onClick={() => zoomAt(1.25, ...centre())}>+</button>
      </div>
    </div>
  );
}
