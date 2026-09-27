CREATE TYPE "Fulfillment" AS ENUM ('store', 'gym');

CREATE TABLE "gyms" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "contactName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "discountPercent" INTEGER NOT NULL DEFAULT 0,
    "commissionPercent" INTEGER NOT NULL DEFAULT 0,
    "deliveryEnabled" BOOLEAN NOT NULL DEFAULT false,
    "deliveryNote" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "gyms_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "gym_qr_codes" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "scans" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "gym_qr_codes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "gym_qr_codes_code_key" ON "gym_qr_codes"("code");
CREATE INDEX "gym_qr_codes_gymId_idx" ON "gym_qr_codes"("gymId");
ALTER TABLE "gym_qr_codes" ADD CONSTRAINT "gym_qr_codes_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "gyms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "orders" ADD COLUMN "gymId" TEXT,
ADD COLUMN "gymQrCodeId" TEXT,
ADD COLUMN "gymDiscountCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "fulfillment" "Fulfillment" NOT NULL DEFAULT 'store';
CREATE INDEX "orders_gymId_createdAt_idx" ON "orders"("gymId", "createdAt");
ALTER TABLE "orders" ADD CONSTRAINT "orders_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "gyms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_gymQrCodeId_fkey" FOREIGN KEY ("gymQrCodeId") REFERENCES "gym_qr_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
