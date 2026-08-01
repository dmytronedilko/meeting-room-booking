-- Weekly recurring bookings: occurrences created together share a seriesId.
-- End-of-booking notifications: endNotifiedAt records when the scheduler
-- notified a booking, so it is never notified twice.

ALTER TABLE "Booking" ADD COLUMN "seriesId" UUID;
ALTER TABLE "Booking" ADD COLUMN "endNotifiedAt" TIMESTAMPTZ(3);

CREATE INDEX "Booking_seriesId_idx" ON "Booking"("seriesId");
-- Supports the scheduler's "not yet notified and ending soon" scan.
CREATE INDEX "Booking_endNotifiedAt_endsAt_idx" ON "Booking"("endNotifiedAt", "endsAt");
