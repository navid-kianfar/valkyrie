import { Module } from '@nestjs/common';
import { SourcesController } from './sources.controller';
import { SourcesService } from './sources.service';
import { RedisConnectionsService } from '../redis/redis-connections.service';
import { ActivityModule } from '../activity/activity.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [SettingsModule, ActivityModule],
  controllers: [SourcesController],
  providers: [SourcesService, RedisConnectionsService],
  exports: [SourcesService, RedisConnectionsService],
})
export class SourcesModule {}
