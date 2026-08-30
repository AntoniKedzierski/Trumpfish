import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as authApi from '@/api/auth';
import { setUnauthorizedHandler } from '@/api/client';
import type { CurrentUser } from '@/api/models';
import { AuthContext, type AuthContextValue } from './authContext';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  // The cookie is the session, so the current user is whatever the server says it is on load.
  useEffect(() => {
    let cancelled = false;
    authApi.getCurrentUser().then(
      (current) => { if (!cancelled) { setUser(current); setLoading(false); } },
      () => { if (!cancelled) { setUser(null); setLoading(false); } },
    );

    return () => { cancelled = true; };
  }, []);

  // A 401 from any later call means the cookie expired underneath us; dropping the user sends the guard to the login page.
  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    return () => setUnauthorizedHandler(null);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    setUser(await authApi.login(username, password));
  }, []);

  const register = useCallback(async (username: string, password: string, displayName: string | null) => {
    setUser(await authApi.register(username, password, displayName));
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({ user, loading, login, register, logout, applyUser: setUser }), [user, loading, login, register, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
