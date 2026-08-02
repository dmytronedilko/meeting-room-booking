# API Reference

REST API for the Meeting Room Booking backend (NestJS 11, Fastify).

> 💡 **Interactive docs:** the live, always-current source of truth is **Swagger
> UI** at **`GET /api/docs`**. This page mirrors it for quick reference and links.

- [Conventions](#-conventions)
- [Authentication](#-authentication)
- [Errors](#-errors)
- [Rate limiting](#-rate-limiting)
- [Endpoint index](#-endpoint-index)
- [Auth endpoints](#-auth)
- [Rooms endpoints](#-rooms)
- [Bookings endpoints](#-bookings)
- [System endpoints](#-system)
- [Data models](#-data-models)

---

## 🌐 Conventions

| | |
| --- | --- |
| **Base URL (Docker)** | `http://localhost/api` (via Traefik) |
| **Base URL (dev)** | `http://localhost:3001/api` |
| **Global prefix** | `/api` — **except** `GET /health` and `GET /metrics` |
| **Content type** | `application/json` (request & response) |
| **Date-times** | ISO-8601 **UTC** strings, e.g. `2026-07-20T07:00:00.000Z`. Working hours are validated in office time (`Europe/Kyiv`); storage is UTC |
| **IDs** | UUID v4. Malformed path IDs are rejected with **400** (`ParseUUIDPipe`) |
| **Validation** | Request bodies/queries are validated (class-validator); failures return **400** |

## 🔐 Authentication

Auth is a **JWT**. On `register`/`login` the backend both returns the token in
the body **and** sets it as a session cookie:

```
Set-Cookie: token=<jwt>; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400
```

A protected endpoint accepts **either**:

- the **session cookie** (browser default — JS never sees the token), or
- an `Authorization: Bearer <jwt>` header (Swagger, curl, tests).

```bash
# Cookie-based (browser flow) — persist cookies to a jar
curl -c jar.txt -X POST http://localhost/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test1@office.dev","password":"password123"}'

curl -b jar.txt http://localhost/api/auth/me           # reuse the cookie

# Bearer-based
TOKEN=$(curl -s -X POST http://localhost/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test1@office.dev","password":"password123"}' | jq -r .token)
curl -H "Authorization: Bearer $TOKEN" http://localhost/api/auth/me
```

Missing/invalid/expired credentials on a protected route → **401**. Set
`COOKIE_SECURE=true` when serving over HTTPS (adds `Secure` to the cookie).

## ⚠️ Errors

Every error has the **same shape** (produced by the global exception filter):

```json
{
  "statusCode": 409,
  "message": "This slot overlaps an existing booking.",
  "error": "Conflict"
}
```

| Status | Meaning in this API |
| --- | --- |
| `400` | Validation failure / malformed UUID / bad date or range |
| `401` | Not authenticated (missing/invalid/expired token) |
| `403` | Authenticated but not allowed (not the owner; email not confirmed) |
| `404` | Resource not found (room / booking) |
| `409` | Conflict (email already taken; booking overlaps) |
| `429` | Rate limit exceeded (see below) |

## 🚦 Rate limiting

`/auth/*` is throttled — **10 requests / minute / IP** by default
(`THROTTLE_LIMIT` / `THROTTLE_TTL_MS`). Behind the proxy the client IP is taken
from `X-Forwarded-For` (`trust proxy`). Exceeding it returns **429**.

---

## 📇 Endpoint index

| Method & path | Auth | Summary |
| --- | :---: | --- |
| [`POST /api/auth/register`](#post-apiauthregister) | – | Create account, set session cookie |
| [`POST /api/auth/login`](#post-apiauthlogin) | – | Log in, set session cookie |
| [`POST /api/auth/logout`](#post-apiauthlogout) | – | Clear the session cookie |
| [`POST /api/auth/confirm`](#post-apiauthconfirm) | – | Confirm email with a token |
| [`POST /api/auth/resend-confirmation`](#post-apiauthresend-confirmation) | ✅ | Re-issue a confirmation link |
| [`GET /api/auth/me`](#get-apiauthme) | ✅ | Current user profile |
| [`GET /api/rooms`](#get-apirooms) | ✅ | List all rooms |
| [`GET /api/rooms/:id/bookings`](#get-apiroomsidbookings) | ✅ | A room's schedule for 1–7 days |
| [`POST /api/bookings`](#post-apibookings) | ✅ | Book a slot (optionally weekly) |
| [`GET /api/bookings/my/upcoming`](#get-apibookingsmyupcoming) | ✅ | Own upcoming bookings |
| [`GET /api/bookings/my/past`](#get-apibookingsmypast) | ✅ | Own past bookings (paginated) |
| [`GET /api/bookings/my/notifications`](#get-apibookingsmynotifications) | ✅ | Own active "ends soon" alerts |
| [`DELETE /api/bookings/:id`](#delete-apibookingsid) | ✅ | Cancel own booking / series |
| [`GET /health`](#get-health) | – | Liveness probe |
| [`GET /metrics`](#get-metrics) | – | Prometheus metrics |

✅ = requires the session cookie **or** a `Bearer` token.

---

## 🔑 Auth

### `POST /api/auth/register`

Create a new employee account. Sets the session cookie and returns the token +
user. A dev-mode confirmation link is written to the **server log**.

**Body**

| Field | Type | Rules |
| --- | --- | --- |
| `name` | string | trimmed, non-empty, ≤ 100 |
| `email` | string | valid email, normalized (lowercased/trimmed), ≤ 254, unique (case-insensitive) |
| `password` | string | 8–72 chars |

```json
// Request
{ "name": "Jane Doe", "email": "jane@office.dev", "password": "password123" }
```
```json
// 201 Created  (+ Set-Cookie: token=…)
{
  "token": "eyJhbGciOiJIUzI1NiIsIn…",
  "user": {
    "id": "1f0a…", "name": "Jane Doe", "email": "jane@office.dev",
    "createdAt": "2026-08-02T09:00:00.000Z", "emailConfirmed": false
  }
}
```

**Errors:** `400` invalid body · `409` email already taken · `429` rate limited.

---

### `POST /api/auth/login`

Exchange credentials for a session. Sets the cookie and returns the token + user.

**Body**

| Field | Type | Rules |
| --- | --- | --- |
| `email` | string | valid email (normalized) |
| `password` | string | non-empty |

```json
// Request
{ "email": "test1@office.dev", "password": "password123" }
```
```json
// 200 OK  (+ Set-Cookie: token=…)
{ "token": "eyJhbGciOiJ…", "user": { "id": "…", "name": "Test One", "email": "test1@office.dev", "createdAt": "…", "emailConfirmed": true } }
```

**Errors:** `401` invalid credentials · `429` rate limited.

---

### `POST /api/auth/logout`

Clears the session cookie. Safe to call when already logged out.

```
204 No Content   (+ Set-Cookie clearing `token`)
```

---

### `POST /api/auth/confirm`

Confirm an email address using the one-time token from the logged link. Returns
the updated user.

```json
// Request
{ "token": "0f3c9b7e-…" }
```
```json
// 200 OK
{ "id": "…", "name": "Jane Doe", "email": "jane@office.dev", "createdAt": "…", "emailConfirmed": true }
```

**Errors:** `400` invalid or already-used token.

---

### `POST /api/auth/resend-confirmation`

**Auth required.** Re-issues a fresh confirmation link (written to the server
log) for the current user. No-op if already confirmed.

```
204 No Content
```

---

### `GET /api/auth/me`

**Auth required.** The current user profile, reflecting live email-confirmation
state (poll this to drive the "confirm your email" banner).

```json
// 200 OK
{ "id": "…", "name": "Test One", "email": "test1@office.dev", "createdAt": "…", "emailConfirmed": true }
```

**Errors:** `401` not authenticated.

---

## 🚪 Rooms

### `GET /api/rooms`

**Auth required.** All meeting rooms (no room-management API — rooms come from
the seed).

```json
// 200 OK
[
  { "id": "…", "name": "Small",      "floor": 1, "capacity": 4,  "createdAt": "…" },
  { "id": "…", "name": "Boardroom",  "floor": 3, "capacity": 16, "createdAt": "…" }
]
```

---

### `GET /api/rooms/:id/bookings`

**Auth required.** A room's bookings across **1–7 office-time-zone days**
starting at `date`. Each booking carries `isMine` for the requesting user.

**Path params**

| Param | Type | Notes |
| --- | --- | --- |
| `id` | UUID | Room id (malformed → 400) |

**Query params**

| Param | Type | Default | Rules |
| --- | --- | --- | --- |
| `date` | string | — *(required)* | `YYYY-MM-DD`, first day of the range (office zone) |
| `days` | integer | `1` | 1–7 |

```bash
GET /api/rooms/2b1e…/bookings?date=2026-07-20&days=7
```
```json
// 200 OK
[
  {
    "id": "…", "roomId": "2b1e…", "title": "Sprint planning",
    "startsAt": "2026-07-20T07:00:00.000Z", "endsAt": "2026-07-20T08:00:00.000Z",
    "user": { "id": "…", "name": "Test One" },
    "isMine": true, "seriesId": null
  }
]
```

**Errors:** `400` bad `date`/`days` or malformed id · `404` room not found.

---

## 📅 Bookings

### `POST /api/bookings`

**Auth required. Requires a confirmed email.** Books a slot; optionally creates a
weekly series. All occurrences are inserted in **one transaction** (all-or-nothing).

**Body**

| Field | Type | Default | Rules |
| --- | --- | --- | --- |
| `roomId` | UUID | — | existing room |
| `title` | string | — | trimmed, 1–100 chars |
| `startsAt` | string | — | ISO-8601 UTC; on a 30-min grid |
| `endsAt` | string | — | ISO-8601 UTC; 30 min – 4 h after `startsAt`; same day |
| `repeatWeeks` | integer | `1` | 1–12; same office-zone weekday/time (DST-safe) |

> **Slot rules** (enforced in `booking-rules.ts`): working hours 09:00–19:00
> (office time), 30-minute grid, duration 30 min–4 h, no day-boundary crossing,
> no booking in the past. Overlaps are rejected by the DB exclusion constraint.

```json
// Request
{
  "roomId": "2b1e…",
  "title": "Sprint planning",
  "startsAt": "2026-07-20T07:00:00.000Z",
  "endsAt":   "2026-07-20T08:00:00.000Z",
  "repeatWeeks": 4
}
```
```json
// 201 Created
{
  "booking": {
    "id": "…", "roomId": "2b1e…", "title": "Sprint planning",
    "startsAt": "2026-07-20T07:00:00.000Z", "endsAt": "2026-07-20T08:00:00.000Z",
    "user": { "id": "…", "name": "Test One" },
    "isMine": true, "seriesId": "9c2f…"
  },
  "createdCount": 4
}
```

**Errors:** `400` rule violation · `403` email not confirmed · `404` room not
found · `409` slot overlaps an existing booking.

---

### `GET /api/bookings/my/upcoming`

**Auth required.** The current user's upcoming bookings, **nearest first**.

```json
// 200 OK
[
  {
    "id": "…", "title": "Sprint planning",
    "startsAt": "2026-07-20T07:00:00.000Z", "endsAt": "2026-07-20T08:00:00.000Z",
    "room": { "id": "2b1e…", "name": "Boardroom", "floor": 3 },
    "seriesId": "9c2f…"
  }
]
```

---

### `GET /api/bookings/my/past`

**Auth required.** The current user's past bookings, **most recent first**, paginated.

**Query params**

| Param | Type | Default | Rules |
| --- | --- | --- | --- |
| `offset` | integer | `0` | ≥ 0 |
| `limit` | integer | `10` | 1–50 |

```bash
GET /api/bookings/my/past?offset=0&limit=10
```
```json
// 200 OK
{
  "items": [
    {
      "id": "…", "title": "Retro",
      "startsAt": "2026-07-10T07:00:00.000Z", "endsAt": "2026-07-10T07:30:00.000Z",
      "room": { "id": "…", "name": "Small", "floor": 1 },
      "seriesId": null
    }
  ],
  "total": 42
}
```

---

### `GET /api/bookings/my/notifications`

**Auth required.** The current user's active **"ends soon"** alerts — their
not-yet-ended bookings the scheduler flagged because the room is needed right
after. Drives the in-app header bell.

```json
// 200 OK
[
  {
    "bookingId": "…", "title": "Sprint planning",
    "room": { "id": "2b1e…", "name": "Boardroom" },
    "endsAt": "2026-07-20T08:00:00.000Z"
  }
]
```

---

### `DELETE /api/bookings/:id`

**Auth required. Owner only.** Cancels a booking. Cancellation is physical
deletion (which is also why cancelling removes any pending "ends soon" match).

**Path params**

| Param | Type | Notes |
| --- | --- | --- |
| `id` | UUID | Booking id (malformed → 400) |

**Query params**

| Param | Type | Default | Rules |
| --- | --- | --- | --- |
| `scope` | string | `one` | `one` \| `series` — `series` cancels this **and every later occurrence** |

```bash
DELETE /api/bookings/7d9a…?scope=series
```
```
204 No Content
```

**Errors:** `403` not the owner · `404` booking not found.

---

## 🩺 System

> Served **without** the `/api` prefix and **without** authentication.

### `GET /health`

Liveness probe (used by Docker health checks).

```json
// 200 OK
{ "status": "ok" }
```

### `GET /metrics`

Prometheus exposition format (scraped by Prometheus every 10 s). Includes
`http_request_duration_seconds`, `http_requests_total`, the business counters
(`bookings_created_total`, `bookings_cancelled_total`, `booking_conflicts_total`,
`booking_end_notifications_total`), and default Node.js process metrics.

```
# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",route="/api/rooms",status="200"} 12
…
```

---

## 🧩 Data models

Canonical wire shapes (defined once in `libs/shared`, imported by both apps).
All date-times are ISO-8601 **UTC** strings.

```ts
interface UserDto {
  id: string; name: string; email: string;
  createdAt: string; emailConfirmed: boolean;
}

interface PublicUserDto { id: string; name: string; }  // exposed on others' bookings

interface RoomDto {
  id: string; name: string; floor: number; capacity: number; createdAt: string;
}

interface BookingDto {
  id: string; roomId: string; title: string;
  startsAt: string; endsAt: string;
  user: PublicUserDto;
  isMine: boolean;          // derived from the requester's JWT
  seriesId: string | null;  // set when part of a weekly series
}

interface MyBookingDto {    // "My bookings" list item
  id: string; title: string; startsAt: string; endsAt: string;
  room: { id: string; name: string; floor: number };
  seriesId: string | null;
}

interface PastBookingsPageDto { items: MyBookingDto[]; total: number; }

interface MyNotificationDto {
  bookingId: string; title: string;
  room: { id: string; name: string };
  endsAt: string;
}

interface AuthResponseDto { token: string; user: UserDto; }
interface CreateBookingResponse { booking: BookingDto; createdCount: number; }
interface ApiErrorResponse { statusCode: number; message: string; error: string; }
```

See also: **[Architecture](Architecture)** · **[Getting Started](Getting-Started)** · **[Home](Home)**
