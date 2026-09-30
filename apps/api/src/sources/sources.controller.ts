import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { SourcesService } from './sources.service';
import { CreateSourceDto, ImportSourcesDto, ScanNetworkDto, SetConfigDto, TestSourceDto, UpdateSourceDto } from './dto/source.dto';
import { RedisConnectionsService } from '../redis/redis-connections.service';
import { ActivityService } from '../activity/activity.service';
import { BadRequestException } from '@nestjs/common';
import * as net from 'node:net';
import type { SourceDto } from '@valkyrie/shared';

@Controller('sources')
export class SourcesController {
  constructor(
    private sources: SourcesService,
    private connections: RedisConnectionsService,
    private activity: ActivityService,
  ) {}

  @Get()
  list() {
    return this.sources.list();
  }

  @Post('test')
  async testDraft(@Body() dto: TestSourceDto) {
    return this.sources.testDraft(dto);
  }

  @Post('scan')
  async scan(@Body() dto: ScanNetworkDto) {
    const hosts = expandCidr(dto.cidr);
    if (hosts.length === 0) throw new BadRequestException('cidr must be an IPv4 range like 10.0.0.0/24');
    const results: { host: string; port: number; open: boolean }[] = [];
    const queue = hosts.flatMap((h) => dto.ports.map((p) => ({ host: h, port: p })));
    let index = 0;
    const worker = async () => {
      while (index < queue.length) {
        const task = queue[index++];
        const open = await new Promise<boolean>((resolve) => {
          const sock = net.connect({ host: task.host, port: task.port });
          const done = (v: boolean) => { sock.destroy(); resolve(v); };
          sock.setTimeout(400, () => done(false));
          sock.once('connect', () => done(true));
          sock.once('error', () => done(false));
        });
        if (open) results.push({ ...task, open: true });
      }
    };
    await Promise.all(Array.from({ length: Math.min(64, queue.length || 1) }, worker));
    return { scanned: queue.length, open: results.sort((a, b) => a.host.localeCompare(b.host) || a.port - b.port) };
  }

  @Post('import')
  async import(@Body() dto: ImportSourcesDto) {
    const created: SourceDto[] = [];
    for (const item of dto.items) {
      try {
        created.push(await this.sources.create(item, 'web/import'));
      } catch { /* skip duplicates, keep importing */ }
    }
    return { imported: created.length, items: created };
  }

  @Get(':id/stats')
  async stats(@Param('id', ParseIntPipe) id: number) {
    const row = await this.sources.get(id);
    return this.sources.statsFor(row);
  }

  @Get(':id/databases')
  async databases(@Param('id', ParseIntPipe) id: number) {
    const row = await this.sources.get(id);
    const stats = this.connections.stats.get(row.id);
    const live = new Map((stats?.keyspace || []).map((k) => [k.db, k]));
    return Array.from({ length: row.visibleDbs }, (_, db) => ({
      db, keys: live.get(db)?.keys ?? 0, expires: live.get(db)?.expires ?? 0, avgTtl: live.get(db)?.avgTtl ?? 0,
    }));
  }

  @Get(':id/slowlog')
  async slowlog(@Param('id', ParseIntPipe) id: number, @Query('count') count?: string) {
    const row = await this.sources.get(id);
    const conn = await this.connections.connFor(row, 0);
    const raw = (await conn.call('SLOWLOG', 'GET', Math.min(128, Number(count) || 25))) as unknown[];
    return raw.map((entry) => {
      const e = entry as [number, number, number, unknown[], string, string];
      return { id: e[0], at: new Date(e[1] * 1000).toISOString(), durationMs: e[2] / 1000, args: e[3].map(String), client: e[4], name: e[5] };
    });
  }

  @Get(':id/clients')
  async clients(@Param('id', ParseIntPipe) id: number) {
    const row = await this.sources.get(id);
    const conn = await this.connections.connFor(row, 0);
    const raw = (await conn.call('CLIENT', 'LIST')) as string;
    return String(raw).split('\n').filter((l) => l.trim()).map((line) => {
      const out: Record<string, string> = {};
      for (const pair of line.trim().split(' ')) {
        const eq = pair.indexOf('=');
        if (eq > 0) out[pair.slice(0, eq)] = pair.slice(eq + 1);
      }
      return out;
    });
  }

  @Get(':id/config')
  async getConfig(@Param('id', ParseIntPipe) id: number, @Query('pattern') pattern?: string) {
    const row = await this.sources.get(id);
    const conn = await this.connections.connFor(row, 0);
    const raw = (await conn.call('CONFIG', 'GET', pattern || '*')) as unknown[];
    const out: { key: string; value: string }[] = [];
    for (let i = 0; i < raw.length; i += 2) out.push({ key: String(raw[i]), value: String(raw[i + 1]) });
    return out;
  }

  @Patch(':id/config')
  async setConfig(@Param('id', ParseIntPipe) id: number, @Body() dto: SetConfigDto) {
    const row = await this.sources.get(id);
    const conn = await this.connections.connFor(row, 0);
    const applied: string[] = [];
    for (const [key, value] of Object.entries(dto.entries)) {
      await conn.call('CONFIG', 'SET', key, value);
      applied.push(key);
    }
    this.activity.record({ operation: 'config.set', target: applied.join(', '), sourceId: row.id, via: 'web' });
    return { applied };
  }

  @Get(':id')
  async get(@Param('id', ParseIntPipe) id: number) {
    const row = await this.sources.get(id);
    return {
      ...this.sources.list().find((s) => s.id === id),
      row: {
        sshEnabled: !!row.sshEnabled, sshHost: row.sshHost, sshPort: row.sshPort, sshUser: row.sshUser,
        sentinelMaster: row.sentinelMaster, tlsEnabled: !!row.tlsEnabled, tlsSkipVerify: !!row.tlsSkipVerify,
        tlsCaCert: row.tlsCa, tlsSni: row.tlsSni, visibleDbs: row.visibleDbs,
      },
    };
  }

  @Post()
  async create(@Body() dto: CreateSourceDto) {
    return this.sources.create(dto, 'web');
  }

  @Post(':id/test')
  async testSaved(@Param('id', ParseIntPipe) id: number) {
    return this.sources.testSaved(id);
  }

  @Patch(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSourceDto) {
    return this.sources.update(id, dto, 'web');
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.sources.remove(id, 'web');
    return { removed: true };
  }
}

export function expandCidr(cidr: string): string[] {
  const m = /^(\d{1,3}(?:\.\d{1,3}){3})(?:\/(\d{1,2}))?$/.exec(cidr);
  if (!m) return [];
  const base = m[1].split('.').map(Number);
  if (base.some((n) => n > 255)) return [];
  const bits = m[2] === undefined ? 32 : Number(m[2]);
  if (bits < 24 || bits > 32) return [];
  const baseInt = ((base[0] << 24) | (base[1] << 16) | (base[2] << 8) | base[3]) >>> 0;
  const size = 2 ** (32 - bits);
  if (size > 65536) return [];
  const out: string[] = [];
  for (let i = 0; i < size; i++) {
    const n = (baseInt + i) >>> 0;
    out.push([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.'));
  }
  return out;
}
