/**
 * Shared API contracts. All date-time values cross the wire as ISO-8601
 * strings in UTC (e.g. "2026-07-16T06:30:00.000Z").
 */

export interface UserDto {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  /** True once the user has confirmed their email (dev-mode confirmation flow). */
  emailConfirmed: boolean;
}

/** The subset of user data exposed on other people's bookings. */
export interface PublicUserDto {
  id: string;
  name: string;
}

export interface RoomDto {
  id: string;
  name: string;
  floor: number;
  capacity: number;
  createdAt: string;
}

export interface BookingDto {
  id: string;
  roomId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  user: PublicUserDto;
  /** Derived from the JWT of the requesting user. */
  isMine: boolean;
  /** Non-null when this booking is one occurrence of a weekly series. */
  seriesId: string | null;
}

/** A booking of the requesting user, as listed on the "My bookings" page. */
export interface MyBookingDto {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  room: {
    id: string;
    name: string;
    floor: number;
  };
  /** Non-null when this booking is one occurrence of a weekly series. */
  seriesId: string | null;
}

/** One page of the past-bookings list. */
export interface PastBookingsPageDto {
  items: MyBookingDto[];
  total: number;
}

/**
 * An active "your booking ends soon" notification: one of the requesting
 * user's bookings that the scheduler has flagged (its room's next slot is
 * taken) and that has not yet ended.
 */
export interface MyNotificationDto {
  bookingId: string;
  title: string;
  room: {
    id: string;
    name: string;
  };
  endsAt: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

/** Body of the email-confirmation call (token comes from the logged link). */
export interface ConfirmEmailRequest {
  token: string;
}

export interface AuthResponseDto {
  token: string;
  user: UserDto;
}

export interface CreateBookingRequest {
  roomId: string;
  /** 1–100 characters after trimming. */
  title: string;
  /** ISO-8601 UTC instant, must sit on a 30-minute boundary. */
  startsAt: string;
  /** ISO-8601 UTC instant, must sit on a 30-minute boundary. */
  endsAt: string;
  /**
   * Number of consecutive weekly occurrences to create (1 = a single booking).
   * Occurrences repeat at the same office-time weekday and time.
   */
  repeatWeeks?: number;
}

/** The result of creating a booking (or a weekly series). */
export interface CreateBookingResponse {
  /** The first occurrence (the slot the user clicked). */
  booking: BookingDto;
  /** How many occurrences were created (1 unless a series was requested). */
  createdCount: number;
}

export interface HealthResponse {
  status: 'ok';
}

/** The single error shape produced by the backend's global exception filter. */
export interface ApiErrorResponse {
  statusCode: number;
  message: string;
  error: string;
}
