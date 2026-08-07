import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { BookingDto, RoomDto } from '@office/shared';
import { and, asc, eq, gte, lt } from 'drizzle-orm';

import { DRIZZLE, type DrizzleDB } from '../db/database.module';
import { bookings, rooms } from '../../db/schema';
import { toBookingDto } from '../bookings/booking.mapper';
import { officeDayRangeUtc } from '../time/office-time';

@Injectable()
export class RoomsService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findAll(): Promise<RoomDto[]> {
    const roomRows = await this.db.query.rooms.findMany({
      orderBy: [asc(rooms.floor), asc(rooms.name)],
    });
    return roomRows.map((room) => ({
      id: room.id,
      name: room.name,
      floor: room.floor,
      capacity: room.capacity,
      createdAt: room.createdAt.toISOString(),
    }));
  }

  /**
   * Bookings of a room for `days` consecutive office-time-zone calendar days
   * starting at `date` (the schedule grid requests a full week).
   */
  async findBookings(
    roomId: string,
    date: string,
    days: number,
    requesterId: string,
  ): Promise<BookingDto[]> {
    const room = await this.db.query.rooms.findFirst({
      where: eq(rooms.id, roomId),
      columns: { id: true },
    });
    if (!room) {
      throw new NotFoundException('Room not found');
    }

    const { start, end } = officeDayRangeUtc(date, days);
    const roomBookings = await this.db.query.bookings.findMany({
      where: and(
        eq(bookings.roomId, roomId),
        gte(bookings.startsAt, start),
        lt(bookings.startsAt, end),
      ),
      orderBy: asc(bookings.startsAt),
      with: { user: { columns: { id: true, name: true } } },
    });
    return roomBookings.map((booking) => toBookingDto(booking, requesterId));
  }
}
