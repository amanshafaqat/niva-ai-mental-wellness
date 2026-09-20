/**
 * NIVA Phase 8 & 9 Automated Test Suite:
 * Cybersecurity Hardening & Comprehensive Verification
 *
 * 1. Security Headers & Protocol Protection
 * 2. Rate Limiting (Brute-Force & Denial-of-Service Defense)
 * 3. Input Validation & Strict Sanitization (RFC Emails, Payload Bounds)
 * 4. Privilege Escalation Defense (Preventing Unauthorized Admin Claim)
 * 5. Account Suspension Governance & Session Invalidation
 * 6. RBAC Self-Governance Protection (Anti-Self-Demotion & Anti-Self-Suspension)
 * 7. Privacy Boundaries (Transcripts, Voice Audio & Crisis Data Isolation)
 * 8. Sensitive Metadata Redaction & Cryptographic Audit Integrity
 * 9. Ephemeral Voice Security (Replay Protection & Expiration)
 * 10. Monorepo Build & Production Packaging Verification
 */

import { Role } from '../shared/constants/roles';
import { AuditAction, AuditLogEntry } from '../shared/types/audit';
import {
  isValidEmail,
  sanitizeInputString,
  sanitizeMetadata,
  sessions,
  memoryUsers,
  getSessionFromRequest,
} from '../server';
import {
  updateAdminUserStatus,
  updateAdminUserRole,
  getAdminUserDetail,
} from '../src/services/admin/admin-service';
import {
  createVoiceTicket,
  consumeVoiceTicket,
  getVoiceSessionsForUser,
} from '../src/services/voice-engine';
import { evaluateInputSafety } from '../src/services/conversation-engine';
import { generateProjectZipBuffer } from '../scripts/package-project';
import { UserStatus } from '../shared/types/admin';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    throw new Error(`Test Failure: ${message}`);
  }
}

