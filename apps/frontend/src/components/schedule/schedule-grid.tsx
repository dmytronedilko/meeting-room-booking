'use client';

import * as React from 'react';
import { SLOTS_PER_DAY } from '@office/shared';
import { Plus } from 'lucide-react';

import {
  buildDaySegments,
  currentTimeRatio,
  formatDayHeading,
  formatTimeInZone,
  groupByOfficeDate,
  officeDateOf,
  maxDurationMinutes,
  type ScheduleSegment,
  slotStartUtc,
  weekDays,
} from '@/lib/schedule';
import { useRoomWeekBookings } from '@/lib/hooks';
import { useUserTimeZone } from '@/lib/timezone';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BookingBlock } from './booking-block';
import { BookingDialog, type SlotSelection } from './booking-dialog';

const SLOT_HEIGHT_REM = 2.5;

/** Time rail + 7 day columns; header and body grids share the template so rows
 *  align. Columns are 1fr (expand to fill on desktop) with a small min so on a
 *  phone more of the week is visible before horizontal scrolling kicks in. */
const GRID_TEMPLATE: React.CSSProperties = {
  gridTemplateColumns: '3rem repeat(7, minmax(5rem, 1fr))',
};

interface ScheduleGridProps {
  roomId: string;
  roomName: string;
  /** Monday of the displayed week (`YYYY-MM-DD`). */
  weekStart: string;
}

export function ScheduleGrid({ roomId, roomName, weekStart }: ScheduleGridProps) {
  const { data: bookings, isPending, isError, refetch } = useRoomWeekBookings(roomId, weekStart);
  const timeZone = useUserTimeZone();
  const [selection, setSelection] = React.useState<SlotSelection | null>(null);
  const [now, setNow] = React.useState(() => new Date());

  // Keep "past slot" dimming and the now-line fresh.
  React.useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  if (isPending) {
    return (
      <Card className="space-y-2 p-4">
        {Array.from({ length: 8 }).map((_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length loading skeleton, never reordered
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="p-8 text-center">
        <p className="mb-4 text-sm text-muted-foreground">Could not load the schedule.</p>
        <Button onClick={() => refetch()}>Try again</Button>
      </Card>
    );
  }

  const days = weekDays(weekStart);
  const bookingsByDate = groupByOfficeDate(bookings);
  const today = officeDateOf(now);

  return (
    <>
      {/* Outer frame clips the rounded corners; the inner element is the
          horizontal scroll container, so the time rail and header corner can be
          `sticky left-0` and stay visible while the week scrolls on a phone. */}
      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <div className="min-w-[38rem]">
            <div className="grid border-b border-border" style={GRID_TEMPLATE}>
              <div aria-hidden className="sticky left-0 z-20 bg-card" />
              {days.map((date) => (
                <div
                  key={date}
                  className={cn(
                    'py-2 text-center text-sm font-medium',
                    date === today ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  {formatDayHeading(date)}
                </div>
              ))}
            </div>

            <div className="grid divide-x divide-border" style={GRID_TEMPLATE}>
              <TimeRail weekStart={weekStart} timeZone={timeZone} />
              {days.map((date) => (
                <DayColumn
                  key={date}
                  date={date}
                  roomName={roomName}
                  segments={buildDaySegments(date, bookingsByDate.get(date) ?? [])}
                  now={now}
                  nowRatio={currentTimeRatio(date, now)}
                  timeZone={timeZone}
                  onSelect={setSelection}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {bookings.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">
          No bookings this week yet — click any free slot to make one.
        </p>
      ) : null}

      <BookingDialog
        roomId={roomId}
        roomName={roomName}
        weekStart={weekStart}
        selection={selection}
        onClose={() => setSelection(null)}
      />
    </>
  );
}

/**
 * Hour labels along the left edge, rendered in the viewer's time zone for the
 * displayed week (labels are taken from Monday's slot instants).
 */
function TimeRail({ weekStart, timeZone }: { weekStart: string; timeZone: string }) {
  return (
    <div className="sticky left-0 z-20 shrink-0 bg-card" aria-hidden>
      {Array.from({ length: SLOTS_PER_DAY }).map((_, index) => {
        const slotStart = slotStartUtc(weekStart, index);
        return (
          <div
            key={slotStart.toISOString()}
            className="relative pr-2 text-right text-xs tabular-nums text-muted-foreground"
            style={{ height: `${SLOT_HEIGHT_REM}rem` }}
          >
            {index % 2 === 0 ? (
              <span className="absolute -top-2 right-2">
                {formatTimeInZone(slotStart, timeZone)}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

interface DayColumnProps {
  date: string;
  roomName: string;
  segments: ScheduleSegment[];
  now: Date;
  nowRatio: number | null;
  timeZone: string;
  onSelect: (selection: SlotSelection) => void;
}

function DayColumn({
  date,
  roomName,
  segments,
  now,
  nowRatio,
  timeZone,
  onSelect,
}: DayColumnProps) {
  return (
    <div className="relative">
      <div className="flex flex-col divide-y divide-border/60">
        {segments.map((segment) =>
          segment.type === 'free' ? (
            <FreeSlot
              key={`free-${segment.slotIndex}`}
              segment={segment}
              roomName={roomName}
              date={date}
              now={now}
              timeZone={timeZone}
              onSelect={() =>
                onSelect({
                  date,
                  slotIndex: segment.slotIndex,
                  startsAt: segment.startsAt,
                  maxMinutes: maxDurationMinutes(segments, segment.slotIndex),
                })
              }
            />
          ) : (
            <BookingBlock
              key={segment.booking.id}
              booking={segment.booking}
              heightRem={segment.slotCount * SLOT_HEIGHT_REM}
              isPast={new Date(segment.booking.endsAt) < now}
              timeZone={timeZone}
            />
          ),
        )}
      </div>

      {nowRatio !== null ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 z-10"
          style={{ top: `${nowRatio * 100}%` }}
        >
          <div className="relative border-t-2 border-red-500">
            <div className="absolute -left-1 -top-[5px] h-2 w-2 rounded-full bg-red-500" />
          </div>
        </div>
      ) : null}
    </div>
  );
}

interface FreeSlotProps {
  segment: Extract<ScheduleSegment, { type: 'free' }>;
  roomName: string;
  date: string;
  now: Date;
  timeZone: string;
  onSelect: () => void;
}

function FreeSlot({ segment, roomName, date, now, timeZone, onSelect }: FreeSlotProps) {
  const isPast = segment.startsAt < now;
  const label = formatTimeInZone(segment.startsAt, timeZone);

  return (
    <button
      type="button"
      disabled={isPast}
      onClick={onSelect}
      aria-label={`Book ${roomName} on ${date} at ${label}`}
      className={cn(
        'group flex w-full items-center justify-center transition-colors',
        isPast
          ? 'cursor-not-allowed bg-muted/40'
          : 'bg-background hover:bg-primary/5 focus-visible:bg-primary/5 focus-visible:outline-none',
      )}
      style={{ height: `${SLOT_HEIGHT_REM}rem` }}
    >
      {!isPast ? (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-transparent group-hover:text-primary group-focus-visible:text-primary">
          <Plus className="h-3.5 w-3.5" />
          {label}
        </span>
      ) : null}
    </button>
  );
}
