import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { Controller, Get, Module } from '@nestjs/common';
import { Public } from '../common/public.decorator';

function readVersion(): string {
  const candidates = [
    path.join(__dirname, '..', '..', '..', '..', 'package.json'),
    path.join(process.cwd(), 'package.json'),
  ];
  for (const candidate of candidates) {
    try { return JSON.parse(readFileSync(candidate, 'utf8')).version; } catch { /* try next */ }
  }
  return '0.0.0';
}

@Controller()
export class InfoController {
  @Public()
  @Get('meta')
  meta() {
    return { name: 'valkyrie', version: readVersion(), api: 1 };
  }

  @Public()
  @Get('health')
  health() {
    return { status: 'ok' };
  }
}

@Module({ controllers: [InfoController] })
export class InfoModule {}
