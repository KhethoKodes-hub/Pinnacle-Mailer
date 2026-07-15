-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_UserRefreshSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    "replacedByTokenId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserRefreshSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_UserRefreshSession" ("createdAt", "expiresAt", "id", "replacedByTokenId", "revokedAt", "tokenHash", "updatedAt", "userId") SELECT "createdAt", "expiresAt", "id", "replacedByTokenId", "revokedAt", "tokenHash", "updatedAt", "userId" FROM "UserRefreshSession";
DROP TABLE "UserRefreshSession";
ALTER TABLE "new_UserRefreshSession" RENAME TO "UserRefreshSession";
CREATE INDEX "UserRefreshSession_userId_expiresAt_idx" ON "UserRefreshSession"("userId", "expiresAt");
CREATE INDEX "UserRefreshSession_revokedAt_idx" ON "UserRefreshSession"("revokedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
