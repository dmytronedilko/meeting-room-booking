'use client';

import * as React from 'react';
import type { MyNotificationDto } from '@office/shared';
import { Bell } from 'lucide-react';
import { toast } from 'sonner';

import { formatTimeInZone } from '@/lib/schedule';
import { useMyNotifications } from '@/lib/hooks';
import { useUserTimeZone } from '@/lib/timezone';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// Booking ids already toasted, persisted so the proactive nudge fires exactly
// once per booking even across reloads (the count/list still show while active).
const SEEN_KEY = 'mrb.notified';

function readSeen(): Set<string> {
  if (typeof window === 'undefined') {
    return new Set();
  }
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

function writeSeen(seen: Set<string>): void {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
  } catch {
    // Ignore quota/serialization errors — the bell still shows the live count.
  }
}

function minutesLeft(endsAt: string): number {
  return Math.max(0, Math.round((new Date(endsAt).getTime() - Date.now()) / 60_000));
}

/**
 * Header bell for "your booking ends soon (the room is needed next)" alerts.
 * Polls `GET /bookings/my/notifications` (the scheduler's flagged bookings) and
 * shows a live count + list; new ones also raise a one-time toast.
 */
export function NotificationsBell() {
  const { data } = useMyNotifications();
  const timeZone = useUserTimeZone();
  // Stable reference so the toast effect only re-runs when the data actually changes.
  const notifications = React.useMemo<MyNotificationDto[]>(() => data ?? [], [data]);

  React.useEffect(() => {
    if (notifications.length === 0) {
      return;
    }
    const seen = readSeen();
    let changed = false;
    for (const notification of notifications) {
      if (!seen.has(notification.bookingId)) {
        toast(`“${notification.title}” ends in ${minutesLeft(notification.endsAt)} min`, {
          description: `${notification.room.name} is booked right after — time to wrap up.`,
        });
        seen.add(notification.bookingId);
        changed = true;
      }
    }
    if (changed) {
      writeSeen(seen);
    }
  }, [notifications]);

  const count = notifications.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={count > 0 ? `Notifications (${count})` : 'Notifications'}
        >
          <Bell />
          {count > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {count}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b px-4 py-3">
          <p className="text-sm font-medium">Ending soon</p>
          <p className="text-xs text-muted-foreground">Rooms needed right after your booking</p>
        </div>
        {count === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            Nothing ending soon.
          </p>
        ) : (
          <ul className="max-h-80 divide-y overflow-y-auto">
            {notifications.map((notification) => (
              <li key={notification.bookingId} className="px-4 py-3">
                <p className="truncate text-sm font-medium">{notification.title}</p>
                <p className="text-xs text-muted-foreground">
                  {notification.room.name} · ends {formatTimeInZone(notification.endsAt, timeZone)}{' '}
                  (in {minutesLeft(notification.endsAt)} min)
                </p>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
