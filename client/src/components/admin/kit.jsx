import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, Plus, Trash2, Upload, X } from 'lucide-react';

/**
 * The primitives the consoles need that the public pages never did: a table, a
 * dialog, a drawer, a form, a file drop, a reorderable list.
 *
 * Written in the same idiom as the rest of the client — named exports, arrow
 * components, CSS classes rather than props for styling — so nothing here
 * needs a new mental model to read.
 */

/* --- form fields -------------------------------------------------------- */

export const Field = ({ label, help, error, children, className = '' }) => {
  const id = useId();
  return (
    <div className={`a-field ${error ? 'is-invalid' : ''} ${className}`}>
      {label ? <label htmlFor={id}>{label}</label> : null}
      {typeof children === 'function' ? children(id) : children}
      {error ? <span className="error">{error}</span> : help ? <span className="help">{help}</span> : null}
    </div>
  );
};

export const Input = ({ label, help, error, className = '', ...props }) => (
  <Field label={label} help={help} error={error} className={className}>
    {(id) => <input id={id} className="input" {...props} />}
  </Field>
);

export const Textarea = ({ label, help, error, rows = 4, className = '', ...props }) => (
  <Field label={label} help={help} error={error} className={className}>
    {(id) => <textarea id={id} className="textarea" rows={rows} {...props} />}
  </Field>
);

export const Select = ({ label, help, error, options = [], placeholder, className = '', ...props }) => (
  <Field label={label} help={help} error={error} className={className}>
    {(id) => (
      <select id={id} className="select" {...props}>
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((o) => (
          <option key={o.value ?? o} value={o.value ?? o}>
            {o.label ?? o}
          </option>
        ))}
      </select>
    )}
  </Field>
);

export const Money = ({ label, help, error, value, onChange, currency = 'USD', ...props }) => (
  <Field label={label} help={help} error={error}>
    {(id) => (
      <div className="row" style={{ gap: 8, alignItems: 'center' }}>
        <span className="muted small">{currency === 'USD' ? '$' : currency}</span>
        <input
          id={id}
          className="input"
          type="number"
          min="0"
          step="1"
          inputMode="decimal"
          value={value ?? ''}
          onChange={(e) => onChange?.(e.target.value === '' ? null : Number(e.target.value))}
          {...props}
        />
      </div>
    )}
  </Field>
);

export const Checkbox = ({ label, help, checked, onChange, ...props }) => (
  <label className="a-check">
    <input type="checkbox" checked={Boolean(checked)} onChange={(e) => onChange?.(e.target.checked)} {...props} />
    <span className="body">
      <span>{label}</span>
      {help ? <span className="help">{help}</span> : null}
    </span>
  </label>
);

export const Switch = ({ label, help, checked, onChange, ...props }) => (
  <label className="a-switch">
    <input type="checkbox" checked={Boolean(checked)} onChange={(e) => onChange?.(e.target.checked)} {...props} />
    <span className="track" />
    <span className="body">
      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>{label}</span>
      {help ? <span className="help" style={{ display: 'block' }}>{help}</span> : null}
    </span>
  </label>
);

/**
 * Long-form copy on this platform is an array of paragraphs rendered as <p>,
 * everywhere, so this is the editor for it. A rich-text field would add a
 * dependency and an HTML-sanitising problem to store something the site does
 * not render anyway.
 */
