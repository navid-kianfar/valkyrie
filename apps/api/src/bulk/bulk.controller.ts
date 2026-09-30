import { BadRequestException, Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { BulkService } from './bulk.service';

export class BulkDeleteDto {
  @IsOptional() @IsInt() @Min(0) @Max(15) db?: number;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200) pattern?: string;
  @IsOptional() @IsString() @MaxLength(20) type?: string;
  @IsOptional() @IsBoolean() onlyTtl?: boolean;
  @IsOptional() @IsInt() @Min(100) @Max(5000) batchSize?: number;
}

export class BulkExpireDto extends BulkDeleteDto {
  @IsInt() @Min(1) ttl: number;
}

export class BulkPreviewDto {
  @IsOptional() @IsInt() @Min(0) @Max(15) db?: number;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200) match?: string;
  @IsOptional() @IsString() @MaxLength(20) type?: string;
  @IsOptional() @IsInt() @Min(10) @Max(5000) limit?: number;
}

@Controller()
export class BulkController {
  constructor(private bulk: BulkService) {}

  @Post('sources/:id/bulk/delete')
  delete(@Param('id', ParseIntPipe) id: number, @Body() dto: BulkDeleteDto) {
    return this.bulk.startDelete(id, dto);
  }

  @Post('sources/:id/bulk/expire')
  expire(@Param('id', ParseIntPipe) id: number, @Body() dto: BulkExpireDto) {
    return this.bulk.startExpire(id, dto);
  }

  @Get('jobs/:jobId')
  get(@Param('jobId') jobId: string) {
    return this.bulk.get(jobId);
  }

  @Post('jobs/:jobId/cancel')
  cancel(@Param('jobId') jobId: string) {
    return this.bulk.cancel(jobId);
  }

  @Get('jobs')
  list() {
    return this.bulk.listRecent().map((j) => ({ ...j }));
  }
}
