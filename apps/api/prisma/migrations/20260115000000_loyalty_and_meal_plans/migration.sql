CREATE TYPE "LoyaltyEntryType" AS ENUM ('earn', 'redeem', 'reversal', 'adjustment');
CREATE TYPE "SubscriptionStatus" AS ENUM ('pending', 'active', 'cancelled');

CREATE TABLE "subscription_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "mealsPerPeriod" INTEGER NOT NULL,
    "periodDays" INTEGER NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "maxMealPriceCents" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'pending',
    "mealsRemaining" INTEGER NOT NULL DEFAULT 0,
    "currentPeriodEnd" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "lastPaidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "subscriptions_userId_idx" ON "subscriptions"("userId");
-- One open subscription per customer.
CREATE UNIQUE INDEX "subscriptions_one_open_per_user" ON "subscriptions"("userId") WHERE "status" IN ('pending', 'active');
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "orders" ADD COLUMN "subscriptionId" TEXT,
ADD COLUMN "subscriptionMeals" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "subscriptionCoveredCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "loyaltyPointsRedeemed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "loyaltyDiscountCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD CONSTRAINT "orders_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "loyalty_entries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "LoyaltyEntryType" NOT NULL,
    "points" INTEGER NOT NULL,
    "orderId" TEXT,
    "note" TEXT,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "loyalty_entries_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "loyalty_entries_orderId_type_key" ON "loyalty_entries"("orderId", "type");
CREATE INDEX "loyalty_entries_userId_createdAt_idx" ON "loyalty_entries"("userId", "createdAt");
ALTER TABLE "loyalty_entries" ADD CONSTRAINT "loyalty_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "loyalty_entries" ADD CONSTRAINT "loyalty_entries_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
