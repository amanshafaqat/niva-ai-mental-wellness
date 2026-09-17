-- ==============================================================================
-- NIVA Database Migration: 20260915110000_oauth_token_minimization
-- Security Hardening: Token Minimization Principle (Phase 2.1)
-- Drops unused OAuth credential columns (accessToken, refreshToken, idToken)
-- ==============================================================================

-- AlterTable
ALTER TABLE "accounts" DROP COLUMN IF EXISTS "refreshToken",
DROP COLUMN IF EXISTS "accessToken",
DROP COLUMN IF EXISTS "expiresAt",
DROP COLUMN IF EXISTS "tokenType",
DROP COLUMN IF EXISTS "idToken",
DROP COLUMN IF EXISTS "sessionState";
