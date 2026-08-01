import { Injectable, NotFoundException } from '@nestjs/common';
import type { BookingDto, RoomDto } from '@office/shared';

import { toBookingDto } from '../bookings/booking.mapper';
import { PrismaService } from '../prisma/prisma.service';
import { officeDayRangeUtc } from '../time/office-time';

@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<RoomDto[]> {
    const rooms = await this.prisma.room.findMany({ orderBy: [{ floor: 'asc' }, { name: 'asc' }] });
    return rooms.map((room) => ({
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
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      select: { id: true },
    });
    if (!room) {
      throw new NotFoundException('Room not found');
    }

    const { start, end } = officeDayRangeUtc(date, days);
    const bookings = await this.prisma.booking.findMany({
      where: { roomId, startsAt: { gte: start, lt: end } },
      orderBy: { startsAt: 'asc' },
      include: { user: { select: { id: true, name: true } } },
    });
    return bookings.map((booking) => toBookingDto(booking, requesterId));
  }
}
