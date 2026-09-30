import { createServer, type Server as NetServer } from 'node:net';
import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { Cluster } from 'ioredis';
import { Client as SshClient } from 'ssh2';
import type { SourceRow } from '../db/schema';
import { decryptSecret } from '../common/crypto.util';
import type { SourceStatus, SourceStats } from '@valkyrie/shared';

export interface SamplePoint { t: number; usedMemory: number; opsPerSec: number; hitRate: number; }
export interface Health { status: SourceStatus; lastError?: string; latencyMs?: number; }
interface Tunnel { server: NetServer; ssh: SshClient; }
export type RedisLike = Redis | Cluster;

export function parseInfo(raw: string) {
  const out: Record<string, string> = {};
  const dbs: Record<string, { keys: number; expires: number; avgTtl: number }> = {};
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx);
    const value = line.slice(idx + 1);
    if (/^db\d+$/.test(key)) {
      const m = /keys=(\d+),expires=(\d+)(?:,avg_ttl=(\d+))?/.exec(value);
      if (m) dbs[key] = { keys: Number(m[1]), expires: Number(m[2]), avgTtl: Number(m[3] || 0) };
      continue;
    }
    out[key] = value;
  }
  return { fields: out, dbs };
}

@Injectable()
export class RedisConnectionsService implements OnApplicationShutdown {
  private readonly logger = new Logger('RedisConnections');
  private readonly conns = new Map<string, RedisLike>();
  private readonly tunnels = new Map<number, Tunnel>();
  readonly health = new Map<number, Health>();
  readonly stats = new Map<number, SourceStats>();
  readonly history = new Map<number, SamplePoint[]>();

  constructor(private config: ConfigService) {}

  private secret(): string {
    return this.config.get<string>('JWT_SECRET') as string;
  }

  private secrets(source: SourceRow) {
    const dec = (v: string | null) => (v ? decryptSecret(v, this.secret()) : undefined);
    return { password: dec(source.password), sshPassword: dec(source.sshPassword) };
  }

  private async openTunnel(source: SourceRow): Promise<number> {
    const existing = this.tunnels.get(source.id);
    if (existing) return (existing.server.address() as { port: number }).port;
    const { sshPassword } = this.secrets(source);
    const ssh = new SshClient();
    await new Promise<void>((resolve, reject) => {
      ssh.once('ready', () => resolve());
      ssh.once('error', (err) => reject(new Error(`SSH tunnel failed: ${err.message}`)));
      ssh.connect({
        host: source.sshHost as string,
        port: source.sshPort || 22,
        username: source.sshUser as string,
        password: sshPassword,
        privateKey: source.sshPrivateKey || undefined,
        readyTimeout: 8000,
      });
    });
    const server = await new Promise<NetServer>((resolve, reject) => {
      const srv = createServer((sock) => {
        ssh.forwardOut('127.0.0.1', 0, source.host, source.port, (err, stream) => {
          if (err || !stream) { sock.destroy(); return; }
          sock.pipe(stream).pipe(sock);
        });
      });
      srv.once('error', reject);
      srv.listen(0, '127.0.0.1', () => resolve(srv));
    });
    const port = (server.address() as { port: number }).port;
    this.tunnels.set(source.id, { server, ssh });
    this.logger.log(`SSH tunnel for source ${source.id} (${source.name}) → 127.0.0.1:${port}`);
    return port;
  }

  async connFor(source: SourceRow, db = 0): Promise<RedisLike> {
    const key = `${source.id}:${db}`;
    const existing = this.conns.get(key);
    if (existing && existing.status !== "end" && existing.status !== "close") return existing;
    if (existing) this.conns.delete(key);
    const { password } = this.secrets(source);
    let host = source.host;
    let port = source.port;
    if (source.sshEnabled) {
      port = await this.openTunnel(source);
      host = '127.0.0.1';
    }
    const tls = source.tlsEnabled ? { rejectUnauthorized: !source.tlsSkipVerify } : undefined;
    const base = {
      password,
      connectTimeout: 6000,
      maxRetriesPerRequest: 2,
      retryStrategy: (attempts: number) => (attempts <= 2 ? Math.min(attempts * 500, 2000) : null),
    };
    let conn: RedisLike;
    if (source.mode === 'cluster') {
      conn = new Redis.Cluster([{ host, port }], { dnsLookup: (h, cb) => cb(null, h), redisOptions: { ...base, tls } });
    } else if (source.mode === 'sentinel') {
      conn = new Redis({ ...base, sentinels: [{ host, port }], name: source.sentinelMaster || 'mymaster', db, tls });
    } else {
      conn = new Redis({ ...base, host, port, db, tls });
    }
    conn.on('error', (err: Error) => {
      this.health.set(source.id, { status: 'err', lastError: err.message });
    });
    conn.on('end', () => {
      this.conns.delete(key);
      this.health.set(source.id, { status: 'err', lastError: 'connection closed' });
    });
    this.conns.set(key, conn);
    return conn;
  }

