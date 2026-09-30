CREATE TABLE `activity` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`at` integer NOT NULL,
	`operation` text NOT NULL,
	`target` text NOT NULL,
	`source_id` integer,
	`via` text DEFAULT 'web' NOT NULL,
	`status` text DEFAULT 'ok' NOT NULL,
	`duration_ms` integer,
	`detail` text
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sources` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`group_name` text DEFAULT 'Default' NOT NULL,
	`host` text NOT NULL,
	`port` integer DEFAULT 6379 NOT NULL,
	`username` text,
	`password` text,
	`mode` text DEFAULT 'standalone' NOT NULL,
	`tls_enabled` integer DEFAULT 0 NOT NULL,
	`tls_skip_verify` integer DEFAULT 0 NOT NULL,
	`ssh_enabled` integer DEFAULT 0 NOT NULL,
	`ssh_host` text,
	`ssh_port` integer DEFAULT 22 NOT NULL,
	`ssh_user` text,
	`ssh_password` text,
	`ssh_private_key` text,
	`sentinel_master` text,
	`read_only` integer DEFAULT 0 NOT NULL,
	`guard_dangerous` integer DEFAULT 1 NOT NULL,
	`scan_count` integer DEFAULT 200 NOT NULL,
	`visible_dbs` integer DEFAULT 16 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sources_name_unique` ON `sources` (`name`);