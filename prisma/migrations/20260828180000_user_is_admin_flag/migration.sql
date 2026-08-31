-- AlterTable
ALTER TABLE `User` ADD COLUMN `isAdmin` BOOLEAN NOT NULL DEFAULT false;

-- Data migration: preserve access for any account that currently has
-- Marketplace admin access via the old role === "super_admin" gate — the
-- new gate is this flag, checked independently of `role`. See
-- docs/admin/decisions/admin-flag-replaces-role-check.md.
UPDATE `User` SET `isAdmin` = true WHERE `role` = 'super_admin';
