CREATE TYPE "ConversationType" AS ENUM ('DIRECT');
CREATE TYPE "MessageAttachmentType" AS ENUM ('IMAGE', 'FILE');
CREATE TYPE "MessageContextType" AS ENUM ('POST', 'SERVICE', 'PRODUCT');

CREATE TABLE "Conversation" (
  "id" TEXT NOT NULL,
  "type" "ConversationType" NOT NULL DEFAULT 'DIRECT',
  "directKey" TEXT,
  "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Conversation_direct_key_check" CHECK ("type" <> 'DIRECT' OR "directKey" IS NOT NULL)
);

CREATE TABLE "ConversationParticipant" (
  "conversationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastReadAt" TIMESTAMP(3),
  CONSTRAINT "ConversationParticipant_pkey" PRIMARY KEY ("conversationId", "userId")
);

CREATE TABLE "Message" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "text" TEXT,
  "attachmentType" "MessageAttachmentType",
  "attachmentStorageKey" TEXT,
  "attachmentFileName" TEXT,
  "attachmentMimeType" TEXT,
  "attachmentSizeBytes" INTEGER,
  "contextType" "MessageContextType",
  "contextId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Message_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Message_text_check" CHECK ("text" IS NULL OR char_length(btrim("text")) BETWEEN 1 AND 4000),
  CONSTRAINT "Message_attachment_size_check" CHECK ("attachmentSizeBytes" IS NULL OR "attachmentSizeBytes" > 0),
  CONSTRAINT "Message_context_pair_check" CHECK (("contextType" IS NULL AND "contextId" IS NULL) OR ("contextType" IS NOT NULL AND "contextId" IS NOT NULL)),
  CONSTRAINT "Message_attachment_pair_check" CHECK (("attachmentType" IS NULL AND "attachmentStorageKey" IS NULL) OR ("attachmentType" IS NOT NULL AND "attachmentStorageKey" IS NOT NULL)),
  CONSTRAINT "Message_content_check" CHECK ("text" IS NOT NULL OR "attachmentStorageKey" IS NOT NULL OR "contextType" IS NOT NULL)
);

CREATE UNIQUE INDEX "Conversation_directKey_key" ON "Conversation"("directKey");
CREATE INDEX "Conversation_type_lastActivityAt_idx" ON "Conversation"("type", "lastActivityAt");
CREATE INDEX "Conversation_lastActivityAt_idx" ON "Conversation"("lastActivityAt");
CREATE INDEX "ConversationParticipant_userId_conversationId_idx" ON "ConversationParticipant"("userId", "conversationId");
CREATE INDEX "ConversationParticipant_userId_lastReadAt_idx" ON "ConversationParticipant"("userId", "lastReadAt");
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");
CREATE INDEX "Message_senderId_createdAt_idx" ON "Message"("senderId", "createdAt");
CREATE INDEX "Message_contextType_contextId_idx" ON "Message"("contextType", "contextId");

ALTER TABLE "ConversationParticipant"
  ADD CONSTRAINT "ConversationParticipant_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationParticipant"
  ADD CONSTRAINT "ConversationParticipant_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Message"
  ADD CONSTRAINT "Message_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Message"
  ADD CONSTRAINT "Message_senderId_fkey"
  FOREIGN KEY ("senderId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Conversation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ConversationParticipant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Message" ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON TYPE "ConversationType" TO hustle_api;
GRANT USAGE ON TYPE "MessageAttachmentType" TO hustle_api;
GRANT USAGE ON TYPE "MessageContextType" TO hustle_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "Conversation" TO hustle_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "ConversationParticipant" TO hustle_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "Message" TO hustle_api;

CREATE POLICY "hustle_api_all_conversations" ON "Conversation" FOR ALL TO hustle_api USING (true) WITH CHECK (true);
CREATE POLICY "hustle_api_all_conversation_participants" ON "ConversationParticipant" FOR ALL TO hustle_api USING (true) WITH CHECK (true);
CREATE POLICY "hustle_api_all_messages" ON "Message" FOR ALL TO hustle_api USING (true) WITH CHECK (true);