  drop(sourceId: number) {
    for (const [key, conn] of this.conns) {
      if (key.startsWith(`${sourceId}:`)) {
        this.conns.delete(key);
        try { conn.disconnect(); } catch { /* already closed */ }
      }
    }
    const tunnel = this.tunnels.get(sourceId);
    if (tunnel) {
      try { tunnel.server.close(); tunnel.ssh.end(); } catch { /* already closed */ }
      this.tunnels.delete(sourceId);
    }
    this.health.delete(sourceId);
    this.stats.delete(sourceId);
    this.history.delete(sourceId);
  }

  dropAll() {
    for (const [, conn] of this.conns) { try { conn.disconnect(); } catch { /* already closed */ } }
    this.conns.clear();
    for (const [, t] of this.tunnels) { try { t.server.close(); t.ssh.end(); } catch { /* already closed */ } }
    this.tunnels.clear();
  }

  onApplicationShutdown() {
    this.dropAll();
  }

  async probe(source: SourceRow) {
    try {
      const conn = await this.connFor(source, 0);
      const t0 = Date.now();
      await conn.ping();
      const latencyMs = Date.now() - t0;
      const { fields, dbs } = parseInfo(await this.callInfo(conn));
      this.health.set(source.id, { status: 'ok', latencyMs });
      const keyspace = Object.entries(dbs).map(([db, v]) => ({ db: Number(db.slice(2)), keys: v.keys, expires: v.expires, avgTtl: v.avgTtl })).sort((a, b) => a.db - b.db);
      return { ok: true as const, latencyMs, engine: fields.valkey_version ? 'valkey' : 'redis', version: fields.valkey_version || fields.redis_version, role: fields.role, mode: source.mode === 'cluster' ? 'cluster' : fields.redis_mode?.toLowerCase() || source.mode, keyspace };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.health.set(source.id, { status: 'err', lastError: message });
      return { ok: false as const, error: message };
    }
  }

  private async callInfo(conn: RedisLike): Promise<string> {
    if (conn instanceof Redis) return conn.info();
    const nodes = (conn as Cluster).nodes();
    const primary = nodes.find((n) => n.status === 'ready') || nodes[0];
    return primary.info();
  }

  async sample(source: SourceRow): Promise<SourceStats> {
    try {
      const conn = await this.connFor(source, 0);
      const t0 = Date.now();
      await conn.ping();
      const latencyMs = Date.now() - t0;
      const { fields, dbs } = parseInfo(await this.callInfo(conn));
      const hits = Number(fields.keyspace_hits || 0);
      const misses = Number(fields.keyspace_misses || 0);
      const keyspace = Object.entries(dbs).map(([db, v]) => ({ db: Number(db.slice(2)), keys: v.keys, expires: v.expires, avgTtl: v.avgTtl })).sort((a, b) => a.db - b.db);
      const stats: SourceStats = {
        status: 'ok',
        latencyMs,
        engine: fields.valkey_version ? 'valkey' : 'redis',
        version: fields.valkey_version || fields.redis_version,
        role: fields.role,
        mode: source.mode === 'cluster' ? 'cluster' : fields.redis_mode?.toLowerCase() || source.mode,
        usedMemory: Number(fields.used_memory || 0),
        maxMemory: Number(fields.maxmemory || 0),
        memFragmentation: Number(fields.mem_fragmentation_ratio || 0),
        connectedClients: Number(fields.connected_clients || 0),
        blockedClients: Number(fields.blocked_clients || 0),
        opsPerSec: Number(fields.instantaneous_ops_per_sec || 0),
        hitRate: hits + misses > 0 ? Math.round((hits / (hits + misses)) * 1000) / 10 : 0,
        uptimeDays: Math.floor(Number(fields.uptime_in_days || 0)),
        totalKeys: keyspace.reduce((sum, k) => sum + k.keys, 0),
        keyspace,
      };
      this.stats.set(source.id, stats);
      this.health.set(source.id, { status: 'ok', latencyMs });
      const hist = this.history.get(source.id) || [];
      hist.push({ t: Date.now(), usedMemory: stats.usedMemory, opsPerSec: stats.opsPerSec, hitRate: stats.hitRate });
      if (hist.length > 720) hist.shift();
      this.history.set(source.id, hist);
      return stats;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const stat: SourceStats = {
        status: 'err', lastError: message,
        usedMemory: 0, maxMemory: 0, memFragmentation: 0, connectedClients: 0, blockedClients: 0,
        opsPerSec: 0, hitRate: 0, uptimeDays: 0, totalKeys: 0, keyspace: [],
      };
      this.stats.set(source.id, stat);
      this.health.set(source.id, { status: 'err', lastError: message });
      return stat;
    }
  }

  statusOf(source: SourceRow): SourceStatus {
    const h = this.health.get(source.id);
    if (!h) return 'off';
    return h.status;
  }
}
