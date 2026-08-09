/** The office time zone. Working hours are defined in it and validated against
 *  it on the server. The UI renders times in each viewer's own browser zone
 *  (so a 10:00 office slot shows as 09:00 for a Berlin viewer); times are still
 *  stored in UTC in the database. */
export const OFFICE_TIME_ZONE = 'Europe/Kyiv';

/** Bookings are allowed from 09:00 (inclusive) office time. */
export const WORK_DAY_START_HOUR = 9;

/** Bookings must end by 19:00 (inclusive as an end boundary) office time. */
export const WORK_DAY_END_HOUR = 19;

/** The schedule grid step, in minutes. */
export const SLOT_MINUTES = 30;

export const MIN_BOOKING_MINUTES = 30;

export const MAX_BOOKING_MINUTES = 240;

/** Number of 30-minute slots in a working day (09:00–19:00). */
export const SLOTS_PER_DAY = ((WORK_DAY_END_HOUR - WORK_DAY_START_HOUR) * 60) / SLOT_MINUTES;

/** Number of days shown in the schedule grid (a full week, Monday-based). */
export const DAYS_PER_WEEK = 7;

/** Maximum number of weekly occurrences a single recurring booking may create. */
export const MAX_REPEAT_WEEKS = 12;

export const MIN_PASSWORD_LENGTH = 8;

/** Maximum accepted password length (bcrypt input limit). */
export const MAX_PASSWORD_LENGTH = 72;

export const MAX_TITLE_LENGTH = 100;
