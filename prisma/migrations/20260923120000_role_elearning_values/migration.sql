-- The E-Learning roles were added to `enum Role` in prisma/schema.prisma without a migration, so a database built
-- from prisma/migrations alone (a new developer's local DB, CI, a fresh staging DB) rejected every hod/dapu/dean/vc
-- user. IF NOT EXISTS makes this a no-op on any database that already has these values (e.g. one updated via
-- `prisma db push`).
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'hod';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'dapu';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'dean';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'vc';
