import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreateBookingResponse,
  MyBookingDto,
  MyNotificationDto,
  PastBookingsPageDto,
} from '@office/shared';
import { Prisma } from '@prisma/client';

import { MetricsService } from '../metrics/metrics.service';
import { PrismaService } from '../prisma/prisma.service';
import { addOfficeWeeks } from '../time/office-time';
import { validateBookingSlot } from './booking-rules';
import { toBookingDto, toMyBookingDto } from './booking.mapper';
import { CreateBookingDto } from './dto/create-booking.dto';

const ROOM_SELECT = { id: true, name: true, floor: true } as const;
const USER_SELECT = { user: { select: { id: true, name: true } } } as const;

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
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

    // Booking requires a confirmed email (dev-mode confirmation flow).
    const actor = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { emailConfirmedAt: true },
    });
    if (!actor?.emailConfirmedAt) {
      throw new ForbiddenException('Please confirm your email address before booking a room.');
    }

    const room = await this.prisma.room.findUnique({
      where: { id: dto.roomId },
      select: { id: true },
    });
    if (!room) {
      throw new NotFoundException('Room not found');
    }

    // Occurrences of a series share one id; a single booking has none.
    const seriesId = repeatWeeks > 1 ? randomUUID() : null;

    try {
      // One transaction: the EXCLUDE constraint guarantees no occurrence
      // overlaps an existing booking, and the whole series is all-or-nothing.
      // Of two concurrent requests for the same slot exactly one succeeds.
      const created = await this.prisma.$transaction(
        occurrences.map((occurrence) =>
          this.prisma.booking.create({
            data: {
              roomId: dto.roomId,
              userId,
              title: dto.title,
              startsAt: occurrence.startsAt,
              endsAt: occurrence.endsAt,
              seriesId,
            },
            include: USER_SELECT,
          }),
        ),
      );
      this.metrics.bookingCreated(created.length);
      return { booking: toBookingDto(created[0], userId), createdCount: created.length };
    } catch (error) {
      if (isExclusionViolation(error)) {
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
    const bookings = await this.prisma.booking.findMany({
      where: { userId, endsAt: { gt: new Date() } },
      orderBy: { startsAt: 'asc' },
      include: { room: { select: ROOM_SELECT } },
    });
    return bookings.map(toMyBookingDto);
  }

  /** Finished bookings of the user, most recent first, offset-paginated. */
  async findMyPast(userId: string, offset: number, limit: number): Promise<PastBookingsPageDto> {
    const where = { userId, endsAt: { lte: new Date() } };
    const [bookings, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where,
        orderBy: { startsAt: 'desc' },
        skip: offset,
        take: limit,
        include: { room: { select: ROOM_SELECT } },
      }),
      this.prisma.booking.count({ where }),
    ]);
    return { items: bookings.map(toMyBookingDto), total };
  }

  /**
   * Active "ends soon" notifications for the user: bookings the scheduler has
   * already flagged (its room's next slot is taken) that have not yet ended.
   * The in-app bell/toast polls this; each row disappears once the booking ends.
   */
  async findMyNotifications(userId: string): Promise<MyNotificationDto[]> {
    const bookings = await this.prisma.booking.findMany({
      where: { userId, endNotifiedAt: { not: null }, endsAt: { gt: new Date() } },
      orderBy: { endsAt: 'asc' },
      include: { room: { select: { id: true, name: true } } },
    });
    return bookings.map((booking) => ({
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
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    if (booking.userId !== userId) {
      throw new ForbiddenException('You can only cancel your own bookings');
    }

    if (scope === 'series' && booking.seriesId) {
      const { count } = await this.prisma.booking.deleteMany({
        where: { seriesId: booking.seriesId, userId, startsAt: { gte: booking.startsAt } },
      });
      this.metrics.bookingCancelled(count);
      return count;
    }

    try {
      await this.prisma.booking.delete({ where: { id: bookingId } });
    } catch (error) {
      // Deleted concurrently between the check and the delete.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('Booking not found');
      }
      throw error;
    }
    this.metrics.bookingCancelled(1);
    return 1;
  }
}

/** Detects the PostgreSQL exclusion-constraint violation (SQLSTATE 23P01). */
function isExclusionViolation(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const meta = error.meta as { code?: string } | undefined;
    return error.code === 'P2004' || meta?.code === '23P01' || error.message.includes('23P01');
  }
  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    return error.message.includes('23P01') || error.message.includes('exclusion constraint');
  }
  return false;
}
