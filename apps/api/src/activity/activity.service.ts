import { Injectable } from '@nestjs/common';
import { and, desc, eq, gte, like, sql, type SQL } from 'drizzle-orm';
import { DbService } from '../db/db.module';
import { activity } from '../db/schema';

export interface RecordInput {
  operation: string;
  target: string;
  sourceId?: number | null;
  via?: string;
  status?: 'ok' | 'failed' | 'blocked';
  durationMs?: number | null;
  detail?: string | null;
}

@Injectable()
export class ActivityService {
  constructor(private db: DbService) {}

  record(input: RecordInput) {
    this.db.db.insert(activity).values({
      at: Date.now(),
      operation: input.operation,
      target: input.target,
      sourceId: input.sourceId ?? null,
      via: input.via || 'web',
      status: input.status || 'ok',
      durationMs: input.durationMs ?? null,
      detail: input.detail ?? null,
    }).run();
  }

  list(params: { page?: number; size?: number; operation?: string; sourceId?: number; status?: string; search?: string; since?: number }) {
    const page = Math.max(1, params.page ?? 1);
    const size = Math.min(200, Math.max(1, params.size ?? 30));
    const filters: SQL[] = [];
    if (params.operation) filters.push(like(activity.operation, `${params.operation}%`));
    if (params.sourceId) filters.push(eq(activity.sourceId, params.sourceId));
    if (params.status) filters.push(eq(activity.status, params.status));
    if (params.search) filters.push(like(activity.target, `%${params.search}%`));
    if (params.since) filters.push(gte(activity.at, params.since));
    const where = filters.length ? and(...filters) : undefined;
    const rows = this.db.db
      .select({
        id: activity.id, at: activity.at, operation: activity.operation, target: activity.target,
        sourceId: activity.sourceId, via: activity.via, status: activity.status,
        durationMs: activity.durationMs, detail: activity.detail, sourceName: sql<string | null>`(select name from sources where id = ${activity.sourceId})`,
      })
      .from(activity).where(where).orderBy(desc(activity.id)).limit(size).offset((page - 1) * size).all();
    const total = this.db.db.select({ n: sql<number>`count(*)` }).from(activity).where(where).get();
    return { items: rows.map((r) => ({ ...r, at: new Date(r.at).toISOString() })), page, size, total: total?.n ?? 0 };
  }
}
