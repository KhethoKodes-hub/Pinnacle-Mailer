-- Add lockout tracking fields to User
ALTER TABLE "User" ADD COLUMN "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "lockedUntil" DATETIME;

-- SQLite enum values are text; this migration records audit action expansion:
-- AuditAction: +login_failed, +lockout
