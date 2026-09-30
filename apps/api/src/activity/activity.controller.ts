import { Controller, Get, Query } from '@nestjs/common';
import { ActivityService } from './activity.service';

@Controller('activity')
export class ActivityController {
  constructor(private activity: ActivityService) {}

  @Get()
  list(
    @Query('page') page?: string,
    @Query('size') size?: string,
    @Query('operation') operation?: string,
    @Query('sourceId') sourceId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('since') since?: string,
  ) {
    return this.activity.list({
      page: page ? Number(page) : undefined,
      size: size ? Number(size) : undefined,
      operation: operation || undefined,
      sourceId: sourceId ? Number(sourceId) : undefined,
      status: status || undefined,
      search: search || undefined,
      since: since ? Number(since) : undefined,
    });
  }
}
