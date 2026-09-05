import { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * The filter rail: a sticky column beside the results on a wide screen, a
 * bottom sheet on a phone.
 *
 * It used to be the same block in both places, and on narrow screens the
 * catalogue grid ordered it *after* the results — so tapping Filters opened a
 * panel several screens below the fold and the button read as doing nothing at
 * all. As a sheet it opens where the thumb already is, and it closes.
 */
export const FilterSheet = ({ open, onClose, onClear, children }) => {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      {/* Only ever visible at sheet widths; the desktop rail needs no scrim. */}
      {open ? <button type="button" className="filters-scrim" aria-label="Close filters" onClick={onClose} /> : null}

      <aside className={`filters ${open ? 'is-open' : ''}`} aria-label="Filters">
        <div className="filters-head">
          <h4>Filters</h4>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close filters"><X size={19} /></button>
        </div>
        <div className="filters-scroll">{children}</div>
        <div className="filters-foot">
          {onClear ? <button type="button" className="btn btn-ghost btn-sm" onClick={onClear}>Clear all</button> : null}
          <button type="button" className="btn btn-primary btn-sm grow" onClick={onClose}>Show results</button>
        </div>
      </aside>
    </>
  );
};
