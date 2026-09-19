import React, { useState } from 'react';
import { FolderTree, Database, Cpu, ShieldCheck, Layers, GitBranch, Terminal } from 'lucide-react';

export const ArchitectureViewer: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'monorepo' | 'prisma' | 'ai' | 'guardian' | 'security'>('guardian');

  return (
    <div id="architecture-viewer-panel" className="rounded-2xl border border-stone-200 bg-white p-6 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold text-stone-900 flex items-center gap-2">
            <Layers className="h-5 w-5 text-emerald-800" />
            <span>NIVA Architecture & Technical Blueprint</span>
          </h3>
          <p className="mt-1 text-xs text-stone-600">
            Phase 6: Next.js + PostgreSQL + Prisma ORM + Real Google OAuth + Gemini Live Voice + Crisis Registry + Consent-Driven Guardian System.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex flex-wrap rounded-xl border border-stone-200 bg-stone-50 p-1 text-xs font-semibold text-stone-700">
          <button
            onClick={() => setActiveTab('guardian')}
            className={`rounded-lg px-3 py-1.5 transition ${
              activeTab === 'guardian' ? 'bg-white text-stone-900 shadow-xs' : 'hover:text-stone-900'
            }`}
          >
            Guardian System (Phase 6)
          </button>
          <button
            onClick={() => setActiveTab('monorepo')}
            className={`rounded-lg px-3 py-1.5 transition ${
              activeTab === 'monorepo' ? 'bg-white text-stone-900 shadow-xs' : 'hover:text-stone-900'
            }`}
          >
            Directory Structure
          </button>
          <button
            onClick={() => setActiveTab('prisma')}
            className={`rounded-lg px-3 py-1.5 transition ${
              activeTab === 'prisma' ? 'bg-white text-stone-900 shadow-xs' : 'hover:text-stone-900'
            }`}
          >
            Prisma Schema
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            className={`rounded-lg px-3 py-1.5 transition ${
              activeTab === 'ai' ? 'bg-white text-stone-900 shadow-xs' : 'hover:text-stone-900'
            }`}
          >
            AI Provider Abstraction
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`rounded-lg px-3 py-1.5 transition ${
              activeTab === 'security' ? 'bg-white text-stone-900 shadow-xs' : 'hover:text-stone-900'
            }`}
          >
            Cybersecurity Baseline
          </button>
        </div>
      </div>

      <div className="mt-6">
        {activeTab === 'guardian' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-stone-200 bg-stone-50/50 p-4">
              <div className="flex items-center gap-2 font-semibold text-stone-900 text-sm mb-2">
                <ShieldCheck className="h-4 w-4 text-emerald-800" />
                <span>Phase 6: Guardian System Architecture & Zero-Surveillance Model</span>
              </div>
              <p className="text-xs text-stone-600 leading-relaxed mb-3">
                NIVA implements a consent-first, sovereign guardian architecture designed to provide trusted human
                support without surveillance, eavesdropping, or privacy erosion.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-stone-700">
                <div className="rounded-lg bg-white p-3 border border-stone-200">
                  <strong className="text-stone-900 block mb-1">1. Cryptographic Single-Use Invitations</strong>
                  Tokens are generated via 256-bit cryptographically secure entropy (<code className="font-mono text-emerald-800">crypto.randomBytes(32)</code>),
                  stored exclusively as salted SHA-256 hashes, with 7-day expiration and single-use replay defense.
                </div>
                <div className="rounded-lg bg-white p-3 border border-stone-200">
                  <strong className="text-stone-900 block mb-1">2. Strict Zero-Surveillance Boundary</strong>
                  Direct chat dialogues, voice audio, transcripts, and clinical crisis flags are strictly isolated and
                  never queried, stored, or exposed to guardian profiles.
                </div>
                <div className="rounded-lg bg-white p-3 border border-stone-200">
                  <strong className="text-stone-900 block mb-1">3. Sovereign Granular Opt-In Controls</strong>
                  Wards maintain real-time individual toggles for Activity Status, Wellness Streak Days, and Voluntary Mood.
                  All indicators default to completely hidden (<code className="font-mono text-emerald-800">null</code>).
                </div>
                <div className="rounded-lg bg-white p-3 border border-stone-200">
                  <strong className="text-stone-900 block mb-1">4. Instant Revocation & IDOR Protection</strong>
                  A ward can terminate a guardian relationship at any instant. Server-side authorization checks verify
                  ownership on every call to prevent Insecure Direct Object References (IDOR).
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'monorepo' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-stone-200 bg-stone-50/50 p-4">
                <div className="flex items-center gap-2 font-semibold text-stone-900 text-sm mb-2">
                  <FolderTree className="h-4 w-4 text-emerald-800" />
                  <span>/backend (NestJS REST API)</span>
                </div>
                <ul className="text-xs text-stone-600 space-y-1.5 list-disc list-inside">
                  <li><code className="font-mono text-stone-800">src/auth/</code>: Google OAuth verification, session tokens, signout</li>
                  <li><code className="font-mono text-stone-800">src/authorization/</code>: RBAC RolesGuard, @Roles decorator</li>
                  <li><code className="font-mono text-stone-800">src/users/</code>: Profile, role verification, directory endpoints</li>
                  <li><code className="font-mono text-stone-800">src/health/</code>: GET /health check, uptime & dependency checks</li>
                  <li><code className="font-mono text-stone-800">src/audit/</code>: Immutable security audit log service & controller</li>
                  <li><code className="font-mono text-stone-800">src/ai/</code>: Swappable AIProvider abstraction interface & stub</li>
                  <li><code className="font-mono text-stone-800">src/prisma/</code>: PrismaClient singleton lifecycle wrapper</li>
                </ul>
              </div>

              <div className="rounded-xl border border-stone-200 bg-stone-50/50 p-4">
                <div className="flex items-center gap-2 font-semibold text-stone-900 text-sm mb-2">
                  <FolderTree className="h-4 w-4 text-emerald-800" />
                  <span>/frontend (Next.js Modern UI)</span>
                </div>
                <ul className="text-xs text-stone-600 space-y-1.5 list-disc list-inside">
                  <li><code className="font-mono text-stone-800">src/app/</code>: Next.js Layout and Page routing</li>
                  <li><code className="font-mono text-stone-800">src/components/</code>: Accessible, calm, non-clinical wellness UI</li>
                  <li><code className="font-mono text-stone-800">src/lib/auth-context.tsx</code>: Session persistence & OAuth state</li>
                  <li><code className="font-mono text-stone-800">src/lib/api.ts</code>: Clean typed client API client</li>
                  <li><code className="font-mono text-stone-800">src/components/RoleTester.tsx</code>: Live interactive RBAC tester</li>
                </ul>
              </div>

              <div className="rounded-xl border border-stone-200 bg-stone-50/50 p-4">
                <div className="flex items-center gap-2 font-semibold text-stone-900 text-sm mb-2">
                  <Database className="h-4 w-4 text-emerald-800" />
                  <span>/prisma (PostgreSQL Database Layer)</span>
                </div>
                <ul className="text-xs text-stone-600 space-y-1.5 list-disc list-inside">
                  <li><code className="font-mono text-stone-800">schema.prisma</code>: User, Role enum, Account, Session, AuditLog</li>
                  <li><code className="font-mono text-stone-800">migrations/</code>: PostgreSQL DDL migration scripts</li>
                  <li><code className="font-mono text-stone-800">seed.ts</code>: Safe system admin seed (no passwords)</li>
                </ul>
              </div>

              <div className="rounded-xl border border-stone-200 bg-stone-50/50 p-4">
                <div className="flex items-center gap-2 font-semibold text-stone-900 text-sm mb-2">
                  <GitBranch className="h-4 w-4 text-emerald-800" />
                  <span>/shared (Shared Contracts)</span>
                </div>
                <ul className="text-xs text-stone-600 space-y-1.5 list-disc list-inside">
                  <li><code className="font-mono text-stone-800">constants/roles.ts</code>: USER, GUARDIAN, ADMIN definitions</li>
                  <li><code className="font-mono text-stone-800">types/user.ts</code> & <code className="font-mono text-stone-800">auth.ts</code>: Shared DTOs</li>
                  <li><code className="font-mono text-stone-800">types/ai.ts</code>: AIProvider, AIMessage, SafetyEvaluation</li>
                  <li><code className="font-mono text-stone-800">types/audit.ts</code>: AuditAction and event payload types</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'prisma' && (
          <div className="rounded-xl bg-stone-900 p-4 text-stone-200 text-xs font-mono overflow-x-auto leading-relaxed max-h-96">
            <pre>{`// NIVA Prisma Schema (Phase 4.1 Schema)
enum Role {
  USER       // Primary end-user
  GUARDIAN   // Authorized contact with consent-gated oversight
  ADMIN      // Platform governance & compliance administrator
}

model User {
  id            String      @id @default(uuid())
  email         String      @unique
  emailVerified DateTime?
  name          String?
  avatarUrl     String?
  role          Role        @default(USER)
  status        String      @default("ACTIVE")
  isActive      Boolean     @default(true)
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
  lastLoginAt   DateTime?

  accounts      Account[]
  sessions      Session[]
  auditLogs     AuditLog[]
  // Future: WellnessProfile, Conversations, SafetyEvents, GuardianLinks
}

model Account {
  id                 String   @id @default(uuid())
  userId             String
  provider           String   // e.g. "google"
  providerAccountId  String
  user               User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([provider, providerAccountId])
}

model Session {
  id           String    @id @default(uuid())
  sessionToken String    @unique
  userId       String
  expires      DateTime
  user         User      @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model AuditLog {
  id          String    @id @default(uuid())
  userId      String?
  action      String    // e.g. "USER_LOGIN_SUCCESS", "RBAC_ACCESS_DENIED"
  metadata    Json?
  timestamp   DateTime  @default(now())
  user        User?     @relation(fields: [userId], references: [id], onDelete: SetNull)
}`}</pre>
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="rounded-xl bg-stone-900 p-4 text-stone-200 text-xs font-mono overflow-x-auto leading-relaxed max-h-96">
            <pre>{`/**
 * AIProvider Contract: Decouples NIVA from model vendors.
 * Ready for Phase 2 (Text Conversational Engine) and Phase 3 (Realtime Voice).
 */
export interface AIProvider {
  readonly providerName: string;
  readonly providerVersion: string;

  // Phase 2: Conversational support
  generateResponse(
    messages: AIMessage[],
    context: AIConversationContext,
  ): Promise<AITextResponse>;

  // Phase 3: Ephemeral voice session token provisioning
  createRealtimeVoiceSession?(
    userId: string,
    context: AIConversationContext,
  ): Promise<AIVoiceSessionToken>;

  // Dedicated crisis/safety detector
  evaluateSafety(
    text: string,
    context?: AIConversationContext,
  ): Promise<AISafetyEvaluation>;

  // Health and latency telemetry
  checkHealth(): Promise<{ status: 'ready' | 'degraded' | 'unavailable'; latencyMs: number }>;
}`}</pre>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="space-y-3 text-xs text-stone-700">
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
              <h4 className="font-semibold text-stone-900 text-sm mb-1 flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-800" />
                <span>Cybersecurity Portfolio Controls</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                <div>
                  <strong>No Plaintext Passwords:</strong> Authentication is handled exclusively through federated Google OAuth 2.0 with cryptographically generated session tokens.
                </div>
                <div>
                  <strong>Server-Side Authorization (RBAC):</strong> Role checks are executed server-side via NestJS <code className="font-mono bg-stone-200/70 px-1 py-0.5 rounded text-stone-800">RolesGuard</code>, never trusting client state.
                </div>
                <div>
                  <strong>Audit Logging:</strong> All login events, failed access checks, and role changes are recorded in the immutable <code className="font-mono bg-stone-200/70 px-1 py-0.5 rounded text-stone-800">AuditLog</code> model.
                </div>
                <div>
                  <strong>Sanitized Error Responses:</strong> The global <code className="font-mono bg-stone-200/70 px-1 py-0.5 rounded text-stone-800">HttpExceptionFilter</code> strips database errors, stack traces, and internal secrets before returning responses.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
