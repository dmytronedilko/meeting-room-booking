import { Injectable } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Histogram } from 'prom-client';

export const HTTP_REQUEST_DURATION = 'http_request_duration_seconds';
export const HTTP_REQUESTS_TOTAL = 'http_requests_total';
export const BOOKINGS_CREATED_TOTAL = 'bookings_created_total';
export const BOOKINGS_CANCELLED_TOTAL = 'bookings_cancelled_total';
export const BOOKING_CONFLICTS_TOTAL = 'booking_conflicts_total';
export const BOOKING_END_NOTIFICATIONS_TOTAL = 'booking_end_notifications_total';

/** Single facade over all custom Prometheus metrics. */
@Injectable()
export class MetricsService {
  constructor(
    @InjectMetric(HTTP_REQUEST_DURATION)
    private readonly httpDuration: Histogram<string>,
    @InjectMetric(HTTP_REQUESTS_TOTAL)
    private readonly httpRequests: Counter<string>,
    @InjectMetric(BOOKINGS_CREATED_TOTAL)
    private readonly bookingsCreated: Counter<string>,
    @InjectMetric(BOOKINGS_CANCELLED_TOTAL)
    private readonly bookingsCancelled: Counter<string>,
    @InjectMetric(BOOKING_CONFLICTS_TOTAL)
    private readonly bookingConflicts: Counter<string>,
    @InjectMetric(BOOKING_END_NOTIFICATIONS_TOTAL)
    private readonly bookingEndNotifications: Counter<string>,
  ) {}

  observeHttpRequest(method: string, route: string, status: number, durationSeconds: number): void {
    const labels = { method, route, status: String(status) };
    this.httpRequests.inc(labels);
    this.httpDuration.observe(labels, durationSeconds);
  }

  bookingCreated(count = 1): void {
    this.bookingsCreated.inc(count);
  }

  bookingCancelled(count = 1): void {
    this.bookingsCancelled.inc(count);
  }

  bookingConflict(): void {
    this.bookingConflicts.inc();
  }

  bookingEndNotified(count = 1): void {
    this.bookingEndNotifications.inc(count);
  }
}
