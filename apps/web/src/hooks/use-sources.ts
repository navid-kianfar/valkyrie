import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { SourceDto, SourceStats } from '@valkyrie/shared';

export type SourceWithStats = SourceDto & { stats: SourceStats };
export const SOURCE_POLL_MS = 5000;

export function useSources() {
  return useQuery({
    queryKey: ['sources'],
    queryFn: () => api.get<SourceWithStats[]>('/sources'),
    refetchInterval: SOURCE_POLL_MS,
  });
}

export function useSource(id: number | null) {
  return useQuery({
    queryKey: ['source', id],
    queryFn: () => api.get<SourceWithStats & { row: { sshEnabled: boolean; sshHost: string | null; sshPort: number; sshUser: string | null; sentinelMaster: string | null; tlsEnabled: boolean; tlsSkipVerify: boolean; visibleDbs: number } }>(`/sources/${id}`),
    refetchInterval: SOURCE_POLL_MS,
    enabled: id !== null,
  });
}

export function useSourceStats(id: number) {
  return useQuery({
    queryKey: ['source-stats', id],
    queryFn: () => api.get<SourceStats & { history: { t: number; usedMemory: number; opsPerSec: number; hitRate: number }[] }>(`/sources/${id}/stats`),
    refetchInterval: SOURCE_POLL_MS,
  });
}

export function useMeta() {
  return useQuery({ queryKey: ['meta'], queryFn: () => api.get<{ name: string; version: string }>('/meta'), staleTime: Infinity });
}

export function engineOf(source: SourceWithStats | { stats: SourceStats }): 'R' | 'V' {
  return source.stats.engine === 'valkey' ? 'V' : 'R';
}
