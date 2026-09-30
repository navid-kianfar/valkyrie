import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import Redis from 'ioredis';
import type { RedisLike } from '../redis/redis-connections.service';
import { SourcesService } from '../sources/sources.service';
import { RedisConnectionsService } from '../redis/redis-connections.service';
import { ActivityService } from '../activity/activity.service';
import { SettingsService } from '../settings/settings.module';

const MAX_ITEMS = 1000;
const WRITE_COMMANDS = new Set(['APPEND','DECR','DECRBY','DEL','EXPIRE','EXPIREAT','FLUSHALL','FLUSHDB','GETDEL','GETSET','HDEL','HSET','HSETNX','INCR','INCRBY','INCRBYFLOAT','LINSERT','LPOP','LPUSH','LPUSHX','LREM','LSET','LTRIM','MSET','PERSIST','PEXPIRE','PSETEX','RENAME','RENAMENX','RPOP','RPUSH','RPUSHX','SADD','SET','SETNX','SETRANGE','SINTERSTORE','SREM','UNLINK','XADD','XDEL','XTRIM','ZADD','ZINCRBY','ZPOPMAX','ZPOPMIN','ZREM','ZREMRANGEBYRANK','ZREMRANGEBYSCORE']);

@Injectable()
export class KeysService {
  constructor(
    private sources: SourcesService,
    private connections: RedisConnectionsService,
    private activity: ActivityService,
    private settings: SettingsService,
  ) {}


