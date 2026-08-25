import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const CartContext = createContext(null);
const KEY = 'kn.cart';

const read = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((i) => i?.kind && i?.slug) : [];
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
