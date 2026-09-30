import { BadRequestException, ConflictException, Injectable, NotFoundException, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { DbService } from '../db/db.module';
import { SourceRow, sources } from '../db/schema';
import { encryptSecret } from '../common/crypto.util';
import { CreateSourceDto, UpdateSourceDto } from './dto/source.dto';
import { RedisConnectionsService } from '../redis/redis-connections.service';
import { ActivityService } from '../activity/activity.service';
import type { SourceDto, SourceStats } from '@valkyrie/shared';

@Injectable()
export class SourcesService implements OnApplicationBootstrap, OnApplicationShutdown {
  private pollTimer: NodeJS.Timeout | null = null;
  private polling = false;

  constructor(
    private db: DbService,
    private config: ConfigService,
    private connections: RedisConnectionsService,
    private activity: ActivityService,
  ) {}

  /* live health polling — every source is probed on a 5s cadence */
  onApplicationBootstrap() {
    void this.pollAll();
    this.pollTimer = setInterval(() => { void this.pollAll(); }, 5000);
  }

  onApplicationShutdown() {
    if (this.pollTimer) clearInterval(this.pollTimer);
  }

  private async pollAll() {
    if (this.polling) return;
    this.polling = true;
    try {
      const rows = this.db.db.select().from(sources).all();
      await Promise.all(rows.map((row) => this.connections.sample(row)));
    } finally {
      this.polling = false;
    }
  }

  private encrypt(dto: CreateSourceDto | UpdateSourceDto) {
    const secret = this.config.get<string>('JWT_SECRET') as string;
    return {
      password: dto.password ? encryptSecret(dto.password, secret) : undefined,
    };
  }

  private encryptSsh(ssh?: { password?: string }) {
    const secret = this.config.get<string>('JWT_SECRET') as string;
    return ssh?.password ? encryptSecret(ssh.password, secret) : undefined;
  }

  private rowToDto(row: SourceRow): SourceDto {
    return {
      id: row.id, name: row.name, group: row.group, host: row.host, port: row.port,
      username: row.username, mode: row.mode as SourceDto['mode'], tls: !!row.tlsEnabled,
      readOnly: !!row.readOnly, guardDangerous: !!row.guardDangerous, scanCount: row.scanCount,
      status: this.connections.statusOf(row),
    };
  }

  private validateMode(dto: CreateSourceDto | UpdateSourceDto) {
    if (dto.mode === 'sentinel' && !dto.sentinelMaster) {
      throw new BadRequestException('sentinelMaster is required for sentinel mode');
    }
  }

  list(): Array<SourceDto & { stats: SourceStats }> {
    const rows = this.db.db.select().from(sources).all().sort((a, b) => a.id - b.id);
    return rows.map((row) => ({
      ...this.rowToDto(row),
      stats: this.connections.stats.get(row.id) || { status: this.connections.statusOf(row) } as SourceStats,
    }));
  }

  async get(id: number): Promise<SourceRow> {
    const row = this.db.db.select().from(sources).where(eq(sources.id, id)).get();
    if (!row) throw new NotFoundException(`Source ${id} not found`);
    return row;
  }

  statsFor(row: SourceRow): SourceStats & { history: { t: number; usedMemory: number; opsPerSec: number; hitRate: number }[] } {
    return {
      ...(this.connections.stats.get(row.id) || { status: this.connections.statusOf(row) } as SourceStats),
      history: this.connections.history.get(row.id) || [],
    };
  }

  async create(dto: CreateSourceDto, via: string): Promise<SourceDto> {
    this.validateMode(dto);
    const exists = this.db.db.select().from(sources).where(eq(sources.name, dto.name)).get();
    if (exists) throw new ConflictException(`A source named "${dto.name}" already exists`);
    const now = Date.now();
    const inserted = this.db.db.insert(sources).values({
      name: dto.name,
      group: dto.group || 'Default',
      host: dto.host,
      port: dto.port ?? 6379,
      username: dto.username ?? null,
      password: this.encrypt(dto).password ?? null,
      mode: dto.mode ?? 'standalone',
      tlsEnabled: dto.tls?.enabled ? 1 : 0,
      tlsSkipVerify: dto.tls?.skipVerify ? 1 : 0,
      sshEnabled: dto.ssh?.enabled ? 1 : 0,
      sshHost: dto.ssh?.host ?? null,
      sshPort: dto.ssh?.port ?? 22,
      sshUser: dto.ssh?.username ?? null,
      sshPassword: this.encryptSsh(dto.ssh) ?? null,
      sshPrivateKey: dto.ssh?.privateKey ?? null,
      sentinelMaster: dto.sentinelMaster ?? null,
      readOnly: dto.readOnly ? 1 : 0,
      guardDangerous: dto.guardDangerous === false ? 0 : 1,
      scanCount: dto.scanCount ?? 200,
      visibleDbs: dto.visibleDbs ?? 16,
      createdAt: now, updatedAt: now,
    }).returning().get();
    this.activity.record({ operation: 'source.create', target: `${inserted.name} (${inserted.host}:${inserted.port})`, via });
    void this.connections.sample(inserted);
    return this.rowToDto(inserted);
  }

  async update(id: number, dto: UpdateSourceDto, via: string): Promise<SourceDto> {
    const row = await this.get(id);
    this.validateMode(dto);
    if (dto.name && dto.name !== row.name) {
      const exists = this.db.db.select().from(sources).where(eq(sources.name, dto.name)).get();
      if (exists) throw new ConflictException(`A source named "${dto.name}" already exists`);
    }
    const enc = this.encrypt(dto as UpdateSourceDto & CreateSourceDto);
    this.db.db.update(sources).set({
      name: dto.name ?? row.name,
      group: dto.group ?? row.group,
      host: dto.host ?? row.host,
      port: dto.port ?? row.port,
      username: dto.username ?? row.username,
      password: enc.password ?? row.password,
      mode: dto.mode ?? row.mode,
      tlsEnabled: dto.tls ? (dto.tls.enabled ? 1 : 0) : row.tlsEnabled,
      tlsSkipVerify: dto.tls ? (dto.tls.skipVerify ? 1 : 0) : row.tlsSkipVerify,
      sshEnabled: dto.ssh ? (dto.ssh.enabled ? 1 : 0) : row.sshEnabled,
      sshHost: dto.ssh?.host ?? row.sshHost,
      sshPort: dto.ssh?.port ?? row.sshPort,
      sshUser: dto.ssh?.username ?? row.sshUser,
      sshPassword: this.encryptSsh(dto.ssh) ?? row.sshPassword,
      sshPrivateKey: dto.ssh?.privateKey ?? row.sshPrivateKey,
      sentinelMaster: dto.sentinelMaster ?? row.sentinelMaster,
      readOnly: dto.readOnly === undefined ? row.readOnly : (dto.readOnly ? 1 : 0),
      guardDangerous: dto.guardDangerous === undefined ? row.guardDangerous : (dto.guardDangerous ? 1 : 0),
      scanCount: dto.scanCount ?? row.scanCount,
      visibleDbs: dto.visibleDbs ?? row.visibleDbs,
      updatedAt: Date.now(),
    }).where(eq(sources.id, id)).run();
    /* topology or credentials changed → rebuild connections */
    this.connections.drop(id);
    const updated = await this.get(id);
    this.activity.record({ operation: 'source.update', target: `${updated.name} (${updated.host}:${updated.port})`, via });
    void this.connections.sample(updated);
    return this.rowToDto(updated);
  }

  async remove(id: number, via: string) {
    const row = await this.get(id);
    this.connections.drop(id);
    this.db.db.delete(sources).where(eq(sources.id, id)).run();
    this.activity.record({ operation: 'source.delete', target: `${row.name} (${row.host}:${row.port})`, via });
  }

  async testDraft(dto: CreateSourceDto) {
    this.validateMode(dto);
    const secret = this.config.get<string>('JWT_SECRET') as string;
    const temp: SourceRow = {
      id: -Date.now(),
      name: '__probe__', group: 'Default', host: dto.host, port: dto.port ?? 6379,
      username: dto.username ?? null,
      password: dto.password ? encryptSecret(dto.password, secret) : null,
      mode: dto.mode ?? 'standalone',
      tlsEnabled: dto.tls?.enabled ? 1 : 0, tlsSkipVerify: dto.tls?.skipVerify ? 1 : 0,
      sshEnabled: dto.ssh?.enabled ? 1 : 0, sshHost: dto.ssh?.host ?? null, sshPort: dto.ssh?.port ?? 22,
      sshUser: dto.ssh?.username ?? null, sshPassword: this.encryptSsh(dto.ssh) ?? null,
      sshPrivateKey: dto.ssh?.privateKey ?? null,
      sentinelMaster: dto.sentinelMaster ?? null,
      readOnly: 0, guardDangerous: 1, scanCount: 200, visibleDbs: 16, createdAt: 0, updatedAt: 0,
    };
    try {
      return await this.connections.probe(temp);
    } finally {
      this.connections.drop(temp.id);
    }
  }

  async testSaved(id: number) {
    const row = await this.get(id);
    return this.connections.probe(row);
  }
}
