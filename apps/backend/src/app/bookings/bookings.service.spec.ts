import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { MetricsService } from '../metrics/metrics.service';
import type { PrismaService } from '../prisma/prisma.service';
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
  const prisma = {
    // Confirmed by default so create() passes the email-confirmation gate.
    user: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ emailConfirmedAt: new Date('2020-01-01T00:00:00.000Z') }),
    },
    room: { findUnique: vi.fn() },
    booking: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    // Array form resolves each queued create, mirroring prisma's $transaction.
    $transaction: vi.fn((ops: unknown) => (Array.isArray(ops) ? Promise.all(ops) : ops)),
  };
  const metrics = {
    bookingCreated: vi.fn(),
    bookingCancelled: vi.fn(),
    bookingConflict: vi.fn(),
  };
  const service = new BookingsService(
    prisma as unknown as PrismaService,
    metrics as unknown as MetricsService,
  );
  return { prisma, metrics, service };
}

function exclusionViolation(): Error {
  return new Prisma.PrismaClientUnknownRequestError(
    'ERROR: conflicting key value violates exclusion constraint "Booking_no_overlap" (SQLSTATE 23P01)',
    { clientVersion: '5.22.0' },
  );
}

describe('BookingsService.create', () => {
  it('creates a single booking and increments the created counter', async () => {
    const { prisma, metrics, service } = createMocks();
    prisma.room.findUnique.mockResolvedValue({ id: ROOM_ID });
    prisma.booking.create.mockResolvedValue(bookingRow());

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
    expect(prisma.booking.create).toHaveBeenCalledOnce();
    expect(prisma.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ title: TITLE, seriesId: null }) }),
    );
    expect(metrics.bookingCreated).toHaveBeenCalledWith(1);
  });

  it('creates a weekly series sharing one seriesId, a week apart', async () => {
    const { prisma, metrics, service } = createMocks();
    prisma.room.findUnique.mockResolvedValue({ id: ROOM_ID });
    prisma.booking.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve(bookingRow(data)),
    );

    const result = await service.create(USER_ID, {
      roomId: ROOM_ID,
      title: TITLE,
      startsAt: START,
      endsAt: END,
      repeatWeeks: 3,
    });

    expect(result.createdCount).toBe(3);
    expect(prisma.booking.create).toHaveBeenCalledTimes(3);
    const calls = prisma.booking.create.mock.calls.map(([arg]) => arg.data);
    const seriesIds = new Set(calls.map((data) => data.seriesId));
    expect(seriesIds.size).toBe(1);
    expect([...seriesIds][0]).toEqual(expect.any(String));
    // Occurrences are one office-week apart (same wall clock).
    const starts = calls.map((data) => (data.startsAt as Date).toISOString());
    expect(starts).toEqual([START, '2030-01-22T09:00:00.000Z', '2030-01-29T09:00:00.000Z']);
    expect(metrics.bookingCreated).toHaveBeenCalledWith(3);
  });

  it('rejects a slot that is not on the 30-minute grid without touching the database', async () => {
    const { prisma, service } = createMocks();

    await expect(
      service.create(USER_ID, {
        roomId: ROOM_ID,
        title: TITLE,
        startsAt: '2030-01-15T09:10:00.000Z',
        endsAt: '2030-01-15T10:10:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.room.findUnique).not.toHaveBeenCalled();
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
    const { prisma, service } = createMocks();
    prisma.room.findUnique.mockResolvedValue(null);

    await expect(
      service.create(USER_ID, { roomId: ROOM_ID, title: TITLE, startsAt: START, endsAt: END }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects booking when the user has not confirmed their email (403)', async () => {
    const { prisma, service } = createMocks();
    prisma.user.findUnique.mockResolvedValue({ emailConfirmedAt: null });
    prisma.room.findUnique.mockResolvedValue({ id: ROOM_ID });

    await expect(
      service.create(USER_ID, { roomId: ROOM_ID, title: TITLE, startsAt: START, endsAt: END }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.booking.create).not.toHaveBeenCalled();
  });

  it('translates an exclusion-constraint violation into 409 and counts the conflict', async () => {
    const { prisma, metrics, service } = createMocks();
    prisma.room.findUnique.mockResolvedValue({ id: ROOM_ID });
    prisma.booking.create.mockRejectedValue(exclusionViolation());

    await expect(
      service.create(USER_ID, { roomId: ROOM_ID, title: TITLE, startsAt: START, endsAt: END }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(metrics.bookingConflict).toHaveBeenCalledOnce();
    expect(metrics.bookingCreated).not.toHaveBeenCalled();
  });

  it('allows touching boundaries (database accepts, no conflict raised)', async () => {
    const { prisma, service } = createMocks();
    prisma.room.findUnique.mockResolvedValue({ id: ROOM_ID });
    prisma.booking.create.mockResolvedValue(
      bookingRow({ startsAt: new Date(END), endsAt: new Date('2030-01-15T11:00:00.000Z') }),
    );

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
    const { prisma, service } = createMocks();
    prisma.booking.findMany.mockResolvedValue([myRow(BOOKING_ID, START, END)]);

    const result = await service.findMyUpcoming(USER_ID);

    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: USER_ID, endsAt: { gt: expect.any(Date) } }),
        orderBy: { startsAt: 'asc' },
      }),
    );
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
    const { prisma, service } = createMocks();
    prisma.$transaction.mockResolvedValue([[myRow(BOOKING_ID, START, END)], 7]);

    const result = await service.findMyPast(USER_ID, 5, 10);

    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: USER_ID, endsAt: { lte: expect.any(Date) } }),
        orderBy: { startsAt: 'desc' },
        skip: 5,
        take: 10,
      }),
    );
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
    mocks.prisma.booking.findUnique.mockResolvedValue(bookingRow({ userId: OTHER_USER_ID }));

    await expect(mocks.service.remove(USER_ID, BOOKING_ID)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(mocks.prisma.booking.delete).not.toHaveBeenCalled();
    expect(mocks.metrics.bookingCancelled).not.toHaveBeenCalled();
  });

  it('returns 404 for a missing booking', async () => {
    mocks.prisma.booking.findUnique.mockResolvedValue(null);

    await expect(mocks.service.remove(USER_ID, BOOKING_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('deletes own booking and increments the cancelled counter', async () => {
    mocks.prisma.booking.findUnique.mockResolvedValue(bookingRow());
    mocks.prisma.booking.delete.mockResolvedValue({});

    const removed = await mocks.service.remove(USER_ID, BOOKING_ID);

    expect(removed).toBe(1);
    expect(mocks.prisma.booking.delete).toHaveBeenCalledWith({ where: { id: BOOKING_ID } });
    expect(mocks.metrics.bookingCancelled).toHaveBeenCalledWith(1);
  });

  it('cancels this and later occurrences when scope is "series"', async () => {
    mocks.prisma.booking.findUnique.mockResolvedValue(bookingRow({ seriesId: SERIES_ID }));
    mocks.prisma.booking.deleteMany.mockResolvedValue({ count: 3 });

    const removed = await mocks.service.remove(USER_ID, BOOKING_ID, 'series');

    expect(removed).toBe(3);
    expect(mocks.prisma.booking.deleteMany).toHaveBeenCalledWith({
      where: { seriesId: SERIES_ID, userId: USER_ID, startsAt: { gte: new Date(START) } },
    });
    expect(mocks.prisma.booking.delete).not.toHaveBeenCalled();
    expect(mocks.metrics.bookingCancelled).toHaveBeenCalledWith(3);
  });
});
