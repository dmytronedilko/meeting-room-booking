-- Overlap protection at the database level.
-- Two bookings for the same room must never overlap in time; touching
-- boundaries (endsAt == startsAt) are allowed because tstzrange() produces
-- half-open ranges [start, end) by default.

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_no_overlap"
  EXCLUDE USING gist (
    "roomId" WITH =,
    tstzrange("startsAt", "endsAt") WITH &&
  );
