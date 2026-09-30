import { Module } from '@nestjs/common';
import { KeysController } from './keys.controller';
import { KeysService } from './keys.service';
import { SourcesModule } from '../sources/sources.module';
import { ActivityModule } from '../activity/activity.module';

@Module({
  imports: [SourcesModule, ActivityModule],
  controllers: [KeysController],
  providers: [KeysService],
})
export class KeysModule {}
