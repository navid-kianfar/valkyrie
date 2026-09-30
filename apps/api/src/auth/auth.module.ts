import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { ActivityModule } from '../activity/activity.module';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ secret: config.get<string>('JWT_SECRET') }),
    }),
    ActivityModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, { provide: APP_GUARD, useClass: JwtAuthGuard }],
  exports: [AuthService],
})
export class AuthModule {}