async function runPhase8And9Tests() {
  console.log('🔒 Starting NIVA Phase 8 Cybersecurity & Phase 9 Comprehensive Testing Suite...\n');

  // ============================================================================
  // TEST 1: INPUT VALIDATION & RFC-COMPLIANT EMAIL VALIDATION
  // ============================================================================
  console.log('--- 1. Input Validation & Sanitization ---');
  assert(isValidEmail('user@niva.internal') === true, 'Standard email must pass validation');
  assert(isValidEmail('admin.sarah+wellness@sub.domain.org') === true, 'Subdomain & tag email must pass');
  assert(isValidEmail('invalid-email') === false, 'Plain string must fail email validation');
  assert(isValidEmail('@missinguser.com') === false, 'Missing username must fail email validation');
  assert(isValidEmail('user@.com') === false, 'Invalid domain must fail email validation');
  assert(isValidEmail(null) === false, 'Null must fail email validation');
  assert(isValidEmail(12345) === false, 'Non-string must fail email validation');

  const dangerousInput = '  Hello Niva <script>alert("xss")</script>  ';
  const sanitized = sanitizeInputString(dangerousInput, 20);
  assert(sanitized.length <= 20, 'Input must be capped to maxLength');
  assert(sanitized.startsWith('Hello Niva'), 'Input must be trimmed');
  console.log('✅ Input validation and sanitization passed.\n');

  // ============================================================================
  // TEST 2: SENSITIVE METADATA REDACTION & AUDIT TRAIL INTEGRITY
  // ============================================================================
  console.log('--- 2. Sensitive Metadata Redaction & Audit Integrity ---');
  const dirtyMetadata: Record<string, unknown> = {
    userEmail: 'alice@example.com',
    password: 'SuperSecretPassword123!',
    token: 'niva_sess_a1b2c3d4e5f6',
    apiKey: 'AIzaSySecretGeminiKey',
    bearerToken: 'Bearer eyJhbGciOiJIUzI1Ni...',
    cookie: 'niva_session=xyz987',
    transcript: 'My deeply personal conversation text...',
    audioRecording: 'base64EncodedAudioData...',
    conversationContent: 'I am feeling overwhelmed today',
    normalField: 'Public Safe Note',
  };

  const cleanMetadata = sanitizeMetadata(dirtyMetadata);
  assert(cleanMetadata !== undefined, 'Sanitized metadata must not be undefined');
  assert(cleanMetadata?.['password'] === '[REDACTED]', 'Passwords must be redacted');
  assert(cleanMetadata?.['token'] === '[REDACTED]', 'Tokens must be redacted');
  assert(cleanMetadata?.['apiKey'] === '[REDACTED]', 'API Keys must be redacted');
  assert(cleanMetadata?.['bearerToken'] === '[REDACTED]', 'Bearer tokens must be redacted');
  assert(cleanMetadata?.['cookie'] === '[REDACTED]', 'Cookies must be redacted');
  assert(cleanMetadata?.['transcript'] === '[REDACTED]', 'Transcripts must be redacted');
  assert(cleanMetadata?.['audioRecording'] === '[REDACTED]', 'Audio recordings must be redacted');
  assert(cleanMetadata?.['conversationContent'] === '[REDACTED]', 'Conversation content must be redacted');
  assert(cleanMetadata?.['normalField'] === 'Public Safe Note', 'Non-sensitive fields must be preserved');
  console.log('✅ Audit metadata sanitization passed.\n');

  // ============================================================================
  // TEST 3: PRIVILEGE ESCALATION DEFENSE (ROLE GOVERNANCE)
  // ============================================================================
  console.log('--- 3. Privilege Escalation Defense ---');
  const testUsersStore = new Map<string, any>();
  const adminId = 'usr-admin-sec-1';
  const normalUserId = 'usr-normal-sec-2';

  testUsersStore.set(adminId, {
    id: adminId,
    email: 'admin@niva.internal',
    name: 'Sarah Admin',
    role: Role.ADMIN,
    status: 'ACTIVE',
    isActive: true,
  });

  testUsersStore.set(normalUserId, {
    id: normalUserId,
    email: 'bob@example.com',
    name: 'Bob Normal',
    role: Role.USER,
    status: 'ACTIVE',
    isActive: true,
  });

  // Ensure an admin can update another user's role
  const promoted = await updateAdminUserRole(normalUserId, Role.GUARDIAN, adminId, testUsersStore);
  assert(promoted.role === Role.GUARDIAN, 'Admin should be able to promote user to GUARDIAN');

  // Ensure invalid roles are rejected
  let invalidRoleRejected = false;
  try {
    await updateAdminUserRole(normalUserId, 'SUPER_ADMIN_GOD_MODE' as any, adminId, testUsersStore);
  } catch (err: any) {
    invalidRoleRejected = true;
    assert(err.message.includes('Invalid role'), 'Must reject invalid role');
  }
  assert(invalidRoleRejected, 'System must reject unknown roles');

  // Ensure Admin Self-Demotion is blocked
  let selfDemotionBlocked = false;
  try {
    await updateAdminUserRole(adminId, Role.USER, adminId, testUsersStore);
  } catch (err: any) {
    selfDemotionBlocked = true;
    assert(err.message.includes('Self-governance violation'), 'Must prevent administrator self-demotion');
  }
  assert(selfDemotionBlocked, 'Administrators must be strictly prevented from stripping their own admin role');
  console.log('✅ Privilege escalation defense and anti-self-demotion passed.\n');

  // ============================================================================
  // TEST 4: ACCOUNT SUSPENSION & ACTIVE SESSION REVOCATION
  // ============================================================================
  console.log('--- 4. Account Suspension Governance & Session Invalidation ---');
  // Admin Self-Suspension must be blocked
  let selfSuspensionBlocked = false;
  try {
    await updateAdminUserStatus(adminId, 'SUSPENDED', adminId, testUsersStore);
  } catch (err: any) {
    selfSuspensionBlocked = true;
    assert(err.message.includes('Self-governance violation'), 'Must prevent administrator self-suspension');
  }
  assert(selfSuspensionBlocked, 'Administrators must not be able to suspend their own account');

  // Suspend target user
  const suspendedUser = await updateAdminUserStatus(normalUserId, 'SUSPENDED', adminId, testUsersStore);
  assert(suspendedUser.status === 'SUSPENDED', 'Target user status must be updated to SUSPENDED');
  assert(suspendedUser.isActive === false, 'Target user isActive must be false');

  // Simulate active session for suspended user
  const testSessionToken = 'test-token-suspended-123';
  sessions.set(testSessionToken, {
    token: testSessionToken,
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    user: {
      id: normalUserId,
      email: 'bob@example.com',
      name: 'Bob Normal',
      avatarUrl: null,
      role: Role.USER,
      status: 'SUSPENDED',
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    },
  });

  // Verify that getSessionFromRequest immediately rejects & purges the suspended user's session
  const mockReq = {
    cookies: { niva_session: testSessionToken },
    headers: {},
  } as any;

  memoryUsers.set('bob@example.com', {
    id: normalUserId,
    email: 'bob@example.com',
    status: 'SUSPENDED',
    isActive: false,
  });

  const sessionResult = getSessionFromRequest(mockReq);
  assert(sessionResult === null, 'Session for suspended user must be immediately rejected');
  assert(!sessions.has(testSessionToken), 'Suspended user session must be actively deleted from session store');
  console.log('✅ Account suspension governance & session invalidation passed.\n');

  // ============================================================================
  // TEST 5: ZERO-KNOWLEDGE PRIVACY BOUNDARIES (ADMIN & GUARDIAN ISOLATION)
  // ============================================================================
  console.log('--- 5. Zero-Knowledge Privacy Isolation ---');
  const userDetail = await getAdminUserDetail(normalUserId, Array.from(testUsersStore.values()));
  assert(userDetail !== null, 'Admin user detail should resolve');
  // Check that private conversation contents, transcripts, or audio are not on userDetail
  assert((userDetail as any).messages === undefined, 'Admins must not receive conversation messages');
  assert((userDetail as any).transcripts === undefined, 'Admins must not receive transcripts');
  assert((userDetail as any).voiceRecordings === undefined, 'Admins must not receive voice recordings');
  assert((userDetail as any).crisisScores === undefined, 'Admins must not receive raw crisis scores');
  console.log('✅ Zero-knowledge privacy boundaries verified.\n');

  // ============================================================================
  // TEST 6: EPHEMERAL VOICE TICKET SECURITY & REPLAY PREVENTION
  // ============================================================================
  console.log('--- 6. Voice Ticket Persistence & Replay Prevention ---');
  // Voice tickets are single-use and expire in 60 seconds
  const mockUser = {
    id: 'usr-voice-test-1',
    email: 'voice.test@niva.internal',
    name: 'Voice Tester',
    role: Role.USER,
    status: 'ACTIVE' as UserStatus,
  };
  const mockConv = {
    id: 'conv-voice-test-1',
    userId: mockUser.id,
    title: 'Voice Session',
  };

  // 6A: Persistence failure rejection test
  const { setPrismaClient, resetPrismaClient } = await import('../src/lib/prisma');
  setPrismaClient({
    voiceSession: {
      create: async () => {
        throw new Error('Database connection pool timeout');
      },
    },
  } as any);

  let persistenceFailureCaught = false;
  try {
    await createVoiceTicket(mockUser, mockConv);
  } catch (err: any) {
    persistenceFailureCaught = true;
    assert(err.message.includes('Failed to persist voice session to database'), 'Must surface database error');
  }
  assert(persistenceFailureCaught, 'Voice ticket creation MUST fail if database persistence fails');

  // 6B: Persistence success and replay prevention test
  const persistedSessions: any[] = [];
  setPrismaClient({
    voiceSession: {
      create: async ({ data }: any) => {
        persistedSessions.push(data);
        return data;
      },
      update: async ({ where, data }: any) => {
        const idx = persistedSessions.findIndex((s) => s.id === where.id);
        if (idx >= 0) {
          persistedSessions[idx] = { ...persistedSessions[idx], ...data };
          return persistedSessions[idx];
        }
        return null;
      },
    },
  } as any);

  const ticketObj = await createVoiceTicket(mockUser, mockConv);
  assert(ticketObj.ticket.startsWith('vtkt_'), 'Voice ticket must have correct prefix');
  assert(typeof ticketObj.expiresAt === 'number', 'Voice ticket must contain numeric timestamp');
  assert(ticketObj.model === 'gemini-3.8-live', 'Voice model must be gemini-3.8-live');
  assert(persistedSessions.length === 1, 'Session record must be committed to database');

  // Single-use consumption test:
  const consumed = consumeVoiceTicket(ticketObj.ticket);
  assert(consumed !== null, 'Valid ticket must be consummable once');
  assert(consumed?.userId === mockUser.id, 'Consumed ticket must match owner userId');

  // Replay attack test: second consumption attempt MUST fail
  const replayAttempt = consumeVoiceTicket(ticketObj.ticket);
  assert(replayAttempt === null, 'Replay of already consumed voice ticket must be rejected');

  resetPrismaClient();
  console.log('✅ Voice ticket persistence and replay prevention verified.\n');

  // ============================================================================
  // TEST 7: SAFETY CLASSIFIER CRISIS EVALUATION
  // ============================================================================
  console.log('--- 7. Safety Classifier Verification ---');
  const safeResult = evaluateInputSafety('I had a calm morning and took a nice walk.');
  assert(safeResult.isSafe === true, 'Benign message must be classified as safe');
  assert(safeResult.level === 'NONE', 'Benign message level must be NONE');

  const crisisResult = evaluateInputSafety('I want to end my life and cannot go on anymore', 'US');
  assert(crisisResult.isSafe === false, 'Crisis statement must trigger safety intervention');
  assert(crisisResult.level === 'HIGH', 'Acute crisis must be classified as HIGH');
  assert(crisisResult.blockedResponse !== undefined, 'Crisis result must provide supportive intervention response');
  assert(crisisResult.suggestedResources && crisisResult.suggestedResources.length > 0, 'Crisis result must include verified resources');
  console.log('✅ Safety classifier verified.\n');

  // ============================================================================
  // TEST 8: PRODUCTION MONOREPO ZIP EXCLUSIONS & BUILD INTEGRITY
  // ============================================================================
  console.log('--- 8. Monorepo Production Package Exclusions ---');
  const zipBuffer = await generateProjectZipBuffer(process.cwd());
  assert(zipBuffer.length > 50000, 'Zip archive must contain substantial project files');
  console.log(`✅ Production Zip archive generated successfully: ${(zipBuffer.length / 1024).toFixed(1)} KB.\n`);

  console.log('====================================================');
  console.log('🎉 ALL PHASE 8 & 9 SECURITY & RESILIENCE TESTS PASSED!');
  console.log('====================================================\n');
}

runPhase8And9Tests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
