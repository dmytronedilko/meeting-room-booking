-- Enforce case-insensitive email uniqueness at the database level.
--
-- The application always stores emails lowercased (RegisterDto normalizes with
-- trim + lowercase before the insert), so in practice lower(email) == email and
-- the existing case-sensitive "User_email_key" already prevents duplicates. This
-- functional unique index makes the guarantee hold even for a direct/raw INSERT
-- that bypassed the application normalization — the DB, not just the app layer,
-- now rejects "Ivan@x.com" when "ivan@x.com" already exists.
--
-- Kept as a raw-SQL migration (like the btree_gist EXCLUDE constraint) because
-- Prisma's schema cannot model a unique index over an expression.

CREATE UNIQUE INDEX "User_email_lower_key" ON "User" (lower(email));
