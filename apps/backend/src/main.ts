import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app/app.module';
import { configureApp } from './app/setup';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    // trustProxy: behind the Nginx proxy the throttler and logs must see the
    // real client IP from X-Forwarded-For.
    new FastifyAdapter({ trustProxy: true }),
    { bufferLogs: true },
  );
  app.useLogger(app.get(Logger));

  configureApp(app);
  app.enableShutdownHooks();

  // In dev mode the frontend (localhost:3000) talks to the API directly, so
  // CORS is required — with credentials, since auth travels in a cookie.
  // In Docker both apps share one origin behind the Nginx proxy.
  if (process.env['NODE_ENV'] !== 'production') {
    app.enableCors({ origin: true, credentials: true });
  }

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Meeting Room Booking API')
    .setDescription('REST API for booking office meeting rooms')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = Number(process.env['PORT'] ?? 3001);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
