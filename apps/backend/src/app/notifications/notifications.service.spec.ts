import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';

import type { MetricsService } from '../metrics/metrics.service';
import type { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';

const NOW = new Date('2030-01-15T10:00:00.000Z');

function createService(notifyBeforeMinutes = 10) {
  const prisma = {
    booking: { findMany: vi.fn(), updateMany: vi.fn() },
  };
  const metrics = { bookingEndNotified: vi.fn() };
  const config = { get: vi.fn().mockReturnValue(String(notifyBeforeMinutes)) };
  const service = new NotificationsService(
    prisma as unknown as PrismaService,
    metrics as unknown as MetricsService,
    config as unknown as ConfigService,
  );
  return { prisma, metrics, service };
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
    const { prisma, metrics, service } = createService(10);
    prisma.booking.findMany
      .mockResolvedValueOnce([
        dueRow('b1', '2030-01-15T10:05:00.000Z'),
        dueRow('b2', '2030-01-15T10:10:00.000Z'),
      ])
      .mockResolvedValueOnce([
        successorAt('2030-01-15T10:05:00.000Z'),
        successorAt('2030-01-15T10:10:00.000Z'),
      ]);
    prisma.booking.updateMany.mockResolvedValue({ count: 2 });

    const sent = await service.processDueNotifications(NOW);

    expect(sent).toBe(2);
    expect(prisma.booking.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: {
          endNotifiedAt: null,
          endsAt: { gt: NOW, lte: new Date('2030-01-15T10:10:00.000Z') },
        },
      }),
    );
    expect(prisma.booking.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['b1', 'b2'] } },
      data: { endNotifiedAt: NOW },
    });
    expect(metrics.bookingEndNotified).toHaveBeenCalledWith(2);
  });

  it('skips a due booking whose next slot is free (no back-to-back successor)', async () => {
    const { prisma, metrics, service } = createService(10);
    prisma.booking.findMany
      .mockResolvedValueOnce([dueRow('b1', '2030-01-15T10:05:00.000Z')])
      .mockResolvedValueOnce([]); // nothing starts when b1 ends

    const sent = await service.processDueNotifications(NOW);

    expect(sent).toBe(0);
    expect(prisma.booking.updateMany).not.toHaveBeenCalled();
    expect(metrics.bookingEndNotified).not.toHaveBeenCalled();
  });

  it('notifies only the booking whose successor exists when several are due', async () => {
    const { prisma, metrics, service } = createService(10);
    prisma.booking.findMany
      .mockResolvedValueOnce([
        dueRow('b1', '2030-01-15T10:05:00.000Z'), // has a successor
        dueRow('b2', '2030-01-15T10:10:00.000Z'), // no successor
      ])
      .mockResolvedValueOnce([successorAt('2030-01-15T10:05:00.000Z')]);
    prisma.booking.updateMany.mockResolvedValue({ count: 1 });

    const sent = await service.processDueNotifications(NOW);

    expect(sent).toBe(1);
    expect(prisma.booking.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['b1'] } },
      data: { endNotifiedAt: NOW },
    });
    expect(metrics.bookingEndNotified).toHaveBeenCalledWith(1);
  });

  it('does nothing (no successor query, no update) when nothing is due', async () => {
    const { prisma, metrics, service } = createService(10);
    prisma.booking.findMany.mockResolvedValueOnce([]);

    const sent = await service.processDueNotifications(NOW);

    expect(sent).toBe(0);
    expect(prisma.booking.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.booking.updateMany).not.toHaveBeenCalled();
    expect(metrics.bookingEndNotified).not.toHaveBeenCalled();
  });

  it('honours a custom NOTIFY_BEFORE_MINUTES window', async () => {
    const { prisma, service } = createService(30);
    prisma.booking.findMany.mockResolvedValueOnce([]);

    await service.processDueNotifications(NOW);

    expect(prisma.booking.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          endsAt: { gt: NOW, lte: new Date('2030-01-15T10:30:00.000Z') },
        }),
      }),
    );
  });
});
