-- CreateEnum
CREATE TYPE "Role" AS ENUM ('customer', 'staff', 'admin', 'gym_partner', 'corporate_admin');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'customer',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_profiles" (
    "userId" TEXT NOT NULL,
    "age" INTEGER,
    "gender" TEXT,
    "heightCm" INTEGER,
    "weightKg" DOUBLE PRECISION,
    "activityLevel" TEXT,
    "goal" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_profiles_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- AddForeignKey
ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
