'use client';

import * as React from 'react';
import { OFFICE_TIME_ZONE } from '@office/shared';
import { getTimezoneOffset } from 'date-fns-tz';

/** The viewer's IANA time zone reported by the browser, e.g. "Europe/Berlin". */
function detectBrowserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || OFFICE_TIME_ZONE;
  } catch {
    return OFFICE_TIME_ZONE;
  }
}

/**
 * The time zone the UI renders times in: the viewer's own browser zone, so a
 * 10:00 office (Europe/Kyiv) slot shows as 09:00 for a Berlin viewer. Working
 * hours are still validated against office time on the server and times are
 * stored in UTC.
 *
 * It starts as the office zone so the server-rendered HTML and the first client
 * render agree (no hydration mismatch), then switches to the real browser zone
 * right after mount.
 */
export function useUserTimeZone(): string {
  const [timeZone, setTimeZone] = React.useState<string>(OFFICE_TIME_ZONE);
  React.useEffect(() => {
    setTimeZone(detectBrowserTimeZone());
  }, []);
  return timeZone;
}

/**
 * Human label for a time zone with its current offset, e.g. "Europe/Kyiv
 * (GMT+3)". The offset is DST-aware for the given instant; falls back to the
 * bare zone id if the runtime cannot format an offset.
 */
export function timeZoneLabel(timeZone: string, at: Date = new Date()): string {
  try {
    const offset = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' })
      .formatToParts(at)
      .find((part) => part.type === 'timeZoneName')?.value;
    return offset ? `${timeZone} (${offset})` : timeZone;
  } catch {
    return timeZone;
  }
}

/**
 * Whether displayed times equal office wall-clock right now: true when the
 * viewer's zone is the office zone or currently shares its UTC offset. This
 * treats the browser's legacy "Europe/Kiev" alias as equal to "Europe/Kyiv" and
 * only flags a shift when the times a viewer sees genuinely differ from office
 * time.
 */
export function rendersInOfficeTime(userTimeZone: string, at: Date = new Date()): boolean {
  if (userTimeZone === OFFICE_TIME_ZONE) {
    return true;
  }
  try {
    return getTimezoneOffset(userTimeZone, at) === getTimezoneOffset(OFFICE_TIME_ZONE, at);
  } catch {
    return false;
  }
}
