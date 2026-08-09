'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DAYS_PER_WEEK, type CreateBookingRequest } from '@office/shared';
import { toast } from 'sonner';

import { api, ApiError } from './api';

const PAST_PAGE_SIZE = 10;

/** Current user profile from the server — the authoritative email-confirmation state. */
export function useMe() {
  return useQuery({ queryKey: ['me'], queryFn: api.getMe, staleTime: 0 });
}

export function useRooms() {
  return useQuery({ queryKey: ['rooms'], queryFn: api.getRooms });
}

/** A room's bookings for the whole week starting at `weekStart` (Monday). */
export function useRoomWeekBookings(roomId: string, weekStart: string) {
  return useQuery({
    queryKey: ['bookings', roomId, weekStart],
    queryFn: () => api.getRoomBookings(roomId, weekStart, DAYS_PER_WEEK),
    refetchInterval: 30_000,
  });
}

export function useMyUpcomingBookings() {
  return useQuery({
    queryKey: ['my-bookings', 'upcoming'],
    queryFn: api.getMyUpcomingBookings,
  });
}

/** Lazy-loaded pages of past bookings, most recent first. */
export function useMyPastBookings() {
  return useInfiniteQuery({
    queryKey: ['my-bookings', 'past'],
    queryFn: ({ pageParam }) => api.getMyPastBookings(pageParam, PAST_PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((count, page) => count + page.items.length, 0);
      return loaded < lastPage.total ? loaded : undefined;
    },
  });
}

/** Active "your booking ends soon" notifications for the bell; polled every minute. */
export function useMyNotifications() {
  return useQuery({
    queryKey: ['my-notifications'],
    queryFn: api.getMyNotifications,
    refetchInterval: 60_000,
  });
}

function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Something went wrong, please try again';
}

export function useCreateBooking(roomId: string, weekStart: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateBookingRequest) => api.createBooking(data),
    onSuccess: (result) => {
      toast.success(
        result.createdCount > 1 ? `Booked ${result.createdCount} weekly slots` : 'Room booked',
      );
    },
    onError: (error: unknown) => {
      // Includes 409s from booking races: show the reason and refetch below.
      toast.error(errorMessage(error));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['bookings', roomId, weekStart] });
      void queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
    },
  });
}

/** Cancels a booking from any screen; refreshes schedules and my-bookings. */
export function useCancelBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingId, scope = 'one' }: { bookingId: string; scope?: 'one' | 'series' }) =>
      api.deleteBooking(bookingId, scope),
    onSuccess: (_data, variables) => {
      toast.success(variables.scope === 'series' ? 'Series cancelled' : 'Booking cancelled');
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['bookings'] });
      void queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
    },
  });
}

/** Re-logs a fresh email-confirmation link for the current unconfirmed user. */
export function useResendConfirmation() {
  return useMutation({
    mutationFn: () => api.resendConfirmation(),
    onSuccess: () => toast.success('Confirmation link re-sent — check the server log'),
    onError: (error: unknown) => toast.error(errorMessage(error)),
  });
}
