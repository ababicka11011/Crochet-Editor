import { useEffect, useRef } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import {
  autoLayoutAtom, canRedoAtom, canUndoAtom, dirtyAtom, layoutAtom, loadProjectAtom, newLayerAtom,
  newPatternAtom, patternAtom, recomputeLayoutAtom, redoAtom, removeLastAtom, setAutoLayoutAtom,
  statusAtom, undoAtom,
} from '../controller/store';
import { exportSvg } from '../persist/exportSvg';
import { download, serializeProject } from '../persist/projectFile';
import { Button } from './Button';
import { Canvas } from './Canvas';
import { Palette } from './Palette';

const Sep = () => <span className="mx-1 h-5 w-px bg-neutral-300" />;

export function App() {
  const pattern = useAtomValue(patternAtom);
  const layout = useAtomValue(layoutAtom);
  const status = useAtomValue(statusAtom);
  const dirty = useAtomValue(dirtyAtom);
  const canUndo = useAtomValue(canUndoAtom);
  const canRedo = useAtomValue(canRedoAtom);
  const auto = useAtomValue(autoLayoutAtom);
  const setAuto = useSetAtom(setAutoLayoutAtom);
  const undo = useSetAtom(undoAtom);
  const redo = useSetAtom(redoAtom);
  const removeLast = useSetAtom(removeLastAtom);
  const newLayer = useSetAtom(newLayerAtom);
  const recompute = useSetAtom(recomputeLayoutAtom);
  const newPattern = useSetAtom(newPatternAtom);
  const load = useSetAtom(loadProjectAtom);
  const setDirty = useSetAtom(dirtyAtom);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === 'z') { e.preventDefault(); undo(); }
      if (e.key === 'y') { e.preventDefault(); redo(); }
    };
    const onUnload = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [undo, redo, dirty]);

  const onNew = () => {
    if (dirty && !window.confirm('Masz niezapisane zmiany. Utworzyć nowy wzór mimo to?')) return;
    newPattern();
  };

  return (
    <div className="grid h-full grid-cols-[230px_1fr] grid-rows-[auto_1fr_auto] bg-neutral-100 text-sm text-black">
      <header className="col-span-2 flex flex-wrap items-center gap-1.5 border-b border-neutral-300 bg-white px-3 py-2">
        <Button onClick={onNew}>Nowy</Button>
        <Button onClick={() => fileInput.current?.click()}>Otwórz</Button>
        <Button onClick={() => { download('wzor.crochet.json', serializeProject(pattern, layout), 'application/json'); setDirty(false); }}>Zapisz</Button>
        <Button onClick={() => download('graf.svg', exportSvg(pattern, layout), 'image/svg+xml')}>Eksportuj SVG</Button>
        <Sep />
        <Button disabled={!canUndo} onClick={() => undo()}>Cofnij</Button>
        <Button disabled={!canRedo} onClick={() => redo()}>Ponów</Button>
        <Button onClick={() => removeLast()}>Usuń ostatni</Button>
        <Button onClick={() => newLayer()}>Nowa warstwa</Button>
        <Sep />
        <Button onClick={() => recompute()}>Rozmieść automatycznie</Button>
        <label className="flex cursor-pointer items-center gap-1.5 text-[13px]">
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
          Przeliczaj po każdej zmianie
        </label>
        <input
          ref={fileInput} type="file" accept=".json" hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) load(await f.text());
            e.target.value = '';
          }}
        />
      </header>
      <Palette />
      <main className="relative overflow-hidden bg-white">
        <Canvas />
      </main>
      <footer
        className={`col-span-2 border-t border-neutral-300 bg-white px-3 py-1.5 ${
          status.kind === 'error' ? 'text-red-700' : 'text-neutral-600'
        }`}
      >
        {status.text}
      </footer>
    </div>
  );
}