export const ParagraphEditor = ({ label, help, value = [], onChange, placeholder = 'Write a paragraph…', min = 0 }) => {
  const paragraphs = value?.length ? value : [''];

  const set = (i, text) => onChange(paragraphs.map((p, n) => (n === i ? text : p)));
  const add = () => onChange([...paragraphs, '']);
  const remove = (i) => onChange(paragraphs.filter((_, n) => n !== i));

  return (
    <div className="a-field">
      {label ? <label>{label}</label> : null}
      <div className="stack stack-2">
        {paragraphs.map((paragraph, i) => (
          <div key={i} className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
            <textarea
              className="textarea grow"
              rows={3}
              value={paragraph}
              placeholder={placeholder}
              onChange={(e) => set(i, e.target.value)}
            />
            <button
              type="button"
              className="a-icon-btn danger"
              onClick={() => remove(i)}
              disabled={paragraphs.length <= min || paragraphs.length === 1}
              aria-label={`Remove paragraph ${i + 1}`}
            >
              <Trash2 size={14} strokeWidth={1.8} />
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="btn btn-ghost btn-sm" onClick={add} style={{ justifySelf: 'start' }}>
        <Plus size={14} strokeWidth={2} /> Add a paragraph
      </button>
      {help ? <span className="help">{help}</span> : null}
    </div>
  );
};

/** A list of things a person adds, removes and reorders. */
export const RepeatableList = ({ items = [], onChange, renderItem, title, addLabel = 'Add', makeItem, collapsible = true, empty }) => {
  const [collapsed, setCollapsed] = useState(() => new Set());

  const update = (i, next) => onChange(items.map((item, n) => (n === i ? next : item)));
  const remove = (i) => onChange(items.filter((_, n) => n !== i));
  const move = (i, by) => {
    const to = i + by;
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    [next[i], next[to]] = [next[to], next[i]];
    onChange(next);
  };

  const toggle = (i) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <div className="a-repeat">
      {items.length === 0 && empty ? <p className="muted small">{empty}</p> : null}

      {items.map((item, i) => (
        <div key={item.key ?? item.id ?? i} className={`a-item ${collapsed.has(i) ? 'is-collapsed' : ''}`}>
          <div className="a-item-head">
            <span className="idx">{i + 1}</span>
            <span className="title clamp-1">{title?.(item, i) ?? `Item ${i + 1}`}</span>
            <button type="button" className="a-icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
              <ChevronUp size={14} strokeWidth={1.8} />
            </button>
            <button type="button" className="a-icon-btn" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label="Move down">
              <ChevronDown size={14} strokeWidth={1.8} />
            </button>
            {collapsible ? (
              <button type="button" className="a-icon-btn" onClick={() => toggle(i)} aria-expanded={!collapsed.has(i)}>
                {collapsed.has(i) ? <ChevronDown size={14} strokeWidth={1.8} /> : <ChevronUp size={14} strokeWidth={1.8} />}
              </button>
            ) : null}
            <button type="button" className="a-icon-btn danger" onClick={() => remove(i)} aria-label="Remove">
              <Trash2 size={14} strokeWidth={1.8} />
            </button>
          </div>
          <div className="a-item-body">{renderItem(item, i, (next) => update(i, next))}</div>
        </div>
      ))}

      <button type="button" className="btn btn-outline btn-sm" onClick={() => onChange([...items, makeItem()])} style={{ justifySelf: 'start' }}>
        <Plus size={14} strokeWidth={2} /> {addLabel}
      </button>
    </div>
  );
};

/* --- dialog and drawer -------------------------------------------------- */

export const Dialog = ({ open, onClose, title, children, footer, wide = false }) => {
  const ref = useRef(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();

    // A native <dialog> already traps focus and closes on Escape; the only
    // thing to add is telling the caller it happened.
    const onCancel = (e) => {
      e.preventDefault();
      onClose?.();
    };
    node.addEventListener('cancel', onCancel);
    return () => node.removeEventListener('cancel', onCancel);
  }, [open, onClose]);

  return (
    <dialog ref={ref} className={`a-dialog ${wide ? 'wide' : ''}`} onClose={onClose}>
      {open ? (
        <>
          <div className="a-dialog-head">
            <h2>{title}</h2>
            <button type="button" className="a-icon-btn" onClick={onClose} aria-label="Close">
              <X size={15} strokeWidth={1.9} />
            </button>
          </div>
          <div className="a-dialog-body">{children}</div>
          {footer ? <div className="a-dialog-foot">{footer}</div> : null}
        </>
      ) : null}
    </dialog>
  );
};

export const Drawer = ({ open, onClose, title, subtitle, children, footer }) => {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="a-drawer-scrim" onClick={onClose} />
      <aside className="a-drawer" role="dialog" aria-modal="true" aria-label={title}>
        <div className="a-drawer-head">
          <div className="grow">
            <h2 style={{ margin: 0, fontSize: 'var(--text-lg)' }}>{title}</h2>
            {subtitle ? <p className="muted small" style={{ margin: '4px 0 0' }}>{subtitle}</p> : null}
          </div>
          <button type="button" className="a-icon-btn" onClick={onClose} aria-label="Close">
            <X size={15} strokeWidth={1.9} />
          </button>
        </div>
        <div className="a-drawer-body">{children}</div>
        {footer ? <div className="a-drawer-foot">{footer}</div> : null}
      </aside>
    </>
  );
};

/** A destructive action that states what it will do before it does it. */
export const Confirm = ({ open, onClose, onConfirm, title, body, confirmLabel = 'Confirm', danger = true, busy }) => (
  <Dialog
    open={open}
    onClose={onClose}
    title={title}
    footer={
      <>
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button type="button" className={`btn ${danger ? 'btn-dark' : 'btn-primary'}`} onClick={onConfirm} disabled={busy}>
          {busy ? 'Working…' : confirmLabel}
        </button>
      </>
    }
  >
    <p className="muted" style={{ margin: 0 }}>{body}</p>
  </Dialog>
);

/* --- tables ------------------------------------------------------------- */

