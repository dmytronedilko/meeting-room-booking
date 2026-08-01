import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import {
  makeCounterProvider,
  makeHistogramProvider,
  PrometheusModule,
} from '@willsoto/nestjs-prometheus';

import { HttpMetricsInterceptor } from './http-metrics.interceptor';
import { MetricsController } from './metrics.controller';
import {
  BOOKING_CONFLICTS_TOTAL,
  BOOKING_END_NOTIFICATIONS_TOTAL,
  BOOKINGS_CANCELLED_TOTAL,
  BOOKINGS_CREATED_TOTAL,
  HTTP_REQUEST_DURATION,
  HTTP_REQUESTS_TOTAL,
  MetricsService,
} from './metrics.service';

@Module({
  imports: [
    PrometheusModule.register({
      controller: MetricsController,
      defaultMetrics: { enabled: true },
    }),
  ],
  providers: [
    makeHistogramProvider({
      name: HTTP_REQUEST_DURATION,
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    }),
    makeCounterProvider({
      name: HTTP_REQUESTS_TOTAL,
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status'],
    }),
    makeCounterProvider({
      name: BOOKINGS_CREATED_TOTAL,
      help: 'Total number of bookings created',
    }),
    makeCounterProvider({
      name: BOOKINGS_CANCELLED_TOTAL,
      help: 'Total number of bookings cancelled',
    }),
    makeCounterProvider({
      name: BOOKING_CONFLICTS_TOTAL,
      help: 'Total number of booking attempts rejected with 409 due to overlap',
    }),
    makeCounterProvider({
      name: BOOKING_END_NOTIFICATIONS_TOTAL,
      help: 'Total number of "booking ends soon" notifications sent',
    }),
    MetricsService,
    { provide: APP_INTERCEPTOR, useClass: HttpMetricsInterceptor },
  ],
  exports: [MetricsService],
})
export class MetricsModule {}
