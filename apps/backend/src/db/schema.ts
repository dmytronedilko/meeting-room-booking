import { relations, sql } from 'drizzle-orm';
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

/**
 * Drizzle schema — the single source of truth for the database shape. Table and
 * column identifiers are quoted PascalCase, matched exactly by the SQL
 * migrations under `drizzle/`.
 *
 * Conventions (match across every table):
 * - PK: `uuid(...).primaryKey().defaultRandom()` — DB-side `gen_random_uuid()`
 *   (built into Postgres 13+), so both auto-generated inserts and explicit-id
 *   inserts (seed/tests) work.
 * - Timestamps: `timestamptz(3)` with `mode: 'date'`, so the app layer always
 *   receives JS `Date` objects (mappers call `.toISOString()`; services compare
 *   with `new Date()` / `.getTime()`). Office TZ is Europe/Kyiv — store UTC.
 */

const timestamptz = (name: string) =>
  timestamp(name, { withTimezone: true, precision: 3, mode: 'date' });

export const users = pgTable(
  'User',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    passwordHash: text('passwordHash').notNull(),
    createdAt: timestamptz('createdAt').notNull().defaultNow(),
    // Dev-mode email confirmation: null until the user clicks the logged link.
    // Booking creation is blocked while unconfirmed.
    emailConfirmedAt: timestamptz('emailConfirmedAt'),
    // The pending confirmation token (null once confirmed); unique so a link
    // resolves to exactly one user.
    emailConfirmToken: text('emailConfirmToken'),
  },
  (table) => [
    uniqueIndex('User_email_key').on(table.email),
    uniqueIndex('User_emailConfirmToken_key').on(table.emailConfirmToken),
    // Case-insensitive uniqueness enforced at the DB level by a functional unique
    // index on lower(email): the DB — not just the app's trim+lowercase — rejects
    // "Ivan@x.com" when "ivan@x.com" already exists, even for a raw INSERT that
    // bypassed the application normalization. Expressed directly in the schema.
    uniqueIndex('User_email_lower_key').on(sql`lower(${table.email})`),
  ],
);

export const rooms = pgTable(
  'Room',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    floor: integer('floor').notNull(),
    capacity: integer('capacity').notNull(),
    createdAt: timestamptz('createdAt').notNull().defaultNow(),
  },
  (table) => [uniqueIndex('Room_name_key').on(table.name)],
);

export const bookings = pgTable(
  'Booking',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roomId: uuid('roomId')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    userId: uuid('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    title: varchar('title', { length: 100 }).notNull(),
    startsAt: timestamptz('startsAt').notNull(),
    endsAt: timestamptz('endsAt').notNull(),
    createdAt: timestamptz('createdAt').notNull().defaultNow(),
    // Non-null for occurrences created together as a weekly recurring series;
    // every occurrence in a series shares the same value.
    seriesId: uuid('seriesId'),
    // When the "ends soon" notification was sent (null until sent), so the
    // background scheduler never notifies the same booking twice.
    endNotifiedAt: timestamptz('endNotifiedAt'),
  },
  (table) => [
    index('Booking_roomId_startsAt_idx').on(table.roomId, table.startsAt),
    // Supports the "My bookings" queries (per-user upcoming/past, time-ordered).
    index('Booking_userId_startsAt_idx').on(table.userId, table.startsAt),
    index('Booking_seriesId_idx').on(table.seriesId),
    // Supports the scheduler's "not yet notified and ending soon" scan.
    index('Booking_endNotifiedAt_endsAt_idx').on(table.endNotifiedAt, table.endsAt),
  ],
);

// Relations power the relational query API (`db.query.*` with `with`), so a
// booking can be fetched together with its room and user in one round-trip.
export const usersRelations = relations(users, ({ many }) => ({
  bookings: many(bookings),
}));

export const roomsRelations = relations(rooms, ({ many }) => ({
  bookings: many(bookings),
}));

export const bookingsRelations = relations(bookings, ({ one }) => ({
  room: one(rooms, { fields: [bookings.roomId], references: [rooms.id] }),
  user: one(users, { fields: [bookings.userId], references: [users.id] }),
}));

// Row types inferred straight from the schema — no code-generation step.
export type User = typeof users.$inferSelect;
export type Room = typeof rooms.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
