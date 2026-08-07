import type { ConfigService } from '@nestjs/config';
import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';

import type { DrizzleDB } from '../db/database.module';
import type { MetricsService } from '../metrics/metrics.service';
import { NotificationsService } from './notifications.service';

const NOW = new Date('2030-01-15T10:00:00.000Z');

const dialect = new PgDialect();

/**
 * The bound parameter values of a Drizzle SQL condition. With a mocked db the
 * query never executes, so this reads back what a `where(...)` would filter on
 * (e.g. the notification window bound, or the ids being marked notified).
 */
function paramsOf(sql: unknown): unknown[] {
  return dialect.sqlToQuery(sql as SQL).params;
}

/** Millisecond timestamps among a condition's params (Dates or ISO strings). */
function paramTimes(sql: unknown): number[] {
  return paramsOf(sql)
    .filter((p): p is Date | string | number => p instanceof Date || typeof p === 'string')
    .map((p) => new Date(p).getTime())
    .filter((t) => !Number.isNaN(t));
}

function createService(notifyBeforeMinutes = 10) {
  // db.query.bookings.findMany is called twice (due rows, then successors);
  // db.update(...).set(...).where(sql) marks the notified rows.
  const findMany = vi.fn();
  const updateWhere = vi.fn();
  const db = {
    query: { bookings: { findMany } },
    update: vi.fn(() => ({
      set: () => ({
        where: (sql: unknown) => {
          updateWhere(sql);
          return Promise.resolve();
        },
      }),
    })),
  };
  const metrics = { bookingEndNotified: vi.fn() };
  const config = { get: vi.fn().mockReturnValue(String(notifyBeforeMinutes)) };
  const service = new NotificationsService(
    db as unknown as DrizzleDB,
    metrics as unknown as MetricsService,
    config as unknown as ConfigService,
  );
  return { db, findMany, updateWhere, metrics, service };
}

function dueRow(id: string, endsAt: string) {
  return {
    id,
    userId: 'u1',
    roomId: 'r1',
    title: 'Standup',
    endsAt: new Date(endsAt),
    room: { name: 'Focus' },
  };
}

/** A back-to-back successor booking that starts exactly when `endsAt` passes. */
function successorAt(endsAt: string) {
  return { roomId: 'r1', startsAt: new Date(endsAt) };
}

describe('NotificationsService.processDueNotifications', () => {
  it('notifies due bookings whose next slot is taken, marks them, and counts them', async () => {
    const { findMany, updateWhere, metrics, service } = createService(10);
    findMany
      .mockResolvedValueOnce([
        dueRow('b1', '2030-01-15T10:05:00.000Z'),
        dueRow('b2', '2030-01-15T10:10:00.000Z'),
      ])
      .mockResolvedValueOnce([
        successorAt('2030-01-15T10:05:00.000Z'),
        successorAt('2030-01-15T10:10:00.000Z'),
      ]);

    const sent = await service.processDueNotifications(NOW);

    expect(sent).toBe(2);
    // Both due bookings are marked notified.
    expect(paramsOf(updateWhere.mock.calls[0][0])).toEqual(['b1', 'b2']);
    expect(metrics.bookingEndNotified).toHaveBeenCalledWith(2);
  });

  it('skips a due booking whose next slot is free (no back-to-back successor)', async () => {
    const { db, findMany, metrics, service } = createService(10);
    findMany
      .mockResolvedValueOnce([dueRow('b1', '2030-01-15T10:05:00.000Z')])
      .mockResolvedValueOnce([]); // nothing starts when b1 ends

    const sent = await service.processDueNotifications(NOW);

    expect(sent).toBe(0);
    expect(db.update).not.toHaveBeenCalled();
    expect(metrics.bookingEndNotified).not.toHaveBeenCalled();
  });

  it('notifies only the booking whose successor exists when several are due', async () => {
    const { findMany, updateWhere, metrics, service } = createService(10);
    findMany
      .mockResolvedValueOnce([
        dueRow('b1', '2030-01-15T10:05:00.000Z'), // has a successor
        dueRow('b2', '2030-01-15T10:10:00.000Z'), // no successor
      ])
      .mockResolvedValueOnce([successorAt('2030-01-15T10:05:00.000Z')]);

    const sent = await service.processDueNotifications(NOW);

    expect(sent).toBe(1);
    expect(paramsOf(updateWhere.mock.calls[0][0])).toEqual(['b1']);
    expect(metrics.bookingEndNotified).toHaveBeenCalledWith(1);
  });

  it('does nothing (no successor query, no update) when nothing is due', async () => {
    const { db, findMany, metrics, service } = createService(10);
    findMany.mockResolvedValueOnce([]);

    const sent = await service.processDueNotifications(NOW);

    expect(sent).toBe(0);
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(db.update).not.toHaveBeenCalled();
    expect(metrics.bookingEndNotified).not.toHaveBeenCalled();
  });

  it('honours a custom NOTIFY_BEFORE_MINUTES window', async () => {
    const { findMany, service } = createService(30);
    findMany.mockResolvedValueOnce([]);

    await service.processDueNotifications(NOW);

    // The due-rows query bounds endsAt at now + 30 min.
    const where = (findMany.mock.calls[0][0] as { where: unknown }).where;
    expect(paramTimes(where)).toContain(new Date('2030-01-15T10:30:00.000Z').getTime());
  });
});
