import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, getToken } from '@/lib/api';

/** Preferences that live on the server (shared by every browser). */
export interface ServerSettings {
  logCommands: boolean;
  pollSeconds: number;
}

/** Preferences that live in this browser only. */
export interface LocalPreferences {
  consoleLabel: string;
  sessionTimeout: SessionTimeout;
  scanCount: number;
  pageSize: number;
  defaultTtl: number;
  valuePreviewKb: number;
  compact: boolean;
}

export type SessionTimeout = '8h' | '24h' | '30d';

const LOCAL_DEFAULTS: LocalPreferences = {
  consoleLabel: '',
  sessionTimeout: '30d',
  scanCount: 200,
  pageSize: 50,
  defaultTtl: 0,
  valuePreviewKb: 10,
  compact: false,
};

const KEY = 'valkyrie.prefs';

function readLocal(): LocalPreferences {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...LOCAL_DEFAULTS, ...(JSON.parse(raw) as Partial<LocalPreferences>) } : LOCAL_DEFAULTS;
  } catch {
    return LOCAL_DEFAULTS;
  }
}

interface PreferencesCtx {
  local: LocalPreferences;
  setLocal: <K extends keyof LocalPreferences>(key: K, value: LocalPreferences[K]) => void;
  server: ServerSettings;
  setServer: (patch: Partial<ServerSettings>) => void;
  serverReady: boolean;
}

const Ctx = createContext<PreferencesCtx | null>(null);

export const SERVER_SETTINGS_FALLBACK: ServerSettings = { logCommands: true, pollSeconds: 5 };

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [local, setLocalState] = useState<LocalPreferences>(readLocal);

  const { data: server, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<ServerSettings>('/settings'),
    staleTime: 30_000,
    enabled: getToken() !== null,
  });

  const mutation = useMutation({
    mutationFn: (patch: Partial<ServerSettings>) => api.put<ServerSettings>('/settings', patch),
    onSuccess: (next) => qc.setQueryData(['settings'], next),
  });

  /* Compact density is applied by tightening the base size and table padding. */
  useEffect(() => {
    document.documentElement.classList.toggle('compact', local.compact);
  }, [local.compact]);

  const setLocal = useCallback<PreferencesCtx['setLocal']>((key, value) => {
    setLocalState((prev) => {
      const next = { ...prev, [key]: value };
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const setServer = useCallback((patch: Partial<ServerSettings>) => {
    mutation.mutate(patch);
  }, [mutation]);

  const value = useMemo<PreferencesCtx>(
    () => ({ local, setLocal, server: server ?? SERVER_SETTINGS_FALLBACK, setServer, serverReady: !isLoading }),
    [local, setLocal, server, setServer, isLoading],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePreferences(): PreferencesCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePreferences outside provider');
  return ctx;
}
