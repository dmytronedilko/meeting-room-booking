import {
  type BookingDto,
  DAYS_PER_WEEK,
  intervalsOverlap,
  MAX_BOOKING_MINUTES,
  OFFICE_TIME_ZONE,
  SLOT_MINUTES,
  SLOTS_PER_DAY,
  WORK_DAY_END_HOUR,
  WORK_DAY_START_HOUR,
} from '@office/shared';
import { format, parse } from 'date-fns';
import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';

/** Pure schedule math for the week grid; unit-tested separately from the UI. */

export interface FreeSegment {
  type: 'free';
  slotIndex: number;
  startsAt: Date;
}

export interface BookedSegment {
  type: 'booked';
  slotIndex: number;
  slotCount: number;
  booking: BookingDto;
}

export type ScheduleSegment = FreeSegment | BookedSegment;

const DAY_START_MINUTES = WORK_DAY_START_HOUR * 60;
const DAY_END_MINUTES = WORK_DAY_END_HOUR * 60;

/** The office-time-zone calendar date (`YYYY-MM-DD`) of a UTC instant. */
export function officeDateOf(instant: Date): string {
  return formatInTimeZone(instant, OFFICE_TIME_ZONE, 'yyyy-MM-dd');
}

/** Today's calendar date in the office time zone. */
export function officeToday(now: Date = new Date()): string {
  return officeDateOf(now);
}

/** Pure calendar-date arithmetic on `YYYY-MM-DD` strings. */
export function addDaysToDate(date: string, delta: number): string {
  const base = new Date(`${date}T12:00:00Z`);
  base.setUTCDate(base.getUTCDate() + delta);
  return base.toISOString().slice(0, 10);
}

/** Monday of the week containing `date` (pure string math). */
export function weekStartOf(date: string): string {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDaysToDate(date, -((day + 6) % 7));
}

/** The 7 calendar dates of the week starting at `weekStart`. */
export function weekDays(weekStart: string): string[] {
  return Array.from({ length: DAYS_PER_WEEK }, (_, index) => addDaysToDate(weekStart, index));
}

