-- Dev-mode email confirmation: users start unconfirmed; a confirmation token is
-- logged (no real SMTP) and cleared once the emailed link is opened. Booking
-- creation is blocked (403) while emailConfirmedAt is null.

ALTER TABLE "User" ADD COLUMN "emailConfirmedAt" TIMESTAMPTZ(3);
ALTER TABLE "User" ADD COLUMN "emailConfirmToken" TEXT;

CREATE UNIQUE INDEX "User_emailConfirmToken_key" ON "User"("emailConfirmToken");
