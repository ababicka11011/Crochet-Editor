import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as RPointerEvent } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import {
  addEdgeAtom, addVertexAtom, endMoveAtom, layoutAtom, moveNodeAtom, patternAtom, toolAtom,
} from '../controller/store';
import { edgeOffsets, edgePath, NODE_RADIUS } from '../layout/edgeGeometry';
import { layerColor } from '../model/stitchCatalog';

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const MARKERS = ['previous', 'insertion', 'slip-stitch'] as const;

export function Canvas() {
  const pattern = useAtomValue(patternAtom);
  const layout = useAtomValue(layoutAtom);
  const tool = useAtomValue(toolAtom);
  const addVertex = useSetAtom(addVertexAtom);
  const addEdge = useSetAtom(addEdgeAtom);
  const move = useSetAtom(moveNodeAtom);
  const endMove = useSetAtom(endMoveAtom);

  const svgRef = useRef<SVGSVGElement>(null);
  const [view, setView] = useState({ x: 400, y: 300, zoom: 1 });
  const [pending, setPending] = useState<string | null>(null); // początek krawędzi
  const [mouse, setMouse] = useState<{ x: number; y: number } | null>(null);
  const pan = useRef<{ sx: number; sy: number; lx: number; ly: number; moved: boolean } | null>(null);
  const dragNode = useRef<{ id: string; sx: number; sy: number; moved: boolean } | null>(null);

  useEffect(() => { setPending(null); }, [tool]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPending(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const offsets = useMemo(() => edgeOffsets(pattern.edges), [pattern.edges]);

  const toWorld = (cx: number, cy: number) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: (cx - r.left - view.x) / view.zoom, y: (cy - r.top - view.y) / view.zoom };
  };

  const zoomAt = (f: number, px: number, py: number) =>
    setView((v) => {
      const z = clamp(v.zoom * f, 0.2, 5);
      const k = z / v.zoom;
      return { zoom: z, x: px - (px - v.x) * k, y: py - (py - v.y) * k };
    });

  const centre = () => {
    const r = svgRef.current!.getBoundingClientRect();
    return [r.width / 2, r.height / 2] as const;
  };

  const onMove = (e: RPointerEvent<SVGSVGElement>) => {
    const w = toWorld(e.clientX, e.clientY);
    if (pending) setMouse(w);
    const d = dragNode.current;
    if (d) {
      if (e.buttons === 0) { dragNode.current = null; endMove(); return; }
      if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 4) return;
      d.moved = true;
      move({ id: d.id, x: w.x, y: w.y });
      return;
    }
    const p = pan.current;
    if (p && e.buttons !== 0) {
      if (!p.moved && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) < 4) return;
      p.moved = true;
      const dx = e.clientX - p.lx;
      const dy = e.clientY - p.ly;
      p.lx = e.clientX;
      p.ly = e.clientY;
      setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
    }
  };

  const onUp = (e: RPointerEvent<SVGSVGElement>) => {
    if (dragNode.current) { dragNode.current = null; endMove(); }
    const p = pan.current;
    pan.current = null;
    if (p && !p.moved) {
      if (tool === 'vertex') {
        const w = toWorld(e.clientX, e.clientY);
        addVertex({ x: w.x, y: w.y });
      } else {
        setPending(null);
      }
    }
  };

  const onLeave = () => {
    if (dragNode.current) { dragNode.current = null; endMove(); }
    pan.current = null;
  };

  const pendingPos = pending ? layout.placements[pending] : undefined;

  return (
    <div className="canvas-wrap">
      <svg
        ref={svgRef}
        className={`canvas tool-${tool}`}
        onWheel={(e) => {
          const r = svgRef.current!.getBoundingClientRect();
          zoomAt(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX - r.left, e.clientY - r.top);
        }}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onLeave}
      >
        <defs>
          {MARKERS.map((k) => (
            <marker key={k} id={`arr-${k}`} viewBox="0 0 10 10" refX="9" refY="5"
              markerWidth="7" markerHeight="7" orient="auto">
              <path className={`arrow ${k}`} d="M0 0L10 5L0 10z" />
            </marker>
          ))}
        </defs>
        <rect
          className="bg" width="100%" height="100%" fill="transparent"
          onPointerDown={(e) => { pan.current = { sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, moved: false }; }}
        />
        <g transform={`translate(${view.x} ${view.y}) scale(${view.zoom})`}>
          {pattern.edges.map((e, i) => {
            const a = layout.placements[e.from];
            const b = layout.placements[e.to];
            if (!a || !b || e.kind === 'surrounding') return null;
            const g = edgePath(a, b, offsets[i] ?? 0);
            if (!g) return null;
            return (
              <g key={`${e.kind}-${e.from}-${e.to}`}>
                <path className={`edge ${e.kind}`} d={g.d} markerEnd={`url(#arr-${e.kind})`} />
                {e.kind === 'slip-stitch' && (
                  <text className="edge-label" x={g.lx} y={g.ly - 3} textAnchor="middle">sl st</text>
                )}
              </g>
            );
          })}

          {pendingPos && mouse && (
            <line className="rubber" x1={pendingPos.x} y1={pendingPos.y} x2={mouse.x} y2={mouse.y} />
          )}

          {Object.values(pattern.stitches).map((s) => {
            const pl = layout.placements[s.id];
            if (!pl) return null;
            return (
              <g
                key={s.id}
                className="node"
                transform={`translate(${pl.x} ${pl.y})`}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  if (tool === 'vertex') {
                    dragNode.current = { id: s.id, sx: e.clientX, sy: e.clientY, moved: false };
                  } else if (!pending) {
                    setPending(s.id);
                  }
                }}
                onPointerUp={() => {
                  if (tool !== 'vertex' && pending && pending !== s.id) {
                    addEdge({ from: pending, to: s.id });
                    setPending(null);
                    setMouse(null);
                  }
                }}
              >
                <title>{`${s.type} #${s.order + 1}, warstwa ${s.layer}`}</title>
                {pattern.cursor === s.id && <circle className="cursor-ring" r={NODE_RADIUS + 5} />}
                {pending === s.id && <circle className="pending-ring" r={NODE_RADIUS + 5} />}
                <circle className="node-body" r={NODE_RADIUS} stroke={layerColor(s.layer)} />
                <text className="node-label" textAnchor="middle" dominantBaseline="central">{s.type}</text>
              </g>
            );
          })}
        </g>
      </svg>
      <div className="zoom">
        <button aria-label="Oddal" onClick={() => zoomAt(1 / 1.25, ...centre())}>−</button>
        <span>{Math.round(view.zoom * 100)}%</span>
        <button aria-label="Przybliż" onClick={() => zoomAt(1.25, ...centre())}>+</button>
      </div>
    </div>
  );
}
