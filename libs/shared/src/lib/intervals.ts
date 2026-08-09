/**
 * The canonical definition of "two bookings overlap", shared by the frontend
 * schedule renderer and mirrored by the database's
 * `tstzrange(startsAt, endsAt)` EXCLUDE constraint.
 */

export interface TimeInterval {
  /** Inclusive start, as a Date or epoch-millisecond number. */
  start: Date | number;
  /** Exclusive end, as a Date or epoch-millisecond number. */
  end: Date | number;
}

function toMs(value: Date | number): number {
  return typeof value === 'number' ? value : value.getTime();
}

/**
 * True when two half-open intervals `[start, end)` overlap.
 *
 * Touching intervals (`a.end === b.start`) do NOT overlap — this is exactly
 * why back-to-back bookings such as 10:00–11:00 and 11:00–12:00 are allowed
 * and why the database uses half-open `tstzrange` ranges.
 */
export function intervalsOverlap(a: TimeInterval, b: TimeInterval): boolean {
  return toMs(a.start) < toMs(b.end) && toMs(b.start) < toMs(a.end);
}
