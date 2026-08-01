/**
 * Idempotent demo seed: rooms, users and a handful of bookings for today and
 * tomorrow (office time zone). Every entity has a fixed UUID and is upserted,
 * so re-running never creates duplicates. Bookings that would overlap
 * user-created ones are skipped gracefully.
 *
 * Kept dependency-light (no Nest DI) so it can run both via
 * `nx run backend:seed` (dev) and as a compiled bundle in Docker.
 */
import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

// Kept in sync with libs/shared OFFICE_TIME_ZONE; duplicated so the seed stays
// dependency-light (runs both via nx and as a compiled Docker bundle).
const OFFICE_TIME_ZONE = 'Europe/Kyiv';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

function seedId(index: number): string {
  return `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
}

const ROOMS = [
  { id: seedId(1), name: 'Small', floor: 1, capacity: 4 },
  { id: seedId(2), name: 'Large', floor: 1, capacity: 12 },
  { id: seedId(3), name: 'Skype booth', floor: 2, capacity: 1 },
  { id: seedId(4), name: 'Brainstorm', floor: 2, capacity: 6 },
  { id: seedId(5), name: 'Boardroom', floor: 3, capacity: 16 },
  { id: seedId(6), name: 'Focus', floor: 3, capacity: 2 },
] as const;

const USERS = [
  { id: seedId(101), name: 'Taras Shevchenko', email: 'test1@office.dev' },
  { id: seedId(102), name: 'Lesia Ukrainka', email: 'test2@office.dev' },
] as const;

interface SeedBooking {
  id: string;
  roomId: string;
  userId: string;
  title: string;
  /** Days from today (office time zone). */
  dayOffset: number;
  start: string;
  end: string;
  /** Shared across occurrences of a weekly recurring series. */
  seriesId?: string;
}

const WEEKLY_SERIES_ID = seedId(300);

// All slots sit inside the 09:00-19:00 working day.
const BOOKINGS: SeedBooking[] = [
  {
    id: seedId(201),
    roomId: ROOMS[0].id,
    userId: USERS[0].id,
    title: 'Daily stand-up',
    dayOffset: 0,
    start: '09:00',
    end: '10:00',
  },
  {
    id: seedId(202),
    roomId: ROOMS[0].id,
    userId: USERS[1].id,
    title: 'Design review',
    dayOffset: 0,
    start: '11:30',
    end: '13:00',
  },
  {
    id: seedId(203),
    roomId: ROOMS[1].id,
    userId: USERS[0].id,
    title: 'Sprint planning',
    dayOffset: 0,
    start: '14:00',
    end: '16:00',
  },
  {
    id: seedId(204),
    roomId: ROOMS[2].id,
    userId: USERS[1].id,
    title: '1:1 with manager',
    dayOffset: 0,
    start: '10:00',
    end: '10:30',
  },
  {
    id: seedId(205),
    roomId: ROOMS[3].id,
    userId: USERS[1].id,
    title: 'Roadmap brainstorm',
    dayOffset: 0,
    start: '16:30',
    end: '18:00',
  },
  {
    id: seedId(206),
    roomId: ROOMS[0].id,
    userId: USERS[0].id,
    title: 'Retrospective',
    dayOffset: 1,
    start: '09:30',
    end: '11:00',
  },
  {
    id: seedId(207),
    roomId: ROOMS[1].id,
    userId: USERS[1].id,
    title: 'All-hands prep',
    dayOffset: 1,
    start: '17:00',
    end: '18:30',
  },
  {
    id: seedId(208),
    roomId: ROOMS[4].id,
    userId: USERS[0].id,
    title: 'Quarterly review',
    dayOffset: 1,
    start: '15:00',
    end: '17:00',
  },
  {
    id: seedId(209),
    roomId: ROOMS[5].id,
    userId: USERS[0].id,
    title: 'Focus block',
    dayOffset: 1,
    start: '10:00',
    end: '10:30',
  },
  // A weekly recurring series (today, +7 days, +14 days) sharing one seriesId.
  {
    id: seedId(301),
    roomId: ROOMS[3].id,
    userId: USERS[0].id,
    title: 'Weekly sync',
    dayOffset: 0,
    start: '12:00',
    end: '12:30',
    seriesId: WEEKLY_SERIES_ID,
  },
  {
    id: seedId(302),
    roomId: ROOMS[3].id,
    userId: USERS[0].id,
    title: 'Weekly sync',
    dayOffset: 7,
    start: '12:00',
    end: '12:30',
    seriesId: WEEKLY_SERIES_ID,
  },
  {
    id: seedId(303),
    roomId: ROOMS[3].id,
    userId: USERS[0].id,
    title: 'Weekly sync',
    dayOffset: 14,
    start: '12:00',
    end: '12:30',
    seriesId: WEEKLY_SERIES_ID,
  },
];

function officeSlotToUtc(dayOffset: number, time: string): Date {
  const dayMs = Date.now() + dayOffset * 24 * 60 * 60 * 1000;
  const date = formatInTimeZone(new Date(dayMs), OFFICE_TIME_ZONE, 'yyyy-MM-dd');
  return fromZonedTime(`${date}T${time}:00`, OFFICE_TIME_ZONE);
}

async function main(): Promise<void> {
  for (const room of ROOMS) {
    await prisma.room.upsert({
      where: { id: room.id },
      update: { name: room.name, floor: room.floor, capacity: room.capacity },
      create: room,
    });
  }

  const passwordHash = await bcrypt.hash('password123', 10);
  // Seeded users are pre-confirmed so the documented credentials can book at once.
  const emailConfirmedAt = new Date();
  for (const user of USERS) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: { name: user.name, email: user.email, emailConfirmedAt },
      create: { ...user, passwordHash, emailConfirmedAt },
    });
  }

  let created = 0;
  let skipped = 0;
  for (const booking of BOOKINGS) {
    const startsAt = officeSlotToUtc(booking.dayOffset, booking.start);
    const endsAt = officeSlotToUtc(booking.dayOffset, booking.end);
    const data = {
      roomId: booking.roomId,
      userId: booking.userId,
      title: booking.title,
      startsAt,
      endsAt,
      seriesId: booking.seriesId ?? null,
    };
    try {
      await prisma.booking.upsert({
        where: { id: booking.id },
        update: data,
        create: { id: booking.id, ...data },
      });
      created += 1;
    } catch (error) {
      // A user-created booking already occupies the slot (exclusion constraint).
      if (error instanceof Error && error.message.includes('23P01')) {
        skipped += 1;
        continue;
      }
      throw error;
    }
  }

  console.log(
    `Seed complete: ${ROOMS.length} rooms, ${USERS.length} users, ${created} bookings upserted, ${skipped} skipped (slot taken).`,
  );
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
