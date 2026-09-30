import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { usePreferences } from '@/providers/preferences';
import type { SourceDto, SourceStats } from '@valkyrie/shared';

export type SourceWithStats = SourceDto & { stats: SourceStats };

export type SourceStatsWithHistory = SourceStats & { history: { t: number; usedMemory: number; opsPerSec: number; hitRate: number }[] };

export interface SourceConnectionRow {
  sshEnabled: boolean;
  sshHost: string | null;
  sshPort: number;
  sshUser: string | null;
  sentinelMaster: string | null;
  tlsEnabled: boolean;
  tlsSkipVerify: boolean;
  tlsCaCert: string | null;
  tlsSni: string | null;
  visibleDbs: number;
}

export type SourceDetail = SourceWithStats & { row: SourceConnectionRow };

/** Polling cadence mirrors the server's own health-poll setting (0 = manual only). */
export function usePollMs(): number | false {
  const { server } = usePreferences();
  return server.pollSeconds > 0 ? server.pollSeconds * 1000 : false;
}

export function useSources() {
  const pollMs = usePollMs();
  return useQuery({
    queryKey: ['sources'],
    queryFn: () => api.get<SourceWithStats[]>('/sources'),
    refetchInterval: pollMs,
  });
}

export function useSource(id: number | null) {
  const pollMs = usePollMs();
  return useQuery({
    queryKey: ['source', id],
    queryFn: () => api.get<SourceDetail>(`/sources/${id}`),
    refetchInterval: pollMs,
    enabled: id !== null,
  });
}

export function useSourceStats(id: number) {
  const pollMs = usePollMs();
  return useQuery({
    queryKey: ['source-stats', id],
    queryFn: () => api.get<SourceStatsWithHistory>(`/sources/${id}/stats`),
    refetchInterval: pollMs,
  });
}

export function useMeta() {
  return useQuery({ queryKey: ['meta'], queryFn: () => api.get<{ name: string; version: string }>('/meta'), staleTime: Infinity });
}

export function engineOf(source: SourceWithStats | { stats: SourceStats }): 'R' | 'V' {
  return source.stats.engine === 'valkey' ? 'V' : 'R';
}
