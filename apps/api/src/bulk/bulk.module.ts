import { Module } from '@nestjs/common';
import { BulkController } from './bulk.controller';
import { BulkService } from './bulk.service';
import { SourcesModule } from '../sources/sources.module';
import { ActivityModule } from '../activity/activity.module';

@Module({
  imports: [SourcesModule, ActivityModule],
  controllers: [BulkController],
  providers: [BulkService],
})
export class BulkModule {}
