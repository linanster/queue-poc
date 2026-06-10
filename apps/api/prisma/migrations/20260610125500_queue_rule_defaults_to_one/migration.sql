-- Set queue rule defaults to 1 minute for test convenience.
UPDATE "Store"
SET
  "readyTimeoutMinutes" = 1,
  "recallWindowMinutes" = 1,
  "servingAlertMinutes" = 1;

-- Keep future new stores consistent with test defaults.
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Store" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Shanghai',
    "staffCount" INTEGER NOT NULL DEFAULT 2,
    "readyTimeoutMinutes" INTEGER NOT NULL DEFAULT 1,
    "recallWindowMinutes" INTEGER NOT NULL DEFAULT 1,
    "servingAlertMinutes" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Store" ("id", "name", "timezone", "staffCount", "readyTimeoutMinutes", "recallWindowMinutes", "servingAlertMinutes", "createdAt")
SELECT "id", "name", "timezone", "staffCount", "readyTimeoutMinutes", "recallWindowMinutes", "servingAlertMinutes", "createdAt"
FROM "Store";
DROP TABLE "Store";
ALTER TABLE "new_Store" RENAME TO "Store";
PRAGMA foreign_keys=ON;
