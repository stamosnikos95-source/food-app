CREATE TABLE "recommendation_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "businessDate" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "shownAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "orderId" TEXT,
    "orderedAt" TIMESTAMP(3),
    CONSTRAINT "recommendation_events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "recommendation_events_userId_menuItemId_businessDate_key" ON "recommendation_events"("userId", "menuItemId", "businessDate");
CREATE INDEX "recommendation_events_businessDate_idx" ON "recommendation_events"("businessDate");
ALTER TABLE "recommendation_events" ADD CONSTRAINT "recommendation_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "recommendation_events" ADD CONSTRAINT "recommendation_events_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
