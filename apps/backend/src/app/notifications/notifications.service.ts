import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq, gt, inArray, isNull, lte, or } from 'drizzle-orm';

import { DRIZZLE, type DrizzleDB } from '../db/database.module';
import { bookings } from '../../db/schema';
import { MetricsService } from '../metrics/metrics.service';

/** How often the scheduler scans for bookings that are about to end. */
const TICK_MS = 60_000;

/**
 * Background scheduler that sends a "your booking ends soon" notification a
 * configurable number of minutes (`NOTIFY_BEFORE_MINUTES`) before a booking
 * concludes — but only when the next slot in that room is taken (another
 * booking starts exactly when this one ends), i.e. someone needs the room
 * right after. Delivery is a structured log line plus a Prometheus counter,
 * and the in-app bell/toast reads the same `endNotifiedAt` stamp via
 * `GET /bookings/my/notifications`. `endNotifiedAt` guarantees each booking is
 * notified exactly once; because a cancelled booking is deleted, cancelling
 * either this booking or the next one makes the notification not fire.
 */
@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly notifyBeforeMinutes: number;
  private timer?: NodeJS.Timeout;

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly metrics: MetricsService,
    config: ConfigService,
  ) {
    this.notifyBeforeMinutes = Number(config.get('NOTIFY_BEFORE_MINUTES') ?? 10);
  }

  onModuleInit(): void {
    // Tests and one-off tasks opt out of the timer; they call
    // processDueNotifications() directly.
    if (process.env['DISABLE_NOTIFICATIONS_SCHEDULER'] === 'true') {
      return;
    }
    this.logger.log(
      `End-of-booking notifications enabled (${this.notifyBeforeMinutes} min before)`,
    );
    this.timer = setInterval(() => {
      this.processDueNotifications().catch((error) =>
        this.logger.error('Notification scan failed', error instanceof Error ? error.stack : error),
      );
    }, TICK_MS);
    // Never keep the process alive just for the timer.
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  /**
   * Notifies every not-yet-notified booking that ends within the window
   * `(now, now + NOTIFY_BEFORE_MINUTES]` AND whose room's next slot is taken
   * (another booking starts exactly when it ends), marks them, and returns how
   * many were sent. Idempotent: already-notified and already-ended bookings, and
   * bookings with no back-to-back successor, are skipped.
   */
  async processDueNotifications(now: Date = new Date()): Promise<number> {
    const windowEnd = new Date(now.getTime() + this.notifyBeforeMinutes * 60_000);
    const due = await this.db.query.bookings.findMany({
      where: and(
        isNull(bookings.endNotifiedAt),
        gt(bookings.endsAt, now),
        lte(bookings.endsAt, windowEnd),
      ),
      with: { room: { columns: { name: true } } },
    });
    if (due.length === 0) {
      return 0;
    }

    // Keep only bookings whose room is needed right after: some booking starts
    // exactly when this one ends. Cancellation deletes rows, so if this booking
    // or its successor is cancelled the match disappears and nothing fires.
    const successors = await this.db.query.bookings.findMany({
      where: or(
        ...due.map((booking) =>
          and(eq(bookings.roomId, booking.roomId), eq(bookings.startsAt, booking.endsAt)),
        ),
      ),
      columns: { roomId: true, startsAt: true },
    });
    const nextSlotTaken = new Set(successors.map((s) => `${s.roomId}@${s.startsAt.getTime()}`));
    const notifiable = due.filter((b) => nextSlotTaken.has(`${b.roomId}@${b.endsAt.getTime()}`));
    if (notifiable.length === 0) {
      return 0;
    }

    for (const booking of notifiable) {
      const minutesLeft = Math.round((booking.endsAt.getTime() - now.getTime()) / 60_000);
      this.deliver(booking.userId, booking.id, booking.title, booking.room.name, minutesLeft);
    }

    await this.db
      .update(bookings)
      .set({ endNotifiedAt: now })
      .where(
        inArray(
          bookings.id,
          notifiable.map((booking) => booking.id),
        ),
      );
    this.metrics.bookingEndNotified(notifiable.length);
    return notifiable.length;
  }

  private deliver(
    userId: string,
    bookingId: string,
    title: string,
    room: string,
    minutesLeft: number,
  ): void {
    this.logger.log(
      { userId, bookingId, title, room, minutesLeft },
      `Booking "${title}" in ${room} ends in ${minutesLeft} min`,
    );
  }
}
