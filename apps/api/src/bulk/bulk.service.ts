import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import Redis from 'ioredis';
import { SourcesService } from '../sources/sources.service';
import { RedisConnectionsService } from '../redis/redis-connections.service';
import { ActivityService } from '../activity/activity.service';
import type { BulkJobDto } from '@valkyrie/shared';

interface Job extends BulkJobDto { cancelFlag: boolean; }

@Injectable()
export class BulkService {
  private readonly jobs = new Map<string, Job>();

  constructor(
    private sources: SourcesService,
    private connections: RedisConnectionsService,
    private activity: ActivityService,
  ) {}

  get(jobId: string): Job {
    const job = this.jobs.get(jobId);
    if (!job) throw new NotFoundException(`Job ${jobId} not found`);
    return job;
  }

  cancel(jobId: string) {
    const job = this.get(jobId);
    if (job.status === 'running') job.cancelFlag = true;
    return { cancelled: job.cancelFlag, status: job.status };
  }

  listRecent(): Job[] {
    return [...this.jobs.values()].sort((a, b) => b.startedAt - a.startedAt).slice(0, 20);
  }

  async startDelete(sourceId: number, dto: { db?: number; pattern?: string; type?: string; onlyTtl?: boolean; batchSize?: number }): Promise<BulkJobDto> {
    const row = await this.sources.get(sourceId);
    if (row.readOnly) throw new Error('Source is in read-only mode');
    const db = dto.db ?? 0;
    const conn = (await this.connections.connFor(row, db)) as Redis;
    const job: Job = {
      id: randomUUID(), sourceId, kind: 'delete', status: 'running',
      matched: 0, processed: 0, errors: 0, startedAt: Date.now(), cancelFlag: false,
    };
    this.jobs.set(job.id, job);
    void this.runDelete(job, conn, row.id, row.name, db, dto);
    return this.publicView(job);
  }

  async startExpire(sourceId: number, dto: { db?: number; pattern?: string; type?: string; ttl: number; batchSize?: number }): Promise<BulkJobDto> {
    const row = await this.sources.get(sourceId);
    if (row.readOnly) throw new Error('Source is in read-only mode');
    if (!dto.ttl || dto.ttl <= 0) throw new Error('ttl must be a positive number of seconds');
    const db = dto.db ?? 0;
    const conn = (await this.connections.connFor(row, db)) as Redis;
    const job: Job = {
      id: randomUUID(), sourceId, kind: 'expire', status: 'running',
      matched: 0, processed: 0, errors: 0, startedAt: Date.now(), cancelFlag: false,
    };
    this.jobs.set(job.id, job);
    void this.runExpire(job, conn, row.id, row.name, db, dto);
    return this.publicView(job);
  }

  private publicView(job: Job): BulkJobDto {
    const { cancelFlag, ...rest } = job;
    void cancelFlag;
    return rest;
  }

  private async scanKeys(conn: Redis, db: number, dto: { pattern?: string; type?: string; batchSize?: number }, onBatch: (keys: string[]) => Promise<void>) {
    let cursor = '0';
    do {
      const args = [cursor, 'MATCH', dto.pattern || '*', 'COUNT', String(dto.batchSize ?? 500)];
      if (dto.type) args.push('TYPE', dto.type);
      const result = (await conn.call('SCAN', ...args)) as [string, string[]];
      cursor = result[0];
      if (result[1].length) await onBatch(result[1]);
    } while (cursor !== '0');
  }

  private async runDelete(job: Job, conn: Redis, sourceId: number, sourceName: string, db: number, dto: { pattern?: string; type?: string; onlyTtl?: boolean; batchSize?: number }) {
    const t0 = Date.now();
    try {
      await this.scanKeys(conn, db, dto, async (keys) => {
        let batch = keys;
        if (dto.onlyTtl) {
          const pipe = conn.pipeline();
          for (const key of keys) pipe.call('TTL', key);
          const res = (await pipe.exec()) ?? [];
          batch = keys.filter((_, i) => Number(res[i]?.[1]) > 0);
        }
        if (batch.length === 0) return;
        const pipe = conn.pipeline();
        for (const key of batch) pipe.call('DEL', key);
        const res = (await pipe.exec()) ?? [];
        for (const r of res) { if (r[0]) job.errors++; else job.processed += Number(r[1]) || 1; }
        job.matched = job.processed;
        if (job.cancelFlag) job.status = 'cancelled';
      });
      if (job.status === 'running') job.status = 'done';
    } catch (err) {
      job.status = 'failed';
      job.errors++;
      this.activity.record({ operation: 'bulk.delete', target: `${dto.pattern || '*'} on ${sourceName}/db${db}`, sourceId, via: 'web', status: 'failed', detail: err instanceof Error ? err.message : String(err) });
      return;
    }
    job.finishedAt = Date.now();
    this.activity.record({
      operation: 'bulk.delete', target: `${dto.pattern || '*'} (${job.processed} keys) on db${db}`, sourceId, via: 'web',
      status: job.status === 'done' ? 'ok' : 'blocked', durationMs: Date.now() - t0,
    });
  }

  private async runExpire(job: Job, conn: Redis, sourceId: number, sourceName: string, db: number, dto: { pattern?: string; type?: string; ttl: number; batchSize?: number }) {
    const t0 = Date.now();
    try {
      await this.scanKeys(conn, db, dto, async (keys) => {
        const pipe = conn.pipeline();
        for (const key of keys) pipe.call('EXPIRE', key, String(dto.ttl));
        const res = (await pipe.exec()) ?? [];
        for (const r of res) { if (r[0]) job.errors++; else job.processed += 1; }
        job.matched = job.processed;
        if (job.cancelFlag) job.status = 'cancelled';
      });
      if (job.status === 'running') job.status = 'done';
    } catch (err) {
      job.status = 'failed';
      job.errors++;
      this.activity.record({ operation: 'bulk.expire', target: `${dto.pattern || '*'} on ${sourceName}/db${db}`, sourceId, via: 'web', status: 'failed', detail: err instanceof Error ? err.message : String(err) });
      return;
    }
    job.finishedAt = Date.now();
    this.activity.record({
      operation: 'bulk.expire', target: `${dto.pattern || '*'} (${job.processed} keys, ttl ${dto.ttl}s) on db${db}`, sourceId, via: 'web',
      status: job.status === 'done' ? 'ok' : 'blocked', durationMs: Date.now() - t0,
    });
  }
}
