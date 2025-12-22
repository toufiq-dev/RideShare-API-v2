-- Migration: Rename FAIR_PRIME to FAIR_GO and FAIR_PLUS to FAIR_ELITE
BEGIN;

-- Step 1: Add the new enum values (if they don't already exist)
ALTER TYPE "VehicleTypeNameBD" ADD VALUE IF NOT EXISTS 'FAIR_GO';

COMMIT;

BEGIN;
ALTER TYPE "VehicleTypeNameBD" ADD VALUE IF NOT EXISTS 'FAIR_ELITE';

COMMIT;

BEGIN;
-- Step 2: Update existing data in VehicleTypeBD table
-- Update FAIR_PRIME to FAIR_GO
UPDATE "VehicleTypeBD" 
SET "name" = 'FAIR_GO' 
WHERE "name" = 'FAIR_PRIME';

-- Update FAIR_PLUS to FAIR_ELITE
UPDATE "VehicleTypeBD" 
SET "name" = 'FAIR_ELITE' 
WHERE "name" = 'FAIR_PLUS';

-- Step 3: Create new enum type without the old values
CREATE TYPE "VehicleTypeNameBD_new" AS ENUM (
  'FAIR_BIKE',
  'FAIR_GO',
  'FAIR_ELITE',
  'FAIR_MAX',
  'FAIR_CNG'
);

-- Step 4: Alter the VehicleTypeBD table to use the new enum
ALTER TABLE "VehicleTypeBD" 
  ALTER COLUMN "name" TYPE "VehicleTypeNameBD_new" 
  USING ("name"::text::"VehicleTypeNameBD_new");

-- Step 5: Replace the old enum with the new one
ALTER TYPE "VehicleTypeNameBD" RENAME TO "VehicleTypeNameBD_old";
ALTER TYPE "VehicleTypeNameBD_new" RENAME TO "VehicleTypeNameBD";
DROP TYPE "VehicleTypeNameBD_old";

COMMIT;