import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { api, getToken, setToken } from './api.js';

const AuthContext = createContext(null);

/**
 * The signed-in account, and the churches it may act for.
 *
 * `memberships` is what decides whether the church console is offered at all.
 * Authority over a church is a relationship, not a property of the account, so
 * it arrives alongside the user rather than on it.
 */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [memberships, setMemberships] = useState([]);
  const [ready, setReady] = useState(false);

  const adopt = useCallback((session) => {
    if (session?.token) setToken(session.token);
    setUser(session?.user ?? null);
    setMemberships(session?.memberships ?? []);
    return session?.user ?? null;
  }, []);

  useEffect(() => {
    const requestedToken = getToken();
    if (!requestedToken) {
      setReady(true);
      return;
    }
    api
      .get('/auth/me')
      .then((session) => {
        if (getToken() !== requestedToken) return;
        setUser(session.user);
        setMemberships(session.memberships ?? []);
      })
      .catch(() => {
        if (getToken() === requestedToken) setToken(null);
      })
      .finally(() => setReady(true));
  }, []);

  const signup = useCallback(async (payload) => adopt(await api.post('/auth/signup', payload)), [adopt]);
  const registerChurch = useCallback(async (payload) => {
    const session = await api.post('/auth/church-register', payload);
    adopt(session);
    return session;
  }, [adopt]);
  const login = useCallback(async (payload) => {
    const session = await api.post('/auth/login', payload);
    adopt(session);
    return session;
  }, [adopt]);

  const refresh = useCallback(async () => {
    const session = await api.get('/auth/me');
    setUser(session.user);
    setMemberships(session.memberships ?? []);
    return session;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setMemberships([]);
  }, []);

  const value = useMemo(
    () => ({
      user,
      memberships,
      ready,
      signup,
      registerChurch,
      login,
      logout,
      refresh,
      adopt,
      setUser,
      isPlatformAdmin: user?.role === 'platform_admin',
      // The church whose console to offer. Most people administer exactly one.
      primaryChurch: memberships[0] ?? null,
      can: (churchSlug, permission) => {
        if (user?.role === 'platform_admin') return true;
        const membership = memberships.find((m) => m.churchSlug === churchSlug);
        if (!membership) return false;
        return membership.permissions.includes('*') || membership.permissions.includes(permission);
      },
    }),
    [user, memberships, ready, signup, registerChurch, login, logout, refresh, adopt],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
