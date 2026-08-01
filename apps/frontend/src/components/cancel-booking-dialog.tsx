'use client';

import type * as React from 'react';

import { useCancelBooking } from '@/lib/hooks';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface CancelBookingDialogProps {
  /** The booking to cancel; `seriesId` drives the extra "this & later" action. */
  booking: { id: string; seriesId: string | null };
  /** Body copy explaining what will be removed (call-site specific). */
  description: React.ReactNode;
  /** Renders the trigger; receives the mutation's pending state for the button. */
  renderTrigger: (isPending: boolean) => React.ReactNode;
  /** Stop click propagation on the trigger and content (e.g. inside a clickable row). */
  stopPropagation?: boolean;
}

/**
 * Shared "Cancel this booking?" confirmation. For a recurring booking it offers
 * cancelling just this occurrence or this and every later one; otherwise a
 * single confirm. Owns the cancel mutation so callers only supply the trigger
 * and the descriptive copy.
 */
export function CancelBookingDialog({
  booking,
  description,
  renderTrigger,
  stopPropagation,
}: CancelBookingDialogProps) {
  const cancelBooking = useCancelBooking();
  const stop = stopPropagation ? (event: React.MouseEvent) => event.stopPropagation() : undefined;

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{renderTrigger(cancelBooking.isPending)}</AlertDialogTrigger>
      <AlertDialogContent onClick={stop}>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => cancelBooking.mutate({ bookingId: booking.id })}
          >
            {booking.seriesId ? 'Just this one' : 'Cancel booking'}
          </AlertDialogAction>
          {booking.seriesId ? (
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => cancelBooking.mutate({ bookingId: booking.id, scope: 'series' })}
            >
              This &amp; later
            </AlertDialogAction>
          ) : null}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
