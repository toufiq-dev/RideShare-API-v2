-- Migration: Swap FAIR_GO and FAIR_ELITE enum values AND fare data
BEGIN;

-- Step 1: Add temporary enum value for swapping
ALTER TYPE "VehicleTypeNameBD" ADD VALUE IF NOT EXISTS 'FAIR_TEMP';

COMMIT;
BEGIN;

-- Step 2: Swap the enum names AND fare data using temporary storage
-- First, store the fare data for FAIR_GO in temporary columns
ALTER TABLE "VehicleTypeBD" 
  ADD COLUMN IF NOT EXISTS temp_baseFare DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS temp_perKmRate DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS temp_perMinRate DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS temp_minFare DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS temp_insuranceFee DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS temp_serialNumber INTEGER;

-- Store FAIR_GO data in temp columns
UPDATE "VehicleTypeBD" 
SET 
  temp_baseFare = "baseFare",
  temp_perKmRate = "perKmRate",
  temp_perMinRate = "perMinRate",
  temp_minFare = "minFare",
  temp_insuranceFee = "insuranceFee",
  temp_serialNumber = "serialNumber"
WHERE "name" = 'FAIR_GO';

COMMIT;
BEGIN;

-- Move FAIR_ELITE's fare data to FAIR_GO
UPDATE "VehicleTypeBD" AS vt_go
SET 
  "baseFare" = vt_elite."baseFare",
  "perKmRate" = vt_elite."perKmRate",
  "perMinRate" = vt_elite."perMinRate",
  "minFare" = vt_elite."minFare",
  "insuranceFee" = vt_elite."insuranceFee",
  "serialNumber" = vt_elite."serialNumber"
FROM "VehicleTypeBD" AS vt_elite
WHERE vt_go."name" = 'FAIR_GO' 
  AND vt_elite."name" = 'FAIR_ELITE';

COMMIT;
BEGIN;

-- Move temp (old FAIR_GO fare data) to FAIR_ELITE
UPDATE "VehicleTypeBD" AS vt_elite
SET 
  "baseFare" = vt_go.temp_baseFare,
  "perKmRate" = vt_go.temp_perKmRate,
  "perMinRate" = vt_go.temp_perMinRate,
  "minFare" = vt_go.temp_minFare,
  "insuranceFee" = vt_go.temp_insuranceFee,
  "serialNumber" = vt_go.temp_serialNumber
FROM "VehicleTypeBD" AS vt_go
WHERE vt_elite."name" = 'FAIR_ELITE'
  AND vt_go."name" = 'FAIR_GO';

COMMIT;
BEGIN;

-- Now swap the enum names
-- Move FAIR_GO to temp
UPDATE "VehicleTypeBD" 
SET "name" = 'FAIR_TEMP' 
WHERE "name" = 'FAIR_GO';

COMMIT;
BEGIN;

-- Move FAIR_ELITE to FAIR_GO
UPDATE "VehicleTypeBD" 
SET "name" = 'FAIR_GO' 
WHERE "name" = 'FAIR_ELITE';

COMMIT;
BEGIN;

-- Move temp (old FAIR_GO) to FAIR_ELITE
UPDATE "VehicleTypeBD" 
SET "name" = 'FAIR_ELITE' 
WHERE "name" = 'FAIR_TEMP';

-- Clean up temp columns
ALTER TABLE "VehicleTypeBD" 
  DROP COLUMN IF EXISTS temp_baseFare,
  DROP COLUMN IF EXISTS temp_perKmRate,
  DROP COLUMN IF EXISTS temp_perMinRate,
  DROP COLUMN IF EXISTS temp_minFare,
  DROP COLUMN IF EXISTS temp_insuranceFee,
  DROP COLUMN IF EXISTS temp_serialNumber;

-- Step 3: Recreate enum without FAIR_TEMP
CREATE TYPE "VehicleTypeNameBD_new" AS ENUM (
  'FAIR_BIKE',
  'FAIR_GO',
  'FAIR_ELITE',
  'FAIR_MAX',
  'FAIR_CNG'
);

-- Step 4: Alter table to use new enum
ALTER TABLE "VehicleTypeBD" 
  ALTER COLUMN "name" TYPE "VehicleTypeNameBD_new" 
  USING ("name"::text::"VehicleTypeNameBD_new");

-- Step 5: Replace enum
ALTER TYPE "VehicleTypeNameBD" RENAME TO "VehicleTypeNameBD_old";
ALTER TYPE "VehicleTypeNameBD_new" RENAME TO "VehicleTypeNameBD";
DROP TYPE "VehicleTypeNameBD_old";

COMMIT;