  private jsonSafe(value: unknown): unknown {
    if (Buffer.isBuffer(value)) return value.toString('utf8');
    if (Array.isArray(value)) return value.map((v) => this.jsonSafe(v));
    if (value instanceof Date) return value.toISOString();
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = this.jsonSafe(v);
      return out;
    }
    return value;
  }

  async scan(sourceId: number, db: number, params: { cursor?: number; match?: string; type?: string; count?: number }) {
    const row = await this.sources.get(sourceId);
    const conn = await this.connections.connFor(row, db);
    const args = [String(params.cursor ?? 0), 'MATCH', params.match || '*', 'COUNT', String(Math.min(5000, params.count ?? row.scanCount))];
    if (params.type) args.push('TYPE', params.type);
    const result = (await conn.call('SCAN', ...args)) as [string, string[]];
    const names = result[1];
    const pipe = (conn as Redis).pipeline();
    for (const name of names) {
      pipe.call('TYPE', name);
      pipe.call('TTL', name);
      pipe.call('MEMORY', 'USAGE', name);
    }
    const meta = (names.length ? await pipe.exec() : []) ?? [];
    const keys = names.map((name, i) => {
      const type = String(meta[i * 3]?.[1] ?? 'none');
      const ttl = Number(meta[i * 3 + 1]?.[1] ?? -2);
      const mem = meta[i * 3 + 2]?.[1];
      return { name, type, ttl, memory: typeof mem === 'number' ? mem : null };
    });
    return { cursor: Number(result[0]), keys };
  }

  async preview(sourceId: number, db: number, params: { match?: string; type?: string; limit?: number }) {
    const limit = Math.min(5000, params.limit ?? 2000);
    let cursor = 0;
    const names: string[] = [];
    do {
      const page = await this.scan(sourceId, db, { cursor, match: params.match || '*', type: params.type, count: Math.min(1000, limit - names.length) });
      cursor = page.cursor;
      names.push(...page.keys.map((k) => k.name));
    } while (cursor !== 0 && names.length < limit);
    const metaRows = await this.enrich(sourceId, db, names.slice(0, 50));
    return { matched: names.length, truncated: names.length >= limit, sample: metaRows };
  }

  private async enrich(sourceId: number, db: number, names: string[]) {
    const row = await this.sources.get(sourceId);
    const conn = await this.connections.connFor(row, db);
    const pipe = (conn as Redis).pipeline();
    for (const name of names) {
      pipe.call('TYPE', name);
      pipe.call('TTL', name);
      pipe.call('MEMORY', 'USAGE', name);
    }
    const meta = (names.length ? await pipe.exec() : []) ?? [];
    return names.map((name, i) => ({
      name, type: String(meta[i * 3]?.[1] ?? 'none'), ttl: Number(meta[i * 3 + 1]?.[1] ?? -2),
      memory: typeof meta[i * 3 + 2]?.[1] === 'number' ? (meta[i * 3 + 2][1] as number) : null,
    }));
  }

  async get(sourceId: number, db: number, name: string) {
    const row = await this.sources.get(sourceId);
    const conn = await this.connections.connFor(row, db);
    const type = String(await conn.call('TYPE', name));
    if (type === 'none') throw new NotFoundException(`Key "${name}" not found`);
    const ttl = Number(await conn.call('TTL', name));
    let memory: number | null = null;
    try { memory = Number(await conn.call('MEMORY', 'USAGE', name)); } catch { memory = null; }
    let value: unknown;
    let length: number | undefined;
    switch (type) {
      case 'string': {
        const raw = (await conn.call('GET', name)) as unknown;
        const text = Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw ?? '');
        length = text.length;
        value = text;
        break;
      }
      case 'hash': {
        const flat = await (conn as Redis).hgetall(name);
        value = flat;
        length = Object.keys(flat).length;
        break;
      }
      case 'list': {
        const items = (await conn.call('LRANGE', name, 0, MAX_ITEMS - 1)) as unknown[];
        value = items.map((v) => this.jsonSafe(v));
        length = Number(await conn.call('LLEN', name));
        break;
      }
      case 'set': {
        const members = (await conn.call('SMEMBERS', name)) as unknown[];
        value = members.map((v) => this.jsonSafe(v));
        length = Number(await conn.call('SCARD', name));
        break;
      }
      case 'zset': {
        const flat = (await conn.call('ZRANGE', name, 0, MAX_ITEMS - 1, 'WITHSCORES')) as unknown[];
        value = this.pairScores(flat);
        length = Number(await conn.call('ZCARD', name));
        break;
      }
      case 'stream': {
        const entries = (await conn.call('XRANGE', name, '-', '+', 'COUNT', MAX_ITEMS)) as unknown[];
        value = entries.map((entry) => {
          const e = entry as [string, unknown[]];
          const fields: Record<string, string> = {};
          for (let i = 0; i < e[1].length; i += 2) fields[String(e[1][i])] = String(e[1][i + 1]);
          return { id: e[0], fields };
        });
        length = Number(await conn.call('XLEN', name));
        break;
      }
      default:
        value = `[unsupported type: ${type}]`;
    }
    return { name, type, ttl, memory, value, length };
  }

  private pairScores(flat: unknown[]): { member: string; score: number }[] {
    const out: { member: string; score: number }[] = [];
    for (let i = 0; i < flat.length; i += 2) out.push({ member: String(flat[i]), score: Number(flat[i + 1]) });
    return out;
  }

  private normalizeCreate(type: string, value: unknown): unknown {
    if (type === 'string' && typeof value === 'object') return JSON.stringify(value);
    if (type === 'hash' && !Array.isArray(value)) return Object.entries(value as Record<string, string>);
    return value;
  }

  private async writeValue(conn: Redis, name: string, type: string, value: unknown) {
    switch (type) {
      case 'string': await conn.call('SET', name, String(value)); break;
      case 'hash': {
        const entries = value as [string, string][];
        if (!Array.isArray(entries) || entries.length === 0) throw new BadRequestException('hash value must be a non-empty object');
        const flat = entries.flatMap(([f, v]) => [f, String(v)]);
        await conn.call('HSET', name, ...flat);
        break;
      }
      case 'list': {
        const items = value as unknown[];
        if (!Array.isArray(items) || items.length === 0) throw new BadRequestException('list value must be a non-empty array');
        await conn.call('RPUSH', name, ...items.map(String));
        break;
      }
      case 'set': {
        const members = value as unknown[];
        if (!Array.isArray(members) || members.length === 0) throw new BadRequestException('set value must be a non-empty array');
        await conn.call('SADD', name, ...members.map(String));
        break;
      }
      case 'zset': {
        const entries = value as [string, number][];
        if (!Array.isArray(entries) || entries.length === 0) throw new BadRequestException('zset value must be an array of [member, score] pairs');
        const flat = entries.flatMap(([member, score]) => [String(score), String(member)]);
        await conn.call('ZADD', name, ...flat);
        break;
      }
      case 'stream': {
        const fields = value as Record<string, string>;
        if (!fields || typeof fields !== 'object') throw new BadRequestException('stream value must be an object of field/value pairs');
        const flat = Object.entries(fields).flatMap(([f, v]) => [f, String(v)]);
        await conn.call('XADD', name, '*', ...flat);
        break;
      }
      default:
        throw new BadRequestException(`Cannot create keys of type "${type}"`);
    }
  }

  async create(sourceId: number, db: number, dto: { name: string; type: string; ttl?: number; value?: unknown }, via: string) {
    const row = await this.sources.get(sourceId);
    if (row.readOnly) throw new BadRequestException('Source is in read-only mode');
    const conn = (await this.connections.connFor(row, db)) as Redis;
    if (Number(await conn.call('EXISTS', dto.name))) throw new ConflictException(`Key "${dto.name}" already exists`);
    const value = this.normalizeCreate(dto.type, dto.value ?? null);
    await this.writeValue(conn, dto.name, dto.type, value);
    if (dto.ttl && dto.ttl > 0) await conn.call('EXPIRE', dto.name, String(dto.ttl));
    this.activity.record({ operation: 'key.create', target: dto.name, sourceId: row.id, via: 'web' });
    return { created: true };
  }

  async update(sourceId: number, db: number, name: string, dto: { type: string; value?: unknown }, via: string) {
    const row = await this.sources.get(sourceId);
    if (row.readOnly) throw new BadRequestException('Source is in read-only mode');
    const conn = (await this.connections.connFor(row, db)) as Redis;
    const type = String(await conn.call('TYPE', name));
    if (type === 'none') throw new NotFoundException(`Key "${name}" not found`);
    if (type !== dto.type) throw new BadRequestException(`Key is of type "${type}", not "${dto.type}"`);
    const ttl = Number(await conn.call('TTL', name));
    if (type === 'string') {
      const value = typeof dto.value === 'object' ? JSON.stringify(dto.value) : String(dto.value);
      await conn.call('SET', name, value, 'KEEPTTL');
    } else {
      await conn.call('DEL', name);
      const value = this.normalizeCreate(dto.type, dto.value);
      await this.writeValue(conn, name, dto.type, value);
      if (ttl > 0) await conn.call('EXPIRE', name, String(ttl));
    }
    this.activity.record({ operation: 'key.update', target: name, sourceId: row.id, via: "web" });
    return { updated: true };
  }

  async remove(sourceId: number, db: number, name: string, via: string) {
    const row = await this.sources.get(sourceId);
    if (row.readOnly) throw new BadRequestException('Source is in read-only mode');
    const conn = await this.connections.connFor(row, db);
    const deleted = Number(await conn.call('DEL', name));
    if (!deleted) throw new NotFoundException(`Key "${name}" not found`);
    this.activity.record({ operation: 'key.delete', target: name, sourceId: row.id, via: "web" });
    return { deleted: true };
  }

  async setTtl(sourceId: number, db: number, name: string, ttl: number, via: string) {
    const row = await this.sources.get(sourceId);
    if (row.readOnly) throw new BadRequestException('Source is in read-only mode');
    const conn = await this.connections.connFor(row, db);
    if (!Number(await conn.call('EXISTS', name))) throw new NotFoundException(`Key "${name}" not found`);
    if (ttl > 0) await conn.call('EXPIRE', name, String(ttl));
    else await conn.call('PERSIST', name);
    this.activity.record({ operation: 'key.ttl', target: `${name} → ${ttl > 0 ? `${ttl}s` : 'persist'}`, sourceId: row.id, via: "web" });
    return { ttl };
  }

  async rename(sourceId: number, db: number, from: string, to: string, via: string) {
    const row = await this.sources.get(sourceId);
    if (row.readOnly) throw new BadRequestException('Source is in read-only mode');
    const conn = await this.connections.connFor(row, db);
    if (!Number(await conn.call('EXISTS', from))) throw new NotFoundException(`Key "${from}" not found`);
    if (Number(await conn.call('EXISTS', to))) throw new ConflictException(`Key "${to}" already exists`);
    await conn.call('RENAME', from, to);
    this.activity.record({ operation: 'key.rename', target: `${from} → ${to}`, sourceId: row.id, via: "web" });
    return { renamed: true };
  }

  async exec(sourceId: number, db: number, command: string, via: string) {
    const row = await this.sources.get(sourceId);
    const tokens = tokenize(command);
    if (tokens.length === 0) throw new BadRequestException('Empty command');
    const cmd = tokens[0].toUpperCase();
    if (row.guardDangerous && ['FLUSHDB', 'FLUSHALL', 'SHUTDOWN', 'SLAVEOF', 'REPLICAOF', 'ACL', 'MODULE'].includes(cmd)) {
      this.activity.record({ operation: 'exec', target: tokens.join(' '), sourceId: row.id, via, status: 'blocked', detail: 'blocked by dangerous-command guard' });
      throw new BadRequestException(`"${cmd}" is blocked by the dangerous-command guard. Use bulk operations instead.`);
    }
    if (row.readOnly && WRITE_COMMANDS.has(cmd)) {
      this.activity.record({ operation: 'exec', target: tokens.join(' '), sourceId: row.id, via, status: 'blocked', detail: 'read-only source' });
      throw new BadRequestException(`"${cmd}" is a write command and this source is read-only.`);
    }
    const conn = await this.connections.connFor(row, db);
    const t0 = Date.now();
    const raw = await conn.call(cmd, ...tokens.slice(1));
    const durationMs = Date.now() - t0;
    /* Settings → General decides whether arguments are recorded alongside the command. */
    const target = this.settings.read().logCommands ? tokens.join(' ').slice(0, 200) : cmd;
    this.activity.record({ operation: 'exec', target, sourceId: row.id, via, durationMs });
    return { result: this.jsonSafe(raw), durationMs };
  }

  async export(sourceId: number, db: number, params: { match?: string; format?: string; limit?: number }, res: import('express').Response) {
    const format = params.format || 'json';
    const limit = Math.min(50000, params.limit ?? 10000);
    const row = await this.sources.get(sourceId);
    const conn = (await this.connections.connFor(row, db)) as Redis;
    res.setHeader('Content-Disposition', `attachment; filename="valkyrie-export-db${db}.${format}"`);
    res.setHeader('Content-Type', format === 'json' ? 'application/json' : format === 'csv' ? 'text/csv' : 'application/octet-stream');
    let cursor = 0;
    let count = 0;
    if (format === 'json') res.write('[');
    do {
      const page = await this.scan(sourceId, db, { cursor, match: params.match || '*', count: 200 });
      cursor = page.cursor;
      for (const key of page.keys) {
        if (count >= limit) break;
        let value: unknown = null;
        try { const detail = await this.get(sourceId, db, key.name); value = detail.value; } catch { value = null; }
        if (format === 'json') {
          res.write((count > 0 ? ',' : '') + JSON.stringify({ name: key.name, type: key.type, ttl: key.ttl, value }));
        } else if (format === 'csv') {
          res.write(`${JSON.stringify(key.name)},${key.type},${key.ttl},${JSON.stringify(JSON.stringify(value))}\n`);
        } else {
          res.write(respEncode([key.name, key.type, key.ttl, value]));
        }
        count++;
      }
    } while (cursor !== 0 && count < limit);
    if (format === 'json') res.write(']');
    res.end();
    this.activity.record({ operation: 'export', target: `${params.match || '*'} (${count} keys)`, sourceId: row.id, via: "web" });
    return { exported: count };
  }
}

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  const re = /"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input))) {
    const token = m[1] ?? m[2] ?? m[3] ?? '';
    tokens.push(token.replace(/\\(.)/g, '$1'));
  }
  return tokens;
}

function respEncode(value: unknown): string {
  if (value === null || value === undefined) return '$-1\r\n';
  if (typeof value === 'number') return `:${value}\r\n`;
  if (typeof value === 'string' || Buffer.isBuffer(value)) {
    const s = Buffer.isBuffer(value) ? value.toString('utf8') : value;
    return `$${Buffer.byteLength(s)}\r\n${s}\r\n`;
  }
  if (typeof value === 'object') {
    const json = JSON.stringify(value);
    return `$${Buffer.byteLength(json)}\r\n${json}\r\n`;
  }
  return respEncode(String(value));
}
