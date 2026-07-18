-- CreateTable
CREATE TABLE "org_messages" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "org_messages_orgId_createdAt_idx" ON "org_messages"("orgId", "createdAt");

-- AddForeignKey
ALTER TABLE "org_messages" ADD CONSTRAINT "org_messages_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_messages" ADD CONSTRAINT "org_messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

