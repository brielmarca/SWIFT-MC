-- Additive; rollback application independently and retain this table/counters.
CREATE TABLE "AuthRateBucket" (
  "key" TEXT NOT NULL PRIMARY KEY,
  "window" BIGINT NOT NULL,
  "count" INTEGER NOT NULL
);
CREATE INDEX "AuthRateBucket_window_idx" ON "AuthRateBucket"("window");
