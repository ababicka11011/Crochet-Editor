import { useAtom, useAtomValue } from 'jotai';
import { patternAtom, selectedTypeAtom, toolAtom } from '../controller/store';
import type { Tool } from '../controller/store';
import { CATALOG, PALETTE_TYPES } from '../model/stitchCatalog';

const TOOLS: { id: Tool; label: string; hint: string }[] = [
  { id: 'vertex', label: 'Wierzchołki', hint: 'Kliknij puste miejsce, aby dodać wierzchołek (z krawędzią previous do bieżącego). Przeciągnij wierzchołek, aby go przesunąć.' },
  { id: 'insertion', label: 'Krawędź: insert', hint: 'Przeciągnij od oczka do punktu, w który jest wbite (albo kliknij oba po kolei). Bieżący wierzchołek się nie zmienia.' },
  { id: 'slip-stitch', label: 'Krawędź: slip stitch', hint: 'Zacznij od bieżącego wierzchołka (pierścień) i wskaż cel. Cel staje się bieżącym wierzchołkiem.' },
];

export function Palette() {
  const [tool, setTool] = useAtom(toolAtom);
  const [type, setType] = useAtom(selectedTypeAtom);
  const pattern = useAtomValue(patternAtom);
  const cursor = pattern.cursor ? pattern.stitches[pattern.cursor] : undefined;
  const hint = TOOLS.find((t) => t.id === tool)?.hint;

  return (
    <aside className="panel">
      <h2>Tryb</h2>
      <div className="tools">
        {TOOLS.map((t) => (
          <button key={t.id} className={t.id === tool ? 'active' : ''} onClick={() => setTool(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <p className="hint">{hint}</p>

      <h2>Typ wierzchołka</h2>
      <ul className={`palette${tool === 'vertex' ? '' : ' disabled'}`}>
        {PALETTE_TYPES.map((t) => (
          <li key={t}>
            <button className={t === type ? 'active' : ''} onClick={() => { setType(t); setTool('vertex'); }}>
              <span className="chip">{t}</span>
              <span>{CATALOG[t].label}</span>
            </button>
          </li>
        ))}
      </ul>

      <h2>Krawędzie</h2>
      <ul className="legend">
        <li><svg width="34" height="8"><line x1="0" y1="4" x2="34" y2="4" className="edge previous" /></svg>previous</li>
        <li><svg width="34" height="8"><line x1="0" y1="4" x2="34" y2="4" className="edge insertion" /></svg>insert</li>
        <li><svg width="34" height="8"><line x1="0" y1="4" x2="34" y2="4" className="edge slip-stitch" /></svg>slip stitch</li>
      </ul>

      <dl className="facts">
        <dt>Bieżący</dt><dd>{cursor ? `${cursor.type} #${cursor.order + 1}` : '–'}</dd>
        <dt>Warstwa</dt><dd>{pattern.currentLayer}</dd>
        <dt>Wierzchołków</dt><dd>{Object.keys(pattern.stitches).length}</dd>
        <dt>Krawędzi</dt><dd>{pattern.edges.length}</dd>
      </dl>
    </aside>
  );
}
