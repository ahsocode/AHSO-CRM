-- CreateTable
CREATE TABLE "EmailAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "imapHost" TEXT NOT NULL DEFAULT 'mail.ahso.vn',
    "imapPort" INTEGER NOT NULL DEFAULT 993,
    "imapSecure" BOOLEAN NOT NULL DEFAULT true,
    "smtpHost" TEXT NOT NULL DEFAULT 'mail.ahso.vn',
    "smtpPort" INTEGER NOT NULL DEFAULT 587,
    "password" TEXT NOT NULL,
    "lastSyncAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailMessage" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "uid" INTEGER NOT NULL,
    "folder" TEXT NOT NULL,
    "messageId" TEXT,
    "inReplyTo" TEXT,
    "fromName" TEXT,
    "fromEmail" TEXT NOT NULL,
    "toAddresses" JSONB NOT NULL,
    "ccAddresses" JSONB NOT NULL DEFAULT '[]',
    "bccAddresses" JSONB NOT NULL DEFAULT '[]',
    "subject" TEXT,
    "bodyText" TEXT,
    "bodyHtml" TEXT,
    "snippet" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isStarred" BOOLEAN NOT NULL DEFAULT false,
    "isDraft" BOOLEAN NOT NULL DEFAULT false,
    "hasAttachments" BOOLEAN NOT NULL DEFAULT false,
    "size" INTEGER NOT NULL DEFAULT 0,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "customerId" TEXT,

    CONSTRAINT "EmailMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailAttachment" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "filePath" TEXT,
    "cid" TEXT,

    CONSTRAINT "EmailAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailAccount_userId_key" ON "EmailAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailMessage_accountId_uid_folder_key" ON "EmailMessage"("accountId", "uid", "folder");

-- CreateIndex
CREATE INDEX "EmailMessage_accountId_folder_receivedAt_idx" ON "EmailMessage"("accountId", "folder", "receivedAt" DESC);

-- CreateIndex
CREATE INDEX "EmailMessage_customerId_idx" ON "EmailMessage"("customerId");

-- CreateIndex
CREATE INDEX "EmailMessage_fromEmail_idx" ON "EmailMessage"("fromEmail");

-- AddForeignKey
ALTER TABLE "EmailAccount" ADD CONSTRAINT "EmailAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "EmailAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailAttachment" ADD CONSTRAINT "EmailAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "EmailMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
