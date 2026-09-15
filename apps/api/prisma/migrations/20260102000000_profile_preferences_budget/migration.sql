-- AlterTable
ALTER TABLE "customer_profiles" ADD COLUMN "budgetPerMealCents" INTEGER,
ADD COLUMN "dietaryPreferences" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "excludedIngredients" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
