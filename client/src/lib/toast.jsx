import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { X } from 'lucide-react';

const ToastContext = createContext(null);

/**
 * Short confirmations for things that happened elsewhere on the page.
 *
 * Anything a person must read stays inline in a `.notice`; this is for "saved",
 * "invitation sent", "that failed" — the sort of message that should not steal
 * focus or need dismissing.
 */
export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => setToasts((all) => all.filter((t) => t.id !== id)), []);

  const push = useCallback((message, tone = 'plain') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((all) => [...all, { id, message, tone }]);
    // Errors stay long enough to be read twice; confirmations do not need to.
    setTimeout(() => dismiss(id), tone === 'bad' ? 7000 : 3500);
    return id;
  }, [dismiss]);

  const value = useMemo(
    () => ({
      toast: push,
      ok: (message) => push(message, 'good'),
      fail: (error) => push(typeof error === 'string' ? error : error?.message ?? 'Something went wrong.', 'bad'),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toasts.length ? (
        <div className="a-toasts" role="status" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={`a-toast ${t.tone === 'bad' ? 'is-bad' : t.tone === 'good' ? 'is-good' : ''}`}>
              <span>{t.message}</span>
              <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss">
                <X size={14} strokeWidth={2} />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
};
