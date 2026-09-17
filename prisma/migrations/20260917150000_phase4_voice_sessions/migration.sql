-- ==============================================================================
-- NIVA Database Migration: 20260917150000_phase4_voice_sessions
-- Phase 4: Realtime Voice-to-Voice AI Agent
-- Adds voice_sessions table and foreign keys to users & conversations
-- ==============================================================================

-- CreateTable
CREATE TABLE "voice_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'INITIALIZING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "voice_sessions_userId_idx" ON "voice_sessions"("userId");

-- CreateIndex
CREATE INDEX "voice_sessions_conversationId_idx" ON "voice_sessions"("conversationId");

-- CreateIndex
CREATE INDEX "voice_sessions_status_idx" ON "voice_sessions"("status");

-- AddForeignKey
ALTER TABLE "voice_sessions" ADD CONSTRAINT "voice_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_sessions" ADD CONSTRAINT "voice_sessions_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
