import { useAtom, useAtomValue } from 'jotai';
import { patternAtom, selectedTypeAtom, toolAtom, engineListAtom, engineIdAtom } from '../controller/store';
import type { Tool } from '../controller/store';
import { CATALOG, PALETTE_TYPES } from '../model/stitchCatalog';
import { Button } from './Button';

const TOOLS: { id: Tool; label: string; hint: string }[] = [
  { id: 'vertex', label: 'Wierzchołki', hint: 'Kliknij puste miejsce, aby dodać wierzchołek (z krawędzią previous do bieżącego). Przeciągnij wierzchołek, aby go przesunąć.' },
  { id: 'insertion', label: 'Krawędź: insert', hint: 'Przeciągnij od oczka do punktu, w który jest wbite (albo kliknij oba po kolei). Bieżący wierzchołek się nie zmienia.' },
  { id: 'slip-stitch', label: 'Krawędź: slip stitch', hint: 'Zacznij od bieżącego wierzchołka (pierścień) i wskaż cel. Cel staje się bieżącym wierzchołkiem.' },
];

const h2 = 'mb-1.5 mt-4 text-[13px] font-bold first:mt-0';

export function Palette() {
  const [tool, setTool] = useAtom(toolAtom);
  const [type, setType] = useAtom(selectedTypeAtom);
  const pattern = useAtomValue(patternAtom);
  const cursor = pattern.cursor ? pattern.stitches[pattern.cursor] : undefined;
  const hint = TOOLS.find((t) => t.id === tool)?.hint;
  const engines = useAtomValue(engineListAtom);
  const [engineId, setEngineId] = useAtom(engineIdAtom);

  return (
    <aside className="overflow-auto border-r border-neutral-300 bg-white p-3">
      <h2 className={h2}>Tryb</h2>
      <div className="grid gap-1">
        {TOOLS.map((t) => (
          <Button key={t.id} active={t.id === tool} className="text-left" onClick={() => setTool(t.id)}>
            {t.label}
          </Button>
        ))}
      </div>
      <p className="mt-2 text-[12.5px] text-neutral-600">{hint}</p>

      <h2 className={h2}>Typ wierzchołka</h2>
      <ul className={`m-0 grid list-none grid-cols-1 gap-1 p-0 ${tool === 'vertex' ? '' : 'opacity-50'}`}>
        {PALETTE_TYPES.map((t) => (
          <li key={t}>
            <Button
              active={t === type}
              pad="px-1.5 py-1"
              className="flex w-full items-center gap-2 text-left text-[12.5px]"
              onClick={() => { setType(t); setTool('vertex'); }}
            >
              <span className="inline-grid size-[26px] flex-none place-items-center rounded-full border-[1.5px] border-black bg-white text-[10px] font-semibold">
                {t}
              </span>
              <span>{CATALOG[t].label}</span>
            </Button>
          </li>
        ))}
      </ul>

      <h2 className={h2}>Krawędzie</h2>
      <ul className="m-0 grid list-none gap-1 p-0 text-[12.5px]">
        <li className="flex items-center gap-2">
          <svg width="34" height="8"><line x1="0" y1="4" x2="34" y2="4" strokeWidth={1.5} className="stroke-neutral-500" /></svg>
          previous
        </li>
        <li className="flex items-center gap-2">
          <svg width="34" height="8"><line x1="0" y1="4" x2="34" y2="4" strokeWidth={1.5} className="stroke-black" /></svg>
          insert
        </li>
        <li className="flex items-center gap-2">
          <svg width="34" height="8"><line x1="0" y1="4" x2="34" y2="4" strokeWidth={1.5} strokeDasharray="5 3" className="stroke-black" /></svg>
          slip stitch
        </li>
      </ul>

      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        <dt className="text-neutral-600">Bieżący</dt>
        <dd className="m-0 text-right">{cursor ? `${cursor.type} #${cursor.order + 1}` : '–'}</dd>
        <dt className="text-neutral-600">Warstwa</dt>
        <dd className="m-0 text-right">{pattern.currentLayer}</dd>
        <dt className="text-neutral-600">Wierzchołków</dt>
        <dd className="m-0 text-right">{Object.keys(pattern.stitches).length}</dd>
        <dt className="text-neutral-600">Krawędzi</dt>
        <dd className="m-0 text-right">{pattern.edges.length}</dd>
      </dl>

      <select value={engineId} onChange={(e) => setEngineId(e.target.value)}>
        {engines.map((e) => (
          <option key={e.id} value={e.id}>{e.name}</option>
        ))}
      </select>
    </aside>
  );
}