import fastifyCookie from '@fastify/cookie';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import type { FastifyInstance } from 'fastify';

/**
 * Application wiring shared between `main.ts` and the integration tests,
 * so tests exercise exactly the same pipeline as production.
 *
 * Adapter-level options (e.g. Fastify's `trustProxy`) are passed where the
 * FastifyAdapter is instantiated.
 */
export function configureApp(app: INestApplication): void {
  // The session JWT travels in an HttpOnly cookie.
  const fastify = app.getHttpAdapter().getInstance() as FastifyInstance;
  void fastify.register(fastifyCookie);

  app.setGlobalPrefix('api', { exclude: ['health', 'metrics'] });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}
