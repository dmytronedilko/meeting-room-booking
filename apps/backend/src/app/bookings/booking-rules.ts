import {
  MAX_BOOKING_MINUTES,
  MIN_BOOKING_MINUTES,
  SLOT_MINUTES,
  WORK_DAY_END_HOUR,
  WORK_DAY_START_HOUR,
} from '@office/shared';

import { officeDateOf, officeMinutesOfDay } from '../time/office-time';

const SLOT_MS = SLOT_MINUTES * 60 * 1000;
const WORK_DAY_START_MINUTES = WORK_DAY_START_HOUR * 60;
const WORK_DAY_END_MINUTES = WORK_DAY_END_HOUR * 60;

/**
 * The single source of truth for booking slot rules. Returns a list of
 * human-readable violations (empty when the slot is valid).
 *
 * Alignment is checked against UTC epoch time; Europe/Kyiv is always a
 * whole-hour offset (+2/+3), so a 30-minute UTC grid matches the office
 * wall-clock grid.
 */
export function validateBookingSlot(startsAt: Date, endsAt: Date, now: Date): string[] {
  const violations: string[] = [];

  if (startsAt.getTime() % SLOT_MS !== 0 || endsAt.getTime() % SLOT_MS !== 0) {
    violations.push(`Start and end must be aligned to the ${SLOT_MINUTES}-minute grid`);
  }

  const durationMinutes = (endsAt.getTime() - startsAt.getTime()) / 60_000;
  if (durationMinutes < MIN_BOOKING_MINUTES) {
    violations.push(`Booking must last at least ${MIN_BOOKING_MINUTES} minutes`);
  }
  if (durationMinutes > MAX_BOOKING_MINUTES) {
    violations.push(`Booking must not exceed ${MAX_BOOKING_MINUTES / 60} hours`);
  }

  if (
    durationMinutes > 0 &&
    officeDateOf(startsAt) !== officeDateOf(new Date(endsAt.getTime() - 1))
  ) {
    violations.push('Booking must not cross a day boundary');
  }

  const startMinutes = officeMinutesOfDay(startsAt);
  // 00:00 as an end boundary means "midnight after the last minute of the day".
  const rawEndMinutes = officeMinutesOfDay(endsAt);
  const endMinutes = rawEndMinutes === 0 && durationMinutes > 0 ? 24 * 60 : rawEndMinutes;
  if (startMinutes < WORK_DAY_START_MINUTES || endMinutes > WORK_DAY_END_MINUTES) {
    violations.push(
      `Bookings are allowed only between ${String(WORK_DAY_START_HOUR).padStart(2, '0')}:00 and ${String(WORK_DAY_END_HOUR).padStart(2, '0')}:00`,
    );
  }

  if (startsAt.getTime() < now.getTime()) {
    violations.push('Booking time is in the past');
  }

  return violations;
}
