import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import {
  OFFICE_TIME_ZONE,
  type AuthResponseDto,
  type BookingDto,
  type CreateBookingResponse,
  type MyBookingDto,
  type PastBookingsPageDto,
  type UserDto,
} from '@office/shared';
import { fromZonedTime } from 'date-fns-tz';
import { asc, eq, inArray } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app/app.module';
import { DRIZZLE, type DrizzleDB } from '../src/app/db/database.module';
import { NotificationsService } from '../src/app/notifications/notifications.service';
import { configureApp } from '../src/app/setup';
import { bookings, rooms, users } from '../src/db/schema';

const ROOM_ID = '99999999-0000-4000-8000-000000000001';

// A fixed far-future working day. Times are office (Europe/Kyiv) wall-clock,
// converted to the UTC instant the API expects — so working-hours assertions
// hold regardless of the office zone's offset.
const iso = (time: string): string =>
  fromZonedTime(`2030-01-15T${time}:00`, OFFICE_TIME_ZONE).toISOString();

describe('API (integration)', () => {
  let app: NestFastifyApplication;
  let db: DrizzleDB;
  let user1: AuthResponseDto;
  let user2: AuthResponseDto;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), {
      bufferLogs: true,
    });
    configureApp(app);
    await app.init();
    // Fastify must finish route registration before supertest hits the server.
    await app.getHttpAdapter().getInstance().ready();

    db = app.get(DRIZZLE);
    await db.delete(bookings);
    await db.delete(users);
    await db.delete(rooms);
    await db.insert(rooms).values({ id: ROOM_ID, name: 'E2E Room', floor: 3, capacity: 6 });
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('auth', () => {
    it('registers a new user and returns a token', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ name: 'User One', email: 'e2e-user1@office.dev', password: 'password123' })
        .expect(201);

      user1 = response.body as AuthResponseDto;
      expect(user1.token).toBeTruthy();
      expect(user1.user.email).toBe('e2e-user1@office.dev');
    });

    it('rejects a duplicate email with 409', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ name: 'Dup', email: 'e2e-user1@office.dev', password: 'password123' })
        .expect(409);

      expect(response.body).toMatchObject({ statusCode: 409, error: expect.any(String) });
    });

    it('treats emails case-insensitively and ignores edge whitespace (409)', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ name: 'Dup', email: '  E2E-User1@Office.DEV  ', password: 'password123' })
        .expect(409);
    });

    it('enforces case-insensitive email uniqueness at the DB level (bypassing app normalization)', async () => {
      // e2e-user1@office.dev already exists (stored lowercased). A direct insert
      // with different casing skips the DTO normalization, so only the functional
      // unique index on lower(email) can reject it.
      await expect(
        db
          .insert(users)
          .values({ name: 'Raw Dup', email: 'E2E-USER1@OFFICE.DEV', passwordHash: 'x' }),
      ).rejects.toThrow();
    });

    it('rejects a whitespace-only name with 400', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ name: '   ', email: 'blank-name@office.dev', password: 'password123' })
        .expect(400);
    });

    it('rejects a short password with 400', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ name: 'Short', email: 'short@office.dev', password: 'short' })
        .expect(400);
    });

    it('rejects a password over 72 characters with 400', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ name: 'Long', email: 'long@office.dev', password: 'x'.repeat(73) })
        .expect(400);
    });

    it('logs in with valid credentials', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ name: 'User Two', email: 'e2e-user2@office.dev', password: 'password123' })
        .expect(201);

      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'e2e-user2@office.dev', password: 'password123' })
        .expect(200);

      user2 = response.body as AuthResponseDto;
      expect(user2.token).toBeTruthy();
    });

    it('logs in with a differently-cased, padded email', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: ' E2E-USER2@office.dev ', password: 'password123' })
        .expect(200);
    });

    it('rejects invalid credentials with 401', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'e2e-user1@office.dev', password: 'wrong-password' })
        .expect(401);
    });

    it('requires a JWT for protected routes', async () => {
      await request(app.getHttpServer()).get('/api/rooms').expect(401);
    });

    it('sets an HttpOnly session cookie on login and accepts it as auth', async () => {
      const login = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'e2e-user1@office.dev', password: 'password123' })
        .expect(200);

      const setCookie = login.get('Set-Cookie');
      expect(setCookie).toBeDefined();
      const authCookie = (setCookie as string[]).find((c) => c.startsWith('token='));
      expect(authCookie).toContain('HttpOnly');
      expect(authCookie).toContain('SameSite=Lax');

      await request(app.getHttpServer())
        .get('/api/rooms')
        .set('Cookie', (authCookie as string).split(';')[0])
        .expect(200);
    });

    it('clears the session cookie on logout', async () => {
      const logout = await request(app.getHttpServer()).post('/api/auth/logout').expect(204);
      const cleared = (logout.get('Set-Cookie') as string[]).find((c) => c.startsWith('token='));
      // An expired, empty cookie removes the session from the browser.
      expect(cleared).toContain('token=;');
      expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970/);
    });

    it('maps an empty JSON body to 400, not 500', async () => {
      // A JSON content-type with no body makes Fastify's parser throw a
      // non-HttpException; the exception filter must surface its 400, not mask
      // it as a generic Internal Server Error.
      const response = await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Content-Type', 'application/json')
        .expect(400);
      expect(response.body).toMatchObject({ statusCode: 400, error: 'Bad Request' });
    });
  });

  describe('rooms', () => {
    it('lists rooms with name, floor and capacity', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/rooms')
        .set('Authorization', `Bearer ${user1.token}`)
        .expect(200);

      expect(response.body).toEqual([
        expect.objectContaining({ id: ROOM_ID, name: 'E2E Room', floor: 3, capacity: 6 }),
      ]);
    });
  });

  describe('bookings', () => {
    let user1Booking: BookingDto;

    beforeAll(async () => {
      // Booking requires a confirmed email; confirm the registered test users
      // directly so the rest of the suite can create bookings.
      await db
        .update(users)
        .set({ emailConfirmedAt: new Date() })
        .where(inArray(users.id, [user1.user.id, user2.user.id]));
    });

    it('creates a booking with a title', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Authorization', `Bearer ${user1.token}`)
        .send({ roomId: ROOM_ID, title: 'Team sync', startsAt: iso('10:00'), endsAt: iso('11:00') })
        .expect(201);

      const body = response.body as CreateBookingResponse;
      expect(body.createdCount).toBe(1);
      user1Booking = body.booking;
      expect(user1Booking.isMine).toBe(true);
      expect(user1Booking.title).toBe('Team sync');
      expect(user1Booking.seriesId).toBeNull();
    });

    it('rejects a missing or whitespace-only title with 400', async () => {
      await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Authorization', `Bearer ${user1.token}`)
        .send({ roomId: ROOM_ID, startsAt: iso('13:00'), endsAt: iso('14:00') })
        .expect(400);

      await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Authorization', `Bearer ${user1.token}`)
        .send({ roomId: ROOM_ID, title: '   ', startsAt: iso('13:00'), endsAt: iso('14:00') })
        .expect(400);
    });

    it('rejects a title over 100 characters with 400', async () => {
      await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Authorization', `Bearer ${user1.token}`)
        .send({
          roomId: ROOM_ID,
          title: 'x'.repeat(101),
          startsAt: iso('13:00'),
          endsAt: iso('14:00'),
        })
        .expect(400);
    });

    it('rejects an overlapping booking with 409', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Authorization', `Bearer ${user2.token}`)
        .send({ roomId: ROOM_ID, title: 'Clash', startsAt: iso('10:30'), endsAt: iso('11:30') })
        .expect(409);

      expect(response.body).toMatchObject({ statusCode: 409 });
    });

    it('allows touching boundaries (end == start)', async () => {
      await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Authorization', `Bearer ${user2.token}`)
        .send({ roomId: ROOM_ID, title: 'Follow-up', startsAt: iso('11:00'), endsAt: iso('12:00') })
        .expect(201);
    });

    it('rejects slots outside the 09:00-19:00 office working hours with 400', async () => {
      await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Authorization', `Bearer ${user1.token}`)
        .send({ roomId: ROOM_ID, title: 'Early', startsAt: iso('08:30'), endsAt: iso('09:30') })
        .expect(400);

      await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Authorization', `Bearer ${user1.token}`)
        .send({ roomId: ROOM_ID, title: 'Late', startsAt: iso('18:30'), endsAt: iso('19:30') })
        .expect(400);
    });

    it('rejects a booking in the past with 400', async () => {
      await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Authorization', `Bearer ${user1.token}`)
        .send({
          roomId: ROOM_ID,
          title: 'Time travel',
          startsAt: '2020-01-15T08:00:00.000Z',
          endsAt: '2020-01-15T09:00:00.000Z',
        })
        .expect(400);
    });

    it('returns 404 for an unknown room', async () => {
      await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Authorization', `Bearer ${user1.token}`)
        .send({
          roomId: '99999999-0000-4000-8000-00000000dead',
          title: 'Ghost room',
          startsAt: iso('13:00'),
          endsAt: iso('14:00'),
        })
        .expect(404);
    });

    it('lists day bookings with title and isMine derived from the JWT', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/rooms/${ROOM_ID}/bookings`)
        .query({ date: '2030-01-15' })
        .set('Authorization', `Bearer ${user1.token}`)
        .expect(200);

      const bookings = response.body as BookingDto[];
      expect(bookings).toHaveLength(2);
      expect(bookings[0]).toMatchObject({
        title: 'Team sync',
        isMine: true,
        user: { name: 'User One' },
      });
      expect(bookings[1]).toMatchObject({ isMine: false, user: { name: 'User Two' } });
    });

    it('lists a whole week of bookings with days=7', async () => {
      // Friday of the same week.
      await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Authorization', `Bearer ${user1.token}`)
        .send({
          roomId: ROOM_ID,
          title: 'Friday demo',
          startsAt: new Date('2030-01-18T14:00:00.000Z').toISOString(),
          endsAt: new Date('2030-01-18T15:00:00.000Z').toISOString(),
        })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get(`/api/rooms/${ROOM_ID}/bookings`)
        .query({ date: '2030-01-14', days: 7 })
        .set('Authorization', `Bearer ${user1.token}`)
        .expect(200);

      const titles = (response.body as BookingDto[]).map((booking) => booking.title);
      expect(titles).toEqual(['Team sync', 'Follow-up', 'Friday demo']);
    });

    it('rejects an out-of-range days value with 400', async () => {
      await request(app.getHttpServer())
        .get(`/api/rooms/${ROOM_ID}/bookings`)
        .query({ date: '2030-01-14', days: 8 })
        .set('Authorization', `Bearer ${user1.token}`)
        .expect(400);
    });

    it('rejects an invalid date with 400', async () => {
      await request(app.getHttpServer())
        .get(`/api/rooms/${ROOM_ID}/bookings`)
        .query({ date: '2030-02-30' })
        .set('Authorization', `Bearer ${user1.token}`)
        .expect(400);
    });

    it("rejects cancelling someone else's booking with 403", async () => {
      await request(app.getHttpServer())
        .delete(`/api/bookings/${user1Booking.id}`)
        .set('Authorization', `Bearer ${user2.token}`)
        .expect(403);
    });

    it('cancels own booking with 204 and frees the slot', async () => {
      await request(app.getHttpServer())
        .delete(`/api/bookings/${user1Booking.id}`)
        .set('Authorization', `Bearer ${user1.token}`)
        .expect(204);

      await request(app.getHttpServer())
        .delete(`/api/bookings/${user1Booking.id}`)
        .set('Authorization', `Bearer ${user1.token}`)
        .expect(404);
    });
  });

  describe('my bookings', () => {
    beforeAll(async () => {
      // Two finished bookings for user1; the API refuses past slots by design,
      // so they are inserted directly.
      await db.insert(bookings).values([
        {
          roomId: ROOM_ID,
          userId: user1.user.id,
          title: 'Old retro',
          startsAt: new Date('2024-03-11T08:00:00.000Z'),
          endsAt: new Date('2024-03-11T09:00:00.000Z'),
        },
        {
          roomId: ROOM_ID,
          userId: user1.user.id,
          title: 'Older kickoff',
          startsAt: new Date('2024-03-04T08:00:00.000Z'),
          endsAt: new Date('2024-03-04T09:00:00.000Z'),
        },
      ]);
    });

    it('lists upcoming bookings nearest-first with room info', async () => {
      // user1's remaining future booking is "Friday demo" (2030-01-18); add an
      // earlier one to verify the ordering.
      await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Authorization', `Bearer ${user1.token}`)
        .send({ roomId: ROOM_ID, title: 'Kickoff', startsAt: iso('15:00'), endsAt: iso('16:00') })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get('/api/bookings/my/upcoming')
        .set('Authorization', `Bearer ${user1.token}`)
        .expect(200);

      const bookings = response.body as MyBookingDto[];
      expect(bookings.map((booking) => booking.title)).toEqual(['Kickoff', 'Friday demo']);
      expect(bookings[0].room).toMatchObject({ id: ROOM_ID, name: 'E2E Room', floor: 3 });
    });

    it("does not leak other users' bookings", async () => {
      const response = await request(app.getHttpServer())
        .get('/api/bookings/my/upcoming')
        .set('Authorization', `Bearer ${user2.token}`)
        .expect(200);

      expect((response.body as MyBookingDto[]).map((booking) => booking.title)).toEqual([
        'Follow-up',
      ]);
    });

    it('paginates past bookings most-recent-first', async () => {
      const firstPage = await request(app.getHttpServer())
        .get('/api/bookings/my/past')
        .query({ offset: 0, limit: 1 })
        .set('Authorization', `Bearer ${user1.token}`)
        .expect(200);

      const first = firstPage.body as PastBookingsPageDto;
      expect(first.total).toBe(2);
      expect(first.items).toHaveLength(1);
      expect(first.items[0].title).toBe('Old retro');

      const secondPage = await request(app.getHttpServer())
        .get('/api/bookings/my/past')
        .query({ offset: 1, limit: 1 })
        .set('Authorization', `Bearer ${user1.token}`)
        .expect(200);

      expect((secondPage.body as PastBookingsPageDto).items[0].title).toBe('Older kickoff');
    });

    it('rejects an invalid pagination query with 400', async () => {
      await request(app.getHttpServer())
        .get('/api/bookings/my/past')
        .query({ offset: -1 })
        .set('Authorization', `Bearer ${user1.token}`)
        .expect(400);
    });
  });

  describe('recurring bookings', () => {
    const RECUR_ROOM_ID = '99999999-0000-4000-8000-000000000002';
    let seriesId: string;

    beforeAll(async () => {
      await db
        .insert(rooms)
        .values({ id: RECUR_ROOM_ID, name: 'Recurring Room', floor: 2, capacity: 4 });
    });

    it('creates a weekly series sharing one seriesId, occurrences a week apart', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Authorization', `Bearer ${user1.token}`)
        .send({
          roomId: RECUR_ROOM_ID,
          title: 'Weekly QA',
          startsAt: iso('09:00'),
          endsAt: iso('09:30'),
          repeatWeeks: 3,
        })
        .expect(201);

      const body = response.body as CreateBookingResponse;
      expect(body.createdCount).toBe(3);
      expect(body.booking.seriesId).toEqual(expect.any(String));
      seriesId = body.booking.seriesId as string;

      const rows = await db.query.bookings.findMany({
        where: eq(bookings.seriesId, seriesId),
        orderBy: asc(bookings.startsAt),
      });
      expect(rows).toHaveLength(3);
      expect(rows.every((row) => row.title === 'Weekly QA')).toBe(true);
      // Consecutive occurrences are exactly one week apart.
      const weekMs = 7 * 24 * 60 * 60 * 1000;
      expect(rows[1].startsAt.getTime() - rows[0].startsAt.getTime()).toBe(weekMs);
      expect(rows[2].startsAt.getTime() - rows[1].startsAt.getTime()).toBe(weekMs);
    });

    it('rejects a series whose any week overlaps an existing booking with 409', async () => {
      // Overlaps week 1 of the series just created.
      await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Authorization', `Bearer ${user2.token}`)
        .send({
          roomId: RECUR_ROOM_ID,
          title: 'Clashing series',
          startsAt: iso('09:00'),
          endsAt: iso('09:30'),
          repeatWeeks: 2,
        })
        .expect(409);
    });

    it('rejects repeatWeeks above the maximum with 400', async () => {
      await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Authorization', `Bearer ${user1.token}`)
        .send({
          roomId: RECUR_ROOM_ID,
          title: 'Too many',
          startsAt: iso('11:00'),
          endsAt: iso('11:30'),
          repeatWeeks: 13,
        })
        .expect(400);
    });

    it('cancels this and later occurrences with scope=series', async () => {
      const rows = await db.query.bookings.findMany({
        where: eq(bookings.seriesId, seriesId),
        orderBy: asc(bookings.startsAt),
      });
      // Cancel from the middle occurrence: it and the last one go, the first stays.
      await request(app.getHttpServer())
        .delete(`/api/bookings/${rows[1].id}?scope=series`)
        .set('Authorization', `Bearer ${user1.token}`)
        .expect(204);

      const remaining = await db.query.bookings.findMany({
        where: eq(bookings.seriesId, seriesId),
      });
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe(rows[0].id);
    });
  });

  describe('end-of-booking notifications', () => {
    const NOTIFY_ROOM_ID = '99999999-0000-4000-8000-000000000003';
    const NOTIFY_ROOM_FREE = '99999999-0000-4000-8000-000000000004';

    beforeAll(async () => {
      await db.insert(rooms).values([
        { id: NOTIFY_ROOM_ID, name: 'Notify Room', floor: 1, capacity: 2 },
        { id: NOTIFY_ROOM_FREE, name: 'Notify Room (free next)', floor: 1, capacity: 2 },
      ]);
    });

    it('notifies a booking ending soon whose next slot is taken, exactly once', async () => {
      const now = new Date();
      const endsAt = new Date(now.getTime() + 5 * 60_000); // inside the 10-min window
      // Ending-soon booking (inserted directly: the API refuses past starts) plus a
      // back-to-back successor that occupies the room the moment it ends.
      const [booking] = await db
        .insert(bookings)
        .values({
          roomId: NOTIFY_ROOM_ID,
          userId: user1.user.id,
          title: 'Ending soon',
          startsAt: new Date(now.getTime() - 25 * 60_000),
          endsAt,
        })
        .returning();
      await db.insert(bookings).values({
        roomId: NOTIFY_ROOM_ID,
        userId: user2.user.id,
        title: 'Needs the room next',
        startsAt: endsAt,
        endsAt: new Date(now.getTime() + 35 * 60_000),
      });

      const notifications = app.get(NotificationsService);
      const firstPass = await notifications.processDueNotifications();
      expect(firstPass).toBe(1);

      const after = await db.query.bookings.findFirst({ where: eq(bookings.id, booking.id) });
      expect(after?.endNotifiedAt).not.toBeNull();

      // Idempotent: a second scan does not notify the same booking again.
      const secondPass = await notifications.processDueNotifications();
      expect(secondPass).toBe(0);
    });

    it('does not notify a booking ending soon whose next slot is free', async () => {
      const now = new Date();
      await db.insert(bookings).values({
        roomId: NOTIFY_ROOM_FREE,
        userId: user2.user.id,
        title: 'No successor',
        startsAt: new Date(now.getTime() - 20 * 60_000),
        endsAt: new Date(now.getTime() + 8 * 60_000),
      });

      const notifications = app.get(NotificationsService);
      expect(await notifications.processDueNotifications()).toBe(0);
    });

    it('does not notify a booking ending far in the future', async () => {
      await db.insert(bookings).values({
        roomId: NOTIFY_ROOM_ID,
        userId: user1.user.id,
        title: 'Later today',
        startsAt: new Date(Date.now() + 60 * 60_000),
        endsAt: new Date(Date.now() + 90 * 60_000),
      });

      const notifications = app.get(NotificationsService);
      expect(await notifications.processDueNotifications()).toBe(0);
    });

    it('serves flagged, not-yet-ended bookings via GET /bookings/my/notifications', async () => {
      // The "exactly once" test above flagged user1's "Ending soon" booking.
      const mine = await request(app.getHttpServer())
        .get('/api/bookings/my/notifications')
        .set('Authorization', `Bearer ${user1.token}`)
        .expect(200);

      const items = mine.body as { bookingId: string; title: string; room: { name: string } }[];
      expect(items.map((item) => item.title)).toContain('Ending soon');
      expect(items.every((item) => typeof item.bookingId === 'string' && item.room.name)).toBe(
        true,
      );

      // user2's bookings were never flagged, so they see nothing.
      const other = await request(app.getHttpServer())
        .get('/api/bookings/my/notifications')
        .set('Authorization', `Bearer ${user2.token}`)
        .expect(200);
      expect(other.body).toEqual([]);
    });
  });

  describe('email confirmation', () => {
    let unconfirmed: AuthResponseDto;

    it('registers a new user as unconfirmed', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ name: 'Needs Confirm', email: 'confirm-me@office.dev', password: 'password123' })
        .expect(201);
      unconfirmed = response.body as AuthResponseDto;
      expect(unconfirmed.user.emailConfirmed).toBe(false);
    });

    it('blocks booking with 403 until the email is confirmed', async () => {
      await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Authorization', `Bearer ${unconfirmed.token}`)
        .send({ roomId: ROOM_ID, title: 'Too soon', startsAt: iso('16:00'), endsAt: iso('17:00') })
        .expect(403);
    });

    it('rejects an invalid confirmation token with 400', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/confirm')
        .send({ token: '00000000-0000-4000-8000-00000000badd' })
        .expect(400);
    });

    it('requires auth for GET /auth/me', async () => {
      await request(app.getHttpServer()).get('/api/auth/me').expect(401);
    });

    it('confirms via the logged token, reflects it on /auth/me, then allows booking', async () => {
      const row = await db.query.users.findFirst({ where: eq(users.id, unconfirmed.user.id) });
      expect(row?.emailConfirmToken).toBeTruthy();

      const confirmed = await request(app.getHttpServer())
        .post('/api/auth/confirm')
        .send({ token: row?.emailConfirmToken })
        .expect(200);
      expect((confirmed.body as UserDto).emailConfirmed).toBe(true);

      const me = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${unconfirmed.token}`)
        .expect(200);
      expect((me.body as UserDto).emailConfirmed).toBe(true);

      await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Authorization', `Bearer ${unconfirmed.token}`)
        .send({
          roomId: ROOM_ID,
          title: 'Now allowed',
          startsAt: iso('16:00'),
          endsAt: iso('17:00'),
        })
        .expect(201);
    });

    it('treats resend-confirmation as a no-op once confirmed (204)', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/resend-confirmation')
        .set('Authorization', `Bearer ${unconfirmed.token}`)
        .expect(204);
    });
  });

  describe('infrastructure endpoints', () => {
    it('serves /health without auth and without the /api prefix', async () => {
      const response = await request(app.getHttpServer()).get('/health').expect(200);
      expect(response.body).toEqual({ status: 'ok' });
    });

    it('serves Prometheus metrics without auth', async () => {
      const response = await request(app.getHttpServer()).get('/metrics').expect(200);
      expect(response.text).toContain('http_requests_total');
      expect(response.text).toContain('booking_conflicts_total');
      expect(response.text).toContain('booking_end_notifications_total');
    });
  });
});
