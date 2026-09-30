import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, getToken, setToken } from '@/lib/api';

interface AuthCtx {
  user: string | null;
  ready: boolean;
  login: (username: string, password: string, remember: boolean) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    if (!getToken()) { setReady(true); return; }
    api.get<{ user: { username: string } }>('/auth/me')
      .then((res) => setUser(res.user.username))
      .catch(() => setToken(null))
      .finally(() => setReady(true));
  }, []);

  const login = useCallback(async (username: string, password: string, remember: boolean) => {
    const res = await api.post<{ accessToken: string; user: { name: string } }>('/auth/login', { username, password, remember });
    setToken(res.accessToken);
    setUser(res.user.name);
    qc.clear();
  }, [qc]);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    qc.clear();
    window.location.href = '/login';
  }, [qc]);

  return <Ctx.Provider value={{ user, ready, login, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth outside provider');
  return ctx;
}
