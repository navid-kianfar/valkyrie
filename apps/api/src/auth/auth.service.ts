import { Injectable, OnApplicationBootstrap, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { eq } from 'drizzle-orm';
import { DbService } from '../db/db.module';
import { settings } from '../db/schema';
import { hashPassword, verifyPassword } from '../common/crypto.util';
import { ActivityService } from '../activity/activity.service';

@Injectable()
export class AuthService implements OnApplicationBootstrap {
  constructor(
    private db: DbService,
    private jwt: JwtService,
    private config: ConfigService,
    private activity: ActivityService,
  ) {}

  /* seed / rotate the admin credential hash from env on every boot */
  onApplicationBootstrap() {
    const user = this.config.get<string>('ADMIN_USER') as string;
    const password = this.config.get<string>('ADMIN_PASSWORD') as string;
    const row = this.db.db.select().from(settings).where(eq(settings.key, 'admin_credential')).get();
    const desired = hashPassword(`${user}:${password}`);
    if (!row || row.value !== desired) {
      this.db.db.insert(settings).values({ key: 'admin_credential', value: desired })
        .onConflictDoUpdate({ target: settings.key, set: { value: desired } }).run();
      console.log(`[valkyrie-auth] admin credential synced from environment (user: ${user})`);
    }
  }

  async login(username: string, password: string, remember: boolean, via: string) {
    const row = this.db.db.select().from(settings).where(eq(settings.key, 'admin_credential')).get();
    const expectedUser = this.config.get<string>('ADMIN_USER') as string;
    const ok = username === expectedUser && !!row && verifyPassword(`${username}:${password}`, row.value);
    if (!ok) {
      this.activity.record({ operation: 'auth.login', target: username, via, status: 'failed' });
      throw new UnauthorizedException('Invalid credentials');
    }
    const expiresIn = remember ? '30d' : '1d';
    const token = await this.jwt.signAsync({ sub: username }, { expiresIn });
    this.activity.record({ operation: 'auth.login', target: username, via, status: 'ok' });
    return { accessToken: token, expiresIn, user: { name: username } };
  }
}
