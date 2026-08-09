'use client';

import type { BookingDto } from '@office/shared';
import { Loader2, Repeat, X } from 'lucide-react';

import { formatRangeInZone } from '@/lib/schedule';
import { cn } from '@/lib/utils';
import { CancelBookingDialog } from '@/components/cancel-booking-dialog';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface BookingBlockProps {
  booking: BookingDto;
  heightRem: number;
  isPast: boolean;
  /** The viewer's IANA time zone; all times are rendered in it. */
  timeZone: string;
}

export function BookingBlock({ booking, heightRem, isPast, timeZone }: BookingBlockProps) {
  const timeRange = formatRangeInZone(booking.startsAt, booking.endsAt, timeZone);
  const author = booking.isMine ? 'You' : booking.user.name;

  return (
    <div
      className={cn(
        'flex items-start justify-between gap-1 overflow-hidden border-l-4 px-1.5 py-1 text-left',
        booking.isMine
          ? 'border-l-primary bg-primary/10'
          : 'border-l-muted-foreground/40 bg-muted/60',
        isPast && 'opacity-50',
      )}
      style={{ height: `${heightRem}rem` }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="min-w-0">
            <p
              className={cn(
                'flex items-center gap-1 truncate text-xs font-medium',
                booking.isMine && 'text-primary',
              )}
            >
              {booking.seriesId ? (
                <Repeat className="h-3 w-3 shrink-0" aria-label="Repeats weekly" />
              ) : null}
              <span className="truncate">{booking.title}</span>
            </p>
            <p className="truncate text-[11px] tabular-nums text-muted-foreground">{timeRange}</p>
            <p className="truncate text-[11px] text-muted-foreground">{author}</p>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {booking.title} · {timeRange} · {booking.user.name}
          {booking.seriesId ? ' · repeats weekly' : ''}
        </TooltipContent>
      </Tooltip>

      {booking.isMine && !isPast ? (
        <CancelBookingDialog
          booking={booking}
          description={
            <>
              Your booking “{booking.title}” ({timeRange}) will be removed and the slot will become
              available to everyone.
              {booking.seriesId
                ? ' This booking repeats weekly — you can cancel just this one or this and every later occurrence.'
                : ''}
            </>
          }
          renderTrigger={(isPending) => (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
              disabled={isPending}
              aria-label={`Cancel booking ${booking.title}`}
            >
              {isPending ? <Loader2 className="animate-spin" /> : <X />}
            </Button>
          )}
        />
      ) : null}
    </div>
  );
}
