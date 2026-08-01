-- Runs once on first Postgres startup: creates the database used by the
-- backend integration tests, so dev mode needs zero manual DB steps.
CREATE DATABASE booking_test;
