CREATE TABLE "Booking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"roomId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"title" varchar(100) NOT NULL,
	"startsAt" timestamp (3) with time zone NOT NULL,
	"endsAt" timestamp (3) with time zone NOT NULL,
	"createdAt" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"seriesId" uuid,
	"endNotifiedAt" timestamp (3) with time zone
);
--> statement-breakpoint
CREATE TABLE "Room" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"floor" integer NOT NULL,
	"capacity" integer NOT NULL,
	"createdAt" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "User" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"passwordHash" text NOT NULL,
	"createdAt" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"emailConfirmedAt" timestamp (3) with time zone,
	"emailConfirmToken" text
);
--> statement-breakpoint
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_roomId_Room_id_fk" FOREIGN KEY ("roomId") REFERENCES "public"."Room"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "Booking_roomId_startsAt_idx" ON "Booking" USING btree ("roomId","startsAt");--> statement-breakpoint
CREATE INDEX "Booking_userId_startsAt_idx" ON "Booking" USING btree ("userId","startsAt");--> statement-breakpoint
CREATE INDEX "Booking_seriesId_idx" ON "Booking" USING btree ("seriesId");--> statement-breakpoint
CREATE INDEX "Booking_endNotifiedAt_endsAt_idx" ON "Booking" USING btree ("endNotifiedAt","endsAt");--> statement-breakpoint
CREATE UNIQUE INDEX "Room_name_key" ON "Room" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "User_email_key" ON "User" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "User_emailConfirmToken_key" ON "User" USING btree ("emailConfirmToken");--> statement-breakpoint
CREATE UNIQUE INDEX "User_email_lower_key" ON "User" USING btree (lower("email"));