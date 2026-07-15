-- Persist visual layout model payload for round-trip hydration
ALTER TABLE "EmailLayout"
ADD COLUMN "layoutJson" TEXT NOT NULL DEFAULT '{}';
