'use client';

import * as React from 'react';
import {
  MAX_REPEAT_WEEKS,
  MAX_TITLE_LENGTH,
  MIN_BOOKING_MINUTES,
  SLOT_MINUTES,
} from '@office/shared';
import { Loader2 } from 'lucide-react';

import { formatDayLong, formatTimeInZone } from '@/lib/schedule';
import { useCreateBooking } from '@/lib/hooks';
import { useUserTimeZone } from '@/lib/timezone';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface SlotSelection {
  /** Office-time-zone calendar day of the clicked slot. */
  date: string;
  slotIndex: number;
  startsAt: Date;
  maxMinutes: number;
}

interface BookingDialogProps {
  roomId: string;
  roomName: string;
  weekStart: string;
  selection: SlotSelection | null;
  onClose: () => void;
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) {
    return `${rest} min`;
  }
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

export function BookingDialog({
  roomId,
  roomName,
  weekStart,
  selection,
  onClose,
}: BookingDialogProps) {
  const createBooking = useCreateBooking(roomId, weekStart);
  const timeZone = useUserTimeZone();
  const [durationMinutes, setDurationMinutes] = React.useState(MIN_BOOKING_MINUTES);
  const [repeatWeeks, setRepeatWeeks] = React.useState(1);
  const [title, setTitle] = React.useState('');
  const [titleError, setTitleError] = React.useState<string | null>(null);

  // Reset the form whenever a new slot is picked.
  React.useEffect(() => {
    if (selection) {
      setDurationMinutes(Math.min(60, selection.maxMinutes));
      setRepeatWeeks(1);
      setTitle('');
      setTitleError(null);
    }
  }, [selection]);

  if (!selection) {
    return null;
  }

  const durationOptions: number[] = [];
  for (
    let minutes = MIN_BOOKING_MINUTES;
    minutes <= selection.maxMinutes;
    minutes += SLOT_MINUTES
  ) {
    durationOptions.push(minutes);
  }

  const endsAt = new Date(selection.startsAt.getTime() + durationMinutes * 60_000);
  const startsAtIso = selection.startsAt.toISOString();
  const endsAtIso = endsAt.toISOString();

  const validateTitle = (value: string): string | null => {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return 'Enter a booking title';
    }
    if (trimmed.length > MAX_TITLE_LENGTH) {
      return `Title must be at most ${MAX_TITLE_LENGTH} characters`;
    }
    return null;
  };

  const confirm = () => {
    const error = validateTitle(title);
    setTitleError(error);
    if (error) {
      return;
    }
    createBooking.mutate(
      {
        roomId,
        title: title.trim(),
        startsAt: startsAtIso,
        endsAt: endsAtIso,
        ...(repeatWeeks > 1 ? { repeatWeeks } : {}),
      },
      // Close either way: on conflict the refetched schedule shows the truth.
      { onSettled: onClose },
    );
  };

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Book {roomName || 'this room'}</DialogTitle>
          <DialogDescription>{formatDayLong(selection.date)}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="booking-title">Title</Label>
          <Input
            id="booking-title"
            placeholder="Sprint planning"
            maxLength={MAX_TITLE_LENGTH}
            value={title}
            autoFocus
            aria-invalid={titleError ? true : undefined}
            onChange={(event) => {
              setTitle(event.target.value);
              if (titleError) {
                setTitleError(validateTitle(event.target.value));
              }
            }}
          />
          {titleError ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {titleError}
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Start</Label>
            <div className="flex h-10 items-center rounded-md border border-input bg-muted/40 px-3 text-sm tabular-nums">
              {formatTimeInZone(selection.startsAt, timeZone)}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="booking-duration">Duration</Label>
            <Select
              value={String(durationMinutes)}
              onValueChange={(value) => setDurationMinutes(Number(value))}
            >
              <SelectTrigger id="booking-duration">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {durationOptions.map((minutes) => (
                  <SelectItem key={minutes} value={String(minutes)}>
                    {formatDuration(minutes)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="booking-repeat">Repeat</Label>
          <Select
            value={String(repeatWeeks)}
            onValueChange={(value) => setRepeatWeeks(Number(value))}
          >
            <SelectTrigger id="booking-repeat">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Doesn&apos;t repeat</SelectItem>
              {Array.from({ length: MAX_REPEAT_WEEKS - 1 }, (_, index) => index + 2).map(
                (weeks) => (
                  <SelectItem key={weeks} value={String(weeks)}>
                    Weekly · {weeks} weeks
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </div>

        <p className="text-sm text-muted-foreground">
          {formatTimeInZone(startsAtIso, timeZone)} – {formatTimeInZone(endsAtIso, timeZone)} ·{' '}
          {formatDuration(durationMinutes)}
          {repeatWeeks > 1 ? ` · ${repeatWeeks} weekly occurrences` : ''}
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={createBooking.isPending}>
            Back
          </Button>
          <Button onClick={confirm} disabled={createBooking.isPending}>
            {createBooking.isPending ? <Loader2 className="animate-spin" /> : null}
            Confirm booking
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
