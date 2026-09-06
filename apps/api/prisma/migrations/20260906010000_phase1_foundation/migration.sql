CREATE TABLE "SystemEvent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "payload" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SystemEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SystemEvent_name_occurredAt_idx" ON "SystemEvent"("name", "occurredAt");
