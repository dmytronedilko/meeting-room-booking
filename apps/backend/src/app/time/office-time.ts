import { BadRequestException } from '@nestjs/common';
import { OFFICE_TIME_ZONE } from '@office/shared';
import { addDays, format, isValid, parse } from 'date-fns';
import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';

const DATE_FORMAT = 'yyyy-MM-dd';

/** Throws 400 unless `value` is a real calendar date in `YYYY-MM-DD` format. */
export function assertValidIsoDate(value: string): void {
  const parsed = parse(value, DATE_FORMAT, new Date());
  if (!isValid(parsed) || format(parsed, DATE_FORMAT) !== value) {
    throw new BadRequestException('Invalid date, expected YYYY-MM-DD');
  }
}

/**
 * UTC instants covering `days` consecutive calendar days in the office time
 * zone, starting at `date` (half-open range).
 */
export function officeDayRangeUtc(date: string, days = 1): { start: Date; end: Date } {
  assertValidIsoDate(date);
  const start = fromZonedTime(`${date}T00:00:00`, OFFICE_TIME_ZONE);
  const endDate = format(addDays(parse(date, DATE_FORMAT, new Date()), days), DATE_FORMAT);
  const end = fromZonedTime(`${endDate}T00:00:00`, OFFICE_TIME_ZONE);
  return { start, end };
}

/** The office-zone calendar date (`YYYY-MM-DD`) of a UTC instant. */
export function officeDateOf(instant: Date): string {
  return formatInTimeZone(instant, OFFICE_TIME_ZONE, DATE_FORMAT);
}

/** Minutes since office-zone midnight for a UTC instant. */
export function officeMinutesOfDay(instant: Date): number {
  const zoned = toZonedTime(instant, OFFICE_TIME_ZONE);
  return zoned.getHours() * 60 + zoned.getMinutes();
}

/**
 * Adds whole weeks in the office time zone, preserving the wall-clock time.
 * Doing the arithmetic on the zoned wall time (not by adding raw milliseconds)
 * keeps e.g. 10:00 at 10:00 even across a DST transition.
 */
export function addOfficeWeeks(instant: Date, weeks: number): Date {
  const zoned = toZonedTime(instant, OFFICE_TIME_ZONE);
  const shifted = addDays(zoned, weeks * 7);
  return fromZonedTime(format(shifted, "yyyy-MM-dd'T'HH:mm:ss"), OFFICE_TIME_ZONE);
}
