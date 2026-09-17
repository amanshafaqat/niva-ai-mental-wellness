-- ==============================================================================
-- NIVA Database Migration: 20260915100000_phase2_user_account_status
-- Phase 2 Authentication & User Identity
-- ==============================================================================

-- AlterTable
ALTER TABLE "users" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE';

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");
