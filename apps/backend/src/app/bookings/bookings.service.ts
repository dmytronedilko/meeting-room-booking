import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreateBookingResponse,
  MyBookingDto,
  MyNotificationDto,
  PastBookingsPageDto,
} from '@office/shared';
import { and, asc, desc, eq, gt, gte, isNotNull, lte } from 'drizzle-orm';

import { DRIZZLE, type DrizzleDB } from '../db/database.module';
import { isPgError, PG_EXCLUSION_VIOLATION } from '../../db/pg-errors';
import { bookings, rooms, users } from '../../db/schema';
import { MetricsService } from '../metrics/metrics.service';
import { addOfficeWeeks } from '../time/office-time';
import { validateBookingSlot } from './booking-rules';
import { toBookingDto, toMyBookingDto } from './booking.mapper';
import { CreateBookingDto } from './dto/create-booking.dto';

// Columns selected for the room a "My bookings" row is rendered with.
const ROOM_COLUMNS = { id: true, name: true, floor: true } as const;

@Injectable()
export class BookingsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly metrics: MetricsService,
  ) {}

  async create(userId: string, dto: CreateBookingDto): Promise<CreateBookingResponse> {
    const repeatWeeks = dto.repeatWeeks ?? 1;
    const baseStart = new Date(dto.startsAt);
    const baseEnd = new Date(dto.endsAt);
    const now = new Date();

    // Materialize every weekly occurrence up front, validating each against the
    // booking rules (times keep the same office-zone wall clock across weeks).
    const occurrences = Array.from({ length: repeatWeeks }, (_, week) => ({
      startsAt: week === 0 ? baseStart : addOfficeWeeks(baseStart, week),
      endsAt: week === 0 ? baseEnd : addOfficeWeeks(baseEnd, week),
    }));
    occurrences.forEach((occurrence, week) => {
      const violations = validateBookingSlot(occurrence.startsAt, occurrence.endsAt, now);
      if (violations.length > 0) {
        const prefix = repeatWeeks > 1 ? `Week ${week + 1}: ` : '';
        throw new BadRequestException(`${prefix}${violations.join('; ')}`);
      }
    });

    // Booking requires a confirmed email (dev-mode confirmation flow). Fetch the
    // actor's id+name too, to attach as the created booking's author without a join.
    const actor = await this.db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { id: true, name: true, emailConfirmedAt: true },
    });
    if (!actor?.emailConfirmedAt) {
      throw new ForbiddenException('Please confirm your email address before booking a room.');
    }

    const room = await this.db.query.rooms.findFirst({
      where: eq(rooms.id, dto.roomId),
      columns: { id: true },
    });
    if (!room) {
      throw new NotFoundException('Room not found');
    }

    // Occurrences of a series share one id; a single booking has none.
    const seriesId = repeatWeeks > 1 ? randomUUID() : null;

    try {
      // One transaction with a single multi-row insert: the EXCLUDE constraint
      // guarantees no occurrence overlaps an existing booking, and the whole
      // series is all-or-nothing. Of two concurrent requests for the same slot
      // exactly one succeeds. RETURNING preserves VALUES order, so row 0 is the
      // base (week 1) occurrence.
      const created = await this.db.transaction((tx) =>
        tx
          .insert(bookings)
          .values(
            occurrences.map((occurrence) => ({
              roomId: dto.roomId,
              userId,
              title: dto.title,
              startsAt: occurrence.startsAt,
              endsAt: occurrence.endsAt,
              seriesId,
            })),
          )
          .returning(),
      );
      this.metrics.bookingCreated(created.length);
      const author = { id: actor.id, name: actor.name };
      return {
        booking: toBookingDto({ ...created[0], user: author }, userId),
        createdCount: created.length,
      };
    } catch (error) {
      if (isPgError(error, PG_EXCLUSION_VIOLATION)) {
        this.metrics.bookingConflict();
        throw new ConflictException(
          repeatWeeks > 1
            ? 'One or more weeks in the series overlap an existing booking for the room'
            : 'This time overlaps an existing booking for the room',
        );
      }
      throw error;
    }
  }

  /** Upcoming (incl. in-progress) bookings of the user, nearest first. */
  async findMyUpcoming(userId: string): Promise<MyBookingDto[]> {
    const rows = await this.db.query.bookings.findMany({
      where: and(eq(bookings.userId, userId), gt(bookings.endsAt, new Date())),
      orderBy: asc(bookings.startsAt),
      with: { room: { columns: ROOM_COLUMNS } },
    });
    return rows.map(toMyBookingDto);
  }

  /** Finished bookings of the user, most recent first, offset-paginated. */
  async findMyPast(userId: string, offset: number, limit: number): Promise<PastBookingsPageDto> {
    const where = and(eq(bookings.userId, userId), lte(bookings.endsAt, new Date()));
    // One transaction so the page and its total are a consistent snapshot.
    const [rows, total] = await this.db.transaction(async (tx) => {
      const items = await tx.query.bookings.findMany({
        where,
        orderBy: desc(bookings.startsAt),
        offset,
        limit,
        with: { room: { columns: ROOM_COLUMNS } },
      });
      const count = await tx.$count(bookings, where);
      return [items, count] as const;
    });
    return { items: rows.map(toMyBookingDto), total };
  }

  /**
   * Active "ends soon" notifications for the user: bookings the scheduler has
   * already flagged (its room's next slot is taken) that have not yet ended.
   * The in-app bell/toast polls this; each row disappears once the booking ends.
   */
  async findMyNotifications(userId: string): Promise<MyNotificationDto[]> {
    const rows = await this.db.query.bookings.findMany({
      where: and(
        eq(bookings.userId, userId),
        isNotNull(bookings.endNotifiedAt),
        gt(bookings.endsAt, new Date()),
      ),
      orderBy: asc(bookings.endsAt),
      with: { room: { columns: { id: true, name: true } } },
    });
    return rows.map((booking) => ({
      bookingId: booking.id,
      title: booking.title,
      room: { id: booking.room.id, name: booking.room.name },
      endsAt: booking.endsAt.toISOString(),
    }));
  }

  /**
   * Cancels a booking. With `scope = 'series'` on a recurring booking, cancels
   * this occurrence and every later one in the same series; otherwise just this
   * one. Returns how many bookings were removed.
   */
  async remove(
    userId: string,
    bookingId: string,
    scope: 'one' | 'series' = 'one',
  ): Promise<number> {
    const booking = await this.db.query.bookings.findFirst({ where: eq(bookings.id, bookingId) });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    if (booking.userId !== userId) {
      throw new ForbiddenException('You can only cancel your own bookings');
    }

    if (scope === 'series' && booking.seriesId) {
      const deleted = await this.db
        .delete(bookings)
        .where(
          and(
            eq(bookings.seriesId, booking.seriesId),
            eq(bookings.userId, userId),
            gte(bookings.startsAt, booking.startsAt),
          ),
        )
        .returning({ id: bookings.id });
      this.metrics.bookingCancelled(deleted.length);
      return deleted.length;
    }

    const deleted = await this.db
      .delete(bookings)
      .where(eq(bookings.id, bookingId))
      .returning({ id: bookings.id });
    if (deleted.length === 0) {
      // Deleted concurrently between the check and the delete.
      throw new NotFoundException('Booking not found');
    }
    this.metrics.bookingCancelled(1);
    return 1;
  }
}
