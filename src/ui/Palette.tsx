import { useAtom, useAtomValue } from 'jotai';
import { patternAtom, selectedTypeAtom } from '../controller/store';
import { CATALOG, PALETTE_TYPES } from '../model/stitchCatalog';

export function Palette() {
  const [selected, select] = useAtom(selectedTypeAtom);
  const pattern = useAtomValue(patternAtom);
  return (
    <aside className="panel">
      <h2>Oczka</h2>
      <ul className="palette">
        {PALETTE_TYPES.map((t) => (
          <li key={t}>
            <button className={t === selected ? 'active' : ''} onClick={() => select(t)}>
              <svg viewBox="-8 -13 16 26" width="22" height="30">
                <path d={CATALOG[t].path} fill={CATALOG[t].filled ? 'currentColor' : 'none'} />
              </svg>
              <span>{CATALOG[t].label}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="hint">
        {CATALOG[selected].needsInsertion
          ? 'Kliknij oczko na schemacie, aby wbić w nie nowe.'
          : 'Kliknij puste miejsce, aby dodać oczko.'}
      </p>
      <dl className="facts">
        <dt>Warstwa</dt><dd>{pattern.currentLayer}</dd>
        <dt>Oczek</dt><dd>{Object.keys(pattern.stitches).length}</dd>
      </dl>
    </aside>
  );
}
