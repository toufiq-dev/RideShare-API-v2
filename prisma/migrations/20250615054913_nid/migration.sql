-- CreateTable
CREATE TABLE "Nid" (
    "pilotId" TEXT NOT NULL,
    "nidNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Nid_pkey" PRIMARY KEY ("pilotId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Nid_pilotId_key" ON "Nid"("pilotId");

-- CreateIndex
CREATE UNIQUE INDEX "Nid_nidNumber_key" ON "Nid"("nidNumber");

-- AddForeignKey
ALTER TABLE "Nid" ADD CONSTRAINT "Nid_pilotId_fkey" FOREIGN KEY ("pilotId") REFERENCES "Pilot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
