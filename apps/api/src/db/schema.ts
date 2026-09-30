import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const sources = sqliteTable('sources', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  group: text('group_name').notNull().default('Default'),
  host: text('host').notNull(),
  port: integer('port').notNull().default(6379),
  username: text('username'),
  password: text('password'),
  mode: text('mode').notNull().default('standalone'),
  tlsEnabled: integer('tls_enabled').notNull().default(0),
  tlsSkipVerify: integer('tls_skip_verify').notNull().default(0),
  sshEnabled: integer('ssh_enabled').notNull().default(0),
  sshHost: text('ssh_host'),
  sshPort: integer('ssh_port').notNull().default(22),
  sshUser: text('ssh_user'),
  sshPassword: text('ssh_password'),
  sshPrivateKey: text('ssh_private_key'),
  sentinelMaster: text('sentinel_master'),
  readOnly: integer('read_only').notNull().default(0),
  guardDangerous: integer('guard_dangerous').notNull().default(1),
  scanCount: integer('scan_count').notNull().default(200),
  visibleDbs: integer('visible_dbs').notNull().default(16),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const activity = sqliteTable('activity', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  at: integer('at').notNull(),
  operation: text('operation').notNull(),
  target: text('target').notNull(),
  sourceId: integer('source_id'),
  via: text('via').notNull().default('web'),
  status: text('status').notNull().default('ok'),
  durationMs: integer('duration_ms'),
  detail: text('detail'),
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export type SourceRow = typeof sources.$inferSelect;
export type ActivityRow = typeof activity.$inferSelect;
