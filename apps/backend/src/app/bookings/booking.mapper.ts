import type { BookingDto, MyBookingDto } from '@office/shared';

import type { Booking } from '../../db/schema';

export type BookingWithUser = Booking & { user: { id: string; name: string } };

export type BookingWithRoom = Booking & { room: { id: string; name: string; floor: number } };

/** Maps a booking row (with its author) to the shared API shape. */
export function toBookingDto(booking: BookingWithUser, requesterId: string): BookingDto {
  return {
    id: booking.id,
    roomId: booking.roomId,
    title: booking.title,
    startsAt: booking.startsAt.toISOString(),
    endsAt: booking.endsAt.toISOString(),
    user: { id: booking.user.id, name: booking.user.name },
    isMine: booking.userId === requesterId,
    seriesId: booking.seriesId,
  };
}

/** Maps a booking row (with its room) to the "My bookings" shape. */
export function toMyBookingDto(booking: BookingWithRoom): MyBookingDto {
  return {
    id: booking.id,
    title: booking.title,
    startsAt: booking.startsAt.toISOString(),
    endsAt: booking.endsAt.toISOString(),
    room: { id: booking.room.id, name: booking.room.name, floor: booking.room.floor },
    seriesId: booking.seriesId,
  };
}
