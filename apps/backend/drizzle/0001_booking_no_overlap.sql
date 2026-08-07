-- Overlap protection at the database level.
-- Two bookings for the same room must never overlap in time; touching
-- boundaries (endsAt == startsAt) are allowed because tstzrange() produces
-- half-open ranges [start, end) by default.
--
-- Hand-written SQL (a Drizzle "custom" migration) because an EXCLUDE constraint
-- and the btree_gist extension can't be expressed in the Drizzle schema — the
-- same reason this lived in a raw-SQL migration under Prisma.

CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_no_overlap"
  EXCLUDE USING gist (
    "roomId" WITH =,
    tstzrange("startsAt", "endsAt") WITH &&
  );
