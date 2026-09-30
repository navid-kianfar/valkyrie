import { existsSync, mkdirSync } from 'node:fs';
import * as path from 'node:path';
import { Global, Module, OnModuleInit } from '@nestjs/common';
import Database from 'better-sqlite3';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema';

export type Db = BetterSQLite3Database<typeof schema> & { $client: Database.Database };

export class DbService implements OnModuleInit {
  readonly db!: Db;
  readonly raw!: Database.Database;

  constructor() {
    const file = path.resolve(process.env.DB_PATH || 'data/valkyrie.db');
    mkdirSync(path.dirname(file), { recursive: true });
    this.raw = new Database(file);
    this.raw.pragma('journal_mode = WAL');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.db = drizzle(this.raw, { schema }) as any;
  }

  onModuleInit() {
    const candidates = [
      path.join(__dirname, '..', '..', '..', '..', 'drizzle'),
      path.join(__dirname, '..', '..', 'drizzle'),
      path.join(process.cwd(), 'drizzle'),
    ];
    const folder = candidates.find((c) => existsSync(path.join(c, 'meta', '_journal.json')));
    if (!folder) throw new Error(`drizzle migrations folder not found (tried: ${candidates.join(', ')})`);
    migrate(this.db, { migrationsFolder: folder });
    console.log('[valkyrie-db] migrations applied from', folder);
  }
}

@Global()
@Module({ providers: [DbService], exports: [DbService] })
export class DbModule {}

export const DB_SCHEMA = schema;
