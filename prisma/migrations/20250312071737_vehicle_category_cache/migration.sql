-- CreateTable
CREATE TABLE "VehicleClassificationCache" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "class" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "bodyType" TEXT,
    "vehicleCategory" TEXT,
    "seatCapacity" TEXT,
    "permitType" TEXT,
    "isCommercial" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleClassificationCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VehicleClassificationCache_class_manufacturer_model_bodyTyp_key" ON "VehicleClassificationCache"("class", "manufacturer", "model", "bodyType", "vehicleCategory", "seatCapacity", "permitType", "isCommercial");
