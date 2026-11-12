import { useEffect, useRef } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import {
  canRedoAtom, canUndoAtom, dirtyAtom, layoutAtom, loadProjectAtom, newLayerAtom,
  newPatternAtom, patternAtom, recomputeLayoutAtom, redoAtom, removeLastAtom, statusAtom, undoAtom,
} from '../controller/store';
import { exportSvg } from '../persist/exportSvg';
import { download, serializeProject } from '../persist/projectFile';
import { Canvas } from './Canvas';
import { Palette } from './Palette';

export function App() {
  const pattern = useAtomValue(patternAtom);
  const layout = useAtomValue(layoutAtom);
  const status = useAtomValue(statusAtom);
  const dirty = useAtomValue(dirtyAtom);
  const canUndo = useAtomValue(canUndoAtom);
  const canRedo = useAtomValue(canRedoAtom);
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
    <div className="app">
      <header className="toolbar">
        <button onClick={onNew}>Nowy</button>
        <button onClick={() => fileInput.current?.click()}>Otwórz</button>
        <button onClick={() => { download('wzor.crochet.json', serializeProject(pattern, layout), 'application/json'); setDirty(false); }}>Zapisz</button>
        <button onClick={() => download('graf.svg', exportSvg(pattern, layout), 'image/svg+xml')}>Eksportuj SVG</button>
        <span className="sep" />
        <button disabled={!canUndo} onClick={() => undo()}>Cofnij</button>
        <button disabled={!canRedo} onClick={() => redo()}>Ponów</button>
        <button onClick={() => removeLast()}>Usuń ostatni</button>
        <button onClick={() => newLayer()}>Nowa warstwa</button>
        <span className="sep" />
        <button onClick={() => recompute()}>Rozmieść automatycznie</button>
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
      <main><Canvas /></main>
      <footer className={`status ${status.kind}`}>{status.text}</footer>
    </div>
  );
}
