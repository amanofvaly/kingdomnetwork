import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const CartContext = createContext(null);
const KEY = 'kn.cart';

/**
 * Only materials go in the basket. A credential offering is applied for, never
 * bought, and `/cart/price` refuses to price one — so anything else stored here
 * would count towards the badge while never appearing on the basket page.
 */
const KINDS = new Set(['course', 'resource']);
const usable = (i) => KINDS.has(i?.kind) && typeof i?.slug === 'string' && i.slug !== '';

const read = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter(usable) : [];
  } catch {
    return [];
  }
};

export const CartProvider = ({ children }) => {
  const [items, setItems] = useState(read);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(items));
  }, [items]);

  const has = useCallback((kind, slug) => items.some((i) => i.kind === kind && i.slug === slug), [items]);

  const add = useCallback((item) => {
    if (!usable(item)) return;
    setItems((prev) =>
      prev.some((i) => i.kind === item.kind && i.slug === item.slug) ? prev : [...prev, item],
    );
  }, []);

  const remove = useCallback((kind, slug) => {
    setItems((prev) => prev.filter((i) => !(i.kind === kind && i.slug === slug)));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo(() => ({ items, count: items.length, has, add, remove, clear }), [items, has, add, remove, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
};
