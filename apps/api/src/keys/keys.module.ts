import { Module } from '@nestjs/common';
import { KeysController } from './keys.controller';
import { KeysService } from './keys.service';
import { SourcesModule } from '../sources/sources.module';
import { ActivityModule } from '../activity/activity.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [SettingsModule, SourcesModule, ActivityModule],
  controllers: [KeysController],
  providers: [KeysService],
})
export class KeysModule {}
