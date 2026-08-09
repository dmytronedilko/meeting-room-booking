'use client';

import { useRouter } from 'next/navigation';
import type { MyBookingDto } from '@office/shared';
import { formatInTimeZone } from 'date-fns-tz';
import { CalendarX2, ChevronDown, Loader2, Repeat, X } from 'lucide-react';

import { formatRangeInZone, officeDateOf } from '@/lib/schedule';
import { useMyPastBookings, useMyUpcomingBookings } from '@/lib/hooks';
import { useUserTimeZone } from '@/lib/timezone';
import { CancelBookingDialog } from '@/components/cancel-booking-dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function MyBookingsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My bookings</h1>
        <p className="text-sm text-muted-foreground">
          Click a booking to open the room schedule for that week.
        </p>
      </div>

      <UpcomingSection />
      <PastSection />
    </div>
  );
}

function UpcomingSection() {
  const { data, isPending, isError, refetch } = useMyUpcomingBookings();

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium">Upcoming</h2>

      {isPending ? (
        <ListSkeleton />
      ) : isError ? (
        <ErrorCard onRetry={() => refetch()} label="Could not load your upcoming bookings." />
      ) : data.length === 0 ? (
        <EmptyCard label="No upcoming bookings — open a room and pick a free slot." />
      ) : (
        <Card className="divide-y">
          {data.map((booking) => (
            <BookingRow key={booking.id} booking={booking} cancellable />
          ))}
        </Card>
      )}
    </section>
  );
}

function PastSection() {
  const { data, isPending, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useMyPastBookings();

  const items = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium">Past</h2>

      {isPending ? (
        <ListSkeleton />
      ) : isError ? (
        <ErrorCard onRetry={() => refetch()} label="Could not load your past bookings." />
      ) : items.length === 0 ? (
        <EmptyCard label="Nothing here yet — finished bookings will appear in this list." />
      ) : (
        <>
          <Card className="divide-y">
            {items.map((booking) => (
              <BookingRow key={booking.id} booking={booking} />
            ))}
          </Card>
          {hasNextPage ? (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? <Loader2 className="animate-spin" /> : <ChevronDown />}
                Load more
              </Button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

function BookingRow({
  booking,
  cancellable = false,
}: {
  booking: MyBookingDto;
  cancellable?: boolean;
}) {
  const router = useRouter();
  const timeZone = useUserTimeZone();

  const dayLabel = formatInTimeZone(new Date(booking.startsAt), timeZone, 'EEE, d MMM yyyy');
  const timeRange = formatRangeInZone(booking.startsAt, booking.endsAt, timeZone);

  const openSchedule = () => {
    // Deep-link to the week (office calendar) containing the booking.
    router.push(`/rooms/${booking.room.id}?date=${officeDateOf(new Date(booking.startsAt))}`);
  };

  return (
    // biome-ignore lint/a11y/useSemanticElements: intentional keyboard-accessible clickable card (role/tabIndex/onKeyDown), not a nav anchor
    <div
      role="link"
      tabIndex={0}
      onClick={openSchedule}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openSchedule();
        }
      }}
      className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
    >
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 truncate font-medium">
          {booking.seriesId ? (
            <Repeat
              className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
              aria-label="Repeats weekly"
            />
          ) : null}
          <span className="truncate">{booking.title}</span>
        </p>
        <p className="truncate text-sm text-muted-foreground">
          {booking.room.name} · Floor {booking.room.floor}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <div className="text-right text-sm">
          <p>{dayLabel}</p>
          <p className="tabular-nums text-muted-foreground">{timeRange}</p>
        </div>

        {cancellable ? (
          <CancelBookingDialog
            booking={booking}
            stopPropagation
            description={
              <>
                “{booking.title}” in {booking.room.name} on {dayLabel} ({timeRange}) will be removed
                and the slot will become available to everyone.
                {booking.seriesId
                  ? ' This booking repeats weekly — cancel just this one or this and every later occurrence.'
                  : ''}
              </>
            }
            renderTrigger={(isPending) => (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive"
                disabled={isPending}
                aria-label={`Cancel booking ${booking.title}`}
                onClick={(event) => event.stopPropagation()}
              >
                {isPending ? <Loader2 className="animate-spin" /> : <X />}
                <span className="hidden sm:inline">Cancel</span>
              </Button>
            )}
          />
        ) : null}
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <Card className="divide-y">
      {Array.from({ length: 3 }).map((_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length loading skeleton, never reordered
        <div key={index} className="flex items-center justify-between px-4 py-3">
          <div className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-28" />
          </div>
          <Skeleton className="h-8 w-24" />
        </div>
      ))}
    </Card>
  );
}

function ErrorCard({ label, onRetry }: { label: string; onRetry: () => void }) {
  return (
    <Card className="p-8 text-center">
      <p className="mb-4 text-sm text-muted-foreground">{label}</p>
      <Button onClick={onRetry}>Try again</Button>
    </Card>
  );
}

function EmptyCard({ label }: { label: string }) {
  return (
    <Card className="flex flex-col items-center gap-3 p-8 text-center">
      <CalendarX2 className="h-8 w-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </Card>
  );
}
