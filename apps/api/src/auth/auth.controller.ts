import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Public } from '../common/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto.username, dto.password, dto.remember ?? false, req.ip || 'web');
  }

  @Get('me')
  me(@Req() req: Request & { user?: { username: string } }) {
    return { user: req.user };
  }
}
