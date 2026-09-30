import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env';
import { DbModule } from './db/db.module';
import { AuthModule } from './auth/auth.module';
import { ActivityModule } from './activity/activity.module';
import { SourcesModule } from './sources/sources.module';
import { KeysModule } from './keys/keys.module';
import { BulkModule } from './bulk/bulk.module';
import { InfoModule } from './info/info.module';
import { SettingsModule } from './settings/settings.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env', validate: validateEnv }),
    DbModule,
    AuthModule,
    ActivityModule,
    SourcesModule,
    KeysModule,
    BulkModule,
    InfoModule,
    SettingsModule,
  ],
})
export class AppModule {}
