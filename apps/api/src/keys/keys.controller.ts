import { Body, Controller, Delete, Get, Injectable, Param, ParseIntPipe, Post, Put, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Allow, IsIn, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { KeysService } from './keys.service';

export class ScanQuery {
  @IsOptional() @IsInt() @Min(0) @Max(15) db?: number;
  @IsOptional() @IsInt() @Min(0) cursor?: number;
  @IsOptional() @IsString() @MaxLength(200) match?: string;
  @IsOptional() @IsString() @MaxLength(20) type?: string;
  @IsOptional() @IsInt() @Min(10) @Max(5000) count?: number;
}

export class CreateKeyDto {
  @IsString() @MinLength(1) @MaxLength(512) name: string;
  @IsOptional() @IsInt() @Min(0) @Max(15) db?: number;
  @IsString() @IsIn(['string', 'hash', 'list', 'set', 'zset', 'stream']) type: string;
  @IsOptional() @IsInt() @Min(0) ttl?: number;
  @Allow() value?: unknown;
}

export class UpdateKeyDto {
  @IsOptional() @IsInt() @Min(0) @Max(15) db?: number;
  @IsString() @IsIn(['string', 'hash', 'list', 'set', 'zset', 'stream']) type: string;
  @Allow() value?: unknown;
}

export class SetTtlDto {
  @IsOptional() @IsInt() @Min(0) @Max(15) db?: number;
  @IsString() @MinLength(1) @MaxLength(512) name: string;
  @IsInt() @Min(0) ttl: number;
}

export class RenameKeyDto {
  @IsOptional() @IsInt() @Min(0) @Max(15) db?: number;
  @IsString() @MinLength(1) @MaxLength(512) from: string;
  @IsString() @MinLength(1) @MaxLength(512) to: string;
}

export class ExecDto {
  @IsOptional() @IsInt() @Min(0) @Max(15) db?: number;
  @IsString() @MinLength(1) @MaxLength(2000) command: string;
}

export class ExportQuery {
  @IsOptional() @IsInt() @Min(0) @Max(15) db?: number;
  @IsOptional() @IsString() @MaxLength(200) match?: string;
  @IsOptional() @IsIn(['json', 'csv', 'resp']) format?: string;
  @IsOptional() @IsInt() @Min(1) @Max(50000) limit?: number;
}

@Controller()
export class KeysController {
  constructor(private keys: KeysService) {}

  @Get('sources/:id/keys')
  scan(@Param('id', ParseIntPipe) id: number, @Query() q: ScanQuery) {
    return this.keys.scan(id, q.db ?? 0, q);
  }

  @Post('sources/:id/keys/preview')
  preview(@Param('id', ParseIntPipe) id: number, @Body() body: { db?: number; match?: string; type?: string; limit?: number }) {
    return this.keys.preview(id, body.db ?? 0, body);
  }

  @Get('sources/:id/key')
  get(@Param('id', ParseIntPipe) id: number, @Query('db') db: string, @Query('name') name: string) {
    return this.keys.get(id, Number(db) || 0, name);
  }

  @Post('sources/:id/key')
  create(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateKeyDto) {
    return this.keys.create(id, dto.db ?? 0, dto, 'web');
  }

  @Put('sources/:id/key')
  update(@Param('id', ParseIntPipe) id: number, @Query('name') name: string, @Body() dto: UpdateKeyDto) {
    return this.keys.update(id, dto.db ?? 0, name, dto, 'web');
  }

  @Delete('sources/:id/key')
  remove(@Param('id', ParseIntPipe) id: number, @Query('db') db: string, @Query('name') name: string) {
    return this.keys.remove(id, Number(db) || 0, name, 'web');
  }

  @Post('sources/:id/key/ttl')
  setTtl(@Param('id', ParseIntPipe) id: number, @Body() dto: SetTtlDto) {
    return this.keys.setTtl(id, dto.db ?? 0, dto.name, dto.ttl, 'web');
  }

  @Post('sources/:id/key/rename')
  rename(@Param('id', ParseIntPipe) id: number, @Body() dto: RenameKeyDto) {
    return this.keys.rename(id, dto.db ?? 0, dto.from, dto.to, 'web');
  }

  @Post('sources/:id/exec')
  exec(@Param('id', ParseIntPipe) id: number, @Body() dto: ExecDto) {
    return this.keys.exec(id, dto.db ?? 0, dto.command, 'web/cli');
  }

  @Get('sources/:id/export')
  async export(@Param('id', ParseIntPipe) id: number, @Query() q: ExportQuery, @Res() res: Response) {
    await this.keys.export(id, q.db ?? 0, q, res);
  }
}