export const DataTable = ({ columns, rows, empty, onRowClick, rowKey = (r, i) => r.id ?? r._id ?? r.reference ?? i }) => {
  if (!rows?.length) {
    return (
      <div className="a-empty">
        <h3>{empty?.title ?? 'Nothing here yet'}</h3>
        {empty?.body ? <p className="muted small" style={{ margin: 0, maxWidth: 380 }}>{empty.body}</p> : null}
        {empty?.action ?? null}
      </div>
    );
  }

  return (
    <div className="a-table-wrap">
      <table className="a-table">
        <thead>
          <tr>{columns.map((c) => <th key={c.key} className={c.align === 'right' ? 'num' : ''}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={rowKey(row, i)}
              className={onRowClick ? 'is-clickable' : ''}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((c) => (
                <td key={c.key} className={c.align === 'right' ? 'num' : ''}>
                  {c.render ? c.render(row, i) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const Pager = ({ page, pages, onPage }) => {
  if (!pages || pages <= 1) return null;
  const window = [...Array(pages).keys()].map((n) => n + 1).filter((n) => n === 1 || n === pages || Math.abs(n - page) <= 2);

  return (
    <nav className="pager" aria-label="Pages">
      {window.map((n, i) => (
        <span key={n}>
          {i > 0 && n - window[i - 1] > 1 ? <span className="dim" style={{ padding: '0 6px' }}>…</span> : null}
          <button type="button" className={n === page ? 'is-current' : ''} onClick={() => onPage(n)}>{n}</button>
        </span>
      ))}
    </nav>
  );
};

/* --- status ------------------------------------------------------------- */

const TONE = {
  draft: 'neutral', archived: 'neutral', unverified: 'neutral', withdrawn: 'neutral', expired: 'neutral',
  published: 'good', verified: 'good', issued: 'good', approved: 'good', completed: 'good', paid: 'good', complete: 'good', active: 'good',
  pending: 'wait', fee_pending: 'wait', submitted: 'wait', under_review: 'wait', final_review: 'wait',
  info_requested: 'wait', coursework: 'wait', assessment: 'wait', interview: 'wait', scheduled: 'wait', waived: 'wait', invited: 'wait',
  declined: 'bad', failed: 'bad', rejected: 'bad', revoked: 'bad', suspended: 'bad', reversed: 'bad', 'no-show': 'bad',
};

const LABELS = {
  fee_pending: 'Fee due',
  under_review: 'With the church',
  final_review: 'Awaiting decision',
  info_requested: 'Information asked for',
  coursework: 'Coursework',
  assessment: 'Assessment',
  interview: 'Interview',
  no_show: 'No show',
};

export const StatusPill = ({ status, label }) => (
  <span className={`pill pill-${TONE[status] ?? 'neutral'}`}>
    {label ?? LABELS[status] ?? String(status ?? '').replace(/[-_]/g, ' ').replace(/^./, (c) => c.toUpperCase())}
  </span>
);

/* --- file upload -------------------------------------------------------- */

export const FileDrop = ({ onFile, accept = 'image/*', label = 'Drop a file, or choose one', hint, busy, progress }) => {
  const [over, setOver] = useState(false);
  const inputRef = useRef(null);

  const take = useCallback((file) => {
    if (file) onFile(file);
  }, [onFile]);

  return (
    <label
      className={`a-drop ${over ? 'is-over' : ''} ${busy ? 'is-busy' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files?.[0]); }}
    >
      <Upload size={18} strokeWidth={1.7} />
      <span>{busy ? `Uploading… ${progress ?? 0}%` : label}</span>
      {hint ? <span className="hint">{hint}</span> : null}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={(e) => { take(e.target.files?.[0]); e.target.value = ''; }}
      />
    </label>
  );
};

/* --- feedback ----------------------------------------------------------- */

export const Problems = ({ problems, title = 'Before this can be published' }) => {
  if (!problems?.length) return null;
  return (
    <div className="notice notice-gold">
      <strong style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <AlertCircle size={15} strokeWidth={1.9} /> {title}
      </strong>
      <ul className="a-problems">
        {problems.map((p) => <li key={p}>{p}</li>)}
      </ul>
    </div>
  );
};

export const Stat = ({ label, value, foot, alert }) => (
  <div className={`a-stat ${alert ? 'is-alert' : ''}`}>
    <div className="label">{label}</div>
    <div className="value">{value}</div>
    {foot ? <div className="foot">{foot}</div> : null}
  </div>
);

export const Panel = ({ title, action, children, flush = false, className = '' }) => (
  <section className={`a-panel ${flush ? 'flush' : ''} ${className}`}>
    {title || action ? (
      <div className="a-panel-head">
        <h2>{title}</h2>
        {action}
      </div>
    ) : null}
    {children}
  </section>
);