/** Office wall-clock label of a slot boundary, e.g. `09:30`. */
export function slotLabel(slotIndex: number): string {
  const minutes = DAY_START_MINUTES + slotIndex * SLOT_MINUTES;
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mm = String(minutes % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** UTC instant at which a slot starts on the given office-time-zone day. */
export function slotStartUtc(date: string, slotIndex: number): Date {
  return fromZonedTime(`${date}T${slotLabel(slotIndex)}:00`, OFFICE_TIME_ZONE);
}

/** Formats a UTC instant as wall-clock time (`HH:mm`) in the given zone. */
export function formatTimeInZone(instant: Date | string, timeZone: string): string {
  return formatInTimeZone(
    typeof instant === 'string' ? new Date(instant) : instant,
    timeZone,
    'HH:mm',
  );
}

/** `10:00–11:30` in the given zone. */
export function formatRangeInZone(startsAt: string, endsAt: string, timeZone: string): string {
  return `${formatTimeInZone(startsAt, timeZone)}–${formatTimeInZone(endsAt, timeZone)}`;
}

/** Parses a `YYYY-MM-DD` calendar date to a local Date (for display formatting). */
function parseIsoDate(date: string): Date {
  return parse(date, 'yyyy-MM-dd', new Date());
}

/** Short column heading for a grid day, e.g. `Mon 27`. */
export function formatDayHeading(date: string): string {
  return format(parseIsoDate(date), 'EEE d');
}

/** Full day label, e.g. `Tuesday, 28 July 2026`. */
export function formatDayLong(date: string): string {
  return format(parseIsoDate(date), 'EEEE, d MMMM yyyy');
}

/** Week range label, e.g. `27 Jul – 2 Aug 2026`. */
export function formatWeekRange(weekStart: string): string {
  const start = parseIsoDate(weekStart);
  const end = parseIsoDate(addDaysToDate(weekStart, DAYS_PER_WEEK - 1));
  return `${format(start, 'd MMM')} – ${format(end, 'd MMM yyyy')}`;
}

function minutesOfOfficeDay(instant: Date): number {
  const zoned = toZonedTime(instant, OFFICE_TIME_ZONE);
  return zoned.getHours() * 60 + zoned.getMinutes();
}

function slotIndexOf(instant: Date): number {
  return (minutesOfOfficeDay(instant) - DAY_START_MINUTES) / SLOT_MINUTES;
}

/** Buckets a week's bookings by their office-time-zone calendar day. */
export function groupByOfficeDate(bookings: BookingDto[]): Map<string, BookingDto[]> {
  const byDate = new Map<string, BookingDto[]>();
  for (const booking of bookings) {
    const date = officeDateOf(new Date(booking.startsAt));
    const list = byDate.get(date);
    if (list) {
      list.push(booking);
    } else {
      byDate.set(date, [booking]);
    }
  }
  return byDate;
}

/**
 * Splits one working day into rendered segments: booked blocks (spanning one
 * or more slots) and single free slots. Bookings are assumed to be sorted and
 * within working hours (the backend enforces both).
 */
export function buildDaySegments(date: string, bookings: BookingDto[]): ScheduleSegment[] {
  const segments: ScheduleSegment[] = [];
  let cursor = 0;
  // Running end of the last placed booking; the backend guarantees no overlaps,
  // but we still never render one booking on top of another.
  let placedEnd = -Infinity;

  for (const booking of bookings) {
    const startMs = new Date(booking.startsAt).getTime();
    const endMs = new Date(booking.endsAt).getTime();
    if (intervalsOverlap({ start: startMs, end: endMs }, { start: -Infinity, end: placedEnd })) {
      continue;
    }

    const start = Math.max(0, Math.floor(slotIndexOf(new Date(booking.startsAt))));
    const rawEnd = slotIndexOf(new Date(booking.endsAt));
    const end = Math.min(SLOTS_PER_DAY, Math.ceil(rawEnd <= 0 ? SLOTS_PER_DAY : rawEnd));
    if (end <= cursor) {
      continue;
    }
    placedEnd = endMs;
    while (cursor < start) {
      segments.push({ type: 'free', slotIndex: cursor, startsAt: slotStartUtc(date, cursor) });
      cursor += 1;
    }
    segments.push({ type: 'booked', slotIndex: start, slotCount: end - start, booking });
    cursor = end;
  }

  while (cursor < SLOTS_PER_DAY) {
    segments.push({ type: 'free', slotIndex: cursor, startsAt: slotStartUtc(date, cursor) });
    cursor += 1;
  }
  return segments;
}

/**
 * Longest allowed duration (minutes) for a booking starting at `slotIndex`:
 * limited by the next booking, the end of the working day and the 4h cap.
 */
export function maxDurationMinutes(segments: ScheduleSegment[], slotIndex: number): number {
  let nextBookedSlot = SLOTS_PER_DAY;
  for (const segment of segments) {
    if (segment.type === 'booked' && segment.slotIndex > slotIndex) {
      nextBookedSlot = segment.slotIndex;
      break;
    }
  }
  return Math.min(MAX_BOOKING_MINUTES, (nextBookedSlot - slotIndex) * SLOT_MINUTES);
}

/**
 * Vertical position of the "now" line as a 0..1 ratio of the day-column
 * height, or null when `date` is not today / now is outside working hours.
 */
export function currentTimeRatio(date: string, now: Date = new Date()): number | null {
  if (officeToday(now) !== date) {
    return null;
  }
  const minutes = minutesOfOfficeDay(now);
  if (minutes < DAY_START_MINUTES || minutes > DAY_END_MINUTES) {
    return null;
  }
  return (minutes - DAY_START_MINUTES) / (DAY_END_MINUTES - DAY_START_MINUTES);
}
