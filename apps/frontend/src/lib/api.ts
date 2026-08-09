import type {
  ApiErrorResponse,
  AuthResponseDto,
  BookingDto,
  ConfirmEmailRequest,
  CreateBookingRequest,
  CreateBookingResponse,
  LoginRequest,
  MyBookingDto,
  MyNotificationDto,
  PastBookingsPageDto,
  RegisterRequest,
  RoomDto,
  UserDto,
} from '@office/shared';

import { clearUser, getStoredUser } from './auth';

/** Relative `/api` in Docker (single origin behind the Nginx proxy), absolute URL in dev. */
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? '/api';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly error: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  // Only advertise a JSON body when we're actually sending one. Fastify's JSON
  // parser rejects an empty body when Content-Type is application/json, which
  // turns bodyless POSTs (logout, resend-confirmation) into 500s.
  if (init?.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    // The JWT lives in an HttpOnly cookie; include it on cross-origin dev
    // requests too (same-origin in Docker behind the proxy).
    credentials: 'include',
  });

  // Expired/invalid session: drop the cached profile and go to /login.
  if (response.status === 401 && getStoredUser()) {
    clearUser();
    window.location.assign('/login');
    throw new ApiError(401, 'Your session has expired, please log in again', 'Unauthorized');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const apiError = body as ApiErrorResponse | null;
    throw new ApiError(
      response.status,
      apiError?.message ?? `Request failed with status ${response.status}`,
      apiError?.error ?? 'Error',
    );
  }
  return body as T;
}

export const api = {
  register: (data: RegisterRequest) =>
    request<AuthResponseDto>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),

  login: (data: LoginRequest) =>
    request<AuthResponseDto>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),

  logout: () => request<void>('/auth/logout', { method: 'POST' }),

  getMe: () => request<UserDto>('/auth/me'),

  confirmEmail: (token: string) =>
    request<UserDto>('/auth/confirm', {
      method: 'POST',
      body: JSON.stringify({ token } satisfies ConfirmEmailRequest),
    }),

  resendConfirmation: () => request<void>('/auth/resend-confirmation', { method: 'POST' }),

  getRooms: () => request<RoomDto[]>('/rooms'),

  getRoomBookings: (roomId: string, date: string, days = 1) =>
    request<BookingDto[]>(
      `/rooms/${roomId}/bookings?date=${encodeURIComponent(date)}&days=${days}`,
    ),

  createBooking: (data: CreateBookingRequest) =>
    request<CreateBookingResponse>('/bookings', { method: 'POST', body: JSON.stringify(data) }),

  getMyUpcomingBookings: () => request<MyBookingDto[]>('/bookings/my/upcoming'),

  getMyPastBookings: (offset: number, limit: number) =>
    request<PastBookingsPageDto>(`/bookings/my/past?offset=${offset}&limit=${limit}`),

  getMyNotifications: () => request<MyNotificationDto[]>('/bookings/my/notifications'),

  deleteBooking: (id: string, scope: 'one' | 'series' = 'one') =>
    request<void>(`/bookings/${id}?scope=${scope}`, { method: 'DELETE' }),
};
