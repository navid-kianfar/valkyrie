import 'reflect-metadata';
import { existsSync } from 'node:fs';
import * as path from 'node:path';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';

/* The built web app is served from this same process when it is present, which
   is what makes the production image a single container on a single port.
   `WEB_DIST` points at it explicitly; otherwise it is looked up relative to the
   working directory the image uses. Under `pnpm dev` none of these exist — Vite
   serves the SPA on 5173 and proxies /api here — so this resolves to null. */
function resolveWebDist(): string | null {
  const candidates = [process.env.WEB_DIST, path.join(process.cwd(), 'web')].filter(
    (candidate): candidate is string => Boolean(candidate),
  );
  const found = candidates.find((candidate) => existsSync(path.join(candidate, 'index.html')));
  return found ? path.resolve(found) : null;
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: ['log', 'warn', 'error'] });
  app.setGlobalPrefix('api');
  app.enableCors({ origin: true, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, transformOptions: { enableImplicitConversion: true } }));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();

  const webDist = resolveWebDist();

  if (webDist) {
    /* Both handlers are attached before listen() initialises the application,
       so they sit ahead of Nest's own router. Static files are served first,
       then everything that is not /api falls through to the SPA shell — /api is
       handed onward, which is what keeps its 404s JSON instead of HTML. */
    app.useStaticAssets(webDist, { index: false });
    app.getHttpAdapter().getInstance().use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      if (req.path === '/api' || req.path.startsWith('/api/')) return next();
      res.sendFile(path.join(webDist, 'index.html'));
    });
  }

  const port = Number(process.env.PORT || 4000);
  await app.listen(port);
  console.log(`[valkyrie-api] listening on http://localhost:${port}/api${webDist ? ` (web from ${webDist})` : ''}`);
}
bootstrap();
