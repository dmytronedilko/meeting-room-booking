import { Module, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { JwtModule, type JwtModuleOptions } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { BookingsModule } from './bookings/bookings.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { DatabaseModule } from './db/database.module';
import { HealthController } from './health/health.controller';
import { MetricsModule } from './metrics/metrics.module';
import { NotificationsModule } from './notifications/notifications.module';
import { RoomsModule } from './rooms/rooms.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        // Keep probe/scrape noise out of the logs (and out of ELK).
        exclude: [
          { method: RequestMethod.ALL, path: 'health' },
          { method: RequestMethod.ALL, path: 'metrics' },
        ],
        pinoHttp: {
          level: config.get<string>('LOG_LEVEL') ?? 'info',
          redact: ['req.headers.authorization'],
          transport:
            process.env['NODE_ENV'] !== 'production'
              ? { target: 'pino-pretty', options: { singleLine: true } }
              : undefined,
        },
      }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: Number(config.get('THROTTLE_TTL_MS') ?? 60_000),
            limit: Number(config.get('THROTTLE_LIMIT') ?? 10),
          },
        ],
      }),
    }),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => ({
        secret: config.get<string>('JWT_SECRET') ?? 'dev-only-secret',
        // @nestjs/jwt 11 types `expiresIn` as ms's `StringValue`; a plain env
        // string needs the assertion to fit that template-literal type.
        signOptions: {
          expiresIn: (config.get<string>('JWT_TTL') ?? '24h') as NonNullable<
            JwtModuleOptions['signOptions']
          >['expiresIn'],
        },
      }),
    }),
    DatabaseModule,
    MetricsModule,
    AuthModule,
    RoomsModule,
    BookingsModule,
    NotificationsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
