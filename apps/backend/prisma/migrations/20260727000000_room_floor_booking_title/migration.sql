-- Room gains a floor; Booking gains a mandatory title (1-100 chars, enforced
-- in the API). Defaults backfill pre-existing rows, then are dropped so new
-- inserts must always provide the values explicitly.

ALTER TABLE "Room" ADD COLUMN "floor" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Room" ALTER COLUMN "floor" DROP DEFAULT;

ALTER TABLE "Booking" ADD COLUMN "title" VARCHAR(100) NOT NULL DEFAULT 'Meeting';
ALTER TABLE "Booking" ALTER COLUMN "title" DROP DEFAULT;

-- Supports the "My bookings" queries (per-user upcoming/past, time-ordered).
CREATE INDEX "Booking_userId_startsAt_idx" ON "Booking"("userId", "startsAt");
