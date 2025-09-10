-- CreateTable
CREATE TABLE "Tariff" (
    "id" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "intercity" BOOLEAN NOT NULL DEFAULT false,
    "vehicleTypeBDId" TEXT NOT NULL,
    "baseFare" DECIMAL(10,2) NOT NULL,
    "perKmRate" DECIMAL(10,2) NOT NULL,
    "perMinRate" DECIMAL(10,2) NOT NULL,
    "minFare" DECIMAL(10,2) NOT NULL,
    "insuranceFee" DECIMAL(10,2) NOT NULL,
    "pickupFee" DECIMAL(10,2),
    "pickupActive" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "effectiveFrom" TIMESTAMPTZ NOT NULL,
    "effectiveTo" TIMESTAMPTZ,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Tariff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Tariff_city_intercity_vehicleTypeBDId_isActive_idx" ON "Tariff"("city", "intercity", "vehicleTypeBDId", "isActive");

-- AddForeignKey
ALTER TABLE "Tariff" ADD CONSTRAINT "Tariff_vehicleTypeBDId_fkey" FOREIGN KEY ("vehicleTypeBDId") REFERENCES "VehicleTypeBD"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
