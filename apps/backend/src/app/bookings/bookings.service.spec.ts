import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DrizzleDB } from '../db/database.module';
import type { MetricsService } from '../metrics/metrics.service';
import { BookingsService } from './bookings.service';

const USER_ID = '00000000-0000-4000-8000-000000000101';
const OTHER_USER_ID = '00000000-0000-4000-8000-000000000102';
const ROOM_ID = '00000000-0000-4000-8000-000000000001';
const BOOKING_ID = '00000000-0000-4000-8000-000000000201';
const SERIES_ID = '00000000-0000-4000-8000-000000000300';
const TITLE = 'Sprint planning';

// Far-future winter day: 09:00–10:00 UTC is 11:00–12:00 Europe/Kyiv, inside the
// 09:00–19:00 office working hours. (Slot alignment holds — Kyiv is +2/+3.)
const START = '2030-01-15T09:00:00.000Z';
const END = '2030-01-15T10:00:00.000Z';

function bookingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: BOOKING_ID,
    roomId: ROOM_ID,
    userId: USER_ID,
    title: TITLE,
    startsAt: new Date(START),
    endsAt: new Date(END),
    createdAt: new Date(),
    seriesId: null,
    endNotifiedAt: null,
    user: { id: USER_ID, name: 'Taras' },
    ...overrides,
  };
}

function createMocks() {
  const insertValues = vi.fn();
  // By default the insert echoes the values it was handed as the "returned"
  // rows, so create() builds its response from what it inserted.
  const insertReturning = vi.fn((vals: unknown) => {
    const rows = Array.isArray(vals) ? vals : [vals];
    return Promise.resolve(
      rows.map((row) => ({ id: BOOKING_ID, createdAt: new Date(), ...(row as object) })),
    );
  });
  const deleteReturning = vi.fn().mockResolvedValue([{ id: BOOKING_ID }]);

  const db = {
    query: {
      // A confirmed, named actor by default so create() passes the email gate
      // and can attribute the booking without a second query.
      users: {
        findFirst: vi.fn().mockResolvedValue({
          id: USER_ID,
          name: 'Taras',
          emailConfirmedAt: new Date('2020-01-01T00:00:00.000Z'),
        }),
      },
      rooms: { findFirst: vi.fn() },
      bookings: { findFirst: vi.fn(), findMany: vi.fn() },
    },
    insert: vi.fn(() => ({
      values: (vals: unknown) => {
        insertValues(vals);
        return { returning: () => insertReturning(vals) };
      },
    })),
    delete: vi.fn(() => ({
      where: () => ({ returning: () => deleteReturning() }),
    })),
    $count: vi.fn().mockResolvedValue(0),
    transaction: vi.fn(),
  };
  // The transaction runs its callback with the same mock standing in for `tx`.
  db.transaction.mockImplementation((cb: (tx: unknown) => unknown) => cb(db));

  const metrics = {
    bookingCreated: vi.fn(),
    bookingCancelled: vi.fn(),
    bookingConflict: vi.fn(),
  };
  const service = new BookingsService(
    db as unknown as DrizzleDB,
    metrics as unknown as MetricsService,
  );
  return { db, metrics, service, insertValues, insertReturning, deleteReturning };
}

function exclusionViolation(): Error {
  // The raw PostgreSQL exclusion-constraint error the pg driver surfaces
  // (SQLSTATE 23P01), which isPgError keys on.
  return Object.assign(
    new Error('conflicting key value violates exclusion constraint "Booking_no_overlap"'),
    { code: '23P01' },
  );
}

