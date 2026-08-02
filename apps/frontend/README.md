# Frontend — Next.js App Router

The booking UI: room list, per-room week schedule with a 30-minute grid,
titled bookings, a "My bookings" page, booking and cancellation dialogs,
light/dark themes. Talks to the backend exclusively through the typed API
client; all request/response types come from `@office/shared` — no DTO
duplication.

## Pages

| Route | Purpose |
| --- | --- |
| `/login`, `/register` | Auth forms (react-hook-form + zod, server errors shown inline and as toasts) |
| `/` | Room cards (name, floor, capacity) with navigation to schedules |
| `/rooms/[id]` | Week schedule: ← → week navigation, calendar picker, 7-day × 09:00–19:00 custom grid; `?date=` deep-links to a week |
| `/bookings` | My bookings: upcoming (nearest first, cancellable) and past (most recent first, "Load more" pagination); rows link to the room's week |

Route groups: `(auth)` — public pages with a centered layout; `(app)` —
protected pages with the app header. Protection is server-side:
`src/middleware.ts` inspects the session cookie on every request and
redirects anonymous users to `/login` (and authenticated users away from the
auth pages) before anything renders.

## Structure

```
src/
  middleware.ts         # server-side auth guard (cookie check + JWT exp)
  app/                  # App Router: layouts, pages, providers, globals.css
  components/
    ui/                 # shadcn/ui components generated into the repo
    schedule/           # schedule-grid (week), booking-dialog, booking-block, date-nav (week nav)
    header.tsx, theme-toggle.tsx, notifications-bell.tsx
  lib/
    api.ts              # typed fetch client (base URL from NEXT_PUBLIC_API_URL)
    auth.ts             # JWT + user persistence (localStorage)
    hooks.ts            # TanStack Query hooks + mutations with toasts
    schedule.ts         # pure schedule math (slots, weeks, segments, now-line) — unit-tested
    timezone.ts         # viewer browser time-zone hook + label helper
    utils.ts            # cn()
```

## Behavior notes

- **Schedule grid.** A custom CSS-grid week view (Mon–Sun columns, no
  calendar library): each day is split into segments — free 30-minute slots
  (clickable, open the booking `Dialog` with a mandatory title and a duration
  select capped by the next booking / end of day / 4-hour limit) and booked
  blocks showing title, time and author. Own bookings are accent-colored with
  a cancel button behind an `AlertDialog` confirmation; other people's
  bookings are neutral and expose no actions. Past slots are dimmed and
  disabled; today's column shows a red current-time line, refreshed every
  minute.
- **Time zone.** The office zone is **Europe/Kyiv**, but every displayed time is
  rendered in the **visitor's own browser zone** (`useUserTimeZone()` reads
  `Intl…resolvedOptions().timeZone`), so a 10:00 Kyiv slot shows as 09:00 for a
  Berlin visitor; the room header labels office hours and, when the viewer's zone
  differs, notes that times are shown in their zone. The grid *structure* (office
  days and 09:00–19:00 slots) stays in office time and validation happens
  server-side against office working hours. Conversions live in
  `lib/schedule.ts` / `lib/timezone.ts` (date-fns-tz).
- **Data fetching.** TanStack Query; the schedule refetches every 30 s and
  after every mutation — including failed ones, so a 409 lost race
  immediately shows the winner's booking. API errors surface as sonner
  toasts.
- **Auth.** The JWT lives in an HttpOnly cookie set by the backend — JS never
  touches it; every `fetch` runs with `credentials: 'include'` so the browser
  attaches it automatically (cross-origin in dev, same-origin in Docker).
  Route access is enforced in `src/middleware.ts` (server-side, before
  render): cookie presence plus a JWT `exp` check — signature verification is
  the backend's job, so a forged cookie fails on the first API call.
  localStorage caches only the non-sensitive user profile for the header
  greeting. Logout calls `POST /auth/logout` (only the server can clear an
  HttpOnly cookie). Any 401 from the API clears the cached profile and
  redirects to `/login`.
- **Theming.** `next-themes` with a header toggle; choice persists. shadcn
  CSS variables define the palette (indigo primary for "mine", neutral for
  others).
- **Loading/empty states.** Skeleton placeholders everywhere instead of
  spinners; explicit empty states for the room list, an empty week and the
  my-bookings lists.

## Configuration

| Variable | Dev | Docker |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001/api` | `/api` (baked at build time via build arg; same origin behind Traefik) |

## Running & testing

```bash
npx nx serve frontend    # dev server on :3000 (backend must run on :3001)
npx nx build frontend    # production build, standalone output for Docker
npx nx test frontend     # Vitest unit tests for lib/schedule.ts
npx nx lint frontend
```

The Docker image serves the Next standalone bundle (`node apps/frontend/server.js`)
on port 3000, reachable only through the Traefik proxy.
