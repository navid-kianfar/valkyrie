import { Body, Controller, Get, Injectable, Module, Put } from '@nestjs/common';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';
import { DbService } from '../db/db.module';
import { settings } from '../db/schema';

export interface ServerSettings {
  /** Record full console commands (with arguments) to the activity log. */
  logCommands: boolean;
  /** Health-poll cadence in seconds; 0 disables background polling. */
  pollSeconds: number;
}

export class UpdateSettingsDto {
  @IsOptional() @IsBoolean() logCommands?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(3600) pollSeconds?: number;
}

const DEFAULTS: ServerSettings = { logCommands: true, pollSeconds: 5 };

@Injectable()
export class SettingsService {
  private listeners = new Set<() => void>();

  constructor(private db: DbService) {}

  /** Notified whenever a setting changes, so services can re-read and re-arm. */
  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  read(): ServerSettings {
    const rows = this.db.db.select().from(settings).all();
    const map = new Map(rows.map((r) => [r.key, r.value]));
    const logCommands = map.get('logCommands');
    const pollSeconds = map.get('pollSeconds');
    return {
      logCommands: logCommands === undefined ? DEFAULTS.logCommands : logCommands === 'true',
      pollSeconds: pollSeconds === undefined ? DEFAULTS.pollSeconds : Number(pollSeconds),
    };
  }

  write(patch: UpdateSettingsDto): ServerSettings {
    const put = (key: string, value: string) =>
      this.db.db.insert(settings).values({ key, value }).onConflictDoUpdate({ target: settings.key, set: { value } }).run();
    if (patch.logCommands !== undefined) put('logCommands', String(patch.logCommands));
    if (patch.pollSeconds !== undefined) put('pollSeconds', String(patch.pollSeconds));
    for (const fn of this.listeners) fn();
    return this.read();
  }
}

@Controller('settings')
export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  @Get()
  get() {
    return this.settingsService.read();
  }

  @Put()
  update(@Body() dto: UpdateSettingsDto) {
    return this.settingsService.write(dto);
  }
}

@Module({ controllers: [SettingsController], providers: [SettingsService], exports: [SettingsService] })
export class SettingsModule {}