describe('BookingsService.create', () => {
  it('creates a single booking and increments the created counter', async () => {
    const { db, metrics, service, insertValues } = createMocks();
    db.query.rooms.findFirst.mockResolvedValue({ id: ROOM_ID });

    const result = await service.create(USER_ID, {
      roomId: ROOM_ID,
      title: TITLE,
      startsAt: START,
      endsAt: END,
    });

    expect(result.createdCount).toBe(1);
    expect(result.booking.isMine).toBe(true);
    expect(result.booking.title).toBe(TITLE);
    expect(result.booking.seriesId).toBeNull();
    // One multi-row insert; a single booking is an array of one occurrence.
    expect(db.insert).toHaveBeenCalledOnce();
    expect(insertValues).toHaveBeenCalledWith([
      expect.objectContaining({ title: TITLE, seriesId: null }),
    ]);
    expect(metrics.bookingCreated).toHaveBeenCalledWith(1);
  });

  it('creates a weekly series sharing one seriesId, a week apart', async () => {
    const { db, metrics, service, insertValues } = createMocks();
    db.query.rooms.findFirst.mockResolvedValue({ id: ROOM_ID });

    const result = await service.create(USER_ID, {
      roomId: ROOM_ID,
      title: TITLE,
      startsAt: START,
      endsAt: END,
      repeatWeeks: 3,
    });

    expect(result.createdCount).toBe(3);
    // All three occurrences go in one insert, sharing a generated seriesId.
    const values = insertValues.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(values).toHaveLength(3);
    const seriesIds = new Set(values.map((data) => data.seriesId));
    expect(seriesIds.size).toBe(1);
    expect([...seriesIds][0]).toEqual(expect.any(String));
    // Occurrences are one office-week apart (same wall clock).
    const starts = values.map((data) => (data.startsAt as Date).toISOString());
    expect(starts).toEqual([START, '2030-01-22T09:00:00.000Z', '2030-01-29T09:00:00.000Z']);
    expect(metrics.bookingCreated).toHaveBeenCalledWith(3);
  });

  it('rejects a slot that is not on the 30-minute grid without touching the database', async () => {
    const { db, service } = createMocks();

    await expect(
      service.create(USER_ID, {
        roomId: ROOM_ID,
        title: TITLE,
        startsAt: '2030-01-15T09:10:00.000Z',
        endsAt: '2030-01-15T10:10:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(db.query.rooms.findFirst).not.toHaveBeenCalled();
  });

  it('rejects booking in the past', async () => {
    const { service } = createMocks();

    await expect(
      service.create(USER_ID, {
        roomId: ROOM_ID,
        title: TITLE,
        startsAt: '2020-01-15T09:00:00.000Z',
        endsAt: '2020-01-15T10:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns 404 when the room does not exist', async () => {
    const { db, service } = createMocks();
    db.query.rooms.findFirst.mockResolvedValue(undefined);

    await expect(
      service.create(USER_ID, { roomId: ROOM_ID, title: TITLE, startsAt: START, endsAt: END }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects booking when the user has not confirmed their email (403)', async () => {
    const { db, service } = createMocks();
    db.query.users.findFirst.mockResolvedValue({ emailConfirmedAt: null });
    db.query.rooms.findFirst.mockResolvedValue({ id: ROOM_ID });

    await expect(
      service.create(USER_ID, { roomId: ROOM_ID, title: TITLE, startsAt: START, endsAt: END }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('translates an exclusion-constraint violation into 409 and counts the conflict', async () => {
    const { db, metrics, service, insertReturning } = createMocks();
    db.query.rooms.findFirst.mockResolvedValue({ id: ROOM_ID });
    insertReturning.mockRejectedValue(exclusionViolation());

    await expect(
      service.create(USER_ID, { roomId: ROOM_ID, title: TITLE, startsAt: START, endsAt: END }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(metrics.bookingConflict).toHaveBeenCalledOnce();
    expect(metrics.bookingCreated).not.toHaveBeenCalled();
  });

  it('allows touching boundaries (database accepts, no conflict raised)', async () => {
    const { db, service } = createMocks();
    db.query.rooms.findFirst.mockResolvedValue({ id: ROOM_ID });

    await expect(
      service.create(USER_ID, {
        roomId: ROOM_ID,
        title: TITLE,
        startsAt: END,
        endsAt: '2030-01-15T11:00:00.000Z',
      }),
    ).resolves.toMatchObject({ booking: { startsAt: END } });
  });
});

describe('BookingsService my bookings', () => {
  const roomRow = { id: ROOM_ID, name: 'Large', floor: 1 };

  function myRow(id: string, startsAt: string, endsAt: string) {
    return {
      id,
      roomId: ROOM_ID,
      userId: USER_ID,
      title: TITLE,
      startsAt: new Date(startsAt),
      endsAt: new Date(endsAt),
      createdAt: new Date(),
      seriesId: null,
      endNotifiedAt: null,
      room: roomRow,
    };
  }

  it('lists upcoming bookings nearest-first with room info', async () => {
    const { db, service } = createMocks();
    db.query.bookings.findMany.mockResolvedValue([myRow(BOOKING_ID, START, END)]);

    const result = await service.findMyUpcoming(USER_ID);

    expect(result).toEqual([
      {
        id: BOOKING_ID,
        title: TITLE,
        startsAt: START,
        endsAt: END,
        room: { id: ROOM_ID, name: 'Large', floor: 1 },
        seriesId: null,
      },
    ]);
  });

  it('paginates past bookings most-recent-first and returns the total', async () => {
    const { db, service } = createMocks();
    db.query.bookings.findMany.mockResolvedValue([myRow(BOOKING_ID, START, END)]);
    db.$count.mockResolvedValue(7);

    const result = await service.findMyPast(USER_ID, 5, 10);

    expect(result.total).toBe(7);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ id: BOOKING_ID, room: { name: 'Large' } });
  });
});

describe('BookingsService.remove', () => {
  let mocks: ReturnType<typeof createMocks>;

  beforeEach(() => {
    mocks = createMocks();
  });

  it("rejects deleting someone else's booking with 403 and keeps the record", async () => {
    mocks.db.query.bookings.findFirst.mockResolvedValue(bookingRow({ userId: OTHER_USER_ID }));

    await expect(mocks.service.remove(USER_ID, BOOKING_ID)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(mocks.db.delete).not.toHaveBeenCalled();
    expect(mocks.metrics.bookingCancelled).not.toHaveBeenCalled();
  });

  it('returns 404 for a missing booking', async () => {
    mocks.db.query.bookings.findFirst.mockResolvedValue(undefined);

    await expect(mocks.service.remove(USER_ID, BOOKING_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('deletes own booking and increments the cancelled counter', async () => {
    mocks.db.query.bookings.findFirst.mockResolvedValue(bookingRow());
    mocks.deleteReturning.mockResolvedValue([{ id: BOOKING_ID }]);

    const removed = await mocks.service.remove(USER_ID, BOOKING_ID);

    expect(removed).toBe(1);
    expect(mocks.db.delete).toHaveBeenCalledOnce();
    expect(mocks.metrics.bookingCancelled).toHaveBeenCalledWith(1);
  });

  it('cancels this and later occurrences when scope is "series"', async () => {
    mocks.db.query.bookings.findFirst.mockResolvedValue(bookingRow({ seriesId: SERIES_ID }));
    mocks.deleteReturning.mockResolvedValue([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);

    const removed = await mocks.service.remove(USER_ID, BOOKING_ID, 'series');

    expect(removed).toBe(3);
    expect(mocks.db.delete).toHaveBeenCalledOnce();
    expect(mocks.metrics.bookingCancelled).toHaveBeenCalledWith(3);
  });
});
