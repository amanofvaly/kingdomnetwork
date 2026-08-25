import { useCallback, useEffect, useState } from 'react';

import { api } from './api.js';

/**
 * Fetch `path` whenever it changes. Returns { data, error, loading, reload }.
 * Aborts the in-flight request when the path changes or the component unmounts.
 */
export const useApi = (path, { skip = false } = {}) => {
  const [state, setState] = useState({ data: null, error: null, loading: !skip });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (skip || !path) {
      setState({ data: null, error: null, loading: false });
      return undefined;
    }
    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));

    api
      .get(path, { signal: controller.signal })
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setState({ data: null, error: err, loading: false });
      });

    return () => controller.abort();
  }, [path, skip, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, reload };
};
