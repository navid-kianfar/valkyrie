export type SourceStatus = "ok" | "warn" | "err" | "off";

export interface SourceDto {
  id: number;
  name: string;
  group: string;
  host: string;
  port: number;
  username: string | null;
  mode: "standalone" | "replica" | "cluster" | "sentinel";
  tls: boolean;
  readOnly: boolean;
  guardDangerous: boolean;
  scanCount: number;
  status: SourceStatus;
  lastError?: string;
  version?: string;
  role?: string;
}

export interface KeyspaceEntry { db: number; keys: number; expires: number; avgTtl: number; }

export interface SourceStats {
  status: SourceStatus;
  engine?: string;
  lastError?: string;
  latencyMs?: number;
  version?: string;
  role?: string;
  mode?: string;
  usedMemory: number;
  maxMemory: number;
  memFragmentation: number;
  connectedClients: number;
  blockedClients: number;
  connectedReplicas?: number;
  opsPerSec: number;
  hitRate: number;
  uptimeDays: number;
  totalKeys: number;
  keyspace: KeyspaceEntry[];
  /** Recent usedMemory samples, oldest → newest. Present on the source list only. */
  spark?: number[];
}

export interface KeySummary { name: string; type: string; ttl: number; memory: number | null; }
export interface KeyDetail { name: string; type: string; ttl: number; memory: number | null; value: unknown; length?: number; }
export interface BulkJobDto {
  id: string; sourceId: number; kind: "delete" | "expire";
  status: "running" | "done" | "cancelled" | "failed";
  matched: number; processed: number; errors: number;
  startedAt: number; finishedAt?: number;
}
export interface ActivityDto {
  id: number; at: string; operation: string; target: string;
  sourceId: number | null; sourceName: string | null; via: string; status: string; durationMs: number | null;
}
