import { OFFICE_TIME_ZONE, type BookingDto } from '@office/shared';
import { fromZonedTime } from 'date-fns-tz';
import { describe, expect, it } from 'vitest';

import {
  addDaysToDate,
  buildDaySegments,
  currentTimeRatio,
  formatTimeInZone,
  groupByOfficeDate,
  maxDurationMinutes,
  officeToday,
  slotLabel,
  slotStartUtc,
  weekDays,
  weekStartOf,
} from './schedule';

const DATE = '2030-01-15'; // A Tuesday.

/** UTC instant of an office (Europe/Kyiv) wall-clock time — zone-agnostic. */
function officeIso(date: string, time: string): string {
  return fromZonedTime(`${date}T${time}:00`, OFFICE_TIME_ZONE).toISOString();
}

function booking(startsAt: string, endsAt: string, id = 'b1'): BookingDto {
  return {
    id,
    roomId: 'r1',
    title: 'Sync',
    startsAt,
    endsAt,
    user: { id: 'u1', name: 'Taras' },
    isMine: false,
    seriesId: null,
  };
}

describe('schedule math', () => {
  it('computes slot starts as the UTC instant of the office wall time', () => {
    // 09:00 office == slot 0; 10:30 office == slot 3.
    expect(slotStartUtc(DATE, 0).toISOString()).toBe(officeIso(DATE, '09:00'));
    expect(slotStartUtc(DATE, 3).toISOString()).toBe(officeIso(DATE, '10:30'));
  });

  it('computes slot starts consistently on any date', () => {
    expect(slotStartUtc('2030-07-16', 0).toISOString()).toBe(officeIso('2030-07-16', '09:00'));
  });

  it('labels slots with office wall time 09:00-19:00', () => {
    expect(slotLabel(0)).toBe('09:00');
    expect(slotLabel(1)).toBe('09:30');
    expect(slotLabel(19)).toBe('18:30');
  });

  it('formats instants in office wall time', () => {
    expect(formatTimeInZone(slotStartUtc(DATE, 0), OFFICE_TIME_ZONE)).toBe('09:00');
    expect(formatTimeInZone(slotStartUtc(DATE, 1), OFFICE_TIME_ZONE)).toBe('09:30');
  });

  it('adds calendar days without time-zone drift', () => {
    expect(addDaysToDate('2030-01-31', 1)).toBe('2030-02-01');
    expect(addDaysToDate('2030-01-01', -1)).toBe('2029-12-31');
  });

  it('finds the Monday of a week for any weekday', () => {
    expect(weekStartOf('2030-01-15')).toBe('2030-01-14'); // Tuesday → Monday
    expect(weekStartOf('2030-01-14')).toBe('2030-01-14'); // Monday → itself
    expect(weekStartOf('2030-01-20')).toBe('2030-01-14'); // Sunday → past Monday
  });

  it('enumerates the 7 days of a week', () => {
    const days = weekDays('2030-01-14');
    expect(days).toHaveLength(7);
    expect(days[0]).toBe('2030-01-14');
    expect(days[6]).toBe('2030-01-20');
  });

  it('groups bookings by office calendar day', () => {
    const monday = booking(
      officeIso('2030-01-14', '12:00'),
      officeIso('2030-01-14', '13:00'),
      'mon',
    );
    const tuesday = booking(
      officeIso('2030-01-15', '12:00'),
      officeIso('2030-01-15', '13:00'),
      'tue',
    );
    const grouped = groupByOfficeDate([monday, tuesday]);

    expect(grouped.get('2030-01-14')).toEqual([monday]);
    expect(grouped.get('2030-01-15')).toEqual([tuesday]);
  });

  it('builds segments: free slots around a booked block', () => {
    // 10:00–11:30 office == slots 2,3,4.
    const segments = buildDaySegments(DATE, [
      booking(officeIso(DATE, '10:00'), officeIso(DATE, '11:30')),
    ]);

    expect(segments).toHaveLength(2 + 1 + 15); // 2 free, 1 booked (3 slots), 15 free
    expect(segments[2]).toMatchObject({ type: 'booked', slotIndex: 2, slotCount: 3 });
    expect(segments[3]).toMatchObject({ type: 'free', slotIndex: 5 });
  });

  it('keeps touching bookings adjacent without gaps', () => {
    const segments = buildDaySegments(DATE, [
      booking(officeIso(DATE, '10:00'), officeIso(DATE, '11:00'), 'b1'),
      booking(officeIso(DATE, '11:00'), officeIso(DATE, '12:00'), 'b2'),
    ]);

    const booked = segments.filter((s) => s.type === 'booked');
    expect(booked).toHaveLength(2);
    expect(booked[0]).toMatchObject({ slotIndex: 2, slotCount: 2 });
    expect(booked[1]).toMatchObject({ slotIndex: 4, slotCount: 2 });
  });

  it('caps the bookable duration at the next booking and at 4 hours', () => {
    // Booking at 14:00 office == slot 10.
    const segments = buildDaySegments(DATE, [
      booking(officeIso(DATE, '14:00'), officeIso(DATE, '15:00')),
    ]);

    expect(maxDurationMinutes(segments, 8)).toBe(60); // 13:00 → 14:00
    expect(maxDurationMinutes(segments, 0)).toBe(240); // 4h cap before 14:00
    expect(maxDurationMinutes(segments, 18)).toBe(60); // 18:00 → 19:00 (day end)
  });

  it('positions the now-line only for today within working hours', () => {
    expect(officeToday(new Date(officeIso(DATE, '12:00')))).toBe(DATE);
    // 14:00 office == halfway through 09:00–19:00
    expect(currentTimeRatio(DATE, new Date(officeIso(DATE, '14:00')))).toBeCloseTo(0.5);
    expect(currentTimeRatio(DATE, new Date(officeIso(DATE, '02:00')))).toBeNull();
    expect(currentTimeRatio('2030-01-16', new Date(officeIso(DATE, '12:00')))).toBeNull();
  });
});
