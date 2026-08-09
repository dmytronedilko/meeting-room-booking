import { OFFICE_TIME_ZONE } from '@office/shared';
import { fromZonedTime } from 'date-fns-tz';
import { describe, expect, it } from 'vitest';

import { validateBookingSlot } from './booking-rules';

// Instants are built from office (Europe/Kyiv) wall-clock time, so the tests
// stay correct regardless of the office zone's UTC offset. 2030-01-15 is a Tuesday.
const officeTime = (time: string): Date => fromZonedTime(`2030-01-15T${time}:00`, OFFICE_TIME_ZONE);
// A different calendar day, to show the rules are date-independent.
const otherDay = (time: string): Date => fromZonedTime(`2030-07-16T${time}:00`, OFFICE_TIME_ZONE);

const NOW = new Date('2030-01-01T00:00:00.000Z');

describe('validateBookingSlot', () => {
  it('accepts a valid 1-hour slot inside working hours', () => {
    expect(validateBookingSlot(officeTime('10:00'), officeTime('11:00'), NOW)).toEqual([]);
  });

  it('accepts boundary slots 09:00–09:30 and 18:30–19:00', () => {
    expect(validateBookingSlot(officeTime('09:00'), officeTime('09:30'), NOW)).toEqual([]);
    expect(validateBookingSlot(officeTime('18:30'), officeTime('19:00'), NOW)).toEqual([]);
  });

  it('accepts working-hours slots on any calendar day', () => {
    expect(validateBookingSlot(otherDay('09:00'), otherDay('13:00'), NOW)).toEqual([]);
  });

  it('rejects times not aligned to the 30-minute grid', () => {
    const violations = validateBookingSlot(officeTime('10:15'), officeTime('11:15'), NOW);
    expect(violations.join()).toContain('30-minute grid');
  });

  it('rejects a zero-length or inverted interval', () => {
    expect(validateBookingSlot(officeTime('10:00'), officeTime('10:00'), NOW).join()).toContain(
      'at least 30 minutes',
    );
    expect(validateBookingSlot(officeTime('11:00'), officeTime('10:00'), NOW).join()).toContain(
      'at least 30 minutes',
    );
  });

  it('rejects a duration over 4 hours', () => {
    const violations = validateBookingSlot(officeTime('09:00'), officeTime('13:30'), NOW);
    expect(violations.join()).toContain('4 hours');
  });

  it('accepts exactly 4 hours', () => {
    expect(validateBookingSlot(officeTime('09:00'), officeTime('13:00'), NOW)).toEqual([]);
  });

  it('rejects slots outside 09:00–19:00 office time', () => {
    expect(validateBookingSlot(officeTime('08:30'), officeTime('09:30'), NOW).join()).toContain(
      'between 09:00 and 19:00',
    );
    expect(validateBookingSlot(officeTime('18:30'), officeTime('19:30'), NOW).join()).toContain(
      'between 09:00 and 19:00',
    );
  });

  it('rejects a slot crossing the day boundary', () => {
    const start = officeTime('23:30');
    const end = new Date(start.getTime() + 60 * 60 * 1000); // 00:30 next day
    const violations = validateBookingSlot(start, end, NOW);
    expect(violations.join()).toContain('day boundary');
  });

  it('rejects booking in the past', () => {
    const now = officeTime('12:00');
    const violations = validateBookingSlot(officeTime('10:00'), officeTime('11:00'), now);
    expect(violations.join()).toContain('past');
  });

  it('allows a slot starting exactly now', () => {
    const now = officeTime('10:00');
    expect(validateBookingSlot(officeTime('10:00'), officeTime('11:00'), now)).toEqual([]);
  });
});
